import { useEffect, useMemo, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { useTheme, type ThemeColors, type ThemePref } from '../lib/theme'

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export default function AccountScreen() {
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [originalEmail, setOriginalEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const { colors, pref, setPref } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single()
      setName(profile?.full_name ?? '')
      setOriginalName(profile?.full_name ?? '')
      setEmail(user.email ?? profile?.email ?? '')
      setOriginalEmail(user.email ?? profile?.email ?? '')
      setLoading(false)
    }
    load()
  }, [])

  async function saveName() {
    if (!name.trim() || name.trim() === originalName) return
    setSavingName(true)
    const { error } = await supabase.rpc('update_own_name', { new_name: name.trim() })
    setSavingName(false)
    if (error) { Alert.alert('Error', error.message); return }
    setOriginalName(name.trim())
    Alert.alert('Saved', 'Your name has been updated.')
  }

  async function saveEmail() {
    const next = email.trim().toLowerCase()
    if (!next || next === originalEmail) return
    setSavingEmail(true)
    const { error } = await supabase.auth.updateUser({ email: next })
    setSavingEmail(false)
    if (error) { Alert.alert('Error', error.message); return }
    Alert.alert(
      'Confirm your new email',
      `We sent a confirmation link to ${next}. Your email won't change until you tap it.`
    )
  }

  async function savePassword() {
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'The two passwords do not match.')
      return
    }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) { Alert.alert('Error', error.message); return }
    setNewPassword('')
    setConfirmPassword('')
    Alert.alert('Saved', 'Your password has been changed.')
  }

  function confirmSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={colors.text} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Account</Text>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={styles.label}>Appearance</Text>
          <Text style={styles.hint}>&quot;System&quot; follows your phone&apos;s settings.</Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map(opt => {
              const active = pref === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.themePill, active && styles.themePillActive]}
                  onPress={() => setPref(opt.value)}
                >
                  <Text style={[styles.themePillText, active && styles.themePillTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            placeholderTextColor={colors.placeholder}
          />
          {name.trim() !== originalName && name.trim().length > 0 && (
            <TouchableOpacity style={styles.saveBtn} onPress={saveName} disabled={savingName}>
              <Text style={styles.saveBtnText}>{savingName ? 'Saving…' : 'Save name'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Email */}
        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholderTextColor={colors.placeholder}
          />
          <Text style={styles.hint}>Changing your email sends a confirmation link to the new address.</Text>
          {email.trim().toLowerCase() !== originalEmail && email.trim().length > 0 && (
            <TouchableOpacity style={styles.saveBtn} onPress={saveEmail} disabled={savingEmail}>
              <Text style={styles.saveBtnText}>{savingEmail ? 'Sending…' : 'Update email'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Password */}
        <View style={styles.section}>
          <Text style={styles.label}>Change password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password"
            placeholderTextColor={colors.placeholder}
            secureTextEntry
            autoComplete="new-password"
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor={colors.placeholder}
            secureTextEntry
            autoComplete="new-password"
          />
          {newPassword.length > 0 && (
            <TouchableOpacity style={styles.saveBtn} onPress={savePassword} disabled={savingPassword}>
              <Text style={styles.saveBtnText}>{savingPassword ? 'Saving…' : 'Change password'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={confirmSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 48 },
  heading: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 20 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  label: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  hint: { fontSize: 12, color: colors.textFaint, marginTop: 8, lineHeight: 16 },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: { color: colors.accentText, fontSize: 14, fontWeight: '600' },
  signOutBtn: {
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  themeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  themePill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  themePillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  themePillText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  themePillTextActive: { color: colors.accentText },
})
