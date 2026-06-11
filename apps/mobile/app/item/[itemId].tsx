import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { WebView } from 'react-native-webview'
import { supabase } from '../../lib/supabase'
import { adjustOpenCount } from '../../lib/openAssignments'
import ReflectionEditor from '../../components/ReflectionEditor'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const VIDEO_HEIGHT = Math.round((SCREEN_WIDTH - 32) * 9 / 16)

type Item = {
  id: string
  type: string
  title: string
  description: string | null
  content: string | null
  external_url: string | null
  book_id: string | null
  week_id: string
  completed: boolean
  due_date: string
}

function getEmbedUrl(url: string): string | null {
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
  const [book, setBook] = useState<{ id: string; title: string } | null>(null)
  const [reflection, setReflection] = useState<{ id: string; content: string } | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: itemData } = await supabase
        .from('homework_items')
        .select('id, type, title, description, content, external_url, book_id, week_id')
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
        .select('id')
        .eq('student_id', user.id)
        .eq('homework_item_id', itemId)
        .single()

      // For book reflections, load the book and any existing reflection
      // so the editor opens right here instead of a separate tab
      if (itemData.type === 'book_reflection' && itemData.book_id) {
        const [{ data: bookData }, { data: refData }] = await Promise.all([
          supabase.from('books').select('id, title').eq('id', itemData.book_id).single(),
          supabase.from('book_reflections')
            .select('id, content')
            .eq('student_id', user.id)
            .eq('book_id', itemData.book_id)
            .maybeSingle(),
        ])
        setBook(bookData)
        setReflection(refData ? { id: refData.id, content: refData.content ?? '' } : null)
      }

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

  function handleReflectionSaved(content: string, reflectionId: string) {
    setReflection({ id: reflectionId, content })
    if (item && !item.completed) adjustOpenCount(-1)
    setItem(prev => prev ? { ...prev, completed: true } : prev)
    setEditorOpen(false)
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.typeLabel}>{
          { bible_reading: 'Bible reading', video: 'Video', book_reflection: 'Book reflection', written: 'Written submission' }[item.type] ?? item.type
        }</Text>
        <Text style={styles.title}>{item.title}</Text>
        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

        {/* Video embed */}
        {item.type === 'video' && embedUrl && (
          <View style={styles.videoContainer}>
            <WebView
              source={{ uri: embedUrl }}
              style={{ width: SCREEN_WIDTH - 32, height: VIDEO_HEIGHT }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
            />
          </View>
        )}

        {/* Bible reading day-by-day */}
        {item.type === 'bible_reading' && days.length > 0 && (
          <View style={styles.daysContainer}>
            {days.map((day, i) => (
              <View key={i} style={styles.dayRow}>
                <View style={styles.dayDot} />
                <Text style={styles.dayText}>{day}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Book reflection — written and saved right here */}
        {item.type === 'book_reflection' && (
          <>
            {reflection?.content ? (
              <View style={styles.reflectionPreview}>
                <Text style={styles.reflectionPreviewLabel}>Your reflection</Text>
                <Text style={styles.reflectionPreviewText} numberOfLines={6}>{reflection.content}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.reflectionCta} onPress={() => setEditorOpen(true)} activeOpacity={0.8}>
              <Text style={styles.reflectionCtaText}>
                {reflection ? 'Edit your reflection' : 'Write your reflection →'}
              </Text>
            </TouchableOpacity>
            {item.completed && (
              <Text style={styles.reflectionDone}>✓ Reflection submitted — homework item complete</Text>
            )}
          </>
        )}

        {/* Written content */}
        {item.type === 'written' && item.content && (
          <View style={styles.writtenBox}>
            <Text style={styles.writtenText}>{item.content}</Text>
          </View>
        )}

        {/* Complete button (not for book reflections — those complete via the reflections tab) */}
        {item.type !== 'book_reflection' && (
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

      {book && (
        <ReflectionEditor
          visible={editorOpen}
          book={book}
          userId={userId}
          initialContent={reflection?.content ?? ''}
          existingReflectionId={reflection?.id ?? null}
          onSaved={handleReflectionSaved}
          onClose={() => setEditorOpen(false)}
        />
      )}
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
    marginBottom: 24,
    backgroundColor: '#000',
  },
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
  reflectionCta: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  reflectionCtaText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  reflectionPreview: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginTop: 16,
  },
  reflectionPreviewLabel: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  reflectionPreviewText: { fontSize: 14, color: '#374151', lineHeight: 21 },
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
