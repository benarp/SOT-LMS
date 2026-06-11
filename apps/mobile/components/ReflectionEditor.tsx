import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'

type Props = {
  visible: boolean
  book: { id: string; title: string }
  userId: string
  initialContent: string
  existingReflectionId: string | null
  onSaved: (content: string, reflectionId: string) => void
  onClose: () => void
}

export default function ReflectionEditor({
  visible, book, userId, initialContent, existingReflectionId, onSaved, onClose,
}: Props) {
  const [draft, setDraft] = useState(initialContent)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!draft.trim()) {
      Alert.alert('Empty reflection', 'Write something before saving.')
      return
    }
    setSaving(true)
    const content = draft.trim()
    const now = new Date().toISOString()
    let reflectionId = existingReflectionId

    if (existingReflectionId) {
      const { error } = await supabase
        .from('book_reflections')
        .update({ content, submitted_at: now })
        .eq('id', existingReflectionId)
      if (error) { Alert.alert('Error', error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase
        .from('book_reflections')
        .insert({ student_id: userId, book_id: book.id, content, submitted_at: now })
        .select('id')
        .single()
      if (error) { Alert.alert('Error', error.message); setSaving(false); return }
      reflectionId = data.id
    }

    // Auto-mark the matching book_reflection homework item complete
    const { data: hwItem } = await supabase
      .from('homework_items')
      .select('id')
      .eq('type', 'book_reflection')
      .eq('book_id', book.id)
      .single()
    if (hwItem) {
      await supabase.from('submissions').upsert({
        student_id: userId,
        homework_item_id: hwItem.id,
        completed_at: now,
        is_late: false,
      }, { onConflict: 'student_id,homework_item_id' })
    }

    setSaving(false)
    onSaved(content, reflectionId!)
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <SafeAreaView style={styles.modal} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>{book.title}</Text>
            <TouchableOpacity onPress={save} disabled={saving}>
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
  )
}

const styles = StyleSheet.create({
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
})
