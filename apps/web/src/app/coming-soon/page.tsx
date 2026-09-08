import SignOutButton from '@/components/SignOutButton'

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-8 text-center space-y-4">
        <h1 className="text-2xl font-medium text-gray-900">Coming soon</h1>
        <p className="text-sm text-gray-500">
          Your account is set up, but the School of Transformation portal isn&apos;t open yet.
          We&apos;ll let you know as soon as it&apos;s ready.
        </p>
        <div className="pt-4">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
