interface CreateSetSuccessModalProps {
  setId: string;
  setName: string;
  onDismiss: () => void;
}

export function CreateSetSuccessModal({ setId, setName, onDismiss }: CreateSetSuccessModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden m-4 text-center">
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
          <div className="text-4xl mb-2">📦</div>
          <h3 className="text-lg font-bold">開套成功！</h3>
        </div>
        <div className="p-6 space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div className="text-xs text-amber-500 font-bold uppercase tracking-wider mb-1">套號</div>
            <div className="text-2xl font-black text-amber-700">#{setId}</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">套名</div>
            <div className="text-lg font-bold text-slate-700">{setName}</div>
          </div>
          <button
            onClick={onDismiss}
            className="w-full mt-2 px-4 py-2.5 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/20 transition-all"
          >
            確認
          </button>
        </div>
      </div>
    </div>
  );
}
