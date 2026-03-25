import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = '搜尋...', className = '' }: SearchInputProps) {
  return (
    <div className={`flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm ${className}`}>
      <Search className="w-4 h-4 text-slate-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-sm outline-none flex-1 min-w-0"
      />
      {value && (
        <button onClick={() => onChange('')}>
          <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
        </button>
      )}
    </div>
  );
}
