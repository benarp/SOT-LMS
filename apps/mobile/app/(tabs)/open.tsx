import { useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { fetchOpenAssignments, adjustOpenCount, type OpenWeek } from '../../lib/openAssignments'

const typeLabels: Record<string, string> = {
  bible_reading: 'Scripture Reading',
  book_reading: 'Book Reading',
  video: 'Video',
  book_reflection: 'Reflection',
  reflection: 'Reflection',
  written: 'Reflection',
}

export default function OpenAssignmentsScreen() {
  const router = useRouter()
  const [weeks, setWeeks] = useState<OpenWeek[]>([])
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const result = await fetchOpenAssignments()
    if (result) {
      setWeeks(result.weeks)
      setUserId(result.userId)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  // Refetch whenever the tab gains focus — completions made on other
  // screens must disappear from this list.
  useFocusEffect(useCallback(() => { load() }, [load]))

  async function completeItem(weekId: string, itemId: string, dueDate: string) {
    // Optimistic: remove from list immediately
    setWeeks(prev => prev
      .map(w => w.id === weekId ? { ...w, items: w.items.filter(i => i.id !== itemId) } : w)
      .filter(w => w.items.length > 0))
    adjustOpenCount(-1)

    const isLate = new Date() > new Date(dueDate)
    const { error } = await supabase.from('submissions').upsert({
      student_id: userId,
      homework_item_id: itemId,
      completed_at: new Date().toISOString(),
      is_late: isLate,
    }, { onConflict: 'student_id,homework_item_id' })

    if (error) {
      Alert.alert('Error', 'Could not save. Try again.')
      load()
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color="#111827" />
      </SafeAreaView>
    )
  }

  const totalOpen = weeks.reduce((sum, w) => sum + w.items.length, 0)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="#111827" />}
      >
        <Text style={styles.heading}>Open assignments</Text>
        <Text style={styles.subheading}>
          {totalOpen === 0
            ? 'Everything is complete. Well done!'
            : `${totalOpen} item${totalOpen !== 1 ? 's' : ''} still to finish`}
        </Text>

        {totalOpen === 0 ? (
          <View style={styles.allDoneBox}>
            <Text style={styles.allDoneEmoji}>🎉</Text>
            <Text style={styles.allDoneText}>You're all caught up</Text>
          </View>
        ) : (
          weeks.map(week => (
            <View key={week.id} style={styles.weekSection}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekLabel}>
                  Week {week.week_number} — {week.title}
                </Text>
                <Text style={[styles.weekDue, week.isPastDue && styles.weekOverdue]}>
                  {week.isPastDue ? 'Past due ' : 'Due '}
                  {new Date(week.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
              </View>
              <View style={styles.itemsList}>
                {week.items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.itemCard}
                    onPress={() => router.push(`/item/${item.id}`)}
                    activeOpacity={0.7}
                  >
                    <TouchableOpacity
                      style={styles.checkbox}
                      onPress={() => completeItem(week.id, item.id, week.due_date)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    />
                    <View style={styles.itemContent}>
                      <Text style={styles.itemType}>{typeLabels[item.type] || item.type}</Text>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 4 },
  subheading: { fontSize: 13, color: '#9ca3af', marginBottom: 20 },
  weekSection: { marginBottom: 24 },
  weekHeader: { marginBottom: 10 },
  weekLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 2 },
  weekDue: { fontSize: 12, color: '#9ca3af' },
  weekOverdue: { color: '#ef4444', fontWeight: '600' },
  itemsList: { gap: 8 },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#d1d5db',
    flexShrink: 0,
  },
  itemContent: { flex: 1 },
  itemType: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  chevron: { fontSize: 20, color: '#d1d5db', marginLeft: 4 },
  allDoneBox: { alignItems: 'center', marginTop: 60 },
  allDoneEmoji: { fontSize: 40, marginBottom: 10 },
  allDoneText: { fontSize: 15, fontWeight: '600', color: '#16a34a' },
})
