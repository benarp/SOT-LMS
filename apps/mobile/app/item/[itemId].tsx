import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, Dimensions, TextInput,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { WebView } from 'react-native-webview'
import { supabase } from '../../lib/supabase'
import { adjustOpenCount } from '../../lib/openAssignments'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const VIDEO_HEIGHT = Math.round((SCREEN_WIDTH - 32) * 9 / 16)

type Item = {
  id: string
  type: string
  title: string
  description: string | null
  content: string | null
  external_url: string | null
  week_id: string
  completed: boolean
  due_date: string
  show_attribution?: boolean
}

function getEmbedUrl(rawUrl: string): string | null {
  // Stored URLs may have stray whitespace; iOS WebKit rejects them outright
  const url = rawUrl.trim()
  try {
    const u = new URL(url)
    // YouTube
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const videoId = u.hostname.includes('youtu.be')
        ? u.pathname.slice(1)
        : u.searchParams.get('v') ?? u.pathname.split('/').pop()
      if (videoId) return `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`
    }
    // Vimeo
    if (u.hostname.includes('vimeo.com')) {
      const videoId = u.pathname.split('/').filter(Boolean).pop()
      if (videoId) return `https://player.vimeo.com/video/${videoId}`
    }
    // Bible Project and others — embed as-is
    return url
  } catch {
    return url
  }
}

export default function ItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>()
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [userId, setUserId] = useState('')
  const [responseDraft, setResponseDraft] = useState('')
  const [savingResponse, setSavingResponse] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: itemData } = await supabase
        .from('homework_items')
        .select('id, type, title, description, content, external_url, week_id, show_attribution')
        .eq('id', itemId)
        .single()

      if (!itemData) { setLoading(false); return }

      const { data: week } = await supabase
        .from('weeks')
        .select('due_date')
        .eq('id', itemData.week_id)
        .single()

      const { data: sub } = await supabase
        .from('submissions')
        .select('id, response_text')
        .eq('student_id', user.id)
        .eq('homework_item_id', itemId)
        .single()

      if (sub?.response_text) setResponseDraft(sub.response_text)

      setItem({ ...itemData, completed: !!sub, due_date: week?.due_date ?? '' })
      setLoading(false)
    }
    load()
  }, [itemId])

  async function markComplete() {
    if (!item || item.completed || completing) return
    setCompleting(true)
    const isLate = item.due_date ? new Date() > new Date(item.due_date) : false
    const { error } = await supabase.from('submissions').upsert({
      student_id: userId,
      homework_item_id: itemId,
      completed_at: new Date().toISOString(),
      is_late: isLate,
    }, { onConflict: 'student_id,homework_item_id' })

    if (error) {
      Alert.alert('Error', 'Could not mark complete. Try again.')
      setCompleting(false)
      return
    }
    setItem(prev => prev ? { ...prev, completed: true } : prev)
    adjustOpenCount(-1)
    setCompleting(false)
  }

  async function saveResponse() {
    if (!item || savingResponse) return
    if (!responseDraft.trim()) {
      Alert.alert('Empty response', 'Write something before saving.')
      return
    }
    setSavingResponse(true)
    const isLate = item.due_date ? new Date() > new Date(item.due_date) : false
    const { error } = await supabase.from('submissions').upsert({
      student_id: userId,
      homework_item_id: itemId,
      completed_at: new Date().toISOString(),
      is_late: isLate,
      response_text: responseDraft.trim(),
    }, { onConflict: 'student_id,homework_item_id' })
    setSavingResponse(false)

    if (error) {
      Alert.alert('Error', 'Could not save. Try again.')
      return
    }
    if (!item.completed) adjustOpenCount(-1)
    setItem(prev => prev ? { ...prev, completed: true } : prev)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color="#111827" />
      </SafeAreaView>
    )
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.empty}>Item not found.</Text>
      </SafeAreaView>
    )
  }

  const embedUrl = item.external_url ? getEmbedUrl(item.external_url) : null
  const days = item.content
    ? item.content.split('\n').filter(l => l.trim().length > 0)
    : []

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.typeLabel}>{
          { bible_reading: 'Scripture Reading', book_reading: 'Book Reading', video: 'Video', reflection: 'Reflection' }[item.type] ?? item.type
        }</Text>
        <Text style={styles.title}>{item.title}</Text>
        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

        {/* Video embed — wrapped in an HTML page with a real origin, because
            YouTube refuses originless WebView requests (player error 153/154) */}
        {item.type === 'video' && embedUrl && (
          <View style={styles.videoContainer}>
            <WebView
              source={{
                html: `<!DOCTYPE html><html><head>
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}iframe{width:100%;height:100%;border:0}</style>
                  </head><body>
                  <iframe src="${embedUrl}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
                  </body></html>`,
                baseUrl: 'https://sot-lms.vercel.app',
              }}
              style={{ width: SCREEN_WIDTH - 32, height: VIDEO_HEIGHT }}
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
            />
          </View>
        )}
        {item.type === 'video' && item.show_attribution !== false && (
          <Text style={styles.attribution}>
            Video provided by BibleProject — explore all their content at{' '}
            <Text style={styles.attributionLink} onPress={() => Linking.openURL('https://bibleproject.com')}>
              bibleproject.com
            </Text>
          </Text>
        )}

        {/* Reading plan day-by-day */}
        {(item.type === 'bible_reading' || item.type === 'book_reading') && days.length > 0 && (
          <View style={styles.daysContainer}>
            {days.map((day, i) => (
              <View key={i} style={styles.dayRow}>
                <View style={styles.dayDot} />
                <Text style={styles.dayText}>{day}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Reflection: prompt + response box */}
        {item.type === 'reflection' && (
          <>
            {item.content ? (
              <View style={styles.writtenBox}>
                <Text style={styles.writtenText}>{item.content}</Text>
              </View>
            ) : null}
            <TextInput
              style={styles.responseInput}
              value={responseDraft}
              onChangeText={setResponseDraft}
              multiline
              placeholder="Write your response here…"
              placeholderTextColor="#9ca3af"
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.completeBtn, savingResponse && styles.completeBtnDisabled]}
              onPress={saveResponse}
              disabled={savingResponse}
              activeOpacity={0.8}
            >
              {savingResponse
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.completeBtnText}>{item.completed ? 'Update response' : 'Save response'}</Text>
              }
            </TouchableOpacity>
            {item.completed && (
              <Text style={styles.reflectionDone}>✓ Response saved — item complete</Text>
            )}
          </>
        )}

        {/* Complete button (reflections complete by saving a response) */}
        {item.type !== 'reflection' && (
          <TouchableOpacity
            style={[styles.completeBtn, item.completed && styles.completeBtnDone, completing && styles.completeBtnDisabled]}
            onPress={markComplete}
            disabled={item.completed || completing}
            activeOpacity={0.8}
          >
            {completing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.completeBtnText}>{item.completed ? '✓ Completed' : 'Mark complete'}</Text>
            }
          </TouchableOpacity>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  scroll: { padding: 20, paddingBottom: 48 },
  typeLabel: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8, lineHeight: 28 },
  description: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 20 },
  videoContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 10,
    backgroundColor: '#000',
  },
  attribution: { fontSize: 12, color: '#9ca3af', lineHeight: 17, marginBottom: 16 },
  attributionLink: { color: '#3b82f6', textDecorationLine: 'underline' },
  daysContainer: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    gap: 12,
  },
  dayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#111827', marginTop: 6, flexShrink: 0 },
  dayText: { fontSize: 14, color: '#374151', lineHeight: 22, flex: 1 },
  reflectionDone: { fontSize: 13, color: '#16a34a', fontWeight: '600', textAlign: 'center', marginTop: 14 },
  writtenBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginTop: 16,
  },
  writtenText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  responseInput: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginTop: 16,
    minHeight: 140,
    fontSize: 14,
    color: '#111827',
    lineHeight: 21,
  },
  completeBtn: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  completeBtnDone: { backgroundColor: '#d1fae5', },
  completeBtnDisabled: { opacity: 0.6 },
  completeBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  empty: { color: '#9ca3af', fontSize: 14 },
})
