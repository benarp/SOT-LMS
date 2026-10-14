// A Player Coach is a student who also leads a group. They belong in both
// lists: counted wherever students are (reports, reflections, emails, billing,
// graduation), and let into the group leader pages for their own group.
export const STUDENT_ROLES = ['student', 'player_coach']
export const LEADER_ROLES = ['group_leader', 'player_coach']

export function isStudentRole(role: string | null | undefined): boolean {
  return !!role && STUDENT_ROLES.includes(role)
}

export function isLeaderRole(role: string | null | undefined): boolean {
  return !!role && LEADER_ROLES.includes(role)
}

// How a role reads to the person who holds it. Player Coach is an admin
// distinction — to the coach themselves, and anyone viewing as them, they're
// a group leader.
export function ownRoleLabel(role: string): string {
  return role === 'player_coach' ? 'group leader' : role.replace('_', ' ')
}
