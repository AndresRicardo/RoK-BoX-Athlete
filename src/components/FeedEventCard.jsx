import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useEngagementStore from '../stores/engagementStore';
import FeedComments from './FeedComments';
import { getAchievementById } from '../data/achievements';
import { formatPrValue, formatBenchmarkResult } from '../utils/format';
import { timeAgo } from '../utils/time';
import './FeedEventCard.css';

const EVENT_ICONS = {
  pr: '🏋️',
  benchmark: '⏱️',
  achievement: '🏆',
  skill: '💪',
};

function renderEventText(e) {
  const p = e.payload || {};
  switch (e.event_type) {
    case 'pr':
      return (
        <>
          registró un PR en <strong>{p.movement}</strong>:{' '}
          <strong>{formatPrValue(p)}</strong>
        </>
      );
    case 'benchmark':
      return (
        <>
          completó <strong>{p.name}</strong>:{' '}
          <strong>{formatBenchmarkResult(p)}</strong>
          {p.scaling ? ` (${p.scaling.toUpperCase()})` : ''}
        </>
      );
    case 'achievement': {
      const def = getAchievementById(p.achievement_id);
      return (
        <>
          desbloqueó el logro{' '}
          <strong>{def?.name || p.achievement_id}</strong>
        </>
      );
    }
    case 'skill':
      return (
        <>
          desbloqueó <strong>{p.movement}</strong>
        </>
      );
    default:
      return null;
  }
}

// Tarjeta de evento del feed con likes y comentarios expandibles.
function FeedEventCard({ event: e }) {
  const { user } = useAuthStore();
  const { likes, commentCounts, toggleLike } = useEngagementStore();
  const [expanded, setExpanded] = useState(false);

  const like = likes[e.id] || { count: 0, likedByMe: false };
  const commentCount = commentCounts[e.id] || 0;

  const initials =
    `${e.athlete?.first_name?.[0] ?? ''}${e.athlete?.last_name?.[0] ?? ''}`.toUpperCase() ||
    '@';

  const handleLike = () => {
    toggleLike(e.id, user.id).catch(() => {});
  };

  return (
    <article className="feed-card">
      <div className="feed-card-main">
        <Link
          to={`/athletes/${e.user_id}`}
          className="feed-card-avatar"
          aria-hidden="true"
          tabIndex={-1}
        >
          {e.athlete?.avatar_url ? (
            <img src={e.athlete.avatar_url} alt="" />
          ) : (
            initials
          )}
        </Link>

        <div className="feed-card-body">
          <p className="feed-card-text">
            <Link to={`/athletes/${e.user_id}`} className="feed-card-handle">
              @{e.athlete?.display_name || 'atleta'}
            </Link>{' '}
            <span className="feed-card-icon" aria-hidden="true">
              {EVENT_ICONS[e.event_type] || '📣'}
            </span>{' '}
            {renderEventText(e)}
          </p>
          <span className="feed-card-time">{timeAgo(e.created_at)}</span>
        </div>
      </div>

      <div className="feed-card-actions">
        <button
          type="button"
          className={`feed-action ${like.likedByMe ? 'feed-action-liked' : ''}`}
          onClick={handleLike}
          aria-pressed={like.likedByMe}
          aria-label={like.likedByMe ? 'Quitar me gusta' : 'Me gusta'}
        >
          <span aria-hidden="true">{like.likedByMe ? '❤️' : '🤍'}</span>
          {like.count > 0 && <span>{like.count}</span>}
        </button>
        <button
          type="button"
          className={`feed-action ${expanded ? 'feed-action-active' : ''}`}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label="Comentarios"
        >
          <span aria-hidden="true">💬</span>
          {commentCount > 0 && <span>{commentCount}</span>}
        </button>
      </div>

      {expanded && <FeedComments eventId={e.id} eventOwnerId={e.user_id} />}
    </article>
  );
}

export default FeedEventCard;
