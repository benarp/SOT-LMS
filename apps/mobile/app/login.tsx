import { useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ImageBackground, Linking,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { useTheme, type ThemeColors } from '../lib/theme'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  async function handleSignIn() {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) Alert.alert('Sign in failed', error.message)
  }

  return (
    <ImageBackground
      source={require('../assets/login-bg.jpg')}
      style={styles.bg}
      imageStyle={styles.bgImage}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.inner}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.school}>School of Transformation</Text>
              <Text style={styles.subtitle}>Discipleship Training</Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                placeholderTextColor={colors.placeholder}
              />

              <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                placeholder="••••••••"
                placeholderTextColor={colors.placeholder}
                onSubmitEditing={handleSignIn}
                returnKeyType="done"
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color={colors.accentText} />
                  : <Text style={styles.buttonText}>Sign in</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyButton}
                activeOpacity={0.8}
                onPress={() => Linking.openURL('https://sot-lms.vercel.app/apply')}
              >
                <Text style={styles.applyButtonText}>Apply now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  bg: { flex: 1 },
  bgImage: { resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  header: { marginBottom: 24 },
  school: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textFaint },
  form: {},
  label: { fontSize: 13, fontWeight: '500', color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.accentText, fontWeight: '600', fontSize: 15 },
  applyButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
  },
  applyButtonText: { color: colors.text, fontWeight: '600', fontSize: 15 },
})
