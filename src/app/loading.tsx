export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-3 border-slate-200 border-t-indigo-600 animate-spin"></div>
        <span className="text-xs font-semibold text-slate-500">
          Loading Vivexa Hosting...
        </span>
      </div>
    </div>
  );
}
