'use client'

import { useState, useTransition } from 'react'
import { updateStudentGroup } from '@/app/actions/admin'

type Group = { id: string; name: string }

export default function GroupAssignSelect({ studentId, currentGroupId, groups }: { studentId: string, currentGroupId: string | null, groups: Group[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const groupId = e.target.value || null
    setError('')
    startTransition(async () => {
      const result = await updateStudentGroup(studentId, groupId)
      if (result?.error) setError(result.error)
    })
  }

  if (error) {
    return <p className="text-xs text-red-500 max-w-[160px]">{error}</p>
  }

  return (
    <select
      value={currentGroupId || ''}
      onChange={handleChange}
      disabled={isPending}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white disabled:opacity-50 max-w-[120px]"
    >
      <option value="">No group</option>
      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  )
}
