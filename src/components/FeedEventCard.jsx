import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageSquare, Zap, Timer, Trophy, CheckCircle2 } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useEngagementStore from '../stores/engagementStore';
import FeedComments from './FeedComments';
import { timeAgo } from '../utils/time';

export default function FeedEventCard({ event }) {
  const { user } = useAuthStore();
  const {
    likesMap,
    commentCounts,
    toggleLike,
  } = useEngagementStore();

  const [commentsOpen, setCommentsOpen] = useState(false);

  const actor = event.actor;
  const isMe = event.user_id === user?.id;
  const payload = event.payload || {};

  const likeState = likesMap[event.id] || { count: 0, likedByMe: false };
  const commentCount = commentCounts[event.id] ?? 0;

  const handleLike = async () => {
    if (!user?.id) return;
    await toggleLike(event.id, user.id);
  };

  const getEventBadge = () => {
    switch (event.event_type) {
      case 'pr':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[#FFC815]/15 text-[#FFC815] border border-[#FFC815]/20">
            <Zap className="w-3 h-3" /> Nuevo PR
          </span>
        );
      case 'benchmark':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-500/15 text-blue-400 border border-blue-500/20">
            <Timer className="w-3 h-3" /> WOD Benchmark
          </span>
        );
      case 'achievement':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-500/15 text-amber-300 border border-amber-500/20">
            <Trophy className="w-3 h-3" /> Logro Desbloqueado
          </span>
        );
      case 'skill':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Nueva Skill
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 shadow-md flex flex-col gap-3">
      {/* Header: Athlete info */}
      <div className="flex items-center justify-between">
        <Link
          to={isMe ? '/profile' : `/athletes/${event.user_id}`}
          className="flex items-center gap-2.5 min-w-0 tap-bounce"
        >
          {actor?.avatar_url ? (
            <img
              src={actor.avatar_url}
              alt={actor.display_name}
              className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#292929] border border-white/10 flex items-center justify-center text-xs font-black text-[#FFC815] shrink-0">
              {actor?.first_name?.[0]?.toUpperCase() || 'R'}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white truncate">
                {actor?.full_name || actor?.display_name || 'Atleta'}
              </span>
              {isMe && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white/10 text-gray-300">
                  Tú
                </span>
              )}
            </div>
            <span className="text-xs text-[#A0A0A5] truncate block">
              @{actor?.display_name || 'atleta'} · {timeAgo(event.created_at)}
            </span>
          </div>
        </Link>

        {getEventBadge()}
      </div>

      {/* Event Details Card */}
      <div className="p-3.5 rounded-xl bg-[#0A0A0C] border border-white/5 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-[#A0A0A5] block">
            {payload.movement || payload.wod_name || payload.achievement_title || 'Entrenamiento'}
          </span>
          <span className="text-lg font-black text-white mt-0.5 block tracking-tight">
            {payload.formatted_value || payload.result || payload.value || '¡Completado!'}
          </span>
        </div>
        {payload.discipline && (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[#292929] text-[#FFC815]">
            {payload.discipline}
          </span>
        )}
      </div>

      {/* Engagement bar (Likes & Comments) */}
      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-xs font-bold tap-bounce transition-colors ${
            likeState.likedByMe ? 'text-red-500' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Heart className={`w-4 h-4 ${likeState.likedByMe ? 'fill-red-500' : ''}`} />
          <span>{likeState.count > 0 ? likeState.count : 'Me gusta'}</span>
        </button>

        <button
          type="button"
          onClick={() => setCommentsOpen((prev) => !prev)}
          className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white tap-bounce"
        >
          <MessageSquare className="w-4 h-4" />
          <span>{commentCount > 0 ? `${commentCount} comentarios` : 'Comentar'}</span>
        </button>
      </div>

      {/* Expandable comments */}
      {commentsOpen && (
        <FeedComments eventId={event.id} eventOwnerId={event.user_id} />
      )}
    </div>
  );
}
