import { useEffect } from 'react';
import useAchievementStore from '../stores/achievementStore';
import './AchievementModal.css';

function AchievementModal() {
  const newUnlock = useAchievementStore((s) => s.newUnlock);
  const dismiss = useAchievementStore((s) => s.dismissNewUnlock);

  useEffect(() => {
    if (!newUnlock) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [newUnlock, dismiss]);

  if (!newUnlock) return null;

  return (
    <div
      className="achievement-modal-backdrop"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="achievement-modal-title"
    >
      <div
        className="achievement-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="achievement-modal-icon">{newUnlock.icon}</div>
        <span className="achievement-modal-label">Logro desbloqueado</span>
        <h2 id="achievement-modal-title" className="achievement-modal-title">
          {newUnlock.name}
        </h2>
        <p className="achievement-modal-description">{newUnlock.description}</p>
        <span className={`achievement-modal-tier tier-${newUnlock.tier}`}>
          {newUnlock.tier}
        </span>
        <button
          type="button"
          className="btn-primary achievement-modal-btn"
          onClick={dismiss}
        >
          Genial
        </button>
      </div>
    </div>
  );
}

export default AchievementModal;
