import { Outlet } from 'react-router-dom';
import TopHeader from '../components/TopHeader';
import BottomNavigation from '../components/BottomNavigation';
import AchievementModal from '../components/AchievementModal';

export default function MobileLayout({ title }) {
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
