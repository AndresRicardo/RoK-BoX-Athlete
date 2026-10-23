import { NavLink } from 'react-router-dom';
import { Home, Dumbbell, Users, Trophy, User, Briefcase } from 'lucide-react';
import useProfileStore from '../stores/profileStore';

const athleteTabs = [
  { to: '/', label: 'Inicio', icon: Home, exact: true },
  { to: '/training', label: 'Entreno', icon: Dumbbell },
  { to: '/community', label: 'Comunidad', icon: Users },
  { to: '/achievements', label: 'Logros', icon: Trophy },
  { to: '/profile', label: 'Perfil', icon: User },
];

// Socios y coaches ven una sexta pestaña. Con 6 ítems cada uno mide al menos
// 60 px en una pantalla de 360 px (mínimo táctil: 44 px).
const staffTab = { to: '/manage', label: 'Gestión', icon: Briefcase };

export default function BottomNavigation() {
  const isStaff = useProfileStore((state) => state.isStaff);
  const tabs = isStaff ? [...athleteTabs, staffTab] : athleteTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-nav safe-bottom">
      <div className="max-w-md mx-auto px-1 py-2 flex items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.exact}
              className={({ isActive }) =>
                `flex-1 min-w-0 flex flex-col items-center justify-center py-1 rounded-xl transition-all tap-bounce ${
                  isActive
                    ? 'text-[#FFC815] font-bold'
                    : 'text-[#A0A0A5] hover:text-white font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#FFC815] rounded-full shadow-[0_0_8px_#FFC815]" />
                    )}
                  </div>
                  <span className="text-[10px] mt-1 tracking-tight leading-none truncate max-w-full">
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
