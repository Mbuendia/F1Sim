// [MJ12, 20/11/2026] Revisión del semáforo de salida en cada estado, sobre un fondo de pista.
// ?revision=semaforo&estado=grid-ready|lights-1..lights-5|lights-out
import { StartLights } from '../components/StartLights';
import type { StartLightState } from '../types/f1';

export default function StartLightsReview() {
  const state = (new URLSearchParams(location.search).get('estado') ?? 'lights-3') as StartLightState;
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: 'radial-gradient(ellipse at 50% 70%, #2a3a2e, #0b0e13 70%)', overflow: 'hidden' }} data-lights-review>
      <StartLights lightState={state} cars={[]} favoriteCarId={0} onSelectFavoriteCar={() => {}} onStartClick={() => {}} />
    </div>
  );
}
