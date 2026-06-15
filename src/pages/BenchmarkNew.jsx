import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WOD_CATALOG, WOD_TYPE_LABELS } from '../data/wods';
import './BenchmarkNew.css';

function BenchmarkNew() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WOD_CATALOG;
    return WOD_CATALOG.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="benchmark-new">
      <div className="benchmark-new-header">
        <h1>Selecciona un WOD</h1>
        <p>Elige el benchmark que vas a registrar.</p>
      </div>

      <div className="wod-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar WOD..."
          aria-label="Buscar WOD"
          autoComplete="off"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="wod-empty">No hay WODs que coincidan con "{query}".</p>
      ) : (
        <div className="wod-grid">
          {filtered.map((wod) => (
            <button
              key={wod.name}
              type="button"
              className="wod-card"
              onClick={() => navigate(`/benchmarks/new/${encodeURIComponent(wod.name)}`)}
            >
              <div className="wod-card-header">
                <h2>{wod.name}</h2>
                <span className={`wod-type-chip wod-type-${wod.type}`}>
                  {WOD_TYPE_LABELS[wod.type]}
                </span>
              </div>
              <p className="wod-card-description">{wod.description}</p>
            </button>
          ))}
          <button
            type="button"
            className="wod-card wod-card-custom"
            onClick={() => navigate('/benchmarks/new/custom')}
          >
            <div className="wod-card-header">
              <h2>WOD personalizado</h2>
              <span className="wod-type-chip wod-type-unknown">+</span>
            </div>
            <p className="wod-card-description">
              Para WODs del box o que no estén en el catálogo
            </p>
          </button>
        </div>
      )}
    </div>
  );
}

export default BenchmarkNew;
