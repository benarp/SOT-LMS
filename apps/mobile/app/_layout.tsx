import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const router = useRouter()
  const segments = useSegments()

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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="week/[weekId]" options={{ headerShown: true, headerTitle: '', headerBackTitle: 'Back', headerTintColor: '#111827' }} />
      <Stack.Screen name="item/[itemId]" options={{ headerShown: true, headerTitle: '', headerBackTitle: 'Back', headerTintColor: '#111827' }} />
      <Stack.Screen name="account" options={{ headerShown: true, headerTitle: '', headerBackTitle: 'Back', headerTintColor: '#111827' }} />
    </Stack>
  )
}
