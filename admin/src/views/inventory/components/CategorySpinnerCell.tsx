import React, { useState } from 'react';

interface CategorySpinnerCellProps {
  value: string;
  categories: string[];
  isCustomMode: boolean;
  setIsCustomMode: (val: boolean) => void;
  onCommit: (val: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onRegisterNewCategory: (cat: string) => void;
}

export const CategorySpinnerCell: React.FC<CategorySpinnerCellProps> = ({
  value,
  categories,
  isCustomMode,
  setIsCustomMode,
  onCommit,
  onKeyDown,
  onRegisterNewCategory,
}) => {
  const [customInput, setCustomInput] = useState('');

  if (isCustomMode) {
    return (
      <div className="flex items-center gap-1 w-full h-full">
        <input
          type="text"
          autoFocus
          placeholder="輸入新類別..."
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onBlur={() => {
            const val = customInput.trim();
            if (val) onRegisterNewCategory(val);
            setIsCustomMode(false);
            onCommit(val || 'GENERAL');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setIsCustomMode(false);
              onKeyDown(e);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const val = customInput.trim();
              if (val) onRegisterNewCategory(val);
              setIsCustomMode(false);
              onCommit(val || 'GENERAL');
            }
          }}
          className="w-full h-full bg-slate-900 text-amber-300 font-sans outline-none px-1 border border-amber-500 rounded text-xs"
        />
      </div>
    );
  }

  return (
    <select
      autoFocus
      value={categories.includes(value) ? value : (value ? 'CURRENT_CUSTOM' : 'GENERAL')}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '__NEW__') {
          setIsCustomMode(true);
          setCustomInput('');
        } else {
          onCommit(val);
        }
      }}
      onBlur={() => {
        if (!isCustomMode) {
          onCommit(value);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onKeyDown(e);
        } else if (e.key === 'Tab') {
          onKeyDown(e);
        }
      }}
      className="w-full h-full bg-slate-900 text-white font-sans outline-none px-0.5 border border-blue-400 rounded text-xs cursor-pointer"
    >
      {!categories.includes(value) && value && (
        <option value="CURRENT_CUSTOM">{value} (自訂)</option>
      )}
      <optgroup label="核心大類">
        <option value="GENERAL">一般商品 (GENERAL)</option>
        <option value="GK">GK 雕像 (GK)</option>
        <option value="BLIND_BOX">盒玩盲盒 (BLIND_BOX)</option>
        <option value="FIGURE">景品公仔 (FIGURE)</option>
      </optgroup>
      <optgroup label="熱門 IP 系列">
        {categories.filter((c) => !['GK', 'BLIND_BOX', 'FIGURE', 'GENERAL'].includes(c)).map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </optgroup>
      <option value="__NEW__" className="text-amber-400 font-bold bg-slate-800">+ 新增自訂類別...</option>
    </select>
  );
};
