import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useTheme, type ThemeColors } from '../../lib/theme'

type Item = {
  id: string
  type: string
  title: string
  description: string | null
  sort_order: number
  completed: boolean
  is_late: boolean
  completed_at: string | null
}

const typeLabels: Record<string, string> = {
  bible_reading: 'Scripture Reading',
  book_reading: 'Book Reading',
  video: 'Video',
  reflection: 'Reflection',
}

export default function WeekDetailScreen() {
  const { weekId } = useLocalSearchParams<{ weekId: string }>()
  const [items, setItems] = useState<Item[]>([])
  const [weekTitle, setWeekTitle] = useState('')
  const [weekNumber, setWeekNumber] = useState(0)
  const [dueDate, setDueDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: week }, { data: hwItems }] = await Promise.all([
        supabase.from('weeks').select('id, week_number, title, due_date').eq('id', weekId).single(),
        supabase.from('homework_items').select('id, type, title, description, sort_order').eq('week_id', weekId).order('sort_order'),
      ])

      if (!week) { setLoading(false); return }
      setWeekTitle(week.title)
      setWeekNumber(week.week_number)
      setDueDate(new Date(week.due_date))

      const itemIds = (hwItems || []).map(i => i.id)
      const { data: subs } = await supabase
        .from('submissions')
        .select('homework_item_id, is_late, completed_at')
        .eq('student_id', user.id)
        .in('homework_item_id', itemIds.length > 0 ? itemIds : ['none'])

      const subMap = new Map((subs || []).map(s => [s.homework_item_id, s]))
      setItems((hwItems || []).map(i => {
        const sub = subMap.get(i.id)
        return { ...i, completed: !!sub, is_late: sub?.is_late ?? false, completed_at: sub?.completed_at ?? null }
      }))
      setLoading(false)
    }
    load()
  }, [weekId])

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.text} />
      </SafeAreaView>
    )
  }

  const completedCount = items.filter(i => i.completed).length

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.weekLabel}>Week {weekNumber}</Text>
        <Text style={styles.weekTitle}>{weekTitle}</Text>
        <Text style={styles.dueDate}>
          Due {dueDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          {'  ·  '}
          {completedCount} of {items.length} completed
        </Text>

        <View style={styles.list}>
          {items.map(item => (
            <View key={item.id} style={[styles.itemCard, item.completed && styles.itemCardDone]}>
              <View style={[styles.checkbox, item.completed && styles.checkboxDone]}>
                {item.completed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemType}>{typeLabels[item.type] || item.type}</Text>
                <Text style={[styles.itemTitle, item.completed && styles.itemTitleDone]}>
                  {item.title}
                </Text>
                {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
                {item.completed && item.completed_at && (
                  <Text style={[styles.submittedAt, item.is_late && styles.late]}>
                    {item.is_late ? 'Submitted late' : 'Submitted on time'}
                    {' · '}
                    {new Date(item.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  weekLabel: { fontSize: 11, color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  weekTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 4 },
  dueDate: { fontSize: 13, color: colors.textFaint, marginBottom: 24 },
  list: { gap: 10 },
  itemCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  itemCardDone: { borderColor: colors.borderSubtle },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: colors.accentText, fontSize: 12, fontWeight: '700', lineHeight: 14 },
  itemContent: { flex: 1 },
  itemType: { fontSize: 11, color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  itemTitleDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  itemDesc: { fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 18 },
  submittedAt: { fontSize: 12, color: colors.success, marginTop: 6 },
  late: { color: colors.warning },
})
