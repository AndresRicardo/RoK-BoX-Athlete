import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useBenchmarkStore from '../stores/benchmarkStore';
import {
  formatBenchmarkResult as formatResult,
  formatShortDate as formatDate,
} from '../utils/format';
import './Benchmarks.css';

const TYPE_LABELS = {
  for_time: 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  max: 'Max',
  all: 'Todos',
};

const SCALING_LABELS = {
  rx: 'RX',
  scaled: 'Scaled',
  masters: 'Masters',
};

function Benchmarks() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    benchmarks,
    loading,
    saving,
    error,
    fetchBenchmarks,
    deleteBenchmark,
    getBestByName,
  } = useBenchmarkStore();
  const [filter, setFilter] = useState('all');
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchBenchmarks(user.id);
    }
  }, [user, fetchBenchmarks]);

  const bestByName = useMemo(
    () => getBestByName(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [benchmarks],
  );

  const filteredBenchmarks = useMemo(() => {
    if (filter === 'all') return benchmarks;
    return benchmarks.filter((b) => b.type === filter);
  }, [benchmarks, filter]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const b of filteredBenchmarks) {
      const key = `${b.name}|${b.scaling}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(b);
    }
    return Array.from(map.entries());
  }, [filteredBenchmarks]);

  const handleDelete = async (id) => {
    try {
      await deleteBenchmark(id);
      setConfirmId(null);
    } catch {
      // error ya en store
    }
  };

  return (
    <div className="benchmarks-page">
      <div className="benchmarks-header">
        <div>
          <h1>Benchmarks</h1>
          <p className="benchmarks-count">
            {benchmarks.length === 0
              ? 'Aún no has registrado benchmarks'
              : `${benchmarks.length} ${benchmarks.length === 1 ? 'resultado guardado' : 'resultados guardados'}`}
          </p>
        </div>
        <button
          className="btn-primary benchmarks-new-btn"
          onClick={() => navigate('/benchmarks/new')}
        >
          + Nuevo
        </button>
      </div>

      {benchmarks.length > 0 && (
        <div className="benchmarks-filters" role="tablist" aria-label="Filtrar por tipo">
          {['all', 'for_time', 'amrap', 'emom', 'max'].map((t) => (
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
        <p className="benchmarks-loading">Cargando benchmarks...</p>
      ) : benchmarks.length === 0 ? (
        <div className="benchmarks-empty">
          <h2>Registra tu primer WOD</h2>
          <p>
            Lleva un histórico de tus resultados en benchmarks clásicos (Fran,
            Helen, Murph, Cindy) o en WODs personalizados de tu box.
          </p>
          <button
            className="btn-primary"
            onClick={() => navigate('/benchmarks/new')}
          >
            Registrar benchmark
          </button>
        </div>
      ) : grouped.length === 0 ? (
        <p className="benchmarks-empty-filter">No hay benchmarks de este tipo todavía.</p>
      ) : (
        <div className="benchmarks-groups">
          {grouped.map(([key, items]) => {
            const first = items[0];
            const best = bestByName.get(`${first.name}|${first.type}|${first.scaling}`);
            return (
              <div key={key} className="benchmarks-group">
                <div className="benchmarks-group-header">
                  <div className="benchmarks-group-title">
                    <h2>{first.name}</h2>
                    <span className="scaling-chip-static">
                      {SCALING_LABELS[first.scaling]}
                    </span>
                  </div>
                  {best && (
                    <span className="benchmarks-group-best">
                      {TYPE_LABELS[best.type]} · <strong>{formatResult(best)}</strong>
                    </span>
                  )}
                </div>
                <ul className="benchmarks-list">
                  {items.map((b) => {
                    const isBest = best?.id === b.id;
                    const isConfirming = confirmId === b.id;
                    return (
                      <li key={b.id} className={`benchmark-item ${isBest ? 'benchmark-item-best' : ''}`}>
                        <div className="benchmark-item-main">
                          <div className="benchmark-item-value">
                            {formatResult(b)}
                          </div>
                          <div className="benchmark-item-meta">
                            <span className="benchmark-item-date">
                              {formatDate(b.performed_at)}
                            </span>
                            {isBest && <span className="benchmark-item-badge">Mejor</span>}
                          </div>
                          {b.notes && <p className="benchmark-item-notes">{b.notes}</p>}
                        </div>
                        {isConfirming ? (
                          <div className="benchmark-item-confirm">
                            <span>¿Eliminar?</span>
                            <button
                              className="btn-danger-sm"
                              onClick={() => handleDelete(b.id)}
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
                          <div className="benchmark-item-actions">
                            <button
                              className="benchmark-item-edit"
                              onClick={() => navigate(`/benchmarks/${b.id}/edit`)}
                              aria-label={`Editar resultado de ${b.name}`}
                            >
                              ✎
                            </button>
                            <button
                              className="benchmark-item-delete"
                              onClick={() => setConfirmId(b.id)}
                              aria-label={`Eliminar resultado de ${b.name}`}
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
        className="benchmarks-fab"
        onClick={() => navigate('/benchmarks/new')}
        aria-label="Registrar nuevo benchmark"
      >
        +
      </button>
    </div>
  );
}

export default Benchmarks;
