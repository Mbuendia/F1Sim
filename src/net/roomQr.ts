// [N7] QR del enlace de una sala, como SVG (se pinta tal cual en la pantalla del anfitrión).
import qrcode from 'qrcode-generator';

export function qrSvg(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
