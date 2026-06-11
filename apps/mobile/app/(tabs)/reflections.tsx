import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, RefreshControl, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'

type Book = { id: string; title: string; author: string | null }
type Reflection = { id: string; book_id: string; content: string | null; submitted_at: string }

export default function ReflectionsScreen() {
  const { bookId: deepLinkBookId } = useLocalSearchParams<{ bookId?: string }>()
  const [books, setBooks] = useState<Book[]>([])
  const [reflections, setReflections] = useState<Reflection[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userId, setUserId] = useState('')
  const [modalBook, setModalBook] = useState<Book | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: schoolYear } = await supabase
      .from('school_years').select('id').eq('is_active', true).single()
    if (!schoolYear) { setLoading(false); return }

    const [{ data: bks }, { data: refs }] = await Promise.all([
      supabase.from('books').select('id, title, author').eq('school_year_id', schoolYear.id).order('sort_order'),
      supabase.from('book_reflections').select('id, book_id, content, submitted_at').eq('student_id', user.id),
    ])

    setBooks(bks || [])
    setReflections(refs || [])
    setLoading(false)
    setRefreshing(false)

    // Auto-open modal if navigated from item detail with a bookId
    if (deepLinkBookId && bks) {
      const book = bks.find((b: Book) => b.id === deepLinkBookId)
      if (book) {
        const existing = (refs || []).find((r: Reflection) => r.book_id === book.id)
        setDraft(existing?.content || '')
        setModalBook(book)
      }
    }
  }, [deepLinkBookId])

  useEffect(() => { load() }, [load])

  function openModal(book: Book) {
    const existing = reflections.find(r => r.book_id === book.id)
    setDraft(existing?.content || '')
    setModalBook(book)
  }

  async function saveReflection() {
    if (!modalBook || !draft.trim()) {
      Alert.alert('Empty reflection', 'Write something before saving.')
      return
    }
    setSaving(true)
    const existing = reflections.find(r => r.book_id === modalBook.id)
    if (existing) {
      const { error } = await supabase
        .from('book_reflections')
        .update({ content: draft.trim(), submitted_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) { Alert.alert('Error', error.message); setSaving(false); return }
      setReflections(prev => prev.map(r => r.id === existing.id ? { ...r, content: draft.trim(), submitted_at: new Date().toISOString() } : r))
    } else {
      const { data, error } = await supabase
        .from('book_reflections')
        .insert({ student_id: userId, book_id: modalBook.id, content: draft.trim(), submitted_at: new Date().toISOString() })
        .select()
        .single()
      if (error) { Alert.alert('Error', error.message); setSaving(false); return }
      setReflections(prev => [...prev, data])
    }

    // Auto-mark the corresponding book_reflection homework item complete
    const { data: hwItem } = await supabase
      .from('homework_items')
      .select('id')
      .eq('type', 'book_reflection')
      .eq('book_id', modalBook.id)
      .single()
    if (hwItem) {
      await supabase.from('submissions').upsert({
        student_id: userId,
        homework_item_id: hwItem.id,
        completed_at: new Date().toISOString(),
        is_late: false,
      }, { onConflict: 'student_id,homework_item_id' })
    }

    setSaving(false)
    setModalBook(null)
  }

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
        <Text style={styles.heading}>Book reflections</Text>
        <Text style={styles.subheading}>Write a reflection for each book you've read this year.</Text>

        <View style={styles.list}>
          {books.map(book => {
            const reflection = reflections.find(r => r.book_id === book.id)
            return (
              <TouchableOpacity
                key={book.id}
                style={styles.card}
                onPress={() => openModal(book)}
                activeOpacity={0.7}
              >
                <View style={styles.cardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookTitle}>{book.title}</Text>
                    {book.author && <Text style={styles.bookAuthor}>{book.author}</Text>}
                    {reflection
                      ? <Text style={styles.preview} numberOfLines={2}>{reflection.content}</Text>
                      : <Text style={styles.notStarted}>Tap to write your reflection</Text>
                    }
                  </View>
                  <View style={styles.statusDot(!!reflection)} />
                </View>
              </TouchableOpacity>
            )
          })}
          {books.length === 0 && <Text style={styles.empty}>No books added yet.</Text>}
        </View>
      </ScrollView>

      {/* Reflection modal */}
      <Modal visible={!!modalBook} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <SafeAreaView style={styles.modal} edges={['top']}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalBook(null)}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>{modalBook?.title}</Text>
              <TouchableOpacity onPress={saveReflection} disabled={saving}>
                <Text style={[styles.save, saving && { opacity: 0.5 }]}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.textArea}
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder="Write your reflection here…"
              placeholderTextColor="#9ca3af"
              textAlignVertical="top"
              autoFocus
            />
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subheading: { fontSize: 13, color: '#9ca3af', marginBottom: 20, lineHeight: 18 },
  list: { gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bookTitle: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  bookAuthor: { fontSize: 12, color: '#9ca3af', marginBottom: 8 },
  preview: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  notStarted: { fontSize: 13, color: '#d1d5db', fontStyle: 'italic' },
  statusDot: (done: boolean) => ({
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: done ? '#16a34a' : '#e5e7eb',
    flexShrink: 0,
  }),
  empty: { fontSize: 14, color: '#9ca3af', textAlign: 'center', marginTop: 40 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#111827', marginHorizontal: 12 },
  cancel: { fontSize: 15, color: '#6b7280' },
  save: { fontSize: 15, fontWeight: '600', color: '#111827' },
  textArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    fontSize: 15,
    color: '#111827',
    lineHeight: 24,
  },
} as any)
