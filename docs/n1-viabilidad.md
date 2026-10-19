# N1 — Prueba de viabilidad del Sprint 5

Medido el 18/10/2026 en el PC del usuario (Windows, navegador integrado de la app de Claude, que es Chromium), con el prototipo de `prototypes/n1/`. El prototipo se tira después y no entra en el paquete: `vite build` solo empaqueta el `index.html` de la raíz (comprobado: no aparece ningún archivo de `prototypes/` en `dist`).

**Estado:** medición completa. El respaldo por Firebase se midió el 19/10/2026 contra la base de datos real del proyecto `f1sim-d5085` (Bélgica, europe-west1), con inicio de sesión anónimo y una regla temporal que solo abre `/n1`.

## Cómo se midió

- **Anfitrión** (`?rol=anfitrion`): `RaceSimulation` corre en un Web Worker con el mismo paso fijo que el juego (0,02 s) y el bucle de `RaceCanvas` (dt real con tope). El Worker produce una foto provisional del estado a 15 por segundo; la pestaña la reenvía por un canal de datos WebRTC no fiable (sin reintentos) y recibe órdenes por un segundo canal fiable.
- **Invitado** (`?rol=invitado`): otra pestaña; la señalización va por `BroadcastChannel` (en el juego real irá por Firebase, N4) y el enlace usa STUN público de Google. Cada 2 s manda una orden de ritmo y mide la ida y vuelta.
- Cada segundo se apunta una fila con el estado de la pestaña (visible u oculta). Carreras completas en Barcelona y Monza a x4 (la escala interna del motor es 10: 10 s de carrera por segundo real) y una prueba de 30 s a x16.

## Cifras

| Medida | Visible | Oculta | Nota |
|---|---|---|---|
| Pasos de motor por segundo, x4 | 500 | 500 (mín. 499) | Igual en las dos. Un único segundo bajó a 310 mientras se compilaba el proyecto en paralelo |
| Pasos de motor por segundo, x16 | 2000 | — | Al límite: el Worker solo da 15 vueltas de bucle por segundo (~65 ms cada una) |
| Coste del motor | ~0,45 ms por paso | | x4 ocupa ~¼ de un núcleo |
| Fotos reenviadas por la pestaña del anfitrión | 15,1/s | 15,3/s | Sin caída en 391 s ocultos (racha más larga: 209 s seguidos) |
| Fotos recibidas por el invitado | 15/s | 15/s | 445 s seguidos oculta, 145 de ellos pasados los 5 minutos: sin frenazo |
| Tamaño de la foto provisional | ~4,0 KB (JSON) | | 20 coches; sin la lectura del muro por equipo. El estado completo de los coches pesa 94 KB |
| Ancho de banda por invitado | ~59 KB/s (~0,5 Mbit/s) | | A 15 fotos por segundo |
| Retraso de la foto (misma máquina) | ~1 ms | ~1 ms (máx. 9) | Entre dos redes lo medirá N10 |
| Ida y vuelta de una orden | ~1 ms | ~4 ms (máx. 41) | Incluye pasar por el Worker |
| Descarga del juego al abrirlo (Firebase Hosting) | 449 KB | | Solo el menú. Al correr se cargan además los modelos 3D (f1-car.glb, 3,1 MB; safety-car.glb, 1,8 MB) y los recursos del circuito |

## Cuotas del plan gratuito (Spark), confirmadas en la página de precios de Firebase

- **Realtime Database:** 100 conexiones simultáneas (cada pestaña o dispositivo cuenta una), 1 GB guardado y **10 GB de descarga al mes**. Las cifras de la entrevista eran correctas.
- **Hosting:** 10 GB guardados y **360 MB de transferencia al día**.
- **Inicio de sesión anónimo:** la página no le pone límite propio.

Fuentes: <https://firebase.google.com/pricing> y <https://firebase.google.com/docs/database/usage/limits>.

## Respaldo por Firebase (medido)

Prueba: invitado sin enlace directo (`&solo=respaldo`), que recibe la foto solo por Realtime Database y manda las órdenes también por ahí; el anfitrión escribe la foto 2 veces por segundo.

| Medida | Resultado |
|---|---|
| Fotos recibidas por el respaldo | 1,9 por segundo (de 2 escritas) |
| Retraso de la foto, anfitrión → base de datos → invitado | ~30 ms de media, 227 ms el peor |
| Ida y vuelta de una orden por el respaldo | ~54 ms (52-60; un caso de 126) |
| Datos de la foto por invitado | 7,4 KB/s |
| Datos reales por la red | ~1,2 veces más: la foto se guardó como texto JSON dentro de la base de datos y sus comillas se escapan (3,9 KB → 4,7 KB). En N4 hay que guardarla como objeto, no como texto |

Consumo: con la foto actual, ~9,4 KB/s por invitado en respaldo, **unos 34 MB por hora**. Los 10 GB de descarga al mes dan para **unas 300 horas de invitado en respaldo**. Con la foto compacta de N2 (~1,5 KB) y guardada como objeto, unas 900 horas; a 1 por segundo, el doble. Cuenta la descarga de cada invitado que escucha, no la escritura del anfitrión. El respaldo sirve para seguir jugando, no para ver la carrera fluida: a 2 fotos por segundo el invitado tendrá que interpolar, y las órdenes llegan en ~50 ms, de sobra para dirigir el muro.

Contraste con la consola («Realtime Database» → «Uso», 19/10/2026): **2,99 MB de descarga y 2 conexiones como máximo** para toda la prueba. Cuadra con la cifra de arriba: a ~9 KB/s, 3 MB son unos 5,5 minutos de invitado escuchando el respaldo, que es lo que sumaron las dos tandas (primero con WebRTC y respaldo a la vez, luego solo respaldo). Es decir, ~33 MB por hora y por invitado según la propia Firebase, incluida la sobrecarga de conexión y protocolo. (Antes de verlo se había estimado ~1 MB contando solo la segunda tanda; era un error de cuenta, no de medida.)

## Cálculo de Hosting

360 MB al día son unas 800 aperturas del menú, o del orden de 60 a 70 primeras partidas completas al día si cada una descarga ~5-6 MB entre modelos y circuito (estimación por el tamaño de los archivos; las siguientes visitas salen de la caché, que ya dura 30 días).

## Coste de pasar la interfaz a leer mensajes (N2 y N3)

Recuento en el código actual: 190 líneas de componentes leen o llaman directamente a la simulación (`simulation.` / `sim.`), con unas 47 llamadas distintas y unos 26 campos. Casi todo está en tres archivos: `App.tsx` (137 líneas), `RaceCanvas.tsx` (28) y `BoxControls.tsx` (15); el resto (`CircuitReview.tsx`, `PaceControls.tsx`) es poco. Es acotado: las 47 llamadas son las órdenes que N2 tiene que convertir en mensajes, y `App.tsx` ya copia el estado a React por intervalos, que es justo el sitio donde entrará la foto. Lo más delicado es `RaceCanvas.tsx`, que hoy hace avanzar el motor en su propio bucle y lee los coches en cada fotograma: con el Worker pasará a pintar la última foto interpolando, como ya hace entre pasos fijos (R43).

## Conclusión: el plan vale, con estos ajustes

1. **La pestaña oculta no es un problema.** El motor en el Worker no se frena y el reenvío tampoco, porque la pestaña del anfitrión no depende de temporizadores: reacciona a los mensajes del Worker y del canal. No hace falta avisar al anfitrión de que no cambie de pestaña. Queda una comprobación en Chrome normal con la pestaña del anfitrión más de 5 minutos oculta, que se puede hacer en la prueba entre redes (N10).
2. **La foto tiene que adelgazar en N2.** A 4 KB y 15 por segundo, un anfitrión con 9 invitados y 10 espectadores necesitaría ~9 Mbit/s de subida. Propuesta para el contrato de N2: separar lo rápido (posición, velocidad y estado de cada coche, a 15 por segundo) de lo lento (vueltas, tiempos, gomas, clima y muro, a 1 por segundo o al cambiar), mandar números en listas en vez de objetos con nombres y que el invitado calcule las coordenadas con la geometría del circuito que ya tiene. Objetivo: ≤1,5 KB por foto rápida, ~20 KB/s por invitado, ~3 Mbit/s de subida con la sala llena. Los espectadores pueden ir a 10 por segundo, interpolando.
3. **El tope x4 con invitados está bien elegido.** x4 deja al motor con margen (unos 500 pasos por segundo, un cuarto de núcleo); a x16 el Worker va justo y las fotos bajan a 13 por segundo.
4. **El respaldo vale para lo que se pensó.** Va a 2 fotos por segundo con ~30 ms de retraso y las órdenes tardan ~54 ms; el plan gratuito aguanta unas 300 horas de invitado en respaldo al mes con la foto actual, y unas 900 con la foto compacta de N2. Para N4 y N5: guardar la foto como objeto (no como texto) y dejar el respaldo a 1-2 por segundo.

La regla temporal que abre `/n1` puede quedarse hasta N4, que publica las reglas definitivas y la quita.

## Cómo repetir la medida

```sh
npx vite --port 3010 --strictPort --open false
# anfitrión: http://localhost:3010/F1Sim/prototypes/n1/?rol=anfitrion&x=4   (opcional: &circuito=monza &hz=15 &respaldo=1 &fbhz=2)
# invitado:  http://localhost:3010/F1Sim/prototypes/n1/?rol=invitado        (opcional: &respaldo=1; &solo=respaldo para no usar WebRTC)
```

El respaldo necesita la configuración web del proyecto: se pega una vez en el desplegable «Configuración de Firebase» de la página y queda en `localStorage` (`n1-fb`).

Cada pestaña muestra el resumen visible / oculta y guarda las filas en `window.__n1.rows` y en `localStorage` (`n1-rows-anfitrion`, `n1-rows-invitado`).
