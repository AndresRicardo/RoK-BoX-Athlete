import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import useProfileStore from '../stores/profileStore';
import NotificationsBell from './NotificationsBell';

export default function TopHeader({ title }) {
  const { profile } = useProfileStore();
  const isStaff = profile?.role === 'admin' || profile?.role === 'coach';

  return (
    <header className="sticky top-0 z-30 w-full glass-header safe-top px-4 pb-3 flex items-center justify-between">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 tap-bounce">
          <img src="/favicon.svg" alt="RöK BoX" className="w-8 h-8 object-contain" />
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tight text-white leading-none">
              RöK<span className="text-[#FFC815]">BoX</span>
            </span>
            <span className="text-[10px] font-bold tracking-widest text-[#A0A0A5] uppercase">
              Athlete
            </span>
          </div>
        </Link>
        {title && (
          <div className="h-5 w-px bg-white/10 mx-1 hidden sm:block" />
        )}
        {title && (
          <span className="text-xs font-semibold text-gray-300 hidden sm:block">
            {title}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isStaff && (
          <Link
            to="/staff"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FFC815]/15 border border-[#FFC815]/30 text-[#FFC815] text-xs font-bold tap-bounce"
            title="Panel de Staff / Coach"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden xs:inline">Staff</span>
          </Link>
        )}

        <NotificationsBell />

        <Link to="/profile" className="tap-bounce">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name || 'Perfil'}
              className="w-9 h-9 rounded-xl object-cover border border-[#FFC815]/40"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-[#292929] border border-white/10 flex items-center justify-center text-xs font-black text-[#FFC815]">
              {profile?.first_name?.[0]?.toUpperCase() || 'R'}
            </div>
          )}
        </Link>
      </div>
    </header>
  );
}
