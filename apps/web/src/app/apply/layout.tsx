export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-8">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">School of Transformation</p>
          <h1 className="text-xl font-semibold text-gray-900">Application</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
