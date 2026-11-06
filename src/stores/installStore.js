import { create } from 'zustand';

// Instalación de la PWA en la pantalla de inicio.
// - Android / Chrome / Edge: el navegador emite `beforeinstallprompt`; se guarda el evento
//   y al llamar `install()` aparece el diálogo nativo, donde el usuario solo confirma.
// - iPhone / iPad: Safari no permite instalar desde la página; se muestran los pasos
//   (Compartir → Agregar a inicio).
// Este módulo se importa en main.jsx para escuchar el evento antes de montar React.

const SNOOZE_KEY = 'rokbox.install.snoozedUntil';
const SNOOZE_DAYS = 3;

function mediaMatches(query) {
  try {
    return window.matchMedia?.(query).matches ?? false;
  } catch {
    return false;
  }
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return mediaMatches('(display-mode: standalone)')
    || mediaMatches('(display-mode: fullscreen)')
    || mediaMatches('(display-mode: minimal-ui)')
    || window.navigator.standalone === true;
}

function detectIos() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS se presenta como Mac de escritorio, pero con pantalla táctil.
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function readSnooze() {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY)) || 0;
  } catch {
    return 0;
  }
}

const useInstallStore = create((set, get) => ({
  promptEvent: null,
  installed: isStandalone(),
  ios: detectIos(),
  sheetOpen: false,
  snoozedUntil: readSnooze(),

  /** Se puede instalar desde este navegador (con diálogo nativo o con los pasos de iPhone). */
  canInstall: () => {
    const { installed, promptEvent, ios } = get();
    return !installed && (Boolean(promptEvent) || ios);
  },

  isSnoozed: () => get().snoozedUntil > Date.now(),

  openSheet: () => set({ sheetOpen: true }),

  /** Cierra la sugerencia y no la vuelve a mostrar sola durante unos días. */
  snooze: () => {
    const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem(SNOOZE_KEY, String(until));
    } catch {
      // Sin almacenamiento (modo privado): se vuelve a sugerir en la próxima visita.
    }
    set({ sheetOpen: false, snoozedUntil: until });
  },

  /** Abre el diálogo nativo de instalación. Devuelve 'accepted', 'dismissed' o 'unavailable'. */
  install: async () => {
    const event = get().promptEvent;
    if (!event) return 'unavailable';
    // El evento solo se puede usar una vez.
    set({ promptEvent: null });
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === 'accepted') set({ sheetOpen: false });
      return outcome;
    } catch {
      return 'unavailable';
    }
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Evita la barra propia del navegador: la app muestra su propia sugerencia.
    event.preventDefault();
    useInstallStore.setState({ promptEvent: event });
  });

  window.addEventListener('appinstalled', () => {
    useInstallStore.setState({ installed: true, promptEvent: null, sheetOpen: false });
  });

  try {
    window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', (e) => {
      if (e.matches) useInstallStore.setState({ installed: true, sheetOpen: false });
    });
  } catch {
    // Navegadores sin matchMedia con eventos: no pasa nada.
  }
}

export default useInstallStore;
