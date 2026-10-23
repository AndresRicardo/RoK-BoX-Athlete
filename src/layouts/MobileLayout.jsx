import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import TopHeader from '../components/TopHeader';
import BottomNavigation from '../components/BottomNavigation';
import AchievementModal from '../components/AchievementModal';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';

export default function MobileLayout({ title }) {
  const userId = useAuthStore((state) => state.user?.id);
  const fetchProfile = useProfileStore((state) => state.fetchProfile);

  // Roles para la barra inferior (pestaña Gestión), en cualquier pantalla de entrada.
  useEffect(() => {
    if (userId) fetchProfile(userId).catch(() => {});
  }, [userId, fetchProfile]);

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white flex flex-col justify-between">
      {/* Container móvil centrado */}
      <div className="w-full max-w-md mx-auto min-h-screen flex flex-col bg-[#0A0A0C] border-x border-white/5 relative">
        <TopHeader title={title} />
        
        <main className="flex-1 px-4 pt-3 pb-24 overflow-y-auto">
          <Outlet />
        </main>

        <BottomNavigation />
        <AchievementModal />
      </div>
    </div>
  );
}
