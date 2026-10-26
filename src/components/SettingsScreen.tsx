import { lazy, Suspense } from 'react';
import { ArrowLeft } from 'lucide-react';
import s from './Screens.module.css';

const RadioSettings = lazy(() => import('./RadioSettings'));

/**
 * [UX1] Ajustes desde la pantalla de juego, con vuelta a ella. De momento reúne los de la radio (con sus descargas);
 * UX2 la completa con sonido, gráficos y controles, y la sección de la radio destacada arriba.
 */
export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className={s.screen}>
      <header className={s.head}>
        <button type="button" className={s.button} onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />Volver</button>
        <h1>Ajustes</h1>
      </header>
      <main className={s.body}>
        <Suspense fallback={<p className={s.dim}>Cargando los ajustes…</p>}><RadioSettings /></Suspense>
      </main>
    </div>
  );
}
