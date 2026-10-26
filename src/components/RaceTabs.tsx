import { Gauge, ListOrdered, Map as MapIcon, Radio } from 'lucide-react';
import styles from './RaceTabs.module.css';

export type RaceTab = 'pista' | 'tiempos' | 'muro' | 'detalle';
export type RaceLayout = 'movil' | 'tableta' | 'escritorio';

/** [V1] Puntos de corte comunes del rediseño (px): por debajo del primero, móvil; por debajo del segundo, tableta. */
export const BREAKPOINTS = { tableta: 768, escritorio: 1024, ancho: 1440 } as const;

/** [V2] Composición de la pantalla de carrera según el ancho de la ventana. */
export const raceLayout = (width: number): RaceLayout => (width < BREAKPOINTS.tableta ? 'movil' : width < BREAKPOINTS.escritorio ? 'tableta' : 'escritorio');

/**
 * [UX5] Qué se ve en la carrera. En el móvil cada pestaña ocupa la pantalla entera (Pista: solo la pista; las demás:
 * solo su panel) y arriba va siempre la franja de la vuelta. En tableta y escritorio no cambia nada.
 */
export function mobileRaceView(layout: RaceLayout, tab: RaceTab): { track: boolean; panel: Exclude<RaceTab, 'pista'> | null; strip: boolean } {
  if (layout !== 'movil') return { track: true, panel: null, strip: false };
  return tab === 'pista' ? { track: true, panel: null, strip: true } : { track: false, panel: tab, strip: true };
}

const TABS: { id: RaceTab; label: string; icon: typeof Gauge }[] = [
  { id: 'pista', label: 'Pista', icon: MapIcon },
  { id: 'tiempos', label: 'Tiempos', icon: ListOrdered },
  { id: 'muro', label: 'Muro', icon: Radio },
  { id: 'detalle', label: 'Detalle', icon: Gauge },
];

/** [V2] Pestañas inferiores de la carrera en móvil. [UX5] Cada una ocupa la pantalla entera. */
export function RaceTabs({ tab, onChange }: { tab: RaceTab; onChange: (tab: RaceTab) => void }) {
  return (
    <nav className={styles.tabs} role="tablist" aria-label="Paneles de la carrera">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} className={styles.tab} onClick={() => onChange(id)}>
          <Icon size={20} aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  );
}
