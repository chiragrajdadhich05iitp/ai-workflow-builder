export default function DashboardLoading() {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar skeleton */}
      <aside className="w-56 flex-shrink-0 h-screen bg-white border-r border-gray-200 flex flex-col">
        <div className="h-14 flex items-center px-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-purple-200 animate-pulse" />
            <div className="w-20 h-4 rounded bg-gray-200 animate-pulse" />
          </div>
        </div>
        <nav className="flex-1 p-3">
          <div className="w-full h-9 rounded-lg bg-gray-100 animate-pulse" />
        </nav>
      </aside>

      {/* Workflow list skeleton */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between mb-6">
            <div className="w-36 h-7 rounded bg-gray-200 animate-pulse" />
            <div className="w-32 h-9 rounded-xl bg-gray-200 animate-pulse" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <div className="w-48 h-4 rounded bg-gray-200 animate-pulse" />
                <div className="w-32 h-3 rounded bg-gray-100 animate-pulse" />
              </div>
              <div className="w-16 h-6 rounded-full bg-gray-100 animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
