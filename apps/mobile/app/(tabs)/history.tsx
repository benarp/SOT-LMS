import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

type Week = {
  id: string
  week_number: number
  title: string
  due_date: string
  completedCount: number
  totalCount: number
}

export default function HistoryScreen() {
  const [weeks, setWeeks] = useState<Week[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: schoolYear } = await supabase
      .from('school_years').select('id').eq('is_active', true).single()
    if (!schoolYear) { setLoading(false); return }

    const { data: allWeeks } = await supabase
      .from('weeks')
      .select('id, week_number, title, due_date')
      .eq('school_year_id', schoolYear.id)
      .lt('due_date', new Date().toISOString())
      .order('due_date', { ascending: false })

    if (!allWeeks || allWeeks.length === 0) { setLoading(false); setRefreshing(false); return }

    const weekIds = allWeeks.map(w => w.id)

    const [{ data: items }, { data: subs }] = await Promise.all([
      supabase.from('homework_items').select('id, week_id').in('week_id', weekIds),
      supabase.from('submissions').select('homework_item_id').eq('student_id', user.id),
    ])

    const submittedIds = new Set((subs || []).map(s => s.homework_item_id))
    const itemsByWeek = new Map<string, string[]>()
    for (const item of items || []) {
      if (!itemsByWeek.has(item.week_id)) itemsByWeek.set(item.week_id, [])
      itemsByWeek.get(item.week_id)!.push(item.id)
    }

    setWeeks(allWeeks.map(w => {
      const weekItems = itemsByWeek.get(w.id) || []
      const completedCount = weekItems.filter(id => submittedIds.has(id)).length
      return { ...w, completedCount, totalCount: weekItems.length }
    }))
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color="#111827" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#111827" />}
      >
        <Text style={styles.heading}>Previous weeks</Text>

        {weeks.length === 0 ? (
          <Text style={styles.empty}>No past weeks yet.</Text>
        ) : (
          <View style={styles.list}>
            {weeks.map(week => {
              const allDone = week.totalCount > 0 && week.completedCount === week.totalCount
              const pct = week.totalCount > 0 ? week.completedCount / week.totalCount : 0
              return (
                <TouchableOpacity
                  key={week.id}
                  style={styles.card}
                  onPress={() => router.push(`/week/${week.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardTop}>
                    {allDone ? (
                      <View style={styles.checkCircle}>
                        <Text style={styles.checkCircleMark}>✓</Text>
                      </View>
                    ) : (
                      <View style={styles.openCircle} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.weekLabel}>Week {week.week_number}</Text>
                      <Text style={styles.weekTitle}>{week.title}</Text>
                      <Text style={styles.dueDate}>
                        Due {new Date(week.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    <View style={styles.badge(allDone)}>
                      <Text style={styles.badgeText(allDone)}>
                        {allDone ? '✓ Complete' : `${week.completedCount}/${week.totalCount} done`}
                      </Text>
                    </View>
                  </View>
                  {week.totalCount > 0 && (
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 20 },
  list: { gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  weekLabel: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  weekTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 3 },
  dueDate: { fontSize: 12, color: '#9ca3af' },
  badge: (done: boolean) => ({
    backgroundColor: done ? '#f0fdf4' : '#fffbeb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: done ? '#bbf7d0' : '#fde68a',
    alignSelf: 'flex-start',
  }),
  badgeText: (done: boolean) => ({
    fontSize: 12,
    fontWeight: '600',
    color: done ? '#16a34a' : '#b45309',
  }),
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkCircleMark: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 15 },
  openCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fbbf24',
    marginTop: 2,
    flexShrink: 0,
  },
  progressTrack: { height: 4, backgroundColor: '#e5e7eb', borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#16a34a', borderRadius: 99 },
  empty: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 40 },
} as any)
