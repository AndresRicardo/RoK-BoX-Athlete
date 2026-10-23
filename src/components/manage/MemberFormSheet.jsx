import { useEffect, useState } from 'react';
import useManageStore from '../../stores/manageStore';
import { Sheet, Field, TextInput, TextArea, Button, ErrorBox, useAction } from './ui';

const EMPTY = { fullName: '', documentId: '', phone: '', email: '', notes: '' };

// Crear o editar los datos de un miembro (upsert_member). La persona en HikCentral
// se registra allá (huella o rostro); el bridge la vincula por la cédula (D36).
export default function MemberFormSheet({ open, member, onClose, onSaved }) {
  const saveMember = useManageStore((state) => state.saveMember);
  const [form, setForm] = useState(EMPTY);
  const { run, busy, error } = useAction();

  useEffect(() => {
    if (!open) return;
    setForm(member
      ? {
          fullName: member.full_name || '',
          documentId: member.document_id || '',
          phone: member.phone || '',
          email: member.email || '',
          notes: member.notes || '',
        }
      : EMPTY);
  }, [open, member]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = () => run(async () => {
    if (!form.fullName.trim()) throw new Error('El nombre es obligatorio.');
    const doc = form.documentId.trim();
    if (doc && !/^[0-9A-Za-z-]{5,20}$/.test(doc)) {
      throw new Error('La cédula debe tener de 5 a 20 caracteres, sin espacios ni puntos.');
    }
    const saved = await saveMember({ ...form, id: member?.id, documentId: doc });
    onSaved?.(saved);
    onClose();
  });

  return (
    <Sheet
      open={open}
      title={member ? 'Editar miembro' : 'Nuevo miembro'}
      onClose={onClose}
      footer={(
        <Button className="w-full py-3" disabled={busy} onClick={submit}>
          {busy ? 'Guardando...' : 'Guardar'}
        </Button>
      )}
    >
      <Field label="Nombre completo *">
        <TextInput value={form.fullName} onChange={set('fullName')} />
      </Field>
      <Field
        label="Cédula"
        hint={member?.hik_person_id
          ? 'Debe coincidir con el campo "Cc" de la persona en HikCentral.'
          : 'Con la cédula, el PC del box lo vincula cuando lo registren en HikCentral.'}
      >
        <TextInput value={form.documentId} onChange={set('documentId')} inputMode="numeric" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Teléfono">
          <TextInput value={form.phone} onChange={set('phone')} inputMode="tel" />
        </Field>
        <Field label="Email">
          <TextInput value={form.email} onChange={set('email')} inputMode="email" />
        </Field>
      </div>
      <Field label="Notas">
        <TextArea value={form.notes} onChange={set('notes')} />
      </Field>
      {member && (
        <p className="text-[10px] text-gray-500">
          Si dejas un campo vacío, se conserva el valor anterior.
        </p>
      )}
      <ErrorBox error={error} />
    </Sheet>
  );
}
