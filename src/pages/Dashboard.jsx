import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import usePRStore from '../stores/prStore';
import useBenchmarkStore from '../stores/benchmarkStore';
import useAchievementStore from '../stores/achievementStore';
import { ACHIEVEMENTS } from '../data/achievements';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { profile, loading, fetchProfile } = useProfileStore();
  const { prs, fetchPRs } = usePRStore();
  const { benchmarks, fetchBenchmarks } = useBenchmarkStore();
  const { unlocked, fetchAchievements, checkAndUnlock } = useAchievementStore();

  useEffect(() => {
    if (user?.id) {
      fetchProfile(user.id);
      fetchPRs(user.id);
      fetchBenchmarks(user.id);
      fetchAchievements(user.id);
    }
  }, [user, fetchProfile, fetchPRs, fetchBenchmarks, fetchAchievements]);

  useEffect(() => {
    if (user?.id && !loading) {
      checkAndUnlock(user.id, { prs, benchmarks, profile }).catch(() => {});
    }
  }, [user, loading, prs, benchmarks, profile, checkAndUnlock]);

  const greetingName =
    profile?.first_name?.trim() || user?.email?.split('@')[0] || 'Atleta';

  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const initials = `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.toUpperCase() || 'RX';

  const achievementsUnlocked = unlocked.length;

  return (
    <div className="dashboard">
      <Link to="/profile" className="dashboard-profile-link">
        <div className="dashboard-profile-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={greetingName} />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="dashboard-profile-info">
          <h1>Bienvenido, {greetingName}</h1>
          <span className="dashboard-view-profile">Ver perfil</span>
        </div>
        <span className="dashboard-profile-arrow" aria-hidden="true">→</span>
      </Link>

      <p className="dashboard-subtitle">Tu perfil deportivo digital de RöK BoX</p>

      {!loading && !profile && (
        <div className="dashboard-cta">
          <div className="dashboard-cta-text">
            <h2>Crea tu perfil deportivo</h2>
            <p>
              Registra tus datos físicos, disciplina y objetivo para empezar a
              llevar tu progreso.
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() => navigate('/profile/edit')}
          >
            Crear perfil
          </button>
        </div>
      )}

      <div className="dashboard-cards">
        <div className="card" onClick={() => navigate('/prs')}>
          <h3>PRs</h3>
          <p>{prs.length}</p>
          <span>Marcas Personales</span>
        </div>
        <div className="card" onClick={() => navigate('/achievements')}>
          <h3>Logros</h3>
          <p>
            {achievementsUnlocked}
            <span className="card-total">/{ACHIEVEMENTS.length}</span>
          </p>
          <span>Desbloqueados</span>
        </div>
        <div className="card" onClick={() => navigate('/benchmarks')}>
          <h3>Benchmarks</h3>
          <p>{benchmarks.length}</p>
          <span>Realizados</span>
        </div>
      </div>

      <div className="dashboard-placeholder">
        <p>Las funcionalidades deportivas estarán disponibles en las próximas fases.</p>
      </div>
    </div>
  );
}

export default Dashboard;
