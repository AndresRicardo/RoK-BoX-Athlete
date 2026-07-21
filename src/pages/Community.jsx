import { useEffect, useState } from 'react';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import useFollowStore from '../stores/followStore';
import AthleteRow from '../components/AthleteRow';
import './Community.css';

const TABS = [
  { value: 'search', label: 'Buscar' },
  { value: 'following', label: 'Siguiendo' },
];

function Community() {
  const { user } = useAuthStore();
  const { profile, fetchProfile } = useProfileStore();
  const {
    following,
    searchResults,
    suggestions,
    explore,
    loading,
    saving,
    error,
    fetchMyNetwork,
    follow,
    unfollow,
    searchAthletes,
    clearSearch,
    fetchSuggestions,
    fetchExplore,
    fetchFollowingList,
  } = useFollowStore();

  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [followingPeople, setFollowingPeople] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchMyNetwork(user.id);
      fetchProfile(user.id);
      fetchExplore(user.id);
    }
  }, [user, fetchMyNetwork, fetchProfile, fetchExplore]);

  useEffect(() => {
    if (user?.id && profile?.box_name) {
      fetchSuggestions(profile.box_name, user.id).catch(() => {});
    }
  }, [user, profile, fetchSuggestions]);

  // Busqueda con debounce
  useEffect(() => {
    if (!query.trim()) {
      clearSearch();
      return;
    }
    const t = setTimeout(() => {
      searchAthletes(query, user.id).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [query, user, searchAthletes, clearSearch]);

  // Lista de perfiles que sigo (tab Siguiendo)
  useEffect(() => {
    if (tab === 'following' && user?.id) {
      fetchFollowingList(user.id)
        .then(setFollowingPeople)
        .catch(() => setFollowingPeople([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user, following.length]);

  const handleTabChange = (value) => {
    setTab(value);
    if (value === 'following') setFollowingPeople(null);
  };

  const handleToggle = async (athlete) => {
    try {
      if (following.includes(athlete.id)) {
        await unfollow(user.id, athlete.id);
      } else {
        await follow(user.id, athlete.id);
      }
    } catch {
      // error ya en store
    }
  };

  const renderList = (people) => (
    <div className="community-list">
      {people.map((a) => (
        <AthleteRow
          key={a.id}
          athlete={a}
          following={following.includes(a.id)}
          saving={saving}
          onToggleFollow={handleToggle}
        />
      ))}
    </div>
  );

  const searching = query.trim().length > 0;
  const suggestionsFiltered = suggestions.filter(
    (a) => !following.includes(a.id),
  );
  const exploreFiltered = explore.filter((a) => !following.includes(a.id));

  return (
    <div className="community-page">
      <div className="community-header">
        <h1>Comunidad</h1>
        <p>Encuentra y sigue a otros atletas de RöK BoX</p>
      </div>

      <div className="community-tabs" role="tablist" aria-label="Secciones de comunidad">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className={`community-tab ${tab === t.value ? 'community-tab-active' : ''}`}
            onClick={() => handleTabChange(t.value)}
          >
            {t.label}
            {t.value === 'following' && following.length > 0 && (
              <span className="community-tab-badge">{following.length}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="form-error">{error}</div>}

      {tab === 'search' && (
        <>
          <div className="community-search">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o @usuario..."
              aria-label="Buscar atletas"
              autoComplete="off"
              autoCapitalize="none"
            />
          </div>

          {searching ? (
            loading ? (
              <p className="community-loading">Buscando...</p>
            ) : searchResults.length === 0 ? (
              <p className="community-empty">
                No hay atletas que coincidan con «{query.trim()}».
              </p>
            ) : (
              renderList(searchResults)
            )
          ) : (
            <>
              {suggestionsFiltered.length > 0 && (
                <section className="community-section">
                  <h2>🏠 De tu box</h2>
                  {renderList(suggestionsFiltered)}
                </section>
              )}
              <section className="community-section">
                <h2>✨ Explorar</h2>
                {exploreFiltered.length === 0 ? (
                  <p className="community-empty">
                    Aún no hay más atletas registrados.
                  </p>
                ) : (
                  renderList(exploreFiltered)
                )}
              </section>
            </>
          )}
        </>
      )}

      {tab === 'following' &&
        (followingPeople === null ? (
          <p className="community-loading">Cargando...</p>
        ) : followingPeople.length === 0 ? (
          <div className="community-empty-state">
            <h2>Aún no sigues a nadie</h2>
            <p>Busca atletas de tu box y síguelos para ver su actividad.</p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setTab('search')}
            >
              Buscar atletas
            </button>
          </div>
        ) : (
          renderList(followingPeople)
        ))}
    </div>
  );
}

export default Community;
