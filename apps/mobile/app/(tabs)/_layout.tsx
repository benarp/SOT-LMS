import { useEffect } from 'react'
import { Tabs } from 'expo-router'
import { ColorValue } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useOpenCount, fetchOpenAssignments } from '../../lib/openAssignments'

function HomeIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={String(color)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </Svg>
  )
}

function ChecklistIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={String(color)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </Svg>
  )
}

function HistoryIcon({ color }: { color: ColorValue }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={String(color)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </Svg>
  )
}

export default function TabsLayout() {
  const openCount = useOpenCount()

  // Populate the badge on app start, before the Open tab is ever visited
  useEffect(() => {
    fetchOpenAssignments()
  }, [])

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#f3f4f6',
          borderTopWidth: 1,
          paddingTop: 4,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'This Week', tabBarIcon: ({ color }) => <HomeIcon color={color} /> }}
      />
      <Tabs.Screen
        name="open"
        options={{
          title: 'Open',
          tabBarIcon: ({ color }) => <ChecklistIcon color={color} />,
          tabBarBadge: openCount > 0 ? openCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#ef4444', fontSize: 11 },
        }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: 'Previous Weeks', tabBarIcon: ({ color }) => <HistoryIcon color={color} /> }}
      />
    </Tabs>
  )
}
