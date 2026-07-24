import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import Navigation from '../components/Navigation';
import NotificationsBell from '../components/NotificationsBell';
import './MainLayout.css';

function MainLayout({ children }) {
  const { user, signOut } = useAuthStore();
  const { profile, fetchProfile } = useProfileStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const avatarBtnRef = useRef(null);

  useEffect(() => {
    if (user?.id && !profile) {
      fetchProfile(user.id).catch(() => {});
    }
  }, [user, profile, fetchProfile]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        if (e.target.closest('.header-avatar-btn')) return;
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error.message);
    }
  };

  const handleViewProfile = () => {
    setMenuOpen(false);
    navigate('/profile');
  };

  const avatarUrl =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture;
  const initials =
    `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.toUpperCase() ||
    (user?.user_metadata?.full_name?.[0] ?? '').toUpperCase() ||
    'RX';
  const displayName =
    user?.user_metadata?.full_name ||
    `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() ||
    user?.email?.split('@')[0] ||
    'Atleta';

  return (
    <div className="main-layout">
      <header className="main-header">
        <div className="header-content">
          <Link to="/dashboard" className="logo">
            <span className="logo-r">R</span>
            <span className="logo-o">ö</span>
            <span className="logo-k">K</span>
            <span className="logo-box"> BoX</span>
            <span className="logo-athlete"> Athlete</span>
          </Link>
          <nav className="main-nav">
            <button
              ref={avatarBtnRef}
              type="button"
              className="header-avatar-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Menú de cuenta"
              aria-expanded={menuOpen}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" />
              ) : (
                <span>{initials}</span>
              )}
            </button>
          </nav>
        </div>
      </header>

      <div className="main-shell">
        <Navigation />
        <main className="main-content">
          {children}
        </main>
      </div>

      <footer className="main-footer">
        <p>© 2024 RöK BoX - CrossFit Box</p>
      </footer>

      {menuOpen && (
        <div ref={menuRef} className="account-menu" role="menu">
          <div className="account-menu-header">
            <span className="account-menu-name">{displayName}</span>
            {user?.email && (
              <span className="account-menu-email">{user.email}</span>
            )}
          </div>
          <button
            type="button"
            className="account-menu-item"
            onClick={handleViewProfile}
            role="menuitem"
          >
            <span aria-hidden="true">👤</span>
            <span>Ver perfil</span>
          </button>
          <button
            type="button"
            className="account-menu-item account-menu-item-danger"
            onClick={handleLogout}
            role="menuitem"
          >
            <span aria-hidden="true">⎋</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}

      <NotificationsBell />
    </div>
  );
}

export default MainLayout;
