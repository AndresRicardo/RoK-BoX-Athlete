import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import Navigation from '../components/Navigation';
import './MainLayout.css';

function MainLayout({ children }) {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error.message);
    }
  };

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
            <span className="user-email">{user?.email}</span>
            <button onClick={handleLogout} className="logout-btn">
              Cerrar Sesión
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
    </div>
  );
}

export default MainLayout;
