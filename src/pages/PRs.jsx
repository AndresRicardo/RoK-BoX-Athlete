import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import usePRStore from '../stores/prStore';
import './PRs.css';

const TYPE_LABELS = {
  strength: 'Fuerza',
  benchmark: 'Benchmark',
  reps: 'Reps',
  all: 'Todos',
};

function formatValue(pr) {
  if (pr.type === 'strength') return `${pr.value_numeric} lb`;
  if (pr.type === 'reps') return `${pr.value_numeric} reps`;
  const total = Math.round(pr.value_numeric);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function PRs() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { prs, loading, saving, error, fetchPRs, deletePR, getBestByMovement } =
    usePRStore();
  const [filter, setFilter] = useState('all');
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchPRs(user.id);
    }
  }, [user, fetchPRs]);

  const bestByMovement = useMemo(
    () => getBestByMovement(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prs],
  );

  const filteredPRs = useMemo(() => {
    if (filter === 'all') return prs;
    return prs.filter((p) => p.type === filter);
  }, [prs, filter]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const pr of filteredPRs) {
      if (!map.has(pr.movement)) {
        map.set(pr.movement, []);
      }
      map.get(pr.movement).push(pr);
    }
    return Array.from(map.entries());
  }, [filteredPRs]);

  const handleDelete = async (id) => {
    try {
      await deletePR(id);
      setConfirmId(null);
    } catch {
      // error ya en store
    }
  };

  return (
    <div className="prs-page">
      <div className="prs-header">
        <div>
          <h1>Tus PRs</h1>
          <p className="prs-count">
            {prs.length === 0
              ? 'Aún no has registrado PRs'
              : `${prs.length} ${prs.length === 1 ? 'PR registrado' : 'PRs registrados'}`}
          </p>
        </div>
        <button
          className="btn-primary prs-new-btn"
          onClick={() => navigate('/prs/new')}
        >
          + Nuevo PR
        </button>
      </div>

      {prs.length > 0 && (
        <div className="prs-filters" role="tablist" aria-label="Filtrar por tipo">
          {['all', 'strength', 'benchmark', 'reps'].map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={filter === t}
              className={`filter-tab ${filter === t ? 'filter-tab-active' : ''}`}
              onClick={() => setFilter(t)}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p className="prs-loading">Cargando PRs...</p>
      ) : prs.length === 0 ? (
        <div className="prs-empty">
          <h2>Registra tu primer PR</h2>
          <p>
            Lleva un registro de tus marcas personales en fuerza, benchmarks
            clásicos y récords de repeticiones.
          </p>
          <button
            className="btn-primary"
            onClick={() => navigate('/prs/new')}
          >
            Registrar PR
          </button>
        </div>
      ) : grouped.length === 0 ? (
        <p className="prs-empty-filter">No hay PRs de este tipo todavía.</p>
      ) : (
        <div className="prs-groups">
          {grouped.map(([movement, items]) => {
            const best = bestByMovement.get(`${movement}|${items[0].type}`);
            return (
              <div key={movement} className="prs-group">
                <div className="prs-group-header">
                  <h2>{movement}</h2>
                  {best && (
                    <span className="prs-group-best">
                      {TYPE_LABELS[best.type]} · <strong>{formatValue(best)}</strong>
                    </span>
                  )}
                </div>
                <ul className="prs-list">
                  {items.map((pr) => {
                    const isBest = best?.id === pr.id;
                    const isConfirming = confirmId === pr.id;
                    return (
                      <li key={pr.id} className={`pr-item ${isBest ? 'pr-item-best' : ''}`}>
                        <div className="pr-item-main">
                          <div className="pr-item-value">{formatValue(pr)}</div>
                          <div className="pr-item-meta">
                            <span className="pr-item-date">{formatDate(pr.achieved_at)}</span>
                            {isBest && <span className="pr-item-badge">Mejor</span>}
                          </div>
                          {pr.notes && <p className="pr-item-notes">{pr.notes}</p>}
                        </div>
                        {isConfirming ? (
                          <div className="pr-item-confirm">
                            <span>¿Eliminar?</span>
                            <button
                              className="btn-danger-sm"
                              onClick={() => handleDelete(pr.id)}
                              disabled={saving}
                            >
                              Sí
                            </button>
                            <button
                              className="btn-secondary-sm"
                              onClick={() => setConfirmId(null)}
                              disabled={saving}
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="pr-item-actions">
                            <button
                              className="pr-item-edit"
                              onClick={() => navigate(`/prs/${pr.id}/edit`)}
                              aria-label={`Editar PR de ${movement}`}
                            >
                              ✎
                            </button>
                            <button
                              className="pr-item-delete"
                              onClick={() => setConfirmId(pr.id)}
                              aria-label={`Eliminar PR de ${movement}`}
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <button
        className="prs-fab"
        onClick={() => navigate('/prs/new')}
        aria-label="Registrar nuevo PR"
      >
        +
      </button>
    </div>
  );
}

export default PRs;
