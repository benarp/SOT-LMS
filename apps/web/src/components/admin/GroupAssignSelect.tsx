'use client'

import { useTransition } from 'react'
import { updateStudentGroup } from '@/app/actions/admin'

type Group = { id: string; name: string }

export default function GroupAssignSelect({ studentId, currentGroupId, groups }: { studentId: string, currentGroupId: string | null, groups: Group[] }) {
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const groupId = e.target.value || null
    startTransition(() => updateStudentGroup(studentId, groupId))
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
