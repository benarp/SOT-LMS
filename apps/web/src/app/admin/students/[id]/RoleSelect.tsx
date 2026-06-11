'use client'

import { useState, useTransition } from 'react'
import { updateUserRole } from '@/app/actions/admin'

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  group_leader: 'Group Leader',
  student: 'Student',
  applicant: 'Applicant',
}

export default function RoleSelect({ userId, currentRole }: { userId: string; currentRole: string }) {
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value
    if (!confirm(`Change this user's role to ${roleLabels[role] ?? role}?`)) {
      e.target.value = currentRole
      return
    }
    setError('')
    startTransition(async () => {
      const result = await updateUserRole(userId, role)
      if (result.error) setError(result.error)
    })
  }

  return (
    <div className="text-right">
      <select
        defaultValue={currentRole}
        onChange={handleChange}
        disabled={isPending}
        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white disabled:opacity-50"
      >
        {Object.entries(roleLabels).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
