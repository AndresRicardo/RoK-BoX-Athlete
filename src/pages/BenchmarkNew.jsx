import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useBenchmarkStore from '../stores/benchmarkStore';
import { WOD_CATALOG, WOD_TYPE_LABELS, findWodByName } from '../data/wods';
import './BenchmarkNew.css';
import './BenchmarkResult.css';

const SCALINGS = [
  { value: 'rx', label: 'RX' },
  { value: 'scaled', label: 'Scaled' },
  { value: 'masters', label: 'Masters' },
];

const TYPES = [
  { value: 'for_time', label: 'For Time' },
  { value: 'amrap', label: 'AMRAP' },
  { value: 'emom', label: 'EMOM' },
  { value: 'max', label: 'Max' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function BenchmarkNew() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { saving, loading, error, createBenchmark, updateBenchmark, getBenchmarkById, resetError } = useBenchmarkStore();

  const [query, setQuery] = useState('');
  const [type, setType] = useState('for_time');
  const [scaling, setScaling] = useState('rx');
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [rounds, setRounds] = useState('');
  const [extraReps, setExtraReps] = useState('');
  const [reps, setReps] = useState('');
  const [performedAt, setPerformedAt] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [knownWod, setKnownWod] = useState(null);
  const [isCustom, setIsCustom] = useState(true);

  useEffect(() => {
    if (!isEdit) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const b = await getBenchmarkById(id);
        if (cancelled) return;
        setName(b.name);
        setType(b.type);
        setScaling(b.scaling);
        setPerformedAt(b.performed_at?.slice(0, 10) || todayISO());
        setNotes(b.notes || '');
        const match = findWodByName(b.name);
        setKnownWod(match || null);
        setIsCustom(!match);
        if (b.result_unit === 'time_seconds') {
          const total = Math.round(b.result_value);
          setMinutes(String(Math.floor(total / 60)));
          setSeconds(String(total % 60));
        } else if (b.result_unit === 'rounds_reps') {
          const total = Math.round(b.result_value);
          setRounds(String(Math.floor(total / 1000)));
          setExtraReps(String(total % 1000));
        } else {
          setReps(String(Math.round(b.result_value)));
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'No se pudo cargar el benchmark');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit, getBenchmarkById]);

  const finalType = useMemo(() => {
    if (knownWod) return knownWod.type;
    return type;
  }, [knownWod, type]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WOD_CATALOG;
    return WOD_CATALOG.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q),
    );
  }, [query]);

  const buildValue = () => {
    if (finalType === 'for_time') {
      const m = Number(minutes || 0);
      const s = Number(seconds || 0);
      if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
      if (m < 0 || s < 0 || s >= 60) return null;
      if (m === 0 && s === 0) return null;
      return { value: m * 60 + s, unit: 'time_seconds' };
    }
    if (finalType === 'amrap') {
      const r = Number(rounds || 0);
      const e = Number(extraReps || 0);
      if (!Number.isFinite(r) || !Number.isFinite(e)) return null;
      if (r < 0 || e < 0) return null;
      if (r === 0 && e === 0) return null;
      return { value: r * 1000 + e, unit: 'rounds_reps' };
    }
    if (finalType === 'emom' || finalType === 'max') {
      const v = Number(reps);
      if (!Number.isFinite(v) || v <= 0) return null;
      return { value: v, unit: 'reps' };
    }
    return null;
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    setMinutes('');
    setSeconds('');
    setRounds('');
    setExtraReps('');
    setReps('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!name.trim()) {
      setValidationError('Indica el nombre del WOD');
      return;
    }
    const built = buildValue();
    if (built === null) {
      setValidationError('Introduce un resultado válido');
      return;
    }

    const payload = {
      name: name.trim(),
      type: finalType,
      scaling,
      result_value: built.value,
      result_unit: built.unit,
      performed_at: performedAt,
      notes,
    };

    try {
      if (isEdit) {
        await updateBenchmark(id, user.id, payload);
      } else {
        await createBenchmark(user.id, payload);
      }
      navigate('/benchmarks');
    } catch {
      // error ya está en benchmarkStore.error
    }
  };

  useEffect(() => () => resetError(), [resetError]);

  if (loadError) {
    return (
      <div className="benchmark-result">
        <div className="form-error">{loadError}</div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => navigate('/benchmarks')}
        >
          Volver a Benchmarks
        </button>
      </div>
    );
  }

  if (isEdit) {
    if (loading) {
      return (
        <div className="benchmark-result">
          <p className="benchmarks-loading">Cargando benchmark...</p>
        </div>
      );
    }
    return (
      <div className="benchmark-result">
        <div className="benchmark-result-header">
          <h1>Editar resultado</h1>
          <p>{name || 'WOD'}</p>
        </div>

        <form onSubmit={handleSubmit} className="benchmark-form" noValidate>
          {validationError && <div className="form-error">{validationError}</div>}
          {error && <div className="form-error">{error}</div>}

          {isCustom && (
            <div className="type-selector" role="tablist" aria-label="Tipo de WOD">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={type === t.value}
                  className={`type-tab ${type === t.value ? 'type-tab-active' : ''}`}
                  onClick={() => handleTypeChange(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {!isCustom && (
            <div className="wod-type-static">
              <span className={`wod-type-chip wod-type-${finalType}`}>
                {WOD_TYPE_LABELS[finalType]}
              </span>
            </div>
          )}

          <div className="scaling-selector" role="tablist" aria-label="Scaling">
            {SCALINGS.map((s) => (
              <button
                key={s.value}
                type="button"
                role="tab"
                aria-selected={scaling === s.value}
                className={`scaling-chip ${scaling === s.value ? 'scaling-chip-active' : ''}`}
                onClick={() => setScaling(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="form-section">
            {isCustom && (
              <div className="form-group">
                <label htmlFor="name">Nombre del WOD *</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. WOD del lunes"
                  autoComplete="off"
                  maxLength={60}
                  required
                />
              </div>
            )}

            {finalType === 'for_time' && (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="minutes">Minutos *</label>
                  <input
                    id="minutes"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    max="999"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    placeholder="3"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="seconds">Segundos *</label>
                  <input
                    id="seconds"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    max="59"
                    value={seconds}
                    onChange={(e) => setSeconds(e.target.value)}
                    placeholder="24"
                    required
                  />
                </div>
              </div>
            )}

            {finalType === 'amrap' && (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="rounds">Rondas completas *</label>
                  <input
                    id="rounds"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    max="999"
                    value={rounds}
                    onChange={(e) => setRounds(e.target.value)}
                    placeholder="15"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="extraReps">Reps extra</label>
                  <input
                    id="extraReps"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    max="999"
                    value={extraReps}
                    onChange={(e) => setExtraReps(e.target.value)}
                    placeholder="4"
                  />
                </div>
              </div>
            )}

            {(finalType === 'emom' || finalType === 'max') && (
              <div className="form-group">
                <label htmlFor="reps">Repeticiones *</label>
                <input
                  id="reps"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  max="9999"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="ej. 80"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="performed_at">Fecha *</label>
              <input
                id="performed_at"
                type="date"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
                max={todayISO()}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notas</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional: condiciones, equipamiento, etc."
                maxLength={280}
                rows={3}
              />
              <span className="char-count">{notes.length}/280</span>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/benchmarks')}
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Actualizar resultado'}
            </button>
          </div>
        </form>
      </div>
    );
  }

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
