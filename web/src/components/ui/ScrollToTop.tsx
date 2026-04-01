import { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      id="scroll-to-top"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full
        bg-gradient-to-br from-indigo-500 to-violet-600
        text-white shadow-lg shadow-indigo-500/30
        flex items-center justify-center
        hover:scale-110 hover:shadow-xl hover:shadow-indigo-500/40
        active:scale-95 transition-all duration-200
        backdrop-blur-sm border border-white/20"
      aria-label="回到頂部"
    >
      <ChevronUp className="w-5 h-5" />
    </button>
  );
}
