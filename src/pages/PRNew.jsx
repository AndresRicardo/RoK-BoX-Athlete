import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import usePRStore from '../stores/prStore';
import './PRNew.css';

const TYPES = [
  { value: 'strength', label: 'Fuerza' },
  { value: 'benchmark', label: 'Benchmark' },
  { value: 'reps', label: 'Reps' },
];

const MOVEMENTS = {
  strength: [
    'Back Squat', 'Front Squat', 'Overhead Squat',
    'Deadlift', 'Sumo Deadlift', 'Romanian Deadlift',
    'Clean', 'Power Clean', 'Hang Clean',
    'Clean & Jerk', 'Power Clean & Jerk',
    'Snatch', 'Power Snatch', 'Hang Snatch',
    'Push Press', 'Push Jerk', 'Split Jerk',
    'Strict Press', 'Bench Press', 'Incline Bench Press',
  ],
  benchmark: [
    'Fran', 'Helen', 'Grace', 'Cindy', 'Diane',
    'Elizabeth', 'Isabel', 'Nancy', 'Murph', 'Kalsu', 'Annie',
  ],
  reps: [
    'Pull-up', 'Chin-up', 'Weighted Pull-up',
    'Push-up', 'Air Squat', 'Burpee',
    'Toes-to-Bar', 'Knees-to-Elbows', 'Double-under',
    'Wall Ball', 'Box Jump', 'Ring Row', 'Sit-up',
  ],
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function PRNew() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { saving, error, createPR } = usePRStore();

  const [type, setType] = useState('strength');
  const [movement, setMovement] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [reps, setReps] = useState('');
  const [achievedAt, setAchievedAt] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState('');

  const datalist = useMemo(() => MOVEMENTS[type] || [], [type]);

  const buildValue = () => {
    if (type === 'strength') {
      const v = Number(weightKg);
      if (!Number.isFinite(v) || v <= 0) return null;
      return v;
    }
    if (type === 'reps') {
      const v = Number(reps);
      if (!Number.isFinite(v) || v <= 0) return null;
      return v;
    }
    const m = Number(minutes || 0);
    const s = Number(seconds || 0);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
    if (m < 0 || s < 0 || s >= 60) return null;
    if (m === 0 && s === 0) return null;
    return m * 60 + s;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!movement.trim()) {
      setValidationError('Indica el movimiento');
      return;
    }
    const value = buildValue();
    if (value === null) {
      setValidationError('Introduce un valor válido');
      return;
    }

    try {
      await createPR(user.id, {
        type,
        movement: movement.trim(),
        value_numeric: value,
        achieved_at: achievedAt,
        notes,
      });
      navigate('/prs');
    } catch {
      // error ya está en prStore.error
    }
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    setMovement('');
    setWeightKg('');
    setMinutes('');
    setSeconds('');
    setReps('');
  };

  return (
    <div className="pr-new">
      <div className="pr-new-header">
        <h1>Registrar PR</h1>
        <p>Añade una nueva marca personal.</p>
      </div>

      <form onSubmit={handleSubmit} className="pr-form" noValidate>
        {validationError && <div className="form-error">{validationError}</div>}
        {error && <div className="form-error">{error}</div>}

        <div className="type-selector" role="tablist" aria-label="Tipo de PR">
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

        <div className="form-section">
          <div className="form-group">
            <label htmlFor="movement">Movimiento *</label>
            <input
              id="movement"
              type="text"
              list="movements-list"
              value={movement}
              onChange={(e) => setMovement(e.target.value)}
              placeholder="ej. Back Squat"
              autoComplete="off"
              maxLength={60}
              required
            />
            <datalist id="movements-list">
              {datalist.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          {type === 'strength' && (
            <div className="form-group">
              <label htmlFor="weight">Peso (kg) *</label>
              <input
                id="weight"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                max="999"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="ej. 100"
                required
              />
            </div>
          )}

          {type === 'benchmark' && (
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

          {type === 'reps' && (
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
                placeholder="ej. 15"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="achieved_at">Fecha *</label>
            <input
              id="achieved_at"
              type="date"
              value={achievedAt}
              onChange={(e) => setAchievedAt(e.target.value)}
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
              placeholder="Opcional: contexto del PR (con faja, tras 3 meses de pausa...)"
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
            onClick={() => navigate('/prs')}
            disabled={saving}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar PR'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PRNew;
