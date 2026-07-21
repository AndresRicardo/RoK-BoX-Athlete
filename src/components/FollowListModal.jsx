import { useEffect, useState } from 'react';
import useAuthStore from '../stores/authStore';
import useFollowStore from '../stores/followStore';
import AthleteRow from './AthleteRow';
import './FollowListModal.css';

// Lista de seguidores/seguidos de cualquier usuario (grafo publico).
function FollowListModal({ userId, type, onClose }) {
  const { user } = useAuthStore();
  const {
    following,
    saving,
    follow,
    unfollow,
    fetchFollowingList,
    fetchFollowersList,
  } = useFollowStore();

  const [people, setPeople] = useState(null);
  const [error, setError] = useState(null);

  const title = type === 'followers' ? 'Seguidores' : 'Siguiendo';

  useEffect(() => {
    const load = type === 'followers' ? fetchFollowersList : fetchFollowingList;
    load(userId)
      .then(setPeople)
      .catch((e) => setError(e.message));
  }, [userId, type, fetchFollowersList, fetchFollowingList]);

  const handleToggle = async (athlete) => {
    try {
      if (following.includes(athlete.id)) {
        await unfollow(user.id, athlete.id);
      } else {
        await follow(user.id, athlete.id);
      }
    } catch {
      // error ya en store
    }
  };

  return (
    <div className="follow-modal-overlay" onClick={onClose}>
      <div
        className="follow-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="follow-modal-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="follow-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="follow-modal-body">
          {error && <div className="form-error">{error}</div>}
          {people === null ? (
            <p className="follow-modal-loading">Cargando...</p>
          ) : people.length === 0 ? (
            <p className="follow-modal-empty">
              {type === 'followers'
                ? 'Aún no tiene seguidores.'
                : 'Aún no sigue a nadie.'}
            </p>
          ) : (
            people.map((a) => (
              <AthleteRow
                key={a.id}
                athlete={a}
                following={following.includes(a.id)}
                saving={saving}
                onToggleFollow={handleToggle}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default FollowListModal;
