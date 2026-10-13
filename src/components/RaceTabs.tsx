import { Gauge, ListOrdered, Map as MapIcon, Radio } from 'lucide-react';
import styles from './RaceTabs.module.css';

export type RaceTab = 'pista' | 'tiempos' | 'muro' | 'detalle';
export type RaceLayout = 'movil' | 'tableta' | 'escritorio';

/** [V1] Puntos de corte comunes del rediseño (px): por debajo del primero, móvil; por debajo del segundo, tableta. */
export const BREAKPOINTS = { tableta: 768, escritorio: 1024, ancho: 1440 } as const;

/** [V2] Composición de la pantalla de carrera según el ancho de la ventana. */
export const raceLayout = (width: number): RaceLayout => (width < BREAKPOINTS.tableta ? 'movil' : width < BREAKPOINTS.escritorio ? 'tableta' : 'escritorio');

const TABS: { id: RaceTab; label: string; icon: typeof Gauge }[] = [
  { id: 'pista', label: 'Pista', icon: MapIcon },
  { id: 'tiempos', label: 'Tiempos', icon: ListOrdered },
  { id: 'muro', label: 'Muro', icon: Radio },
  { id: 'detalle', label: 'Detalle', icon: Gauge },
];

/** [V2] Pestañas inferiores de la carrera en móvil: la pista sola o con uno de los tres paneles debajo. */
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
