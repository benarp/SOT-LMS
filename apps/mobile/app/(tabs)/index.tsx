import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { adjustOpenCount } from '../../lib/openAssignments'

type HomeworkItem = {
  id: string
  type: string
  title: string
  description: string | null
  external_url: string | null
  sort_order: number
  completed: boolean
}

type Announcement = { id: string; title: string; body: string }

const typeLabels: Record<string, string> = {
  bible_reading: 'Scripture Reading',
  book_reading: 'Book Reading',
  video: 'Video',
  book_reflection: 'Reflection',
  reflection: 'Reflection',
  written: 'Reflection',
}

export default function ThisWeekScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [items, setItems] = useState<HomeworkItem[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [weekTitle, setWeekTitle] = useState('')
  const [weekNumber, setWeekNumber] = useState(0)
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [weekId, setWeekId] = useState('')
  const [userId, setUserId] = useState('')
  const [error, setError] = useState('')
  const [isAlumni, setIsAlumni] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: prof } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (prof?.role === 'alumni') {
      setIsAlumni(true)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const { data: schoolYear } = await supabase
      .from('school_years').select('id, name').eq('is_active', true).single()
    if (!schoolYear) { setError('No active school year.'); setLoading(false); return }

    const { data: week } = await supabase
      .from('weeks')
      .select('id, week_number, title, due_date')
      .eq('school_year_id', schoolYear.id)
      .gte('due_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('due_date', { ascending: true })
      .limit(1)
      .single()

    if (!week) { setError('No homework due this week.'); setLoading(false); return }
    setWeekTitle(week.title)
    setWeekNumber(week.week_number)
    setDueDate(new Date(week.due_date))
    setWeekId(week.id)

    const [{ data: hwItems }, { data: subs }, { data: ann }] = await Promise.all([
      supabase.from('homework_items').select('id, type, title, description, external_url, sort_order').eq('week_id', week.id).order('sort_order'),
      supabase.from('submissions').select('homework_item_id').eq('student_id', user.id),
      supabase.from('announcements').select('id, title, body').lte('publish_at', new Date().toISOString()).is('target_group_id', null).order('publish_at', { ascending: false }).limit(3),
    ])

    const submittedIds = new Set((subs || []).map(s => s.homework_item_id))
    setItems((hwItems || []).map(i => ({ ...i, completed: submittedIds.has(i.id) })))
    setAnnouncements(ann || [])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleItem(item: HomeworkItem) {
    const newCompleted = !item.completed
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, completed: newCompleted } : i))
    adjustOpenCount(newCompleted ? -1 : 1)

    if (newCompleted) {
      const due = dueDate ? new Date(dueDate) : new Date()
      const isLate = new Date() > due
      const { error } = await supabase.from('submissions').upsert({
        student_id: userId,
        homework_item_id: item.id,
        completed_at: new Date().toISOString(),
        is_late: isLate,
      }, { onConflict: 'student_id,homework_item_id' })
      if (error) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, completed: false } : i))
        adjustOpenCount(1)
        Alert.alert('Error', 'Could not save. Try again.')
      }
    } else {
      const { error } = await supabase.from('submissions')
        .delete()
        .eq('student_id', userId)
        .eq('homework_item_id', item.id)
      if (error) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, completed: true } : i))
        adjustOpenCount(-1)
        Alert.alert('Error', 'Could not save. Try again.')
      }
    }
  }


  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color="#111827" />
      </SafeAreaView>
    )
  }

  const completedCount = items.filter(i => i.completed).length
  const progress = items.length > 0 ? completedCount / items.length : 0
  const isOverdue = dueDate ? dueDate < new Date() : false

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#111827" />}
      >
        {/* Header */}
        <View style={styles.topRow}>
          <Text style={styles.schoolName}>School of Transformation</Text>
          <TouchableOpacity onPress={() => router.push('/account')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.signOut}>Account</Text>
          </TouchableOpacity>
        </View>

        {/* Announcements */}
        {announcements.map(a => (
          <View key={a.id} style={styles.announcement}>
            <Text style={styles.announcementTitle}>{a.title}</Text>
            <Text style={styles.announcementBody}>{a.body}</Text>
          </View>
        ))}

        {isAlumni ? (
          <View style={styles.alumniBox}>
            <Text style={styles.alumniEmoji}>🎓</Text>
            <Text style={styles.alumniTitle}>Your year is complete</Text>
            <Text style={styles.alumniText}>
              Thank you for being part of the School of Transformation. The reflections you wrote
              on each book are kept for you in the web portal.
            </Text>
          </View>
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : (
          <>
            {/* Week header */}
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>Week {weekNumber}</Text>
              <Text style={styles.weekTitle}>{weekTitle}</Text>
              <Text style={[styles.dueDate, isOverdue && styles.overdue]}>
                {isOverdue ? 'Overdue — ' : 'Due '}
                {dueDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
            </View>

            {/* Progress bar */}
            {items.length > 0 && (
              <View style={styles.progressSection}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>{completedCount} of {items.length} complete</Text>
                  {completedCount === items.length && <Text style={styles.allDone}>All done!</Text>}
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
              </View>
            )}

            {/* Homework items */}
            <View style={styles.itemsList}>
              {items.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.itemCard, item.completed && styles.itemCardDone]}
                  onPress={() => router.push(`/item/${item.id}`)}
                  activeOpacity={0.7}
                >
                  <TouchableOpacity
                    style={[styles.checkbox, item.completed && styles.checkboxDone]}
                    onPress={() => toggleItem(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {item.completed && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                  <View style={styles.itemContent}>
                    <Text style={styles.itemType}>{typeLabels[item.type] || item.type}</Text>
                    <Text style={[styles.itemTitle, item.completed && styles.itemTitleDone]}>
                      {item.title}
                    </Text>
                    {item.description ? (
                      <Text style={styles.itemDesc}>{item.description}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
              {items.length === 0 && <Text style={styles.empty}>No homework items yet.</Text>}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  schoolName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  signOut: { fontSize: 13, color: '#9ca3af' },
  announcement: {
    backgroundColor: '#eff6ff',
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  announcementTitle: { fontSize: 13, fontWeight: '600', color: '#1e40af', marginBottom: 3 },
  announcementBody: { fontSize: 13, color: '#1d4ed8', lineHeight: 18 },
  weekHeader: { marginBottom: 20 },
  weekLabel: { fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  weekTitle: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 4 },
  dueDate: { fontSize: 13, color: '#9ca3af' },
  overdue: { color: '#ef4444' },
  progressSection: { marginBottom: 20 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressText: { fontSize: 13, color: '#6b7280' },
  allDone: { fontSize: 13, fontWeight: '600', color: '#16a34a' },
  progressTrack: { height: 5, backgroundColor: '#e5e7eb', borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#111827', borderRadius: 99 },
  itemsList: { gap: 10 },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  itemCardDone: { borderColor: '#f3f4f6' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxDone: { backgroundColor: '#111827', borderColor: '#111827' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700', lineHeight: 14 },
  itemContent: { flex: 1 },
  itemType: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  itemTitleDone: { color: '#9ca3af', textDecorationLine: 'line-through' },
  itemDesc: { fontSize: 13, color: '#6b7280', marginTop: 3, lineHeight: 18 },
  chevron: { fontSize: 20, color: '#d1d5db', alignSelf: 'center', marginLeft: 4 },
  empty: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  alumniBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
  alumniEmoji: { fontSize: 44, marginBottom: 14 },
  alumniTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  alumniText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21 },
})
