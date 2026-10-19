import { Link } from 'react-router-dom';
import { UserCheck, UserPlus } from 'lucide-react';
import useFollowStore from '../stores/followStore';
import useAuthStore from '../stores/authStore';

export default function AthleteRow({ athlete, onSelect, showFollowButton = true }) {
  const { user } = useAuthStore();
  const { isFollowing, follow, unfollow } = useFollowStore();

  const isMe = athlete.id === user?.id;
  const following = isFollowing(athlete.id);

  const handleFollowToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMe) return;

    if (following) {
      await unfollow(user.id, athlete.id);
    } else {
      await follow(user.id, athlete.id);
    }
  };

  const content = (
    <div
      onClick={() => onSelect && onSelect(athlete)}
      className="p-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center justify-between gap-3 tap-bounce cursor-pointer hover:border-[#FFC815]/30 transition-all"
    >
      <div className="flex items-center gap-3 min-w-0">
        {athlete.avatar_url ? (
          <img
            src={athlete.avatar_url}
            alt={athlete.display_name}
            className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0"
          />
        ) : (
          <div className="w-11 h-11 rounded-xl bg-[#292929] border border-white/10 flex items-center justify-center text-sm font-black text-[#FFC815] shrink-0">
            {athlete.first_name?.[0]?.toUpperCase() || 'A'}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white truncate">
              {athlete.full_name || `${athlete.first_name || ''} ${athlete.last_name || ''}`}
            </span>
            {athlete.discipline && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-[#292929] text-[#FFC815]">
                {athlete.discipline}
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-[#A0A0A5] truncate block">
            @{athlete.display_name || 'atleta'}
          </span>
        </div>
      </div>

      {showFollowButton && !isMe && (
        <button
          type="button"
          onClick={handleFollowToggle}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 tap-bounce shrink-0 transition-colors ${
            following
              ? 'bg-[#292929] text-gray-300 border border-white/10'
              : 'bg-[#FFC815] text-black shadow-md'
          }`}
        >
          {following ? (
            <>
              <UserCheck className="w-3.5 h-3.5" />
              <span>Siguiendo</span>
            </>
          ) : (
            <>
              <UserPlus className="w-3.5 h-3.5" />
              <span>Seguir</span>
            </>
          )}
        </button>
      )}
    </div>
  );

  if (onSelect) {
    return content;
  }

  return (
    <Link to={isMe ? '/profile' : `/athletes/${athlete.id}`}>
      {content}
    </Link>
  );
}
