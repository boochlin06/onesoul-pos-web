import React from 'react';
import { Clock, Trash2 } from 'lucide-react';

interface DraftsTabViewProps {
  drafts: any[];
  onLoadDraft: (draft: any) => void;
  onDeleteDraft: (id: string) => void;
}

export const DraftsTabView: React.FC<DraftsTabViewProps> = ({
  drafts,
  onLoadDraft,
  onDeleteDraft,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>未發布配賞草稿箱</span>
        </h2>
      </div>

      {drafts.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs">
          目前暫無儲存的配賞草稿。在工作台點擊「儲存草稿」即可暫存未完成方案。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drafts.map((d) => (
            <div
              key={d.id}
              className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white truncate max-w-[180px]">
                  {d.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {d.storeId === 'chupei' ? '竹北旗艦店' : '金山概念店'}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-400">
                <div>
                  總抽數: {d.totalDraws} 抽 | 單抽: ${d.price1}
                </div>
                <div>包含獎品: {d.items?.length || 0} 項</div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => onLoadDraft(d)}
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  載入編輯
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteDraft(d.id)}
                  className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded transition cursor-pointer"
                  title="刪除草稿"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
