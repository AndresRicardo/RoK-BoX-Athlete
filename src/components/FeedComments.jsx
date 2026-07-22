import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useEngagementStore from '../stores/engagementStore';
import { timeAgo } from '../utils/time';
import './FeedComments.css';

// Seccion expandible de comentarios de un evento del feed.
function FeedComments({ eventId, eventOwnerId }) {
  const { user } = useAuthStore();
  const {
    commentsByEvent,
    saving,
    fetchComments,
    addComment,
    deleteComment,
  } = useEngagementStore();

  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);

  const comments = commentsByEvent[eventId]; // undefined = sin cargar

  useEffect(() => {
    fetchComments(eventId).catch((e) => setError(e.message));
  }, [eventId, fetchComments]);

  const canDelete = (c) => c.user_id === user?.id || eventOwnerId === user?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!draft.trim() || saving) return;
    try {
      await addComment(eventId, user.id, draft);
      setDraft('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      await deleteComment(commentId, eventId);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="feed-comments">
      {error && <div className="form-error">{error}</div>}

      {comments === undefined ? (
        <p className="feed-comments-loading">Cargando comentarios...</p>
      ) : comments.length === 0 ? (
        <p className="feed-comments-empty">Sé el primero en comentar 💬</p>
      ) : (
        <ul className="feed-comments-list">
          {comments.map((c) => {
            const initials =
              `${c.author?.first_name?.[0] ?? ''}${c.author?.last_name?.[0] ?? ''}`.toUpperCase() ||
              '@';
            return (
              <li key={c.id} className="feed-comment">
                <Link
                  to={`/athletes/${c.user_id}`}
                  className="feed-comment-avatar"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  {c.author?.avatar_url ? (
                    <img src={c.author.avatar_url} alt="" />
                  ) : (
                    initials
                  )}
                </Link>
                <div className="feed-comment-body">
                  <p className="feed-comment-text">
                    <Link
                      to={`/athletes/${c.user_id}`}
                      className="feed-comment-handle"
                    >
                      @{c.author?.display_name || 'atleta'}
                    </Link>{' '}
                    {c.body}
                  </p>
                  <span className="feed-comment-time">
                    {timeAgo(c.created_at)}
                  </span>
                </div>
                {canDelete(c) && (
                  <button
                    type="button"
                    className="feed-comment-delete"
                    onClick={() => handleDelete(c.id)}
                    disabled={saving}
                    aria-label="Eliminar comentario"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form className="feed-comments-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe un comentario..."
          maxLength={500}
          aria-label="Escribe un comentario"
        />
        <button
          type="submit"
          className="feed-comments-send"
          disabled={saving || !draft.trim()}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

export default FeedComments;
