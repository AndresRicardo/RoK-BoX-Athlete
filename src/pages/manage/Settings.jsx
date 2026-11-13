import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Users2, Tag, Package, FolderTree, ShieldCheck, Wifi, History, ChevronRight, Plus, Trash2, Mail, MessageCircle,
  AlertTriangle, Landmark, QrCode, Upload,
} from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import useAuthStore from '../../stores/authStore';
import {
  ManageHeader, Card, SectionTitle, Button, ErrorBox, Loading, Empty, Field, Select, TextInput, MoneyInput,
  Sheet, Money, Row, Badge, Chips, Segmented, TextArea, useAction, inputClass,
} from '../../components/manage/ui';
import { planDuration } from '../../components/manage/RenewSheet';
import { formatDateTime } from '../../utils/dates';
import { timeAgo } from '../../utils/time';
import {
  DEFAULT_DEBT_TEMPLATE, TEMPLATE_PLACEHOLDERS, buildDebtReminder,
  DEFAULT_MEMBERSHIP_TEMPLATE, MEMBERSHIP_PLACEHOLDERS, buildMembershipReminder, whatsappPhone,
} from '../../utils/whatsapp';
import usePaymentStore, { paymentQrUrl } from '../../stores/paymentStore';
import { shrinkImage } from '../../utils/images';

const SECTIONS = [
  { key: 'partners', label: 'Socios y porcentajes', icon: Users2 },
  { key: 'plans', label: 'Planes y precios', icon: Tag },
  { key: 'products', label: 'Catálogo de productos', icon: Package },
  { key: 'categories', label: 'Categorías de gasto', icon: FolderTree },
  { key: 'roles', label: 'Roles e invitaciones', icon: ShieldCheck },
  { key: 'payments', label: 'Medios de pago', icon: Landmark },
  { key: 'whatsapp', label: 'Mensajes de WhatsApp', icon: MessageCircle },
  { key: 'bridge', label: 'Conexión con HikCentral', icon: Wifi },
  { key: 'audit', label: 'Auditoría', icon: History },
];

const PRODUCT_CATEGORIES = [['store', 'Tienda'], ['equipment', 'Implementos'], ['other', 'Otros']];
const ROLE_LABELS = { partner: 'Socio', coach: 'Coach', bridge: 'PC del box' };

/** Hoja genérica para editar una fila de catálogo. */
function EditSheet({ open, title, onClose, onSave, children }) {
  const { run, busy, error, setError } = useAction();
  useEffect(() => {
    if (open) setError(null);
  }, [open, setError]);
  return (
    <Sheet
      open={open}
      title={title}
      onClose={onClose}
      footer={(
        <Button className="w-full py-3" disabled={busy} onClick={() => run(async () => { await onSave(); onClose(); })}>
          {busy ? 'Guardando...' : 'Guardar'}
        </Button>
      )}
    >
      {children}
      <ErrorBox error={error} />
    </Sheet>
  );
}

function ActiveToggle({ value, onChange, label = 'Activo' }) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="accent-[#FFC815] w-4 h-4" />
      {label}
    </label>
  );
}

// ---------------------------------------------------------------------
// Socios
// ---------------------------------------------------------------------
function PartnersSection() {
  const { partners, saveRow } = useManageStore();
  const [edit, setEdit] = useState(null);
  const total = partners.filter((p) => p.is_active).reduce((s, p) => s + Number(p.share_percentage), 0);

  return (
    <>
      <div className={`p-3 rounded-xl text-xs font-bold border ${
        Math.abs(total - 100) < 0.05 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
      }`}
      >
        Suma de porcentajes: {total} % {Math.abs(total - 100) < 0.05 ? '✓' : '(debe ser 100 % para poder hacer cuadres)'}
      </div>
      {partners.map((p) => (
        <button key={p.id} type="button" onClick={() => setEdit({ ...p })} className="text-left">
          <Card className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color_hex }} />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-black text-white block">{p.name}</span>
              <span className="text-[11px] text-gray-400">{p.user_id ? 'Con cuenta en la app' : 'Sin cuenta vinculada (invítalo en Roles)'}</span>
            </div>
            <span className="text-lg font-black text-[#FFC815]">{Number(p.share_percentage)} %</span>
            {!p.is_active && <Badge className="bg-white/5 text-gray-400 border-white/10">Inactivo</Badge>}
          </Card>
        </button>
      ))}
      <Button variant="secondary" onClick={() => setEdit({ name: '', share_percentage: 0, color_hex: '#FFC815', is_active: true })}>
        <Plus className="w-4 h-4" /> Agregar socio
      </Button>
      <EditSheet
        open={!!edit}
        title={edit?.id ? 'Editar socio' : 'Nuevo socio'}
        onClose={() => setEdit(null)}
        onSave={() => {
          if (!edit.name.trim()) throw new Error('Escribe el nombre.');
          return saveRow('partners', {
            id: edit.id,
            name: edit.name.trim(),
            share_percentage: Number(edit.share_percentage),
            color_hex: edit.color_hex,
            is_active: edit.is_active,
          });
        }}
      >
        {edit && (
          <>
            <Field label="Nombre"><TextInput value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Porcentaje">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={edit.share_percentage}
                  onChange={(e) => setEdit({ ...edit, share_percentage: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Color">
                <input type="color" value={edit.color_hex} onChange={(e) => setEdit({ ...edit, color_hex: e.target.value.toUpperCase() })} className="w-full h-11 rounded-xl bg-[#0A0A0C] border border-white/10" />
              </Field>
            </div>
            <ActiveToggle value={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} />
            <p className="text-[10px] text-gray-500">Ajusta los porcentajes de todos los socios para que sumen 100 %.</p>
          </>
        )}
      </EditSheet>
    </>
  );
}

// ---------------------------------------------------------------------
// Planes
// ---------------------------------------------------------------------
function PlansSection() {
  const { plans, saveRow } = useManageStore();
  const [edit, setEdit] = useState(null);

  return (
    <>
      {plans.map((p) => (
        <button key={p.id} type="button" onClick={() => setEdit({ ...p, price: String(Math.round(p.price)) })} className="text-left">
          <Card className={`flex items-center gap-3 ${p.is_active ? '' : 'opacity-50'}`}>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-black text-white block">{p.name}</span>
              <span className="text-[11px] text-gray-400">{planDuration(p)}</span>
            </div>
            <Money value={p.price} className="text-sm text-[#FFC815]" />
          </Card>
        </button>
      ))}
      <Button
        variant="secondary"
        onClick={() => setEdit({ name: '', kind: 'period', duration_months: 1, duration_days: 0, class_count: '', price: '', sort_order: plans.length + 1, is_active: true })}
      >
        <Plus className="w-4 h-4" /> Agregar plan
      </Button>
      <EditSheet
        open={!!edit}
        title={edit?.id ? 'Editar plan' : 'Nuevo plan'}
        onClose={() => setEdit(null)}
        onSave={() => {
          if (!edit.name.trim()) throw new Error('Escribe el nombre.');
          if (Number(edit.duration_months) + Number(edit.duration_days) <= 0) throw new Error('La duración debe ser mayor que 0.');
          if (edit.kind === 'class_pack' && !(Number(edit.class_count) > 0)) throw new Error('Indica cuántas clases trae la tiquetera.');
          return saveRow('membership_plans', {
            id: edit.id,
            name: edit.name.trim(),
            kind: edit.kind,
            duration_months: Number(edit.duration_months || 0),
            duration_days: Number(edit.duration_days || 0),
            class_count: edit.kind === 'class_pack' ? Number(edit.class_count) : null,
            price: Number(edit.price || 0),
            sort_order: Number(edit.sort_order || 0),
            is_active: edit.is_active,
          });
        }}
      >
        {edit && (
          <>
            <Field label="Nombre"><TextInput value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Tipo">
              <Select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                <option value="period">Por tiempo (mensual, trimestral...)</option>
                <option value="class_pack">Tiquetera de clases</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Meses">
                <input type="number" min="0" value={edit.duration_months} onChange={(e) => setEdit({ ...edit, duration_months: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Días">
                <input type="number" min="0" value={edit.duration_days} onChange={(e) => setEdit({ ...edit, duration_days: e.target.value })} className={inputClass} />
              </Field>
            </div>
            {edit.kind === 'class_pack' && (
              <Field label="Número de clases" hint="La duración es la vigencia máxima de la tiquetera.">
                <input type="number" min="1" value={edit.class_count} onChange={(e) => setEdit({ ...edit, class_count: e.target.value })} className={inputClass} />
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio de lista"><MoneyInput value={edit.price} onChange={(v) => setEdit({ ...edit, price: v })} /></Field>
              <Field label="Orden">
                <input type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: e.target.value })} className={inputClass} />
              </Field>
            </div>
            <ActiveToggle value={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Disponible para renovar" />
          </>
        )}
      </EditSheet>
    </>
  );
}

// ---------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------
function ProductsSection() {
  const { products, saveRow } = useManageStore();
  const [edit, setEdit] = useState(null);
  const [cat, setCat] = useState('all');
  const visible = products.filter((p) => cat === 'all' || p.category === cat);

  return (
    <>
      <Chips options={[['all', 'Todos'], ...PRODUCT_CATEGORIES]} value={cat} onChange={setCat} />
      {visible.length === 0 && <Empty title="Sin productos" />}
      {visible.map((p) => (
        <button key={p.id} type="button" onClick={() => setEdit({ ...p, price: String(Math.round(p.price)) })} className="text-left">
          <Card className={`flex items-center gap-3 py-3 ${p.is_active ? '' : 'opacity-50'}`}>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-black text-white block truncate">{p.name}</span>
              <span className="text-[11px] text-gray-400">{PRODUCT_CATEGORIES.find(([k]) => k === p.category)?.[1]}</span>
            </div>
            <Money value={p.price} className="text-sm text-white" />
          </Card>
        </button>
      ))}
      <Button variant="secondary" onClick={() => setEdit({ name: '', category: cat === 'all' ? 'store' : cat, price: '', sort_order: 0, is_active: true })}>
        <Plus className="w-4 h-4" /> Agregar producto
      </Button>
      <EditSheet
        open={!!edit}
        title={edit?.id ? 'Editar producto' : 'Nuevo producto'}
        onClose={() => setEdit(null)}
        onSave={() => {
          if (!edit.name.trim()) throw new Error('Escribe el nombre.');
          return saveRow('products', {
            id: edit.id,
            name: edit.name.trim(),
            category: edit.category,
            price: Number(edit.price || 0),
            sort_order: Number(edit.sort_order || 0),
            is_active: edit.is_active,
          });
        }}
      >
        {edit && (
          <>
            <Field label="Nombre"><TextInput value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoría">
                <Select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                  {PRODUCT_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </Field>
              <Field label="Precio"><MoneyInput value={edit.price} onChange={(v) => setEdit({ ...edit, price: v })} /></Field>
            </div>
            <ActiveToggle value={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Disponible" />
          </>
        )}
      </EditSheet>
    </>
  );
}

// ---------------------------------------------------------------------
// Categorías de gasto
// ---------------------------------------------------------------------
function CategoriesSection() {
  const { categories, saveRow } = useManageStore();
  const [edit, setEdit] = useState(null);

  return (
    <>
      {categories.map((c) => (
        <button key={c.id} type="button" onClick={() => setEdit({ ...c, archived: !!c.archived_at })} className="text-left">
          <Card className={`flex items-center gap-3 py-3 ${c.archived_at ? 'opacity-50' : ''}`}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: `${c.color_hex}33` }}>
              {c.icon_emoji}
            </span>
            <span className="flex-1 text-sm font-black text-white">{c.name}</span>
            {c.archived_at && <Badge className="bg-white/5 text-gray-400 border-white/10">Archivada</Badge>}
          </Card>
        </button>
      ))}
      <Button
        variant="secondary"
        onClick={() => setEdit({ name: '', icon_emoji: '🏷️', color_hex: '#64748B', sort_order: categories.length + 1, archived: false })}
      >
        <Plus className="w-4 h-4" /> Agregar categoría
      </Button>
      <EditSheet
        open={!!edit}
        title={edit?.id ? 'Editar categoría' : 'Nueva categoría'}
        onClose={() => setEdit(null)}
        onSave={() => {
          if (!edit.name.trim()) throw new Error('Escribe el nombre.');
          return saveRow('expense_categories', {
            id: edit.id,
            name: edit.name.trim(),
            icon_emoji: edit.icon_emoji || '🏷️',
            color_hex: edit.color_hex,
            sort_order: Number(edit.sort_order || 0),
            archived_at: edit.archived ? edit.archived_at || new Date().toISOString() : null,
          });
        }}
      >
        {edit && (
          <>
            <div className="grid grid-cols-[4rem_1fr] gap-3">
              <Field label="Ícono">
                <TextInput value={edit.icon_emoji} onChange={(e) => setEdit({ ...edit, icon_emoji: e.target.value })} className={`${inputClass} text-center text-lg`} maxLength={4} />
              </Field>
              <Field label="Nombre"><TextInput value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            </div>
            <Field label="Color">
              <input type="color" value={edit.color_hex} onChange={(e) => setEdit({ ...edit, color_hex: e.target.value.toUpperCase() })} className="w-full h-11 rounded-xl bg-[#0A0A0C] border border-white/10" />
            </Field>
            <ActiveToggle value={edit.archived} onChange={(v) => setEdit({ ...edit, archived: v })} label="Archivada (no aparece al registrar gastos)" />
          </>
        )}
      </EditSheet>
    </>
  );
}

// ---------------------------------------------------------------------
// Roles e invitaciones
// ---------------------------------------------------------------------
const userLabel = (u) => u?.profile?.full_name || u?.email || 'otra cuenta';

/**
 * "¿Qué socio es?": todos los socios activos. Si el elegido ya tiene otra cuenta, avisa que
 * esa cuenta dejará de ser socio. El socio propio no se puede pasar a otra cuenta.
 */
function PartnerPicker({ value, onChange, partners, users, myId }) {
  const userById = Object.fromEntries(users.map((u) => [u.userId, u]));
  const chosen = partners.find((p) => p.id === value);
  return (
    <>
      <Field label="¿Qué socio es?" hint="Su cuenta queda asociada a este socio para la caja y los cuadres.">
        <Select value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">— Elegir —</option>
          {partners.filter((p) => p.is_active).map((p) => (
            <option key={p.id} value={p.id} disabled={p.user_id === myId}>
              {p.name}
              {p.user_id === myId ? ' (eres tú)' : p.user_id ? ` (hoy: ${userLabel(userById[p.user_id])})` : ''}
            </option>
          ))}
        </Select>
      </Field>
      {chosen?.user_id && chosen.user_id !== myId && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            {chosen.name} hoy está asociado a la cuenta de {userLabel(userById[chosen.user_id])}. Al confirmar, esa cuenta
            deja de ser socio y la nueva queda como {chosen.name}. La caja y los cuadres de {chosen.name} no cambian.
          </span>
        </div>
      )}
    </>
  );
}

function RolesSection() {
  const {
    partners, fetchRoles, setUserRole, assignPartnerAccount, saveInvite, deleteInvite, searchUsers, loadCatalogs,
  } = useManageStore();
  const myId = useAuthStore((state) => state.user?.id);
  const [data, setData] = useState(null);
  const [invite, setInvite] = useState(null);
  const [grant, setGrant] = useState(null); // { q, results, role }
  const action = useAction();

  const refresh = useCallback(async () => setData(await fetchRoles()), [fetchRoles]);
  useEffect(() => {
    action.run(refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const revoke = (user, role) => action.run(async () => {
    const name = user.profile?.full_name || 'este usuario';
    if (!window.confirm(`¿Quitarle el rol ${ROLE_LABELS[role]} a ${name}?`)) return;
    await setUserRole(user.userId, role, false);
    // Quitar el rol de socio deja su socio libre para asociarlo a otra cuenta.
    if (role === 'partner') await loadCatalogs(true);
    await refresh();
  });

  const doSearch = async (q) => {
    setGrant((g) => ({ ...g, q }));
    const results = await searchUsers(q).catch(() => []);
    setGrant((g) => (g && g.q === q ? { ...g, results } : g));
  };

  if (!data) return action.error ? <ErrorBox error={action.error} /> : <Loading />;

  return (
    <>
      <ErrorBox error={action.error} />
      <SectionTitle>Usuarios con rol</SectionTitle>
      {data.users.map((u) => (
        <Card key={u.userId} className="flex flex-col gap-2 py-3">
          <span className="text-sm font-black text-white">
            {u.profile?.full_name || u.email || (u.roles.includes('bridge') ? 'PC del box (bridge)' : 'Usuario sin perfil')}
            {u.userId === myId && <span className="text-gray-500 text-xs"> (tú)</span>}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {u.roles.map((r) => (
              <span key={r} className="pl-2 pr-1 py-0.5 rounded-md bg-[#FFC815]/10 border border-[#FFC815]/30 text-[11px] font-black text-[#FFC815] flex items-center gap-1">
                {ROLE_LABELS[r] || r}
                {r === 'partner' && partners.find((p) => p.user_id === u.userId) && ` · ${partners.find((p) => p.user_id === u.userId).name}`}
                {r !== 'bridge' && (
                  <button type="button" onClick={() => revoke(u, r)} className="p-0.5 text-[#FFC815]/60 hover:text-red-400" aria-label={`Quitar ${ROLE_LABELS[r]}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </Card>
      ))}
      <Button variant="secondary" onClick={() => setGrant({ q: '', results: [], role: 'coach' })}>
        <Plus className="w-4 h-4" /> Dar rol a alguien que ya usa la app
      </Button>

      <SectionTitle>Invitaciones por email</SectionTitle>
      <p className="text-[11px] text-gray-400 -mt-2">
        Para quien todavía no tiene cuenta: el rol se aplica solo cuando entre con ese correo de Google.
      </p>
      {data.invites.length === 0 && <p className="text-xs text-gray-500">Sin invitaciones.</p>}
      {data.invites.map((inv) => (
        <Card key={inv.email} className="flex items-center gap-3 py-3">
          <Mail className="w-4 h-4 text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-black text-white block truncate">{inv.email}</span>
            <span className="text-[10px] text-gray-400">
              {inv.roles.map((r) => ROLE_LABELS[r]).join(' + ')}
              {inv.partner_id && ` · ${partners.find((p) => p.id === inv.partner_id)?.name || ''}`}
              {inv.claimed_at ? ` · aceptada ${timeAgo(inv.claimed_at)}` : ' · pendiente'}
            </span>
          </div>
          {!inv.claimed_at && (
            <button
              type="button"
              onClick={() => action.run(async () => { await deleteInvite(inv.email); await refresh(); })}
              className="p-1 text-gray-500 hover:text-red-400"
              aria-label="Eliminar invitación"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </Card>
      ))}
      <Button variant="secondary" onClick={() => setInvite({ email: '', role: 'coach', partnerId: '' })}>
        <Mail className="w-4 h-4" /> Invitar por email
      </Button>

      <EditSheet
        open={!!invite}
        title="Invitar por email"
        onClose={() => setInvite(null)}
        onSave={async () => {
          if (!/^\S+@\S+\.\S+$/.test(invite.email.trim())) throw new Error('Escribe un email válido.');
          if (invite.role === 'partner' && !invite.partnerId) throw new Error('Elige qué socio es.');
          await saveInvite({ email: invite.email, roles: [invite.role], partnerId: invite.role === 'partner' ? invite.partnerId : null });
          await refresh();
        }}
      >
        {invite && (
          <>
            <Field label="Email de Google"><TextInput value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} inputMode="email" /></Field>
            <Field label="Rol">
              <Select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                <option value="coach">Coach</option>
                <option value="partner">Socio</option>
              </Select>
            </Field>
            {invite.role === 'partner' && (
              <PartnerPicker
                value={invite.partnerId}
                onChange={(partnerId) => setInvite({ ...invite, partnerId })}
                partners={partners}
                users={data.users}
                myId={myId}
              />
            )}
          </>
        )}
      </EditSheet>

      <Sheet open={!!grant} title="Dar rol" onClose={() => setGrant(null)}>
        {grant && (
          <>
            <Field label="Rol">
              <Select value={grant.role} onChange={(e) => setGrant({ ...grant, role: e.target.value })}>
                <option value="coach">Coach</option>
                <option value="partner">Socio</option>
              </Select>
            </Field>
            {grant.role === 'partner' && (
              <PartnerPicker
                value={grant.partnerId}
                onChange={(partnerId) => setGrant({ ...grant, partnerId })}
                partners={partners}
                users={data.users}
                myId={myId}
              />
            )}
            <Field label="Buscar usuario">
              <TextInput value={grant.q} onChange={(e) => doSearch(e.target.value)} placeholder="Nombre o @usuario" />
            </Field>
            {grant.results?.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => action.run(async () => {
                  if (grant.role === 'partner' && !grant.partnerId) throw new Error('Elige qué socio es.');
                  const partner = partners.find((p) => p.id === grant.partnerId);
                  const roleText = grant.role === 'partner' ? `Socio (${partner?.name})` : ROLE_LABELS[grant.role];
                  if (!window.confirm(`¿Darle el rol ${roleText} a ${u.full_name}?`)) return;
                  if (grant.role === 'partner') {
                    await assignPartnerAccount(grant.partnerId, u.id);
                    await loadCatalogs(true);
                  } else {
                    await setUserRole(u.id, grant.role, true);
                  }
                  setGrant(null);
                  await refresh();
                })}
                className="text-left px-3 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-sm font-bold text-white"
              >
                {u.full_name} <span className="text-gray-400 text-xs">@{u.display_name}</span>
              </button>
            ))}
            <ErrorBox error={action.error} />
          </>
        )}
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------
// Bridge
// ---------------------------------------------------------------------
const COMMAND_STATUS = {
  pending: ['En cola', 'text-amber-400'],
  processing: ['Aplicando', 'text-sky-400'],
  done: ['Aplicado', 'text-emerald-400'],
  failed: ['Falló', 'text-red-400'],
  cancelled: ['Cancelado', 'text-gray-400'],
};

function BridgeSection() {
  const fetchBridge = useManageStore((state) => state.fetchBridge);
  const [data, setData] = useState(null);
  const { run, error } = useAction();

  useEffect(() => {
    run(async () => setData(await fetchBridge()));
  }, [fetchBridge, run]);

  if (!data) return error ? <ErrorBox error={error} /> : <Loading />;
  const s = data.status;

  return (
    <>
      <Card>
        {s ? (
          <>
            <Row label="Última señal">{s.last_seen_at ? `${timeAgo(s.last_seen_at)} (${formatDateTime(s.last_seen_at)})` : '—'}</Row>
            <Row label="Última lectura de personas">{s.last_pull_at ? timeAgo(s.last_pull_at) : '—'}</Row>
            <Row label="Personas en HikCentral">{s.persons_count ?? '—'}</Row>
            <Row label="Versión del agente">{s.agent_version || '—'}</Row>
            <Row label="Versión de HikCentral">{s.hik_version || '—'}</Row>
            {s.last_error && <Row label="Último error"><span className="text-red-400">{s.last_error}</span></Row>}
          </>
        ) : (
          <p className="text-xs text-gray-400">El PC del box todavía no se ha conectado.</p>
        )}
      </Card>
      <SectionTitle>Últimos cambios enviados al torniquete</SectionTitle>
      {data.commands.length === 0 && <p className="text-xs text-gray-500">Sin comandos.</p>}
      {data.commands.map((c) => {
        const [label, color] = COMMAND_STATUS[c.status] || [c.status, 'text-gray-400'];
        return (
          <Card key={c.id} className="py-2.5">
            <div className="flex items-center justify-between gap-2">
              <Link to={`/manage/members/${c.member_id}`} className="text-xs font-black text-white truncate">{c.members?.full_name || 'Miembro'}</Link>
              <span className={`text-[10px] font-black ${color}`}>{label}</span>
            </div>
            <span className="text-[10px] text-gray-400 block">
              {formatDateTime(c.created_at)} · vigencia hasta {c.payload?.valid_until ? formatDateTime(c.payload.valid_until) : '—'}
              {c.attempts > 1 && ` · ${c.attempts} intentos`}
            </span>
            {c.last_error && <span className="text-[10px] text-red-300 block">{c.last_error}</span>}
          </Card>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------
// Mensajes de WhatsApp: cobro de deuda (D41) y mensualidad (D50)
// ---------------------------------------------------------------------
const SAMPLE_DEBTS = [
  { concept: 'Mensualidad', items: [], balance: 70000, created_at: '2026-01-02' },
  { concept: 'Consumo', items: [{ name: 'Agua 600 ml', quantity: 2 }], balance: 5000, created_at: '2026-01-05' },
];

const TEMPLATES = {
  debt: {
    key: 'debt_reminder_template',
    fallback: DEFAULT_DEBT_TEMPLATE,
    placeholders: TEMPLATE_PLACEHOLDERS,
    intro: 'Es el texto base del recordatorio de deuda. Antes de enviarlo, quien cobra puede ajustarlo para cada persona.',
    preview: (template) => buildDebtReminder({ template, fullName: 'JUAN PÉREZ', total: 75000, debts: SAMPLE_DEBTS }),
  },
  membership: {
    key: 'membership_reminder_template',
    fallback: DEFAULT_MEMBERSHIP_TEMPLATE,
    placeholders: MEMBERSHIP_PLACEHOLDERS,
    intro: 'Es el texto base del recordatorio de mensualidad (por vencer o vencida). Antes de enviarlo, quien lo envía puede ajustarlo.',
    preview: (template, accounts) => buildMembershipReminder({
      template,
      fullName: 'JUAN PÉREZ',
      planName: 'Mensual',
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      daysLeft: 1,
      accounts,
    }),
  },
};

function TemplateEditor({ config }) {
  const { fetchSetting, saveSetting, fetchPaymentAccounts } = useManageStore();
  const [value, setValue] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [saved, setSaved] = useState(false);
  const { run, busy, error } = useAction();

  useEffect(() => {
    run(async () => {
      const [stored, list] = await Promise.all([fetchSetting(config.key), fetchPaymentAccounts().catch(() => [])]);
      setAccounts(list);
      setValue(stored || config.fallback);
    });
  }, [config, fetchSetting, fetchPaymentAccounts, run]);

  if (value === null) return error ? <ErrorBox error={error} /> : <Loading />;

  const isDefault = value.trim() === config.fallback;
  const save = (text) => run(async () => {
    if (!text.trim()) throw new Error('El mensaje no puede quedar vacío.');
    if (text.length > 2000) throw new Error('El mensaje es muy largo (máximo 2.000 caracteres).');
    // Guardar el texto por defecto = no guardar nada (así recibe las mejoras futuras).
    await saveSetting(config.key, text.trim() === config.fallback ? null : text.trim());
    setValue(text.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  });

  return (
    <>
      <p className="text-[11px] text-[#A0A0A5]">{config.intro}</p>
      <Card className="flex flex-col gap-1.5">
        {config.placeholders.map(([key, desc]) => (
          <div key={key} className="flex items-center gap-2 text-[11px]">
            <code className="px-1.5 py-0.5 rounded bg-[#0A0A0C] text-[#FFC815] font-bold shrink-0">{key}</code>
            <span className="text-gray-300">{desc}</span>
          </div>
        ))}
        <span className="text-[10px] text-gray-500 mt-1">En WhatsApp, *texto* se ve en negrita.</span>
      </Card>
      <Field label="Mensaje">
        <textarea
          rows={12}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`${inputClass} font-normal resize-none`}
        />
      </Field>
      <SectionTitle>Así se verá</SectionTitle>
      <div className="p-3 rounded-2xl rounded-tr-sm bg-[#005C4B] text-[13px] text-white whitespace-pre-wrap break-words">
        {config.preview(value, accounts)}
      </div>
      <ErrorBox error={error} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={busy || isDefault} onClick={() => save(config.fallback)}>
          Restaurar original
        </Button>
        <Button disabled={busy} onClick={() => save(value)}>
          {busy ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
        </Button>
      </div>
    </>
  );
}

function WhatsAppSection() {
  const [which, setWhich] = useState('debt');
  return (
    <>
      <Segmented options={[['debt', 'Cobro de deuda'], ['membership', 'Mensualidad']]} value={which} onChange={setWhich} />
      <TemplateEditor key={which} config={TEMPLATES[which]} />
    </>
  );
}

// ---------------------------------------------------------------------
// Medios de pago (D51): lo que ve el atleta al tocar "Pagar"
// ---------------------------------------------------------------------
const EMPTY_ACCOUNT = {
  label: '', account_number: '', holder_name: '', holder_document: '', notes: '', qr_path: null, sort_order: 0, is_active: true,
};

/** Imagen del QR guardado (URL firmada) o del archivo recién elegido. */
function QrPreview({ path, file, className = '' }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    if (file) {
      objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
    } else if (path) {
      paymentQrUrl(path).then((u) => alive && setUrl(u));
    } else {
      setUrl(null);
    }
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, file]);
  if (!url) return null;
  return <img src={url} alt="Código QR de pago" className={`rounded-xl bg-white object-contain ${className}`} />;
}

function PaymentAccountSheet({ account, onClose, onSaved }) {
  const { savePaymentAccount, deletePaymentAccount, uploadPaymentQr, removePaymentQr } = useManageStore();
  const [edit, setEdit] = useState(null);
  const [file, setFile] = useState(null);
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (!account) return;
    setEdit({ ...EMPTY_ACCOUNT, ...account });
    setFile(null);
    setError(null);
  }, [account, setError]);

  const pickFile = async (e) => {
    const raw = e.target.files?.[0];
    e.target.value = '';
    if (!raw) return;
    // La galería puede entregar otros formatos (GIF, AVIF...) o fotos pesadas: se pasan a JPEG.
    const picked = await shrinkImage(raw, 1.9 * 1024 * 1024, ['image/png', 'image/jpeg', 'image/webp']);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(picked.type)) {
      setError('El QR debe ser una imagen PNG, JPG o WebP.');
      return;
    }
    if (picked.size > 2 * 1024 * 1024) {
      setError('La imagen pesa más de 2 MB. Usa una captura más liviana.');
      return;
    }
    setError(null);
    setFile(picked);
  };

  const save = () => run(async () => {
    const label = edit.label.trim();
    const number = edit.account_number.trim();
    if (!label) throw new Error('Escribe el nombre del medio de pago (ej. Nequi, Bancolombia ahorros).');
    if (!number && !file && !edit.qr_path) throw new Error('Escribe el número, celular o llave, o sube el QR.');

    const oldPath = account.qr_path || null;
    const newPath = file ? await uploadPaymentQr(file) : edit.qr_path || null;
    try {
      await savePaymentAccount({
        id: edit.id,
        label,
        account_number: number || null,
        holder_name: edit.holder_name.trim() || null,
        holder_document: edit.holder_document.trim() || null,
        notes: edit.notes.trim() || null,
        qr_path: newPath,
        sort_order: Number(edit.sort_order || 0),
        is_active: edit.is_active,
      });
    } catch (err) {
      if (file) await removePaymentQr(newPath);
      throw err;
    }
    if (oldPath && oldPath !== newPath) await removePaymentQr(oldPath);
    onSaved();
    onClose();
  });

  const remove = () => run(async () => {
    if (!window.confirm(`¿Borrar "${account.label}"? Los atletas dejarán de verlo.`)) return;
    await deletePaymentAccount(account);
    onSaved();
    onClose();
  });

  const set = (field) => (e) => setEdit({ ...edit, [field]: e.target.value });

  return (
    <Sheet
      open={!!account}
      title={account?.id ? 'Editar medio de pago' : 'Nuevo medio de pago'}
      onClose={onClose}
      footer={(
        <div className="flex flex-col gap-2">
          <Button className="w-full py-3" disabled={busy} onClick={save}>{busy ? 'Guardando...' : 'Guardar'}</Button>
          {account?.id && (
            <Button variant="danger" className="w-full" disabled={busy} onClick={remove}>
              <Trash2 className="w-4 h-4" /> Borrar
            </Button>
          )}
        </div>
      )}
    >
      {edit && (
        <>
          <Field label="Nombre" hint="Así lo ve el atleta: Nequi, Daviplata, Bancolombia ahorros, Llave Bre-B...">
            <TextInput value={edit.label} onChange={set('label')} maxLength={60} placeholder="Nequi" />
          </Field>
          <Field label="Número, celular o llave">
            <TextInput value={edit.account_number} onChange={set('account_number')} maxLength={60} placeholder="300 123 4567" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Titular (opcional)">
              <TextInput value={edit.holder_name} onChange={set('holder_name')} maxLength={100} />
            </Field>
            <Field label="Cédula o NIT (opcional)">
              <TextInput value={edit.holder_document} onChange={set('holder_document')} maxLength={30} inputMode="numeric" />
            </Field>
          </div>
          <Field label="Nota para el atleta (opcional)">
            <TextInput value={edit.notes} onChange={set('notes')} maxLength={300} placeholder="Ej. escribe tu nombre en la descripción" />
          </Field>
          {/* No va dentro de Field (un <label>): tiene su propio label y un botón. */}
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5]">Código QR (opcional)</span>
            <div className="flex items-center gap-3">
              {(file || edit.qr_path) ? (
                <QrPreview path={edit.qr_path} file={file} className="w-24 h-24 p-1" />
              ) : (
                <div className="w-24 h-24 rounded-xl border border-dashed border-white/15 flex items-center justify-center text-gray-600">
                  <QrCode className="w-8 h-8" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="px-3 py-2 rounded-xl bg-[#292929] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer tap-bounce">
                  <Upload className="w-4 h-4" /> {file || edit.qr_path ? 'Cambiar imagen' : 'Subir imagen'}
                  <input type="file" accept="image/*" className="hidden" onChange={pickFile} />
                </label>
                {(file || edit.qr_path) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setEdit({ ...edit, qr_path: null });
                    }}
                    className="text-[11px] font-black text-red-400 text-left"
                  >
                    Quitar QR
                  </button>
                )}
              </div>
            </div>
            <span className="text-[10px] text-gray-500">Una captura del QR de tu banco o billetera. PNG o JPG de hasta 2 MB.</span>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Orden">
              <input type="number" value={edit.sort_order} onChange={set('sort_order')} className={inputClass} />
            </Field>
            <div className="pb-3">
              <ActiveToggle value={edit.is_active} onChange={(v) => setEdit({ ...edit, is_active: v })} label="Visible para los atletas" />
            </div>
          </div>
        </>
      )}
      <ErrorBox error={error} />
    </Sheet>
  );
}

const DEFAULT_PAYMENT_INSTRUCTIONS = 'Después de pagar, toca "Ya pagué" y adjunta el comprobante para que el box lo confirme.';

function PaymentsSection() {
  const { fetchPaymentAccounts, fetchSettings, saveSetting } = useManageStore();
  const resetPaymentInfo = usePaymentStore((state) => state.invalidateInfo);
  const [accounts, setAccounts] = useState(null);
  const [form, setForm] = useState(null); // { whatsapp, instructions }
  const [edit, setEdit] = useState(null);
  const [saved, setSaved] = useState(false);
  const load = useAction();
  const action = useAction();

  const refresh = useCallback(async () => {
    setAccounts(await fetchPaymentAccounts());
    resetPaymentInfo();
  }, [fetchPaymentAccounts, resetPaymentInfo]);

  useEffect(() => {
    load.run(async () => {
      const [, settings] = await Promise.all([refresh(), fetchSettings(['payment_whatsapp', 'payment_instructions'])]);
      setForm({
        whatsapp: settings.payment_whatsapp || '',
        instructions: settings.payment_instructions || DEFAULT_PAYMENT_INSTRUCTIONS,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveContact = () => action.run(async () => {
    const phone = form.whatsapp.trim();
    if (phone && !whatsappPhone(phone)) {
      throw new Error('Revisa el celular: uno colombiano tiene 10 dígitos y empieza por 3 (ej. 3001234567).');
    }
    if (form.instructions.length > 2000) throw new Error('Las indicaciones son muy largas (máximo 2.000 caracteres).');
    await Promise.all([
      saveSetting('payment_whatsapp', phone || null),
      saveSetting('payment_instructions', form.instructions.trim() === DEFAULT_PAYMENT_INSTRUCTIONS ? null : form.instructions),
    ]);
    resetPaymentInfo();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  });

  if (!accounts || !form) return load.error ? <ErrorBox error={load.error} /> : <Loading />;

  return (
    <>
      <p className="text-[11px] text-[#A0A0A5]">
        Los atletas vinculados ven estos datos al tocar "Pagar" cuando tienen una deuda o su mensualidad está por vencer
        o vencida. También salen en el recordatorio de mensualidad por WhatsApp.
      </p>

      {accounts.length === 0 && (
        <Empty title="Aún no hay medios de pago">Agrega tu Nequi, cuenta o llave, con su QR si lo tienes.</Empty>
      )}
      {accounts.map((a) => (
        <button key={a.id} type="button" onClick={() => setEdit(a)} className="text-left">
          <Card className={`flex items-center gap-3 ${a.is_active ? '' : 'opacity-50'}`}>
            {a.qr_path ? (
              <QrPreview path={a.qr_path} className="w-12 h-12 p-0.5 shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#FFC815]/10 text-[#FFC815] flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-black text-white block truncate">{a.label}</span>
              <span className="text-[11px] text-gray-400 block truncate">
                {[a.account_number, a.holder_name].filter(Boolean).join(' · ') || 'Solo QR'}
              </span>
            </div>
            {!a.is_active && <Badge className="bg-white/5 text-gray-400 border-white/10">Oculto</Badge>}
          </Card>
        </button>
      ))}
      <Button variant="secondary" onClick={() => setEdit({ ...EMPTY_ACCOUNT, sort_order: accounts.length + 1 })}>
        <Plus className="w-4 h-4" /> Agregar medio de pago
      </Button>

      <SectionTitle>Comprobantes</SectionTitle>
      <Field label="WhatsApp del box para recibir comprobantes" hint="Si lo dejas vacío, el atleta no ve el botón de enviar comprobante.">
        <TextInput
          type="tel"
          inputMode="tel"
          value={form.whatsapp}
          onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          placeholder="3001234567"
        />
      </Field>
      <Field label="Indicaciones para el atleta">
        <TextArea rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
      </Field>
      <ErrorBox error={action.error} />
      <Button disabled={action.busy} onClick={saveContact}>
        {action.busy ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
      </Button>

      <PaymentAccountSheet account={edit} onClose={() => setEdit(null)} onSaved={() => load.run(refresh)} />
    </>
  );
}

// ---------------------------------------------------------------------
// Auditoría
// ---------------------------------------------------------------------
const TABLE_LABELS = {
  members: 'Miembros',
  memberships: 'Membresías',
  membership_renewals: 'Renovaciones',
  membership_plans: 'Planes',
  class_usages: 'Clases',
  debts: 'Deudas',
  debt_items: 'Ítems de deuda',
  debt_payments: 'Abonos',
  products: 'Productos',
  expenses: 'Gastos',
  incomes: 'Ingresos',
  partner_transfers: 'Entregas',
  settlements: 'Cuadres',
  partners: 'Socios',
  user_roles: 'Roles',
  expense_categories: 'Categorías',
  app_settings: 'Ajustes del box',
  payment_accounts: 'Medios de pago',
};
const ACTION_LABELS = { INSERT: 'Creó', UPDATE: 'Modificó', DELETE: 'Borró' };
const IGNORED_KEYS = new Set(['updated_at', 'hik_synced_at']);

function changedKeys(row) {
  if (row.action !== 'UPDATE' || !row.old_data || !row.new_data) return [];
  return Object.keys(row.new_data).filter(
    (k) => !IGNORED_KEYS.has(k) && JSON.stringify(row.old_data[k]) !== JSON.stringify(row.new_data[k]),
  );
}

function AuditSection() {
  const fetchAudit = useManageStore((state) => state.fetchAudit);
  const [table, setTable] = useState('');
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const { run, error } = useAction();

  useEffect(() => {
    run(async () => setRows(await fetchAudit({ table: table || null })));
  }, [fetchAudit, table, run]);

  return (
    <>
      <Select value={table} onChange={(e) => setTable(e.target.value)}>
        <option value="">Todas las tablas</option>
        {Object.entries(TABLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </Select>
      <ErrorBox error={error} />
      {!rows ? <Loading /> : rows.length === 0 ? <Empty title="Sin registros" /> : rows.map((r) => {
        const keys = changedKeys(r);
        const isOpen = open === r.id;
        return (
          <button key={r.id} type="button" onClick={() => setOpen(isOpen ? null : r.id)} className="text-left">
            <Card className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-white">
                  {ACTION_LABELS[r.action] || r.action} · {TABLE_LABELS[r.table_name] || r.table_name}
                </span>
                <span className="text-[10px] text-gray-500 shrink-0">{formatDateTime(r.changed_at)}</span>
              </div>
              <span className="text-[10px] text-gray-400 block">
                {r.actorProfile?.full_name || (r.actor ? 'Usuario' : 'Sistema / PC del box')}
                {keys.length > 0 && ` · ${keys.join(', ')}`}
              </span>
              {isOpen && (
                <pre className="mt-2 p-2 rounded-lg bg-[#0A0A0C] text-[10px] text-gray-300 whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                  {r.action === 'UPDATE'
                    ? keys.map((k) => `${k}: ${JSON.stringify(r.old_data[k])} → ${JSON.stringify(r.new_data[k])}`).join('\n') || 'Sin cambios visibles'
                    : JSON.stringify(r.new_data || r.old_data, null, 1)}
                </pre>
              )}
            </Card>
          </button>
        );
      })}
    </>
  );
}

const SECTION_COMPONENTS = {
  partners: PartnersSection,
  plans: PlansSection,
  products: ProductsSection,
  categories: CategoriesSection,
  roles: RolesSection,
  payments: PaymentsSection,
  whatsapp: WhatsAppSection,
  bridge: BridgeSection,
  audit: AuditSection,
};

export default function Settings() {
  const { section } = useParams();
  const loadCatalogs = useManageStore((state) => state.loadCatalogs);
  const { run, error } = useAction();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    run(async () => {
      await loadCatalogs(true);
      setReady(true);
    });
  }, [loadCatalogs, run]);

  if (section && !SECTION_COMPONENTS[section]) return <Navigate to="/manage/settings" replace />;

  if (!section) {
    return (
      <div className="flex flex-col gap-3 pb-8">
        <ManageHeader title="Ajustes" />
        <ErrorBox error={error} />
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <Link key={key} to={`/manage/settings/${key}`} className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center gap-3 tap-bounce">
            <div className="p-2 rounded-xl bg-[#FFC815]/10 text-[#FFC815]"><Icon className="w-5 h-5" /></div>
            <span className="flex-1 text-sm font-black text-white">{label}</span>
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </Link>
        ))}
      </div>
    );
  }

  const Section = SECTION_COMPONENTS[section];
  const label = SECTIONS.find((s) => s.key === section)?.label;
  return (
    <div className="flex flex-col gap-3 pb-8">
      <ManageHeader title={label} subtitle="Ajustes" back="/manage/settings" />
      <ErrorBox error={error} />
      {ready ? <Section /> : <Loading />}
    </div>
  );
}
