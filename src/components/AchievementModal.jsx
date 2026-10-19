import { useEffect } from 'react';
import { Trophy, Sparkles, X } from 'lucide-react';
import useAchievementStore from '../stores/achievementStore';

export default function AchievementModal() {
  const newUnlock = useAchievementStore((s) => s.newUnlock);
  const dismiss = useAchievementStore((s) => s.dismissNewUnlock);

  useEffect(() => {
    if (!newUnlock) return;
    const onKey = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newUnlock, dismiss]);

  if (!newUnlock) return null;

  const getTierColor = (tier) => {
    switch (tier?.toLowerCase()) {
      case 'gold':
        return 'bg-[#FFC815]/20 text-[#FFC815] border-[#FFC815]/30';
      case 'silver':
        return 'bg-slate-300/20 text-slate-200 border-slate-300/30';
      case 'bronze':
        return 'bg-amber-700/20 text-amber-300 border-amber-700/30';
      default:
        return 'bg-[#FFC815]/20 text-[#FFC815] border-[#FFC815]/30';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm p-6 rounded-3xl bg-[#1C1C1E] border border-[#FFC815]/40 shadow-2xl flex flex-col items-center text-center relative overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow */}
        <div className="absolute -top-12 -left-12 w-36 h-36 bg-[#FFC815]/20 rounded-full blur-3xl pointer-events-none" />

        <button
          type="button"
          onClick={dismiss}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Big Icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#FFC815] to-amber-200 text-black flex items-center justify-center text-4xl shadow-lg mb-4 mt-2">
          {newUnlock.icon || <Trophy className="w-10 h-10" />}
        </div>

        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#FFC815] mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>¡Logro Desbloqueado!</span>
        </div>

        <h2 className="text-xl font-black text-white">{newUnlock.name}</h2>
        <p className="text-xs text-[#A0A0A5] mt-2 leading-relaxed">
          {newUnlock.description}
        </p>

        {newUnlock.tier && (
          <span
            className={`mt-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getTierColor(
              newUnlock.tier
            )}`}
          >
            Nivel {newUnlock.tier}
          </span>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="w-full mt-6 py-3 rounded-xl bg-[#FFC815] text-black font-black text-sm uppercase tracking-wider tap-bounce shadow-lg shadow-[#FFC815]/20"
        >
          ¡Genial!
        </button>
      </div>
    </div>
  );
}
