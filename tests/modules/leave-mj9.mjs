// MJ9 — Salir de la carrera sin errores (Sprint 15). Contrato aprobado por el usuario el 20/11/2026 («Sí, adelante»):
//  1. «GPs» (anfitrión o en solitario) y «Salir de la sala» (invitado) abren un aviso: «Seguir en la carrera» no hace nada
//     y «Salir» sale; el texto cambia según sea carrera libre, profesional, anfitrión o invitado.
//  2. El gesto o el botón de atrás durante la carrera abre el aviso y la carrera sigue; con la carrera terminada, sale.
//  3. Recargar o cerrar la pestaña durante la carrera pide confirmación; fuera de ella o con ella terminada, no.
//  4. Si un invitado se va, el anfitrión ve un aviso con su nombre; el invitado que sale ve cómo volver a la sala.
//  5. Capturas del aviso en escritorio y en el móvil, como anfitrión y como invitado.
// Prueba en Chrome sin ventana del 20/11/2026 (carrera libre de Barcelona y la revisión del invitado): «GPs» y «Salir de
// la sala» abren el aviso; «Seguir en la carrera» lo cierra y la carrera sigue; history.back() en carrera abre el aviso
// (escritorio y 430 px); «Salir» lleva al menú; beforeunload se bloquea en carrera y deja de bloquearse al salir.
import { readFileSync, existsSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const src = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export default async function run({ server, assert, test }) {
  const L = await server.ssrLoadModule('/src/utils/leaveRace.ts');
  const { LeaveRaceDialog } = await server.ssrLoadModule('/src/components/LeaveRaceDialog.tsx');

  await test('MJ9.1: el aviso de salida, con lo que se pierde en cada caso', () => {
    const libre = L.leaveText('libre', { saved: true }), pro = L.leaveText('profesional', { saved: true }), lost = L.leaveText('libre', { saved: false });
    const host = L.leaveText('anfitrion'), guest = L.leaveText('invitado', { roomCode: 'K7Q2' }), spec = L.leaveText('espectador', { roomCode: 'K7Q2' });
    const texts = /Autoguardado/.test(libre.body) && /temporada/.test(pro.body) && /se pierde/.test(lost.body)
      && /se cierra[\s\S]*todos/.test(host.body) && /K7Q2/.test(guest.body) && /estratega lleva tus coches/.test(guest.body) && /K7Q2/.test(spec.body);
    const html = renderToStaticMarkup(createElement(LeaveRaceDialog, { kind: 'anfitrion', onStay() {}, onLeave() {} }));
    const dialog = /role="alertdialog"/.test(html) && /Seguir en la carrera/.test(html) && /Cerrar la sala y salir/.test(html);
    const app = src('src/App.tsx'), client = src('src/components/ClientRace.tsx');
    const wired = app.includes('onClick={requestLeaveRace}') && app.includes("kind={sharedRef.current ? 'anfitrion' : mode === 'career' ? 'profesional' : 'libre'}")
      && app.includes('onStay={() => setLeaveAsk(false)} onLeave={() => { setLeaveAsk(false); handleLeaveRace(); }}')
      && client.includes('onClick={requestLeave} aria-label="Salir de la sala"') && client.includes("kind={player ? 'invitado' : 'espectador'} roomCode={roomCode}");
    assert(texts && dialog && wired, 'MJ9: «GPs» y «Salir de la sala» abren un aviso con «Seguir en la carrera» y «Salir», que dice qué se pierde en carrera libre, profesional, como anfitrión o como invitado',
      JSON.stringify({ texts, dialog, wired }));
  });

  await test('MJ9.2: atrás durante la carrera abre el aviso; terminada, sale', () => {
    const guard = src('src/utils/leaveRace.ts');
    const pop = /const onPop = \(\) => \{ push\(\); back\.current\(\); \};/.test(guard) && guard.includes("window.addEventListener('popstate', onPop);") && /if \(!active \|\| typeof window === 'undefined'\) return;/.test(guard);
    const app = src('src/App.tsx'), client = src('src/components/ClientRace.tsx');
    const active = app.includes("const leaveGuarded = currentView === 'race' && !isFinished;") && app.includes('useLeaveGuard(leaveGuarded, () => setLeaveAsk(true));')
      && client.includes('const leaveGuarded = Boolean(slow) && !slow?.finished && !closed;') && client.includes('useLeaveGuard(leaveGuarded, () => setLeaveAsk(true));');
    assert(pop && active, 'MJ9: en carrera, «atrás» gasta una entrada propia del historial y abre el aviso; terminada la carrera (o cerrada la sala) no hay protección', JSON.stringify({ pop, active }));
  });

  await test('MJ9.3: recargar o cerrar la pestaña pide confirmación solo en carrera', () => {
    const guard = src('src/utils/leaveRace.ts');
    const unload = guard.includes("const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };")
      && guard.includes("window.addEventListener('beforeunload', onBeforeUnload);") && guard.includes("window.removeEventListener('beforeunload', onBeforeUnload);");
    assert(unload, 'MJ9: mientras dura la carrera, recargar o cerrar la pestaña pide la confirmación del navegador; al acabar o salir se quita', String(unload));
  });

  await test('MJ9.4: el anfitrión ve quién se va; el invitado, cómo volver', () => {
    const shared = src('src/net/SharedRace.ts');
    const notify = shared.includes("this.onPresence?.(uid, this.names[uid] ?? 'Un jugador', 'dropped');") && shared.includes("this.onPresence?.(uid, this.names[uid] ?? 'Un jugador', 'returned');");
    const app = src('src/App.tsx');
    const notice = app.includes('onPresence: (_uid, name, op) => presenceNoticeRef.current(name, op)') && app.includes('se ha ido de la sala: el estratega lleva sus coches');
    const back = /volver a entrar con su código/.test(L.leaveText('invitado', { roomCode: 'K7Q2' }).body) && src('src/components/RoomFlow.tsx').includes("onLeave={exit} roomCode={code} />");
    assert(notify && notice && back, 'MJ9: cuando un invitado se va (o vuelve), el anfitrión ve un aviso con su nombre; el invitado que sale sabe que puede volver con el código de la sala',
      JSON.stringify({ notify, notice, back }));
  });

  await test('MJ9.5: capturas', () => {
    const dir = 'docs/design/mj9-capturas';
    const need = ['anfitrion-escritorio.png', 'anfitrion-movil.png', 'invitado-escritorio.png', 'invitado-movil.png'];
    const missing = need.filter(f => !existsSync(`${dir}/${f}`));
    assert(missing.length === 0, 'MJ9: capturas del aviso en escritorio y en el móvil, como anfitrión y como invitado', missing.join(', '));
  });
}
