import React from 'react';
import { FileSpreadsheet, ArrowRight } from 'lucide-react';

interface TemplatesTabViewProps {
  templates: any[];
  onLoadTemplate: (tpl: any) => void;
}

export const TemplatesTabView: React.FC<TemplatesTabViewProps> = ({
  templates,
  onLoadTemplate,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4">
      <div>
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
          <span>Google Sheet 歷史常用開套配置範本庫</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          對齊歷史 Sheet：數字賞位（1, 2, 3...）、X 盲盒賞、Z 小賞保底；支援 100 抽預設、300 抽進階、1000 抽與 3000 抽巨型套組。
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-xs">
          目前暫無範本資料。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-slate-950 border border-slate-800 hover:border-amber-500/50 p-4 rounded-xl flex flex-col justify-between transition group shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-300 px-2 py-0.5 bg-amber-950/60 rounded border border-amber-500/30">
                    {tpl.totalDraws} 抽
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    建議單抽 ${tpl.price1}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mt-2 group-hover:text-amber-300 transition">
                  {tpl.name}
                </h3>
                <div className="mt-3 text-xs text-slate-400 space-y-1 font-mono">
                  <div>
                    3抽: ${tpl.price3} | 5抽: ${tpl.price5} | 10抽: ${tpl.price10}
                  </div>
                  <div>目標毛利: {tpl.targetMargin}%</div>
                  <div className="text-[11px] text-slate-500 mt-2 truncate">
                    賞位編排: {(tpl.items || []).map((i: any) => i.prizeGrade).join(', ')}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onLoadTemplate(tpl)}
                className="mt-4 w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-900 hover:bg-amber-600 text-slate-200 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>載入此範本配賞</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
