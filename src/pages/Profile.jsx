import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import './Profile.css';

const DISCIPLINE_LABELS = {
  rx: 'RX',
  scaled: 'Scaled',
  masters: 'Masters',
  beginner: 'Principiante',
};

const GENDER_LABELS = {
  male: 'Masculino',
  female: 'Femenino',
  other: 'Otro',
  prefer_not_to_say: 'Prefiero no decirlo',
};

function Profile() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { profile, loading, fetchProfile } = useProfileStore();

  useEffect(() => {
    if (user?.id) {
      fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  const age = useMemo(() => {
    const birthDate = profile?.birth_date;
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      years -= 1;
    }
    return years;
  }, [profile]);

  if (loading) {
    return (
      <div className="profile-page">
        <p className="profile-loading">Cargando perfil...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <div className="profile-empty">
          <h1>Aún no tienes perfil</h1>
          <p>Crea tu perfil para registrar tus PRs, benchmarks y progreso.</p>
          <button
            className="btn-primary"
            onClick={() => navigate('/profile/edit')}
          >
            Crear perfil
          </button>
        </div>
      </div>
    );
  }

  const fullName =
    `${profile.first_name} ${profile.last_name}`.trim() || user?.email;
  const displayName = profile.display_name?.trim();
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const initials = `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase() || 'RX';

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <div className="profile-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} />
          ) : (
            <span className="avatar-initials">{initials}</span>
          )}
        </div>
        <div className="profile-hero-info">
          <h1>{fullName}</h1>
          {displayName && <p className="profile-display-name">{displayName}</p>}
          <p className="profile-email">{user?.email}</p>
          <div className="profile-chips">
            <span className="chip chip-discipline">
              {DISCIPLINE_LABELS[profile.discipline] || profile.discipline}
            </span>
            {profile.box_name && (
              <span className="chip chip-box">{profile.box_name}</span>
            )}
            {age !== null && <span className="chip chip-muted">{age} años</span>}
          </div>
        </div>
        <button
          className="btn-secondary profile-edit-btn"
          onClick={() => navigate('/profile/edit')}
        >
          Editar
        </button>
      </div>

      <div className="profile-section">
        <h2>Datos físicos</h2>
        <div className="profile-grid">
          <div className="profile-field">
            <span className="field-label">Peso</span>
            <span className="field-value">
              {profile.weight_kg != null ? `${profile.weight_kg} lb` : '—'}
            </span>
          </div>
          <div className="profile-field">
            <span className="field-label">Altura</span>
            <span className="field-value">
              {profile.height_cm != null ? `${profile.height_cm} cm` : '—'}
            </span>
          </div>
          <div className="profile-field">
            <span className="field-label">Fecha de nacimiento</span>
            <span className="field-value">
              {profile.birth_date
                ? new Date(profile.birth_date).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '—'}
            </span>
          </div>
          <div className="profile-field">
            <span className="field-label">Género</span>
            <span className="field-value">
              {GENDER_LABELS[profile.gender] || '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h2>CrossFit</h2>
        <div className="profile-grid">
          <div className="profile-field">
            <span className="field-label">Años de experiencia</span>
            <span className="field-value">
              {profile.experience_years != null
                ? profile.experience_years
                : '—'}
            </span>
          </div>
          <div className="profile-field">
            <span className="field-label">Disciplina</span>
            <span className="field-value">
              {DISCIPLINE_LABELS[profile.discipline] || '—'}
            </span>
          </div>
        </div>
        {profile.goal && (
          <div className="profile-goal">
            <span className="field-label">Objetivo</span>
            <p>{profile.goal}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Profile;
