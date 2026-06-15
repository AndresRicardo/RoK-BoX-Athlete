import { useEffect, useMemo, useState } from 'react';
import useAuthStore from '../stores/authStore';
import useMovementStore from '../stores/movementStore';
import {
  MOVEMENT_CATALOG,
  MOVEMENT_CATEGORIES,
  CATEGORY_LABELS,
  TOTAL_MOVEMENTS,
} from '../data/movements';
import './Skills.css';

const TABS = [
  { value: 'explore', label: 'Explorar' },
  { value: 'mine', label: 'Mi arsenal' },
];

function Skills() {
  const { user } = useAuthStore();
  const {
    unlocked,
    loading,
    saving,
    error,
    fetchMovements,
    unlockMovement,
    lockMovement,
  } = useMovementStore();

  const [tab, setTab] = useState('mine');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (user?.id) {
      fetchMovements(user.id);
    }
  }, [user, fetchMovements]);

  const unlockedSet = useMemo(
    () => new Set(unlocked.map((u) => u.movement.toLowerCase())),
    [unlocked],
  );

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOVEMENT_CATALOG.filter((m) => {
      if (category !== 'all' && m.category !== category) return false;
      if (!q) return true;
      return m.name.toLowerCase().includes(q);
    });
  }, [category, query]);

  const myUnlocked = useMemo(() => {
    const q = query.trim().toLowerCase();
    return unlocked.filter((u) => {
      if (category !== 'all' && u.category !== category) return false;
      if (!q) return true;
      return u.movement.toLowerCase().includes(q);
    });
  }, [unlocked, category, query]);

  const handleUnlock = async (movement) => {
    try {
      await unlockMovement(user.id, movement);
    } catch {
      // error ya en store
    }
  };

  const handleLock = async (movement) => {
    try {
      await lockMovement(user.id, movement);
    } catch {
      // error ya en store
    }
  };

  return (
    <div className="skills-page">
      <div className="skills-header">
        <h1>Skills</h1>
        <p className="skills-stats">
          {unlocked.length} de {TOTAL_MOVEMENTS} en tu arsenal
        </p>
        <div className="skills-progress">
          <div
            className="skills-progress-bar"
            style={{
              width: `${Math.round((unlocked.length / TOTAL_MOVEMENTS) * 100)}%`,
            }}
          />
        </div>
      </div>

      <div className="skills-tabs" role="tablist" aria-label="Modo de vista">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className={`skills-tab ${tab === t.value ? 'skills-tab-active' : ''}`}
            onClick={() => setTab(t.value)}
          >
            {t.label}
            {t.value === 'mine' && unlocked.length > 0 && (
              <span className="skills-tab-badge">{unlocked.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="skills-search">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar movimiento..."
          aria-label="Buscar movimiento"
          autoComplete="off"
        />
      </div>

      <div className="skills-categories" role="tablist" aria-label="Filtrar por categoría">
        {MOVEMENT_CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="tab"
            aria-selected={category === c.value}
            className={`category-chip ${category === c.value ? 'category-chip-active' : ''}`}
            onClick={() => setCategory(c.value)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p className="skills-loading">Cargando skills...</p>
      ) : tab === 'explore' ? (
        filteredCatalog.length === 0 ? (
          <p className="skills-empty">No hay movimientos que coincidan.</p>
        ) : (
          <div className="skills-grid">
            {filteredCatalog.map((m) => {
              const isUnlocked = unlockedSet.has(m.name.toLowerCase());
              return (
                <div
                  key={m.name}
                  className={`skill-card ${isUnlocked ? 'skill-card-unlocked' : ''}`}
                >
                  <div className="skill-card-main">
                    <h2>{m.name}</h2>
                    <span className={`skill-category-chip category-${m.category}`}>
                      {CATEGORY_LABELS[m.category]}
                    </span>
                  </div>
                  {isUnlocked ? (
                    <span className="skill-card-check" aria-label="Desbloqueado">
                      ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="skill-card-add"
                      onClick={() => handleUnlock(m.name)}
                      disabled={saving}
                      aria-label={`Desbloquear ${m.name}`}
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : myUnlocked.length === 0 ? (
        <div className="skills-empty-state">
          <h2>Aún no tienes skills</h2>
          <p>Ve a Explorar y desbloquea los movimientos que ya puedas hacer.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setTab('explore')}
          >
            Explorar catálogo
          </button>
        </div>
      ) : (
        <div className="skills-grid">
          {myUnlocked.map((u) => (
            <div
              key={u.id}
              className="skill-card skill-card-mine"
            >
              <div className="skill-card-main">
                <h2>{u.movement}</h2>
                <span className={`skill-category-chip category-${u.category}`}>
                  {CATEGORY_LABELS[u.category]}
                </span>
                <span className="skill-card-date">
                  {new Date(u.unlocked_at).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <button
                type="button"
                className="skill-card-remove"
                onClick={() => handleLock(u.movement)}
                disabled={saving}
                aria-label={`Quitar ${u.movement}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Skills;
