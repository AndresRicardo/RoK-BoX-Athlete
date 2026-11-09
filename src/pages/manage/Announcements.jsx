import { useEffect, useState } from 'react';
import { Plus, Eye, Clock, BellRing, BellOff, Pencil, Trash2 } from 'lucide-react';
import useAnnouncementStore, { ANNOUNCEMENT_AUDIENCES } from '../../stores/announcementStore';
import { AnnouncementItem, formatEventAt } from '../../components/Announcements';
import AnnouncementFormSheet from '../../components/manage/AnnouncementFormSheet';
import {
  ManageHeader, Button, ErrorBox, Empty, Loading, SectionTitle, useAction,
} from '../../components/manage/ui';
import { formatDate, formatDateTime } from '../../utils/dates';

const SECTIONS = [
  ['scheduled', 'Programados'],
  ['active', 'Vigentes'],
  ['expired', 'Anteriores'],
];

function Meta({ a }) {
  const reminder = a.event_at && a.remind && (a.reminded_at
    ? 'Recordatorio enviado'
    : `Recordatorio: ${formatEventAt(a.remind_at)}`);
  return (
    <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1 text-[10px] text-gray-400">
      <span className="flex items-center gap-1.5">
        {a.published_at
          ? <>{a.notify ? <BellRing className="w-3 h-3" /> : <BellOff className="w-3 h-3" />} Enviado {formatDateTime(a.published_at)}</>
          : <><Clock className="w-3 h-3" /> Se envía {formatDateTime(a.publish_at)}</>}
        {a.author_name && <span>· por {a.author_name}</span>}
      </span>
      <span>
        {ANNOUNCEMENT_AUDIENCES[a.audience]} · en Inicio hasta el{' '}
        {formatDate(new Date(new Date(a.visible_until).getTime() - 1000))}
      </span>
      {reminder && <span className="first-letter:uppercase">{reminder}</span>}
      {a.published_at && (
        <span className="flex items-center gap-1.5 font-bold text-gray-300">
          <Eye className="w-3 h-3" /> Visto por {a.seen_count}{a.recipients_count ? ` de ${a.recipients_count}` : ''}
        </span>
      )}
    </div>
  );
}

// Gestión → Comunicados (D49): socios y coaches publican avisos para los atletas.
export default function ManageAnnouncements() {
  const { adminList, fetchAdminList, remove } = useAnnouncementStore();
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const { run, error } = useAction();

  useEffect(() => {
    run(async () => {
      await fetchAdminList();
      setLoaded(true);
    });
  }, [fetchAdminList, run]);

  const openForm = (a = null) => {
    setEditing(a);
    setFormOpen(true);
  };

  const onDelete = (a) => {
    if (!window.confirm(`¿Borrar "${a.title}"? Deja de verse en la app y sale de la campana de todos.`)) return;
    run(() => remove(a.id));
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <ManageHeader
        title="Comunicados"
        subtitle="Gestión"
        action={(
          <Button onClick={() => openForm()}>
            <Plus className="w-4 h-4" /> Nuevo
          </Button>
        )}
      />

      <ErrorBox error={error} />

      {!loaded ? (
        <Loading />
      ) : adminList.length === 0 ? (
        <Empty title="Aún no hay comunicados">
          Avisa cambios de horario, eventos o recordatorios: les llega a todos al teléfono.
        </Empty>
      ) : (
        SECTIONS.map(([status, label]) => {
          const rows = adminList.filter((a) => a.status === status);
          if (rows.length === 0) return null;
          return (
            <div key={status} className="flex flex-col gap-2">
              <SectionTitle>{label}</SectionTitle>
              {rows.map((a) => (
                <AnnouncementItem
                  key={a.id}
                  announcement={a}
                  footer={(
                    <>
                      <Meta a={a} />
                      <div className="mt-2 flex gap-2">
                        {status !== 'expired' && (
                          <Button variant="secondary" className="flex-1" onClick={() => openForm(a)}>
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </Button>
                        )}
                        <Button variant="danger" className="flex-1" onClick={() => onDelete(a)}>
                          <Trash2 className="w-3.5 h-3.5" /> Borrar
                        </Button>
                      </div>
                    </>
                  )}
                />
              ))}
            </div>
          );
        })
      )}

      <AnnouncementFormSheet open={formOpen} announcement={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}
