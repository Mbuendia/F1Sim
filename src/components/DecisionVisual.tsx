import { Suspense, lazy, useState } from 'react';
import { Box } from 'lucide-react';
import type { DecisionVisual as Visual } from '../simulation/Hub';
import { FACILITY_IMAGE, PART_FOR_PROJECT, resolveVisual } from '../scene3d/partVisuals';
import m from './Management.module.css';

/** El visor 3D (con three) solo se descarga cuando se pide ver la pieza. */
const PartViewer = lazy(() => import('./PartViewer'));

/**
 * [UX10] Imagen de una decisión. Una instalación o la sede: su imagen (FACILITY_IMAGE). Una mejora o un componente: un
 * botón que, al tocarlo, carga el coche en 3D girando con la pieza resaltada (highlight, PART_FOR_PROJECT). Así, en el
 * móvil solo hay un visor 3D cuando se pide.
 */
export default function DecisionVisual({ visual, accent }: { visual: Visual; accent?: string }) {
  const [open, setOpen] = useState(false);
  const shown = resolveVisual(visual);
  if (!shown) return null;
  if (shown.kind === 'imagen') {
    return <img className={m.decisionImage} src={`${import.meta.env.BASE_URL}${shown.src}`} alt={shown.alt} loading="lazy" width={960} height={540} />;
  }
  if (!open) {
    return (
      <button type="button" className={m.button} onClick={() => setOpen(true)} data-part-button>
        <Box size={16} aria-hidden="true" />Ver la pieza: {shown.label}
      </button>
    );
  }
  return (
    <Suspense fallback={<div className={m.decisionImage} aria-busy="true" />}>
      <PartViewer highlight={shown.parts} label={`Coche en 3D con ${shown.label.toLowerCase()} resaltado`} accent={accent} />
    </Suspense>
  );
}

/** Para comprobar de un vistazo que todas las mejoras e instalaciones tienen qué enseñar. */
export const VISUAL_SOURCES = { PART_FOR_PROJECT, FACILITY_IMAGE };
