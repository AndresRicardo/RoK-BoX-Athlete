import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useBenchmarkStore from '../stores/benchmarkStore';
import { WOD_TYPE_LABELS, findWodByName } from '../data/wods';
import { todayInputValue } from '../utils/format';
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
  return todayInputValue();
}

function BenchmarkResult() {
  const { wodName } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { saving, error, createBenchmark } = useBenchmarkStore();

  const isCustom = wodName === 'custom';
  const decodedName = isCustom ? '' : decodeURIComponent(wodName || '');
  const knownWod = !isCustom ? findWodByName(decodedName) : null;

  const initialType = isCustom ? 'for_time' : (knownWod?.type || 'for_time');

  const [type, setType] = useState(initialType);
  const [scaling, setScaling] = useState('rx');
  const [name, setName] = useState(decodedName);
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [rounds, setRounds] = useState('');
  const [extraReps, setExtraReps] = useState('');
  const [reps, setReps] = useState('');
  const [performedAt, setPerformedAt] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState('');

  const finalType = useMemo(() => {
    if (knownWod) return knownWod.type;
    return type;
  }, [knownWod, type]);

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

    try {
      await createBenchmark(user.id, {
        name: name.trim(),
        type: finalType,
        scaling,
        result_value: built.value,
        result_unit: built.unit,
        performed_at: performedAt,
        notes,
      });
      navigate('/benchmarks');
    } catch {
      // error ya está en benchmarkStore.error
    }
  };

  if (!isCustom && !knownWod) {
    return (
      <div className="benchmark-result">
        <div className="benchmark-result-header">
          <h1>WOD no encontrado</h1>
          <p>El WOD "{decodedName}" no existe en el catálogo.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate('/benchmarks/new')}
        >
          Volver al catálogo
        </button>
      </div>
    );
  }

  return (
    <div className="benchmark-result">
      <div className="benchmark-result-header">
        <h1>{isCustom ? 'WOD personalizado' : decodedName}</h1>
        <p>
          {isCustom
            ? 'Define el WOD y registra tu resultado.'
            : knownWod?.description}
        </p>
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
            onClick={() => navigate('/benchmarks/new')}
            disabled={saving}
          >
            Volver
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar resultado'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default BenchmarkResult;
