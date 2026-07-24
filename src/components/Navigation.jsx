import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import './Navigation.css';

const ITEMS = [
  { to: '/community', label: 'Comunidad', icon: '👥' },
  { to: '/dashboard', label: 'Inicio', icon: '🏠' },
  { to: '/prs', label: 'PRs', icon: '🏋️' },
  { to: '/skills', label: 'Skills', icon: '💪' },
  { to: '/benchmarks', label: 'WODs', icon: '⏱️' },
  { to: '/history', label: 'Histórico', icon: '📈' },
  { to: '/achievements', label: 'Logros', icon: '🏆' },
  { to: '/profile', label: 'Perfil', icon: '👤' },
];

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { profile, fetchProfile } = useProfileStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (user?.id && !profile) {
      fetchProfile(user.id).catch(() => {});
    }
  }, [user, profile, fetchProfile]);

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error.message);
    }
  };

  const handleViewProfile = () => {
    setMenuOpen(false);
    navigate('/profile');
  };

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    if (path === '/community') {
      return (
        location.pathname === '/community' ||
        location.pathname.startsWith('/athletes')
      );
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const avatarUrl =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture;
  const initials =
    `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.toUpperCase() ||
    (user?.user_metadata?.full_name?.[0] ?? '').toUpperCase() ||
    'RX';

  // Cerrar el menu al hacer click fuera
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        if (
          e.target.closest('.nav-bottom-avatar-btn') ||
          e.target.closest('.nav-sidebar-avatar-btn')
        ) {
          return;
        }
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const toggleMenu = () => {
    setMenuOpen((open) => !open);
  };

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
        <button
          type="button"
          className="nav-bottom-item nav-bottom-avatar-btn"
          onClick={toggleMenu}
          aria-label="Menú de cuenta"
          aria-expanded={menuOpen}
        >
          <span className="nav-bottom-avatar" aria-hidden="true">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              <span>{initials}</span>
            )}
          </span>
        </button>
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
          <div className="nav-sidebar-user">
            <button
              type="button"
              className="nav-sidebar-avatar nav-sidebar-avatar-btn"
              onClick={toggleMenu}
              aria-label="Menú de cuenta"
              aria-expanded={menuOpen}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={user?.email || ''} />
              ) : (
                <span>{initials}</span>
              )}
            </button>
            <div className="nav-sidebar-user-info">
              <span className="nav-sidebar-user-name">
                {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Atleta'}
              </span>
              <span className="nav-sidebar-user-email">{user?.email}</span>
            </div>
          </div>
        </div>
      </aside>

      {menuOpen && (
        <div ref={menuRef} className="nav-account-menu" role="menu">
          <button
            type="button"
            className="nav-account-menu-item"
            onClick={handleViewProfile}
            role="menuitem"
          >
            <span aria-hidden="true">👤</span>
            <span>Ver perfil</span>
          </button>
          <button
            type="button"
            className="nav-account-menu-item nav-account-menu-item-danger"
            onClick={handleLogout}
            role="menuitem"
          >
            <span aria-hidden="true">⎋</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}
    </>
  );
}

export default Navigation;
