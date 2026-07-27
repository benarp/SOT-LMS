import { Suspense } from 'react'
import LoginForm from './LoginForm'
import { getApplicationCycle } from '@/lib/applicationYear'

export default async function LoginPage() {
  const { year } = await getApplicationCycle()

  return (
    <Suspense fallback={null}>
      <LoginForm applyYearLabel={year?.name ?? null} />
    </Suspense>
  )
}
