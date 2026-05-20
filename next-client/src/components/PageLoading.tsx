export default function PageLoading() {
  return (
    <div className="min-h-screen bg-[#050915] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-400/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
        </div>
        <p className="text-sm text-gray-400 tracking-widest uppercase">Đang tải...</p>
      </div>
    </div>
  );
}
