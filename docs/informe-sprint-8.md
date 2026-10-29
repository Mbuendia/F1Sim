# Informe del Sprint 8 — Rendimiento y deuda técnica

29/10/2026 · rama `sprint/8` · PF1 a PF8 entregadas y en revisión local.

PF1 y PF2 se hicieron con tu aprobación tarea a tarea. De PF3 a PF8 se trabajó en el modo que pediste ese día («no me pidas permiso, sigue hasta finalizar el sprint»). Cada tarea tiene su contrato de tests, escrito y en rojo antes de implementarla, y en cada decisión abierta se tomó la opción recomendada. Las fichas del dashboard (sección 7.10) tienen el detalle, y `docs/perf/linea-base.md` todas las medidas.

## Resultado en cifras

| Qué | Antes | Después |
| --- | --- | --- |
| Paquete principal (lo que se descarga antes de ver nada, gzip) | 606 KB | 449 KB |
| Modelos 3D en la descarga (gzip) | 5,0 MB | 2,9 MB |
| Imágenes en la descarga (gzip) | 20,6 MB | 2,2 MB |
| Coche 3D (archivo) | 3,2 MB | 1,2 MB |
| Llamadas de dibujo, Barcelona con cámara de persecución | 177 | 92 |
| Triángulos, Barcelona con cámara de persecución | 681.000 | 312.000 (con el seguido y su vecino completos) |
| Llamadas de dibujo, vista general | 394 | 212 (107 en calidad baja) |
| `RaceSimulation.ts` | 4.064 líneas | 1.733 líneas |
| Suite completa de tests | unos 25 min | 5,5 min |

Los fotogramas por segundo en tus dispositivos siguen **pendientes**: los mide la prueba `?rendimiento=prueba` en tu PC y en tus móviles (ver «Lo que te toca»).

## Qué se hizo, tarea a tarea

### PF1 — Medición base y contador de rendimiento (commit `ce6c84b`)
- El contador `?rendimiento` enseña el coste de simulación, pista, clima, coches, 3D y resto, el percentil 95, el tiempo de la gráfica (cronómetro de WebGL), la memoria del juego y de la gráfica y los tiempos de carga. Lo que no se puede medir sale «n/d».
- Prueba repetible `?rendimiento=prueba`: carrera real con el motor en el Worker, siempre igual (Barcelona, semilla 2026, persecución), con 5 s de calentamiento, 30 s de medida y botón «Copiar».
- `npm run perf:size` da el peso de la descarga por grupos. Las cifras se guardan en `docs/perf/linea-base.md`.
- Archivos: `src/dev/PerfOverlay.tsx`, `perfMeter.ts`, `perfBench.ts`, `PerfBenchPage.tsx`, `src/perf/loadMarks.ts`, `scripts/perf-size.mjs`.

### PF2 — Renderizado 3D más ligero (commit `4f3e760`)
- Escenario con instancias: lo repetido (árboles, carteles, gradas, edificios…) se dibuja por grupos, en trozos de 250 m para que three descarte lo que no se ve (`src/scene3d/instancing.ts`).
- El coche completo (127.000 triángulos) solo sale cuando mide 150 px o más en pantalla (opción A que elegiste); la sombra de cada coche sale del modelo ligero.
- Ampliación que pediste al ver el resultado: con las cámaras de persecución y a bordo, el coche seguido y los que estén a menos de 80 m de él van siempre con el modelo completo (40 m en calidad media; en baja, nunca), con un margen del 10 % para que no parpadeen al cruzar el radio. Así, en curvas cerradas o con coches pegados delante o detrás, se ven con su calidad.

### PF3 — Modelos comprimidos y carga diferida (commit `55114f0`)
- Nueve modelos comprimidos con meshopt (`scripts/compress-models.mjs`), con la misma geometría: mismos triángulos y vértices y posiciones exactas. El coche pasa de 3,2 a 1,2 MB y el Safety Car de 1,9 a 0,9 MB.
- three.js sale del paquete principal: la rueda 3D de la portada se carga aparte y, mientras llega, se ve la 2D.
- Texturas: los modelos no llevan imágenes (las del 3D se dibujan en el momento), así que KTX2 no aplica.

### PF4 — Calidad según el dispositivo (commit `6c13568`)
- Tres niveles: alta (lo de antes), media y baja (sin sombras, sin suavizado de bordes, resolución ×1 y siempre el coche ligero).
- En automático decide el dispositivo y baja un nivel si la carrera va a menos de 45 fps (en alta) o de 28 (en media) durante 5 s seguidos; nunca sube sola.
- Nueva opción en Ajustes → Gráficos → Calidad (Automática, Alta, Media, Baja). Archivo: `src/settings/quality.ts`.

### PF5 — Motor de carrera partido en módulos
- `RaceSimulation.ts` partido sin reescribir código, con una transformación sobre el árbol de sintaxis. Quedan seis módulos en `src/simulation/race/`: `carStep.ts` (el paso de cada coche: ritmo, adelantamientos, boxes en pista, neumáticos, energía, incidentes), `neutralization.ts` (Safety Car, VSC, roja), `weather.ts`, `teamOrders.ts`, `wall.ts` (estratega y órdenes del jugador) y `startAndResult.ts` (salida, clasificación, sanciones y resultado).
- Misma semilla, misma carrera: tres sprints completos (seco; lluvia con Safety Car; VSC, roja y órdenes) acaban con el motor en el mismo estado que antes, comprobado con una huella SHA-256 del estado entero.
- Los miembros de la clase que usan los módulos dejan de ser `private` (van marcados `@internal`).

### PF6 — Limpieza
- Fuera `public/racecars2d` (216 archivos, 19,5 MB): sprites 2D de T28 que ningún código usaba.
- Fuera dos archivos sin uso (`radio/model/classifierStore.ts`, `radio/classifier/vectorCache.ts`) y 18 exportaciones que nadie usaba, entre ellas el clasificador de IA8 (`classifierAi`) y la IA de radio genérica de IA5 (`radioAi`, `llmInterpreter`, `aiReply`), sustituidos en el juego por el modelo propio de IA10.
- El dibujo 2D de la carrera se queda, porque es la vista 2D de Ajustes (UX2).

### PF7 — Suite de tests en paralelo
- `node test-suite.mjs` corre los módulos a la vez (por defecto, núcleos menos dos; `--jobs N` lo cambia y `--jobs 1` vuelve a uno en uno), con la misma salida, el mismo JSON y el mismo orden.
- `rooms-rules-n4` (emulador de Firebase con puerto fijo) va marcado `serial` y corre solo al final.
- Lo que más recortó: el servidor de Vite de cada módulo arrancaba su vigilante de archivos, que recorría toda la carpeta del proyecto (unos 13 s de procesador por módulo), y la recarga en caliente, cuyo puerto fijo chocaba en paralelo. Ahora los dos van apagados en los tests (`tests/support/worker.mjs`). Con eso, la suite pasa de 16,7 a 5,5 minutos.
- El lanzador apunta lo que tarda cada módulo (`tests/results/durations.json`) y empieza por los más largos.
- No se hicieron «compilaciones compartidas»: cada módulo sigue con su propio Vite aislado, como exigía la suite original.

### PF8 — Presupuesto vigilado
- `docs/perf/presupuesto.json` fija los límites: paquete principal 490 KB, modelos 3.170 KB, escenario 250 llamadas en el peor circuito, coche 135.000 triángulos, coche ligero 10.500 y `RaceSimulation.ts` 1.900 líneas. También los objetivos de 60 fps en el PC y 30 en un móvil medio.
- `tests/modules/budget-pf8.mjs` compila la aplicación y avisa de qué cifra se pasa, cuánto vale y cuál es su límite.

## Cambios en tests anteriores

Las reglas de AGENTS.md piden autorización para tocar un test acordado. Estos son todos los que se cambiaron y por qué:

| Test | Cambio | Autorización |
| --- | --- | --- |
| `car-dots-ux16` (2 casos) | El coche «completo» se comprueba a 200 px a 25 m y a 25 m (antes 40 px a 50 m y 40 m), por el corte de 150 px de PF2 | Tuya, explícita (29/10) |
| `perf-baseline-pf1` | Nombre de la página de la prueba (`PerfBenchPage.tsx`) y filtro de `src/dev/` | Tuya, explícita |
| `perf-baseline-pf1` | La tabla de dispositivos se lee solo en su sección (PF2 añade otra tabla al mismo documento) | Tuya, explícita |
| `drs-visible-r04`, `rain-forecast-r53`, `wall-telemetry-r24`, `speedometers-ux17` | Leían el texto de `RaceSimulation.ts`; ahora leen el motor entero (clase y `race/*.ts`) y aceptan `sim.` donde pedían `this.`. Lo que comprueban no cambia | Modo sin permisos (PF5) |
| `models-compressed-pf3`, `budget-pf8` (propios del sprint) | Antes de darlos por buenos: el tamaño mínimo pasó a «al menos un 10 % menos» (el redondeo dejaba pasar un archivo igual) y el presupuesto compila como `npm run build` (el entorno de pruebas metía React de desarrollo) | Modo sin permisos |

## Validación

- **Suite completa:** 207 módulos, 7.598 aserciones, todas en verde, en 5,5 minutos (en paralelo). Antes del último arreglo del lanzador tardaba 16,7 min; de uno en uno, unos 25.
- **Misma carrera:** las huellas de las tres carreras de PF5 son idénticas a las de antes de partir el motor.
- **En el navegador** (Chrome sin ventana, que no sirve para medir fps): coches con el modelo comprimido, escenario con instancias igual que antes en la vista general, calidad baja sin sombras y la rueda 3D de la portada cargada aparte, sin errores en consola.
- **Compilación** (`tsc -b` y `vite build`) sin errores.

## Lo que te toca

1. **Medir los fotogramas**: enciende el modo desarrollador (Ajustes, 7 toques en la versión), abre `?rendimiento=prueba` en tu PC, en tu móvil y en uno modesto, pulsa «Copiar» y pégame los resúmenes. Con eso se rellena la línea base y se comprueba el objetivo de PF8.
2. **Revisar en el juego**: los coches cerca del seguido con la cámara de persecución (PF2), la calidad en Ajustes (PF4) y que todo se vea como antes.
3. **Dar por buenas** las tareas (están «en revisión local») y decidir cuándo se sube la rama y se abre el PR.

## Lo que no se hizo o queda abierto

- Las cifras de fotogramas por dispositivo (ver arriba).
- Las «compilaciones compartidas» de PF7.
- `@types/three` y `@types/animejs` siguen en `dependencies`: moverlas a `devDependencies` toca el lockfile.
- `meshoptimizer` (lo usa `scripts/compress-models.mjs`) está en node_modules porque llega con `@types/three`, no como dependencia propia.
- En la carpeta siguen sin tocar ni subir las skills de `.claude/` y la salida de graphify, que no son de este sprint.
