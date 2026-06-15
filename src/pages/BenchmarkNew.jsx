import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useBenchmarkStore from '../stores/benchmarkStore';
import './BenchmarkNew.css';

const TYPES = [
  { value: 'for_time', label: 'For Time' },
  { value: 'amrap', label: 'AMRAP' },
  { value: 'emom', label: 'EMOM' },
  { value: 'max', label: 'Max' },
];

const SCALINGS = [
  { value: 'rx', label: 'RX' },
  { value: 'scaled', label: 'Scaled' },
  { value: 'masters', label: 'Masters' },
];

const WOD_NAMES = [
  'Fran', 'Helen', 'Grace', 'Cindy', 'Diane', 'Elizabeth', 'Isabel',
  'Nancy', 'Murph', 'Kalsu', 'Annie', 'Mary', 'DT', 'Linda', 'Nate',
  'Jackie', 'Karen', 'Amanda', 'Kelly', 'Chelsea',
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function BenchmarkNew() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { saving, error, createBenchmark } = useBenchmarkStore();

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

  const datalist = useMemo(() => WOD_NAMES, []);

  const buildValue = () => {
    if (type === 'for_time') {
      const m = Number(minutes || 0);
      const s = Number(seconds || 0);
      if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
      if (m < 0 || s < 0 || s >= 60) return null;
      if (m === 0 && s === 0) return null;
      return { value: m * 60 + s, unit: 'time_seconds' };
    }
    if (type === 'amrap') {
      const r = Number(rounds || 0);
      const e = Number(extraReps || 0);
      if (!Number.isFinite(r) || !Number.isFinite(e)) return null;
      if (r < 0 || e < 0) return null;
      if (r === 0 && e === 0) return null;
      return { value: r * 1000 + e, unit: 'rounds_reps' };
    }
    if (type === 'emom' || type === 'max') {
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
        type,
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

  return (
    <div className="benchmark-new">
      <div className="benchmark-new-header">
        <h1>Registrar Benchmark</h1>
        <p>Añade un nuevo resultado de WOD.</p>
      </div>

      <form onSubmit={handleSubmit} className="benchmark-form" noValidate>
        {validationError && <div className="form-error">{validationError}</div>}
        {error && <div className="form-error">{error}</div>}

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
          <div className="form-group">
            <label htmlFor="name">Nombre del WOD *</label>
            <input
              id="name"
              type="text"
              list="wod-names-list"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Fran"
              autoComplete="off"
              maxLength={60}
              required
            />
            <datalist id="wod-names-list">
              {datalist.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          {type === 'for_time' && (
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

          {type === 'amrap' && (
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

          {(type === 'emom' || type === 'max') && (
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
            {saving ? 'Guardando...' : 'Guardar benchmark'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default BenchmarkNew;
