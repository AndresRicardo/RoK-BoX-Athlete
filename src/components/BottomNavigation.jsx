import { NavLink } from 'react-router-dom';
import { Home, Dumbbell, Users, Trophy, User } from 'lucide-react';

const tabs = [
  { to: '/', label: 'Inicio', icon: Home, exact: true },
  { to: '/training', label: 'Entreno', icon: Dumbbell },
  { to: '/community', label: 'Comunidad', icon: Users },
  { to: '/achievements', label: 'Logros', icon: Trophy },
  { to: '/profile', label: 'Perfil', icon: User },
];

export default function BottomNavigation() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-nav safe-bottom">
      <div className="max-w-md mx-auto px-3 py-2 flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.exact}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all tap-bounce ${
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
                  <span className="text-[10px] mt-1 tracking-tight leading-none">
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
