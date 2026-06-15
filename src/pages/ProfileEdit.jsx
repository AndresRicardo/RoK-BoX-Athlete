import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import './ProfileEdit.css';

const DISCIPLINE_OPTIONS = [
  { value: 'rx', label: 'RX' },
  { value: 'scaled', label: 'Scaled' },
  { value: 'masters', label: 'Masters' },
  { value: 'beginner', label: 'Principiante' },
];

const GENDER_OPTIONS = [
  { value: '', label: 'Prefiero no decirlo' },
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Femenino' },
  { value: 'other', label: 'Otro' },
  { value: 'prefer_not_to_say', label: 'No especificar' },
];

const emptyForm = {
  first_name: '',
  last_name: '',
  display_name: '',
  birth_date: '',
  gender: '',
  weight_kg: '',
  height_cm: '',
  experience_years: '',
  discipline: 'rx',
  goal: '',
  box_name: '',
};

function ProfileEdit() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { profile, loading, saving, error, fetchProfile, upsertProfile } =
    useProfileStore();

  const [form, setForm] = useState(emptyForm);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    fetchProfile(user.id).then((data) => {
      if (data) {
        setForm({
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          display_name: data.display_name ?? '',
          birth_date: data.birth_date ?? '',
          gender: data.gender ?? '',
          weight_kg: data.weight_kg ?? '',
          height_cm: data.height_cm ?? '',
          experience_years: data.experience_years ?? '',
          discipline: data.discipline ?? 'rx',
          goal: data.goal ?? '',
          box_name: data.box_name ?? '',
        });
      } else {
        const meta = user.user_metadata || {};
        setForm((prev) => ({
          ...prev,
          first_name: prev.first_name || meta.given_name || '',
          last_name: prev.last_name || meta.family_name || '',
        }));
      }
    });
  }, [user, fetchProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setValidationError('Nombre y apellidos son obligatorios');
      return;
    }

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      display_name: form.display_name.trim() || null,
      birth_date: form.birth_date || null,
      gender: form.gender || null,
      weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
      height_cm: form.height_cm === '' ? null : Number(form.height_cm),
      experience_years:
        form.experience_years === '' ? null : Number(form.experience_years),
      discipline: form.discipline,
      goal: form.goal.trim() || null,
      box_name: form.box_name.trim() || null,
    };

    try {
      await upsertProfile(user.id, payload);
      navigate('/profile');
    } catch {
      // error ya está en profileStore.error
    }
  };

  if (loading && !profile) {
    return (
      <div className="profile-edit">
        <p className="loading-text">Cargando perfil...</p>
      </div>
    );
  }

  return (
    <div className="profile-edit">
      <div className="profile-edit-header">
        <h1>{profile ? 'Editar perfil' : 'Crear perfil'}</h1>
        <p>
          {profile
            ? 'Actualiza tu información deportiva.'
            : 'Cuéntanos sobre ti para personalizar tu experiencia.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="profile-form" noValidate>
        {validationError && (
          <div className="form-error">{validationError}</div>
        )}
        {error && <div className="form-error">{error}</div>}

        <div className="form-section">
          <h2>Identidad</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">Nombre *</label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                value={form.first_name}
                onChange={handleChange}
                placeholder="Tu nombre"
                autoComplete="given-name"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="last_name">Apellidos *</label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                value={form.last_name}
                onChange={handleChange}
                placeholder="Tus apellidos"
                autoComplete="family-name"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="display_name">Nombre público</label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              value={form.display_name}
              onChange={handleChange}
              placeholder="Como te conocen en el box"
              maxLength={40}
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Datos físicos</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="birth_date">Fecha de nacimiento</label>
              <input
                id="birth_date"
                name="birth_date"
                type="date"
                value={form.birth_date}
                onChange={handleChange}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="gender">Género</label>
              <select
                id="gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
              >
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="weight_kg">Peso (lb)</label>
              <input
                id="weight_kg"
                name="weight_kg"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="500"
                value={form.weight_kg}
                onChange={handleChange}
                placeholder="ej. 165"
              />
            </div>
            <div className="form-group">
              <label htmlFor="height_cm">Altura (cm)</label>
              <input
                id="height_cm"
                name="height_cm"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                max="300"
                value={form.height_cm}
                onChange={handleChange}
                placeholder="ej. 178"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>CrossFit</h2>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="experience_years">Años de experiencia</label>
              <input
                id="experience_years"
                name="experience_years"
                type="number"
                inputMode="numeric"
                step="1"
                min="0"
                max="99"
                value={form.experience_years}
                onChange={handleChange}
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label htmlFor="discipline">Disciplina</label>
              <select
                id="discipline"
                name="discipline"
                value={form.discipline}
                onChange={handleChange}
              >
                {DISCIPLINE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="box_name">Box</label>
            <input
              id="box_name"
              name="box_name"
              type="text"
              value={form.box_name}
              onChange={handleChange}
              placeholder="RöK BoX"
            />
          </div>
          <div className="form-group">
            <label htmlFor="goal">Objetivo</label>
            <textarea
              id="goal"
              name="goal"
              value={form.goal}
              onChange={handleChange}
              placeholder="¿Qué quieres lograr este año?"
              maxLength={280}
              rows={3}
            />
            <span className="char-count">{form.goal.length}/280</span>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(profile ? '/profile' : '/dashboard')}
            disabled={saving}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProfileEdit;
