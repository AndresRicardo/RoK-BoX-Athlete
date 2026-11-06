import { useEffect, useRef, useState } from 'react';
import { Download, Share, PlusSquare, Smartphone, BellRing, Zap, MoreVertical } from 'lucide-react';
import useInstallStore from '../stores/installStore';
import { Sheet, Button } from './manage/ui';

// Segundos que espera la sugerencia antes de aparecer sola, para no tapar la primera pantalla.
const AUTO_OPEN_DELAY_MS = 3000;
// Ícono dentro de una línea de texto.
const ICON = 'inline w-4 h-4 align-[-3px] mx-0.5';

function isPhone() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

function Step({ n, children }) {
  return (
    <li className="flex items-start gap-2">
      <span className="w-5 h-5 rounded-full bg-[#292929] text-[10px] font-black flex items-center justify-center shrink-0">{n}</span>
      <span className="leading-5">{children}</span>
    </li>
  );
}

/** Hoja global que sugiere instalar la app mientras no esté en la pantalla de inicio. */
export default function InstallPrompt() {
  const installed = useInstallStore((s) => s.installed);
  const promptEvent = useInstallStore((s) => s.promptEvent);
  const ios = useInstallStore((s) => s.ios);
  const sheetOpen = useInstallStore((s) => s.sheetOpen);
  const snoozedUntil = useInstallStore((s) => s.snoozedUntil);
  const { openSheet, snooze, install } = useInstallStore.getState();
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const autoShown = useRef(false);

  const available = !installed && (Boolean(promptEvent) || ios);

  // Aparece sola una vez por visita, solo en teléfonos y si no se pospuso hace poco.
  useEffect(() => {
    if (autoShown.current || !available || sheetOpen) return undefined;
    if (snoozedUntil > Date.now() || !(ios || isPhone())) return undefined;
    const timer = setTimeout(() => {
      autoShown.current = true;
      openSheet();
    }, AUTO_OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [available, sheetOpen, snoozedUntil, ios, openSheet]);

  if (installed) return null;

  const handleInstall = async () => {
    setBusy(true);
    const outcome = await install();
    setBusy(false);
    if (outcome === 'dismissed') snooze();
    if (outcome === 'unavailable') setFallback(true);
  };

  const nativePrompt = Boolean(promptEvent) && !ios;

  return (
    <Sheet
      open={sheetOpen}
      title="Instala RöK BoX"
      onClose={snooze}
      footer={
        nativePrompt && !fallback ? (
          <div className="flex flex-col gap-2">
            <Button onClick={handleInstall} disabled={busy} className="py-3.5 text-sm uppercase tracking-wider">
              <Download className="w-4 h-4" />
              {busy ? 'Un momento...' : 'Instalar'}
            </Button>
            <Button variant="ghost" onClick={snooze}>Ahora no</Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={snooze} className="w-full py-3">Entendido</Button>
        )
      }
    >
      <div className="flex items-center gap-3">
        <img src="/pwa-192x192.png" alt="" className="w-14 h-14 rounded-2xl border border-white/10 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-black text-white">Tenla en tu pantalla de inicio</p>
          <p className="text-xs text-[#A0A0A5] mt-0.5">Ábrela con un toque, como cualquier otra app.</p>
        </div>
      </div>

      <ul className="flex flex-col gap-2 text-xs text-gray-300">
        <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-[#FFC815] shrink-0" /> Abre más rápido y en pantalla completa.</li>
        <li className="flex items-center gap-2"><BellRing className="w-4 h-4 text-[#FFC815] shrink-0" /> Recibe avisos de tu membresía, pagos y comunidad.</li>
        <li className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-[#FFC815] shrink-0" /> No ocupa espacio como una app de tienda.</li>
      </ul>

      {ios && (
        <ol className="flex flex-col gap-2 text-xs text-gray-300 p-3 rounded-xl bg-[#0A0A0C] border border-white/5">
          <Step n={1}>
            Toca <Share className={`${ICON} text-sky-400`} /> <strong>Compartir</strong> en la barra del navegador{' '}
            <span className="text-gray-500">(en Safari puede estar dentro de ···)</span>.
          </Step>
          <Step n={2}>
            Elige <PlusSquare className={ICON} /> <strong>Agregar a inicio</strong> y toca <strong>Agregar</strong>.
          </Step>
          <Step n={3}>Abre RöK BoX desde el nuevo ícono.</Step>
          <li className="text-[10px] text-gray-500 pl-7">Si no ves la opción, abre esta página en Safari.</li>
        </ol>
      )}

      {fallback && (
        <ol className="flex flex-col gap-2 text-xs text-gray-300 p-3 rounded-xl bg-[#0A0A0C] border border-white/5">
          <Step n={1}>
            Abre el menú <MoreVertical className={ICON} /> del navegador.
          </Step>
          <Step n={2}>
            Toca <strong>Instalar app</strong> o <strong>Agregar a pantalla de inicio</strong>.
          </Step>
        </ol>
      )}
    </Sheet>
  );
}

/** Tarjeta de Perfil para instalar la app aunque se haya pospuesto la sugerencia. */
export function InstallAppCard() {
  const installed = useInstallStore((s) => s.installed);
  const promptEvent = useInstallStore((s) => s.promptEvent);
  const ios = useInstallStore((s) => s.ios);
  const { openSheet, install } = useInstallStore.getState();

  if (installed || !(promptEvent || ios)) return null;

  // Con diálogo nativo se instala directo (un solo toque para confirmar); en iPhone se muestran los pasos.
  const handleClick = async () => {
    if (ios || !promptEvent) {
      openSheet();
      return;
    }
    const outcome = await install();
    if (outcome === 'unavailable') openSheet();
  };

  return (
    <div className="p-5 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center gap-3">
      <img src="/pwa-192x192.png" alt="" className="w-11 h-11 rounded-xl border border-white/10 shrink-0" />
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-white">Instala la app</h4>
        <p className="text-xs text-[#A0A0A5] mt-0.5">Agrégala a la pantalla de inicio de este teléfono.</p>
      </div>
      <Button onClick={handleClick} className="shrink-0">
        <Download className="w-4 h-4" />
        Instalar
      </Button>
    </div>
  );
}
