import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useTheme, type ThemeColors } from '../../lib/theme'
import { formatDueDate } from '../../lib/dueDate'

type Row = {
  id: string
  week_number: number
  title: string
  due_date: string
  recordingTitle: string | null
  speaker: string | null
  recordedOn: string | null
  published: boolean
}

export default function RecordingsScreen() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: schoolYear } = await supabase
      .from('school_years').select('id').eq('is_active', true).single()
    if (!schoolYear) { setLoading(false); setRefreshing(false); return }

    // Every week of the year, unlike Curriculum — a week with nothing posted
    // yet stays in the list as a grayed row rather than disappearing.
    const { data: allWeeks } = await supabase
      .from('weeks')
      .select('id, week_number, title, due_date')
      .eq('school_year_id', schoolYear.id)
      .order('week_number', { ascending: true })

    if (!allWeeks || allWeeks.length === 0) { setLoading(false); setRefreshing(false); return }

    const weekIds = allWeeks.map(w => w.id)
    const { data: recordings } = await supabase
      .from('recordings')
      .select('week_id, title, speaker, video_url, recorded_on')
      .in('week_id', weekIds)

    const byWeek = new Map((recordings || []).map(r => [r.week_id, r]))

    setRows(allWeeks.map(w => {
      const rec = byWeek.get(w.id)
      return {
        ...w,
        recordingTitle: rec?.title ?? null,
        speaker: rec?.speaker ?? null,
        recordedOn: rec?.recorded_on ?? null,
        // Only a recording with a link is posted; a row without one is a draft
        // the admin saved ahead of the upload.
        published: !!rec?.video_url,
      }
    }))
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.text} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.text} />}
      >
        <Text style={styles.heading}>Recordings</Text>

        {rows.length === 0 ? (
          <Text style={styles.empty}>No weeks scheduled yet.</Text>
        ) : (
          <View style={styles.list}>
            {rows.map(row => {
              if (!row.published) {
                return (
                  <View key={row.id} style={[styles.card, styles.cardMuted]}>
                    <Text style={styles.weekLabel}>Week {row.week_number}</Text>
                    <Text style={styles.titleMuted}>{row.title}</Text>
                    <Text style={styles.meta}>Not posted yet</Text>
                  </View>
                )
              }

              const meta = [
                formatDueDate(row.recordedOn ?? row.due_date, { month: 'short', day: 'numeric' }),
                row.speaker,
              ].filter(Boolean).join('  ·  ')

              return (
                <TouchableOpacity
                  key={row.id}
                  style={styles.card}
                  onPress={() => router.push(`/recording/${row.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardRow}>
                    <View style={styles.playCircle}>
                      <Text style={styles.playMark}>▶</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.weekLabel}>Week {row.week_number}</Text>
                      <Text style={styles.title}>{row.recordingTitle}</Text>
                      <Text style={styles.meta}>{meta}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 20 },
  list: { gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardMuted: { opacity: 0.5 },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  weekLabel: { fontSize: 11, color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 3 },
  titleMuted: { fontSize: 15, fontWeight: '600', color: colors.textMuted, marginBottom: 3 },
  meta: { fontSize: 12, color: colors.textFaint },
  playCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playMark: { color: colors.accentText, fontSize: 12, lineHeight: 14, marginLeft: 2 },
  empty: { fontSize: 14, color: colors.textFaint, textAlign: 'center', marginTop: 40 },
})
