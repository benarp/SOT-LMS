import Link from 'next/link'
import { getApplicationCycle } from '@/lib/applicationYear'

export default async function ApplyLandingPage() {
  const { year: schoolYear, isOpen, opensAt, closesAt } = await getApplicationCycle()

  const now = new Date()
  const notOpenYet = opensAt && opensAt > now
  const closed = closesAt && closesAt < now

  if (!isOpen) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Applications are currently closed</h2>
        {notOpenYet && opensAt && (
          <p className="text-sm text-gray-500">
            Applications for {schoolYear?.name} open on{' '}
            {opensAt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.
          </p>
        )}
        {closed && (
          <p className="text-sm text-gray-500">
            The application window for {schoolYear?.name} has closed.
          </p>
        )}
        {!opensAt && !closesAt && (
          <p className="text-sm text-gray-500">Check back soon for information about the next school year.</p>
        )}
        <p className="text-sm text-gray-400 mt-3">
          Already applied?{' '}
          <Link href="/apply/account?mode=signin" className="text-gray-600 underline underline-offset-2">
            Sign in to check your status
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
          Apply for {schoolYear?.name ?? 'the upcoming year'}
        </h2>
        {closesAt && (
          <p className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 inline-block mb-4">
            Applications close {closesAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        <p className="text-gray-600 mb-6 leading-relaxed">
          School of Transformation is a 9-month discipleship training school that meets weekly.
          This application takes about 15–20 minutes. You can save your progress and come back at any time.
        </p>

        <div className="space-y-3 mb-8">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center flex-shrink-0 font-medium">1</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Questionnaire</p>
              <p className="text-sm text-gray-500">Share a bit about yourself, your faith journey, and why you want to attend.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center flex-shrink-0 font-medium">2</div>
            <div>
              <p className="text-sm font-medium text-gray-900">Pastoral reference</p>
              <p className="text-sm text-gray-500">Provide your pastor's contact info — we'll email them a short reference form.</p>
            </div>
          </div>
        </div>

        <Link
          href="/apply/account"
          className="inline-block bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          Start your application →
        </Link>
      </div>

      <p className="text-sm text-gray-400 text-center">
        Already started?{' '}
        <Link href="/apply/account?mode=signin" className="text-gray-600 underline underline-offset-2">
          Sign in to continue
        </Link>
      </p>
    </div>
  )
}
