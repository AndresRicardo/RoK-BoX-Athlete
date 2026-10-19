import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Trash2 } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useEngagementStore from '../stores/engagementStore';
import { timeAgo } from '../utils/time';

export default function FeedComments({ eventId, eventOwnerId }) {
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

  const comments = commentsByEvent[eventId];

  useEffect(() => {
    fetchComments(eventId).catch((e) => setError(e.message));
  }, [eventId, fetchComments]);

  const canDelete = (c) => c.user_id === user?.id || eventOwnerId === user?.id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!draft.trim() || saving) return;
    try {
      await addComment(eventId, user.id, draft.trim());
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
    <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-3">
      {error && (
        <div className="p-2 rounded-lg bg-red-500/10 text-red-400 text-xs">{error}</div>
      )}

      {comments === undefined ? (
        <p className="text-xs text-[#A0A0A5] py-2 text-center">Cargando comentarios...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-[#A0A0A5] py-2 text-center">Sé el primero en comentar 💬</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
          {comments.map((c) => {
            const author = c.author;
            const isMe = c.user_id === user?.id;

            return (
              <div
                key={c.id}
                className="p-2.5 rounded-xl bg-[#0A0A0C] border border-white/5 flex items-start gap-2.5 text-xs"
              >
                <Link to={isMe ? '/profile' : `/athletes/${c.user_id}`} className="shrink-0 mt-0.5">
                  {author?.avatar_url ? (
                    <img
                      src={author.avatar_url}
                      alt={author.display_name}
                      className="w-7 h-7 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-[#292929] text-[#FFC815] font-black flex items-center justify-center text-[10px]">
                      {author?.first_name?.[0]?.toUpperCase() || 'A'}
                    </div>
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <Link
                      to={isMe ? '/profile' : `/athletes/${c.user_id}`}
                      className="font-bold text-white hover:text-[#FFC815]"
                    >
                      @{author?.display_name || 'atleta'}
                    </Link>
                    <span className="text-[10px] text-gray-500">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-gray-300 mt-0.5 break-words">{c.content}</p>
                </div>

                {canDelete(c) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="p-1 text-gray-500 hover:text-red-400 shrink-0"
                    title="Eliminar comentario"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Input de nuevo comentario */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escribe un comentario..."
          maxLength={500}
          className="flex-1 px-3 py-2 rounded-xl bg-[#0A0A0C] border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC815]"
        />
        <button
          type="submit"
          disabled={!draft.trim() || saving}
          className="p-2 rounded-xl bg-[#FFC815] text-black font-bold disabled:opacity-40 tap-bounce"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
