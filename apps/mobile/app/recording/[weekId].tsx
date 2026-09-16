import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Dimensions, Linking, TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { WebView } from 'react-native-webview'
import { supabase } from '../../lib/supabase'
import { useTheme, type ThemeColors } from '../../lib/theme'
import { formatDueDate } from '../../lib/dueDate'
import { getEmbedUrl } from '../../lib/videoEmbed'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const VIDEO_HEIGHT = Math.round((SCREEN_WIDTH - 32) * 9 / 16)

type Recording = {
  weekNumber: number
  weekTitle: string
  weekDueDate: string
  title: string
  speaker: string | null
  videoUrl: string | null
  recordedOn: string | null
  description: string | null
}

export default function RecordingDetailScreen() {
  const { weekId } = useLocalSearchParams<{ weekId: string }>()
  const [recording, setRecording] = useState<Recording | null>(null)
  const [loading, setLoading] = useState(true)
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  useEffect(() => {
    async function load() {
      const [{ data: week }, { data: rec }] = await Promise.all([
        supabase.from('weeks').select('week_number, title, due_date').eq('id', weekId).single(),
        supabase
          .from('recordings')
          .select('title, speaker, video_url, recorded_on, description')
          .eq('week_id', weekId)
          .maybeSingle(),
      ])

      if (week && rec) {
        setRecording({
          weekNumber: week.week_number,
          weekTitle: week.title,
          weekDueDate: week.due_date,
          title: rec.title,
          speaker: rec.speaker,
          videoUrl: rec.video_url,
          recordedOn: rec.recorded_on,
          description: rec.description,
        })
      }
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

  // Covers both a week with no row at all and a draft the admin hasn't linked
  // a video to yet — a deep link shouldn't open an empty player either way.
  if (!recording || !recording.videoUrl) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.empty}>This recording hasn't been posted yet.</Text>
      </SafeAreaView>
    )
  }

  const embedUrl = getEmbedUrl(recording.videoUrl)
  const meta = [
    formatDueDate(recording.recordedOn ?? recording.weekDueDate, { month: 'long', day: 'numeric' }),
    recording.speaker,
  ].filter(Boolean).join('  ·  ')

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.weekLabel}>Week {recording.weekNumber}</Text>
        <Text style={styles.title}>{recording.title}</Text>
        <Text style={styles.meta}>{meta}</Text>

        {/* Wrapped in an HTML page with a real origin, because YouTube refuses
            originless WebView requests (player error 153/154) */}
        {embedUrl ? (
          <View style={styles.videoContainer}>
            <WebView
              source={{
                html: `<!DOCTYPE html><html><head>
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}iframe{width:100%;height:100%;border:0}</style>
                  </head><body>
                  <iframe src="${embedUrl}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
                  </body></html>`,
                baseUrl: 'https://schooloftransformation.app',
              }}
              style={{ width: SCREEN_WIDTH - 32, height: VIDEO_HEIGHT }}
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
            />
          </View>
        ) : (
          <TouchableOpacity onPress={() => Linking.openURL(recording.videoUrl!.trim())}>
            <Text style={styles.link}>Watch recording →</Text>
          </TouchableOpacity>
        )}

        {recording.description ? (
          <Text style={styles.description}>{recording.description}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, paddingHorizontal: 32 },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  weekLabel: { fontSize: 11, color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  meta: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  videoContainer: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.videoBg },
  link: { fontSize: 15, fontWeight: '600', color: colors.info },
  description: { fontSize: 14, color: colors.textSecondary, lineHeight: 21, marginTop: 20 },
  empty: { fontSize: 14, color: colors.textFaint, textAlign: 'center' },
})
