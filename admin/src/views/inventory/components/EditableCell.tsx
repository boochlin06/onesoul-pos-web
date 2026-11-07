import React from 'react';
import type {
  InventoryItem,
  ActiveCell,
  EditingCell,
  CellFeedback,
  PendingCellChange,
} from '../types.js';
import { CategorySpinnerCell } from './CategorySpinnerCell.js';

interface EditableCellProps {
  item: InventoryItem;
  colId: string;
  align?: 'left' | 'center' | 'right';
  isCompact?: boolean;
  activeCell: ActiveCell | null;
  editingCell: EditingCell | null;
  cellFeedback: Record<string, CellFeedback>;
  pendingChanges: Map<string, PendingCellChange>;
  categories: string[];
  isCustomCategoryMode: boolean;
  setIsCustomCategoryMode: (val: boolean) => void;
  onSetActiveCell: (cell: ActiveCell) => void;
  onSetEditingCell: (cell: EditingCell | null) => void;
  onCommit: (rowId: string, colId: string, val: any) => void;
  onKeyDown: (e: React.KeyboardEvent, rowId: string, colId: string) => void;
  onRegisterNewCategory: (cat: string) => void;
  formatValue?: (val: any) => React.ReactNode;
  customClass?: string;
  getCellValue: (item: any, colId: string) => any;
}

export const EditableCell: React.FC<EditableCellProps> = React.memo(({
  item,
  colId,
  align = 'left',
  isCompact = true,
  activeCell,
  editingCell,
  cellFeedback,
  pendingChanges,
  categories,
  isCustomCategoryMode,
  setIsCustomCategoryMode,
  onSetActiveCell,
  onSetEditingCell,
  onCommit,
  onKeyDown,
  onRegisterNewCategory,
  formatValue,
  customClass = '',
  getCellValue,
}) => {
  const rawVal = getCellValue(item, colId);
  const cellKey = `${item.id}_${colId}`;
  const isEditing = editingCell?.rowId === item.id && editingCell?.colId === colId;
  const isActive = activeCell?.rowId === item.id && activeCell?.colId === colId;
  const isPending = pendingChanges.has(cellKey);
  const feedback = cellFeedback[cellKey];

  const rowHeightClass = isCompact ? 'h-8 text-xs' : 'h-11 text-sm';
  const cellPaddingClass = isCompact ? 'px-2.5 py-0.5' : 'px-3 py-2';

  // 動態狀態樣式
  let stateStyles = 'border-b border-r border-slate-800/80 hover:bg-slate-750/70 transition-colors';
  if (isEditing) {
    stateStyles = 'ring-2 ring-blue-400 bg-slate-900 z-10 relative';
  } else if (feedback?.status === 'saving') {
    stateStyles = 'ring-2 ring-cyan-500 bg-cyan-950/30 text-cyan-200 animate-pulse z-10 relative';
  } else if (feedback?.status === 'saved') {
    stateStyles = 'ring-2 ring-emerald-400 bg-emerald-950/40 text-emerald-300 transition-all duration-700 z-10 relative';
  } else if (feedback?.status === 'error') {
    stateStyles = 'ring-2 ring-rose-500 bg-rose-950/40 text-rose-300 z-10 relative';
  } else if (isPending) {
    stateStyles = 'bg-amber-950/25 border-b border-r border-amber-600/40 text-amber-200 relative';
  } else if (isActive) {
    stateStyles = 'ring-2 ring-blue-500 bg-blue-950/30 z-10 relative';
  }

  return (
    <td
      key={colId}
      onClick={() => {
        onSetActiveCell({ rowId: item.id, colId });
      }}
      onDoubleClick={() => {
        onSetActiveCell({ rowId: item.id, colId });
        setIsCustomCategoryMode(false);
        onSetEditingCell({ rowId: item.id, colId, value: rawVal });
      }}
      className={`${cellPaddingClass} ${rowHeightClass} ${stateStyles} ${customClass} cursor-text select-none text-${align}`}
    >
      {isEditing ? (
        colId === 'category' ? (
          <CategorySpinnerCell
            value={editingCell?.value}
            categories={categories}
            isCustomMode={isCustomCategoryMode}
            setIsCustomMode={setIsCustomCategoryMode}
            onCommit={(val) => onCommit(item.id, colId, val)}
            onKeyDown={(e) => onKeyDown(e, item.id, colId)}
            onRegisterNewCategory={onRegisterNewCategory}
          />
        ) : (
          <input
            type={['costPrice', 'sellingPrice', 'suggestedPoints', 'safetyStock'].includes(colId) || colId.startsWith('store_') ? 'number' : 'text'}
            autoFocus
            value={editingCell?.value ?? ''}
            onChange={(e) => onSetEditingCell({ rowId: item.id, colId, value: e.target.value })}
            onBlur={() => onCommit(item.id, colId, editingCell?.value)}
            onKeyDown={(e) => onKeyDown(e, item.id, colId)}
            onFocus={(e) => e.target.select()}
            className="w-full h-full bg-transparent text-white font-mono outline-none px-0.5 border-none"
          />
        )
      ) : (
        <div className="flex items-center justify-between w-full h-full gap-1">
          <span className="truncate w-full">
            {formatValue ? formatValue(rawVal) : rawVal}
          </span>
          {isPending && (
            <span
              className="w-2 h-2 rounded-full bg-amber-400 shrink-0 ml-1 shadow-sm shadow-amber-400/50"
              title="已暫存修改 (待提交)"
            />
          )}
        </div>
      )}
    </td>
  );
});
