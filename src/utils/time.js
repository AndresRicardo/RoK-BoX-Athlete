// "hace 5 min", "hace 2 h", "ayer", "hace 3 d", o fecha corta si > 1 semana.
export function timeAgo(dateStr) {
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000),
  );

  if (diffSec < 60) return 'ahora';

  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} d`;

  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}
