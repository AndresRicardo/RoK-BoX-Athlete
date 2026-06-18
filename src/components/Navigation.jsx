import { Link, useLocation } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import './Navigation.css';

const ITEMS = [
  { to: '/dashboard', label: 'Inicio', icon: '🏠' },
  { to: '/prs', label: 'PRs', icon: '🏋️' },
  { to: '/benchmarks', label: 'WODs', icon: '⏱️' },
  { to: '/skills', label: 'Skills', icon: '💪' },
  { to: '/history', label: 'Histórico', icon: '📈' },
  { to: '/achievements', label: 'Logros', icon: '🏆' },
  { to: '/profile', label: 'Perfil', icon: '👤' },
];

function Navigation() {
  const location = useLocation();
  const { user, signOut } = useAuthStore();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error.message);
    }
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <>
      <nav className="nav-bottom" aria-label="Navegación principal">
        {ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`nav-bottom-item ${isActive(item.to) ? 'nav-bottom-item-active' : ''}`}
            aria-current={isActive(item.to) ? 'page' : undefined}
          >
            <span className="nav-bottom-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-bottom-label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <aside className="nav-sidebar" aria-label="Navegación lateral">
        <Link to="/dashboard" className="nav-sidebar-logo">
          <span className="logo-r">R</span>
          <span className="logo-o">ö</span>
          <span className="logo-k">K</span>
          <span className="logo-box"> BoX</span>
          <span className="logo-athlete"> Athlete</span>
        </Link>

        <nav className="nav-sidebar-list">
          {ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-sidebar-item ${isActive(item.to) ? 'nav-sidebar-item-active' : ''}`}
              aria-current={isActive(item.to) ? 'page' : undefined}
            >
              <span className="nav-sidebar-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-sidebar-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="nav-sidebar-profile">
          <Link to="/profile" className="nav-sidebar-user">
            <div className="nav-sidebar-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={user?.email || ''} />
              ) : (
                <span>👤</span>
              )}
            </div>
            <div className="nav-sidebar-user-info">
              <span className="nav-sidebar-user-name">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Atleta'}
              </span>
              <span className="nav-sidebar-user-email">{user?.email}</span>
            </div>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="nav-sidebar-logout"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

export default Navigation;
