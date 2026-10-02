export default function WorkflowLoading() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f1f2f4]">
      {/* Top bar skeleton */}
      <div className="absolute top-0 left-0 right-0 h-12 flex items-center px-3 gap-2 z-30">
        <div className="w-9 h-9 rounded-xl bg-white/80 animate-pulse" />
        <div className="w-52 h-9 rounded-xl bg-white/80 animate-pulse" />
        <div className="flex-1" />
        <div className="w-24 h-9 rounded-xl bg-white/80 animate-pulse" />
        <div className="w-24 h-9 rounded-xl bg-white/80 animate-pulse" />
        <div className="w-9 h-9 rounded-xl bg-purple-400/60 animate-pulse" />
        <div className="w-9 h-9 rounded-xl bg-white/80 animate-pulse" />
      </div>

      {/* Canvas dot background */}
      <svg className="absolute inset-0 w-full h-full opacity-50" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="#798396" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>

      {/* Centre spinner */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-purple-300 border-t-purple-600 animate-spin" />
      </div>
    </div>
  );
}
