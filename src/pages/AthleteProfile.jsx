import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabase/client';
import useAuthStore from '../stores/authStore';
import useFollowStore from '../stores/followStore';
import FollowListModal from '../components/FollowListModal';
import { getAchievementById } from '../data/achievements';
import { CATEGORY_LABELS } from '../data/movements';
import { DISCIPLINE_LABELS } from '../data/labels';
import {
  formatPrValue,
  formatBenchmarkResult,
  formatShortDate,
} from '../utils/format';
import './AthleteProfile.css';

function AthleteProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { following, saving, fetchMyNetwork, follow, unfollow } =
    useFollowStore();

  const [athlete, setAthlete] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [activity, setActivity] = useState(null);
  const [modal, setModal] = useState(null); // 'followers' | 'following' | null
  const [error, setError] = useState(null);

  const isMe = user?.id === id;
  const isFollowing = following.includes(id);

  useEffect(() => {
    if (isMe) {
      navigate('/profile', { replace: true });
      return;
    }
    if (user?.id) {
      fetchMyNetwork(user.id).catch(() => {});
    }
  }, [user, id, isMe, navigate, fetchMyNetwork]);

  // Perfil publico + contadores
  useEffect(() => {
    if (!id || isMe) return;

    const load = async () => {
      const [{ data: person, error: e1 }, followersRes, followingRes] =
        await Promise.all([
          supabase.from('athlete_directory').select('*').eq('id', id).maybeSingle(),
          supabase
            .from('follows')
            .select('follower_id', { count: 'exact', head: true })
            .eq('followed_id', id),
          supabase
            .from('follows')
            .select('followed_id', { count: 'exact', head: true })
            .eq('follower_id', id),
        ]);

      if (e1) {
        setError(e1.message);
        return;
      }
      if (!person) {
        setNotFound(true);
        return;
      }

      setAthlete(person);
      setCounts({
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
      });
    };

    load().catch((e) => setError(e.message));
  }, [id, isMe, following]); // following: refresca contadores al seguir/dejar

  // Actividad (solo visible si lo sigo; las policies followers-read lo garantizan)
  useEffect(() => {
    if (!id || isMe || !isFollowing) {
      return;
    }

    const load = async () => {
      const [prs, benchmarks, achievements, skills] = await Promise.all([
        supabase
          .from('prs')
          .select('*')
          .eq('user_id', id)
          .order('achieved_at', { ascending: false })
          .limit(5),
        supabase
          .from('benchmarks')
          .select('*')
          .eq('user_id', id)
          .order('performed_at', { ascending: false })
          .limit(5),
        supabase
          .from('achievements')
          .select('*')
          .eq('user_id', id)
          .order('unlocked_at', { ascending: false })
          .limit(6),
        supabase
          .from('unlocked_movements')
          .select('*')
          .eq('user_id', id)
          .order('unlocked_at', { ascending: false })
          .limit(6),
      ]);

      setActivity({
        prs: prs.data || [],
        benchmarks: benchmarks.data || [],
        achievements: achievements.data || [],
        skills: skills.data || [],
      });
    };

    load().catch((e) => setError(e.message));
  }, [id, isMe, isFollowing]);

  const handleToggleFollow = async () => {
    try {
      if (isFollowing) {
        await unfollow(user.id, id);
        setActivity(null); // oculta la actividad al dejar de seguir
      } else {
        await follow(user.id, id);
      }
    } catch {
      // error ya en store
    }
  };

  if (notFound) {
    return (
      <div className="athlete-profile">
        <div className="athlete-profile-empty">
          <h1>Atleta no encontrado</h1>
          <p>Este perfil no existe o aún no ha sido creado.</p>
          <button className="btn-primary" onClick={() => navigate('/community')}>
            Ir a Comunidad
          </button>
        </div>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="athlete-profile">
        <p className="athlete-profile-loading">Cargando atleta...</p>
      </div>
    );
  }

  const initials =
    `${athlete.first_name?.[0] ?? ''}${athlete.last_name?.[0] ?? ''}`.toUpperCase() ||
    '@';

  return (
    <div className="athlete-profile">
      <div className="athlete-hero">
        <div className="athlete-hero-top">
          <div className="athlete-avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="athlete-hero-info">
            <h1>@{athlete.display_name}</h1>
            <p className="athlete-full-name">{athlete.full_name}</p>
            <div className="athlete-chips">
              {athlete.discipline && (
                <span className="chip chip-discipline">
                  {DISCIPLINE_LABELS[athlete.discipline] || athlete.discipline}
                </span>
              )}
              {athlete.box_name && (
                <span className="chip chip-box">{athlete.box_name}</span>
              )}
            </div>
          </div>
        </div>

        <div className="athlete-stats">
          <button
            type="button"
            className="athlete-stat"
            onClick={() => setModal('followers')}
          >
            <strong>{counts.followers}</strong>
            <span>Seguidores</span>
          </button>
          <button
            type="button"
            className="athlete-stat"
            onClick={() => setModal('following')}
          >
            <strong>{counts.following}</strong>
            <span>Siguiendo</span>
          </button>
          <button
            type="button"
            className={`athlete-follow-btn ${isFollowing ? 'athlete-follow-btn-following' : ''}`}
            onClick={handleToggleFollow}
            disabled={saving}
          >
            {isFollowing ? 'Siguiendo' : 'Seguir'}
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!isFollowing ? (
        <div className="athlete-locked">
          <span className="athlete-locked-icon" aria-hidden="true">🔒</span>
          <h2>Actividad privada</h2>
          <p>Sigue a @{athlete.display_name} para ver sus PRs, benchmarks, logros y skills.</p>
        </div>
      ) : activity === null ? (
        <p className="athlete-profile-loading">Cargando actividad...</p>
      ) : (
        <>
          <section className="athlete-section">
            <h2>🏋️ PRs recientes</h2>
            {activity.prs.length === 0 ? (
              <p className="athlete-section-empty">Sin PRs todavía.</p>
            ) : (
              <ul className="athlete-activity-list">
                {activity.prs.map((pr) => (
                  <li key={pr.id}>
                    <span className="athlete-activity-name">{pr.movement}</span>
                    <span className="athlete-activity-value">{formatPrValue(pr)}</span>
                    <span className="athlete-activity-date">
                      {formatShortDate(pr.achieved_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="athlete-section">
            <h2>⏱️ Benchmarks recientes</h2>
            {activity.benchmarks.length === 0 ? (
              <p className="athlete-section-empty">Sin benchmarks todavía.</p>
            ) : (
              <ul className="athlete-activity-list">
                {activity.benchmarks.map((b) => (
                  <li key={b.id}>
                    <span className="athlete-activity-name">{b.name}</span>
                    <span className="athlete-activity-value">
                      {formatBenchmarkResult(b)}
                    </span>
                    <span className="athlete-activity-date">
                      {formatShortDate(b.performed_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="athlete-section">
            <h2>🏆 Logros</h2>
            {activity.achievements.length === 0 ? (
              <p className="athlete-section-empty">Sin logros todavía.</p>
            ) : (
              <div className="athlete-badge-grid">
                {activity.achievements.map((a) => {
                  const def = getAchievementById(a.achievement_id);
                  return (
                    <div key={a.id} className="athlete-badge" title={def?.description}>
                      <span className="athlete-badge-icon">{def?.icon || '🏆'}</span>
                      <span className="athlete-badge-name">{def?.name || a.achievement_id}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="athlete-section">
            <h2>💪 Skills</h2>
            {activity.skills.length === 0 ? (
              <p className="athlete-section-empty">Sin skills todavía.</p>
            ) : (
              <div className="athlete-badge-grid">
                {activity.skills.map((s) => (
                  <div key={s.id} className="athlete-badge">
                    <span className="athlete-badge-name">{s.movement}</span>
                    <span className="athlete-badge-cat">
                      {CATEGORY_LABELS[s.category] || s.category}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {modal && (
        <FollowListModal
          userId={id}
          type={modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

export default AthleteProfile;
