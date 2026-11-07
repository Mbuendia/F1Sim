import { CAR_MODEL, applyLivery } from '../renderer/carModel3d';
import { compoundStyle } from '../utils/compounds';

type Mountable = { userData: Record<string, unknown>; traverse: Parameters<typeof applyLivery>[0]['traverse'] };

/**
 * [CA4] Monta en un coche 3D el compuesto que lleva: pinta la banda del neumático con su color. Solo hace algo cuando el
 * compuesto cambia (al salir de boxes); devuelve si lo ha cambiado. La librea no se toca.
 */
export function syncCompound(root: Mountable, compound: string): boolean {
  if (root.userData.compound === compound) return false;
  applyLivery(root, { [CAR_MODEL.materials.band]: compoundStyle(compound).color });
  root.userData.compound = compound;
  return true;
}
