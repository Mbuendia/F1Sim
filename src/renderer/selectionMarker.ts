// [MJ6, 19/11/2026] Marcador del piloto seleccionado: un chevrón ▼ con «CÓDIGO · Pn» en el color de su equipo, flotando
// encima del coche, con un pulso suave (decisión del usuario: «Marcador flotante»). El mismo en la vista 2D, en la 3D y
// sobre el punto de lejos; se pinta el último, encima de coches y etiquetas. Si el piloto abandona, gris.

/** Lo que dice el marcador y su color. */
export function markerLabel(car: { driver: { code: string }; currentPosition: number; status: string; team: { color: string } }): { text: string; color: string; retired: boolean } {
  const retired = car.status === 'out';
  return { text: `${car.driver.code} · ${retired ? 'DNF' : `P${car.currentPosition}`}`, color: retired ? '#7a7f87' : car.team.color, retired };
}

/** Desplazamiento vertical del pulso (px) en el segundo t; 0 con «reducir movimiento». */
export const markerBob = (tSec: number, reduced: boolean) => (reduced ? 0 : Math.sin(tSec * 4) * 3);

/** Pinta el marcador con la punta del chevrón en (x, y), que es el punto justo encima del coche. */
export function drawSelectionMarker(ctx: CanvasRenderingContext2D, x: number, y: number, label: { text: string; color: string; retired: boolean }, tSec: number, reduced: boolean): void {
  const tip = y - 4 + markerBob(tSec, reduced);
  ctx.save();
  ctx.font = "800 14px 'Barlow Condensed', 'Arial Narrow', sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.ceil(ctx.measureText(label.text).width) + 16, h = 22;
  const boxY = tip - 12 - h;
  // Sombra suave para que se lea sobre cualquier fondo.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = label.color;
  ctx.fillRect(x - w / 2, boxY, w, h);
  // Chevrón ▼ bajo la etiqueta, apuntando al coche.
  ctx.beginPath();
  ctx.moveTo(x - 9, tip - 12);
  ctx.lineTo(x + 9, tip - 12);
  ctx.lineTo(x, tip);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.strokeRect(x - w / 2 + 0.75, boxY + 0.75, w - 1.5, h - 1.5);
  ctx.fillStyle = luminance(label.color) > 0.6 ? '#101418' : '#ffffff';
  ctx.fillText(label.text, x, boxY + h / 2 + 0.5);
  ctx.restore();
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}
