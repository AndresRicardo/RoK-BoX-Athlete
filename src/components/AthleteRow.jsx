import { Link } from 'react-router-dom';
import { DISCIPLINE_LABELS } from '../data/labels';
import './AthleteRow.css';

function AthleteRow({ athlete, following, saving, onToggleFollow }) {
  const initials =
    `${athlete.first_name?.[0] ?? ''}${athlete.last_name?.[0] ?? ''}`.toUpperCase() ||
    '@';

  return (
    <div className="athlete-row">
      <Link to={`/athletes/${athlete.id}`} className="athlete-row-main">
        <div className="athlete-row-avatar" aria-hidden="true">
          {athlete.avatar_url ? (
            <img src={athlete.avatar_url} alt="" />
          ) : (
            initials
          )}
        </div>
        <div className="athlete-row-info">
          <span className="athlete-row-handle">@{athlete.display_name}</span>
          <span className="athlete-row-name">{athlete.full_name}</span>
          <div className="athlete-row-chips">
            {athlete.box_name && (
              <span className="athlete-row-chip">{athlete.box_name}</span>
            )}
            {athlete.discipline && (
              <span className="athlete-row-chip athlete-row-chip-discipline">
                {DISCIPLINE_LABELS[athlete.discipline] || athlete.discipline}
              </span>
            )}
          </div>
        </div>
      </Link>
      <button
        type="button"
        className={`athlete-row-follow ${following ? 'athlete-row-following' : ''}`}
        onClick={() => onToggleFollow(athlete)}
        disabled={saving}
      >
        {following ? 'Siguiendo' : 'Seguir'}
      </button>
    </div>
  );
}

export default AthleteRow;
