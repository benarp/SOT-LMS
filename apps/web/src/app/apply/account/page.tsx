import { Suspense } from 'react'
import AccountForm from './AccountForm'

export default function ApplyAccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountForm />
    </Suspense>
  )
}
