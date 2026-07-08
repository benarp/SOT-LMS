import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { StatusBar } from 'expo-status-bar'
import { supabase } from '../lib/supabase'
import ThemeProvider from '../components/ThemeProvider'
import { useTheme } from '../lib/theme'

function RootStack() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const router = useRouter()
  const segments = useSegments()
  const { colors, scheme } = useTheme()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    const inAuth = segments[0] === 'login'
    if (!session && !inAuth) {
      router.replace('/login')
    } else if (session && inAuth) {
      router.replace('/(tabs)')
    }
  }, [session, segments])

  if (session === undefined) return null

  const headerOptions = {
    headerShown: true,
    headerTitle: '',
    headerBackTitle: 'Back',
    headerTintColor: colors.text,
    headerStyle: { backgroundColor: colors.surface },
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="week/[weekId]" options={headerOptions} />
        <Stack.Screen name="item/[itemId]" options={headerOptions} />
        <Stack.Screen name="account" options={headerOptions} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootStack />
    </ThemeProvider>
  )
}
