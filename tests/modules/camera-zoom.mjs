// R32: el zoom del usuario (rueda o botones) se respeta al seguir un coche y «Vista general» lo restablece.
export default async function run({ server, assert, test }) {
  const { Camera } = await server.ssrLoadModule('/src/renderer/Camera.ts');
  await test('R32: zoom del usuario en seguimiento y reinicio con vista general', () => {
    const camera = new Camera();
    const car = { id: 1, worldX: 100, worldY: 100, status: 'running', isRetiredVisible: false };
    camera.followCar(1);
    camera.update([car], 0.016);
    const base = camera.targetZoom;
    camera.zoomBy(1.25);
    camera.update([car], 0.016);
    const zoomed = camera.targetZoom;
    camera.resetToFullTrack();
    assert(Math.abs(zoomed - base * 1.25) < 1e-9 && camera.zoomLevel === 1, 'R32: acercar se mantiene al seguir y la vista general lo restablece',
      `${base.toFixed(2)} → ${zoomed.toFixed(2)}`);
  });
}
