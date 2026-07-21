// Reglas del @handle (display_name), espejo del CHECK
// profiles_display_name_format de la migracion 0007.
export const HANDLE_REGEX = /^[a-z0-9._]{3,20}$/;

export const normalizeHandle = (value) =>
  value.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20);
