import useAuthStore from '../stores/authStore';
import './Dashboard.css';

function Dashboard() {
  const { user } = useAuthStore();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Bienvenido, {user?.email?.split('@')[0]}</h1>
        <p>Tu perfil deportivo digital de RöK BoX</p>
      </div>

      <div className="dashboard-cards">
        <div className="card">
          <h3>PRs</h3>
          <p>0</p>
          <span>Marcas Personales</span>
        </div>
        <div className="card">
          <h3>Logros</h3>
          <p>0</p>
          <span>Desbloqueados</span>
        </div>
        <div className="card">
          <h3>Benchmarks</h3>
          <p>0</p>
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
