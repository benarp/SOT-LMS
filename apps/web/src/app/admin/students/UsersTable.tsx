'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ImpersonateButton from '@/components/admin/ImpersonateButton'

export type UserRow = {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  city: string | null
  role: string
  alumniYear: string | null
  paymentStatus: string | null
  homeworkStatus: 'current' | 'late' | null
  birthday: string | null // ISO date (YYYY-MM-DD)
}

type SortKey = keyof Omit<UserRow, 'id'>
type SortDir = 'asc' | 'desc'

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  student: 'Student',
  group_leader: 'Group Leader',
  applicant: 'Applicant',
  alumni: 'Alumni',
}

const roleOrder: Record<string, number> = {
  admin: 0,
  group_leader: 1,
  student: 2,
  applicant: 3,
  alumni: 4,
}

function sortValue(row: UserRow, key: SortKey): string | number {
  switch (key) {
    case 'role': return roleOrder[row.role] ?? 99
    case 'homeworkStatus': {
      const order = { current: 0, late: 1 }
      return row.homeworkStatus ? order[row.homeworkStatus] : 2
    }
    case 'paymentStatus': return row.paymentStatus ?? 'zzz'
    // Sort birthdays by month-day (year-agnostic), missing last
    case 'birthday': return row.birthday ? row.birthday.slice(5) : '99-99'
    default: return (row[key] ?? '').toString().toLowerCase()
  }
}

// Birthday windows compare month-day only (the year on file doesn't matter)
export type BirthdayWindow = 'all' | 'today' | 'week' | 'month' | 'nextMonth'

function daysUntilBirthday(iso: string, today: Date): number {
  const [, m, d] = iso.split('-').map(Number)
  const next = new Date(today.getFullYear(), m - 1, d)
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86400000)
}

function inBirthdayWindow(iso: string | null, window: BirthdayWindow): boolean {
  if (window === 'all') return true
  if (!iso) return false
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const [, m] = iso.split('-').map(Number)
  switch (window) {
    case 'today': return daysUntilBirthday(iso, today) === 0
    case 'week': return daysUntilBirthday(iso, today) <= 6
    case 'month': return m - 1 === today.getMonth()
    case 'nextMonth': return m - 1 === (today.getMonth() + 1) % 12
  }
}

function formatBirthday(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return new Date(2000, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function downloadCSV(rows: UserRow[]) {
  const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'City', 'Birthday', 'Role', 'Payment Status', 'Homework Status']
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      r.firstName,
      r.lastName,
      r.email,
      r.phone ?? '',
      r.city ?? '',
      r.birthday ?? '',
      roleLabels[r.role] ?? r.role,
      r.paymentStatus ?? '—',
      r.homeworkStatus ? (r.homeworkStatus === 'current' ? 'Current' : 'Late') : '—',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'sot-users.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const columns: { key: SortKey; label: string; minWidth?: string }[] = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email', minWidth: '180px' },
  { key: 'phone', label: 'Phone' },
  { key: 'city', label: 'City' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'paymentStatus', label: 'Payment' },
  { key: 'homeworkStatus', label: 'Homework' },
  { key: 'role', label: 'Role' },
]

export default function UsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('lastName')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [birthdayWindow, setBirthdayWindow] = useState<BirthdayWindow>('all')
  const [search, setSearch] = useState('')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = useMemo(() => {
    let rows = users
    if (filterRole !== 'all') rows = rows.filter(r => r.role === filterRole)
    if (birthdayWindow !== 'all') rows = rows.filter(r => inBirthdayWindow(r.birthday, birthdayWindow))
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      )
    }
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [users, filterRole, birthdayWindow, search, sortKey, sortDir])

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="ml-1 text-gray-300">↕</span>
    return <span className="ml-1 text-gray-600">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function HomeworkBadge({ status }: { status: 'current' | 'late' | null }) {
    if (!status) return <span className="text-gray-300">—</span>
    if (status === 'current') return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Current</span>
    )
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">Late</span>
    )
  }

  function PaymentBadge({ status }: { status: string | null }) {
    if (!status) return <span className="text-gray-300">—</span>
    const colors: Record<string, string> = {
      'Active': 'bg-green-50 text-green-700',
      'Paid in full': 'bg-green-50 text-green-700',
      'Paused': 'bg-yellow-50 text-yellow-700',
      'Overdue': 'bg-red-50 text-red-700',
      'Not started': 'bg-gray-100 text-gray-600',
      'Cancelled': 'bg-gray-100 text-gray-500',
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    )
  }

  function RoleBadge({ role, alumniYear }: { role: string; alumniYear?: string | null }) {
    const colors: Record<string, string> = {
      admin: 'bg-purple-50 text-purple-700',
      group_leader: 'bg-blue-50 text-blue-700',
      student: 'bg-gray-100 text-gray-700',
      applicant: 'bg-orange-50 text-orange-700',
      alumni: 'bg-emerald-50 text-emerald-700',
    }
    const label = role === 'alumni' && alumniYear
      ? `Alumni · ${alumniYear}`
      : roleLabels[role] ?? role
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[role] ?? 'bg-gray-100 text-gray-600'}`}>
        {label}
      </span>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        >
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="group_leader">Group Leader</option>
          <option value="student">Student</option>
          <option value="applicant">Applicant</option>
          <option value="alumni">Alumni</option>
        </select>
        <select
          value={birthdayWindow}
          onChange={e => setBirthdayWindow(e.target.value as BirthdayWindow)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
        >
          <option value="all">Birthdays: any</option>
          <option value="today">Birthday today</option>
          <option value="week">Birthday this week</option>
          <option value="month">Birthday this month</option>
          <option value="nextMonth">Birthday next month</option>
        </select>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => downloadCSV(filtered)}
          className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none whitespace-nowrap"
                  style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                >
                  {col.label}
                  <SortIcon col={col.key} />
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(user => (
              <tr
                key={user.id}
                onClick={() => router.push(`/admin/students/${user.id}`)}
                className="hover:bg-gray-50/50 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 text-gray-900">{user.firstName || '—'}</td>
                <td className="px-4 py-3 text-gray-900 font-medium">{user.lastName || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3 text-gray-500">{user.phone ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-gray-500">{user.city ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{user.birthday ? formatBirthday(user.birthday) : <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3"><PaymentBadge status={user.paymentStatus} /></td>
                <td className="px-4 py-3"><HomeworkBadge status={user.homeworkStatus} /></td>
                <td className="px-4 py-3"><RoleBadge role={user.role} alumniYear={user.alumniYear} /></td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <ImpersonateButton email={user.email} name={`${user.firstName} ${user.lastName}`.trim() || user.email} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
