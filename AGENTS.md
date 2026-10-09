# Reglas de oro de tests

1. **Sin test no hay implementación.** Antes de implementar o modificar una funcionalidad, localizar su módulo de tests y revisar con el usuario el comportamiento esperado. Si falta cobertura, escribir primero el test ejecutable, comprobar que falla por la causa esperada y acordar el contrato antes de tocar la implementación. La revisión de tests y la implementación son fases separadas.
2. **La implementación se adapta al test acordado.** No cambiar, borrar, saltar, silenciar ni relajar tests, datos o tolerancias para que una implementación pase. Si un test acordado es defectuoso o cambia el requisito, explicar el caso y obtener autorización explícita para revisar ese contrato antes de modificarlo. Una petición expresa de revisión de tests autoriza esa fase, no autoriza implementar funcionalidades.
3. **Validación por funcionalidad.** Ejecutar el módulo afectado y sus dependencias funcionales relevantes mediante `node test-suite.mjs --module ID` o `--task QN`. No exigir toda la suite por defecto en cada cambio localizado. Usar `--all` para una revisión integral solicitada o cambios transversales que la justifiquen. Registrar por módulo funcionalidad presente, parcial o ausente y resultados PASS/FAIL; una prueba ausente o no ejecutada nunca equivale a PASS.

El catálogo y las instrucciones de ejecución están en `tests/README.md`. Estas reglas no cambian la planificación ni las casillas del sprint.

## Prioridad: completar una tarea del sprint con la cuota disponible

**Un agente por defecto.** Esta regla sustituye la activación automática de cuatro agentes. El principal cubre planificación, tests, implementación y UX cuando correspondan; son perspectivas de trabajo, no cuatro procesos obligatorios. No cargar los cuatro perfiles para una tarea sencilla.

- Trabajar sobre la tarea del sprint solicitada y sus criterios de aceptación. No ampliar a otras tareas, auditar todo el proyecto ni corregir fallos ajenos para terminar con una suite global verde. Acotar una entrega completa y comprobable; no declarar completada una tarea parcial.
- Antes de editar, identificar brevemente objetivo, archivos probables, contrato de tests y validación mínima suficiente. Reutilizar lo ya acordado; no abrir otra ronda de planificación ni pedir de nuevo aprobaciones existentes. Esta preparación no exige crear un documento.
- Delegar solo una subtarea concreta e independiente si aporta evidencia especializada o evita retrabajo suficiente para justificar su contexto adicional. Preferir un especialista; añadir más solo con trabajo independiente y beneficio concreto. Explicar brevemente el motivo. No delegar preguntas sencillas, ediciones pequeñas ni roles sin impacto.
- Los delegados no crean agentes. Compartir únicamente objetivo, alcance, rutas y contrato necesarios; preferir contexto resumido sin historial completo. No cambiar modelos, esfuerzo ni permisos sin instrucción del usuario. Un propietario de escritura por archivo/fase; evitar lecturas y ejecuciones duplicadas.
- Buscar primero con rg y leer fragmentos relevantes. No releer documentos completos, el repositorio entero o logs extensos si ya existe evidencia suficiente. Consultar documentación externa solo cuando la tarea lo requiera. Resumir salidas con fallos y datos útiles, sin volcar resultados enteros.
- Ejecutar los módulos afectados y consumidores pertinentes. Después de que pasen, repetir solo por nuevos cambios, fallos o incertidumbre concreta. Ejecutar la suite completa cuando el alcance transversal o una solicitud explícita lo requiera. No confundir menor salida de logs con menor trabajo de validación.
- Mantener las tres reglas de oro: contrato de tests previo acordado, tests fijos durante implementación y verificación por módulos. La implementación puede analizarse mientras se revisan tests, pero su escritura espera al contrato y a la autorización de implementar. No saltar controles necesarios por ahorrar cuota.
- Si aparece una dependencia fuera de alcance que impide terminar, explicar el bloqueo concreto. Si hay que interrumpir, dejar un resumen breve de tarea, cambios, tests ejecutados, fallos y siguiente paso para retomar sin reconstruir toda la investigación; no generar resúmenes persistentes en cada mensaje.

Perfiles opcionales: .ai/roles/planning.md, .ai/roles/tests.md, .ai/roles/implementation.md y .ai/roles/ux.md. Los equivalentes nativos están en .codex/agents/. Cargar únicamente el perfil pertinente cuando se use. La configuración de concurrencia fija un máximo, no obliga a lanzar agentes. Estas instrucciones solo rigen donde el cliente las cargue; no garantizan ahorro medido ni fuerzan capacidades externas. Véase .ai/README.md.

## Comandos

```sh
npm run dev            # Vite en http://localhost:3000/F1Sim/ (base '/F1Sim/' para GitHub Pages)
npm run build          # prebuild → check:tasks; luego tsc -b && vite build
npm run sync:tasks     # regenera el bloque JSON project-task-index de index.html desde DASHBOARD.md
npm run check:tasks    # falla si DASHBOARD.md e index.html están desalineados
```

No hay linter ni runner npm de tests. Los tests se ejecutan con Node desde la raíz (detalle en `tests/README.md`):

```sh
node test-suite.mjs --list                 # catálogo: módulo, tareas, tipo
node test-suite.mjs --module box-orders    # un módulo (varios: --module a,b)
node test-suite.mjs --task Q9,Q10          # por ID de tarea del sprint
node test-suite.mjs --sprint 2.8 --json tests/results/sprint-2.8.json
node test-suite.mjs --all                  # suite completa (también sin argumentos); solo si se pide o el cambio es transversal
```

Los filtros se intersectan. Una selección desconocida o vacía, una excepción o un timeout salen con código distinto de cero.

## Flujo de trabajo (DASHBOARD.md)

- `DASHBOARD.md` es la fuente de verdad del roadmap: sprints, IDs de tarea (Q*, R*, C*/A*/M*/B*, MOB*), casillas de estado y la línea `**Orden vigente:**`. `scripts/sync-task-index.mjs` parsea esos patrones exactos: al cambiar tareas, conserva el formato, actualiza DASHBOARD.md e index.html en el mismo cambio y ejecuta `npm run sync:tasks`.
- Cada sprint tiene su rama (`sprint/2.8`, `sprint/2.9`…). Trabaja en la rama del sprint en curso y llévala a `main` con un pull request por sprint cuando el usuario lo pida; al cerrar un sprint su rama se elimina. `main` despliega a GitHub Pages (`.github/workflows/deploy.yml`).
- La línea `**Orden vigente:**` necesita dos IDs de tarea que existan en el dashboard (actual y siguiente): con un guion u otro texto, `sync:tasks` y `npm run build` fallan.
- Una tarea entregada queda `[ ] EN REVISIÓN LOCAL — IMPLEMENTADO dd/mm/aaaa CON CONTRATO DE TESTS ACORDADO` con su nota de entrega; solo pasa a `[x] COMPLETADO — …` cuando el usuario dice que la da por revisada.
- Leyes del dashboard que afectan al código: el usuario es el director de equipo (sin controles de conducción manual); nada de teletransportar coches, porque todo movimiento sale de velocidad/`progress`/`trackT`; no mutar arrays de estado in-place (p. ej. `this.cars.sort`); al escalar banderas SC/VSC/roja hay que limpiar los temporizadores previos.

## Arquitectura

- **Simulación (`src/simulation/`)**: clases TS puras, sin React. `RaceSimulation` es el orquestador; `update(dt)` divide el paso en subpasos de ≤0.05 s escalados por `speedMultiplier` y delega en los modelos (`TireModel`, `FuelModel`, `EnergyModel`, `EngineModel`, `DRSModel`, `PitStopModel`, `SafetyCarModel`, `IncidentModel`, `BoxOrders`). La posición del coche es `progress` (vueltas acumuladas) / `trackT` (0–1 dentro de la vuelta); las líneas de boxes (`pitCommitmentT`, `pitEntryT`, `pitExitT`) viven en `activeTrack`.
- **Doble bucle**: `App.tsx` crea una única `RaceSimulation` y una `Camera` con `useMemo` y copia su estado a React con `setInterval` (UI a ~15 FPS). `components/RaceCanvas.tsx` ejecuta el bucle `requestAnimationFrame` que avanza la simulación y dibuja en Canvas 2D mediante `src/renderer/` (Track, Car, CarLabels, Minimap, Camera).
- **Geometría**: `utils/svgTrackParser.ts` convierte los SVG de `public/circuits/` y `data/svgTrackPaths.json` en splines (`utils/spline.ts`). `racingLine.ts`, `pitLaneGeometry.ts`, `carPosition.ts` y `scenarioGeometry.ts` pasan de `trackT` a coordenadas del mundo.
- **Datos (`src/data/`)**: `circuits.ts`, `drivers.ts` y `teams.ts` son estáticos. Los escenarios visuales por circuito (escapatorias, pianos, barreras; tipos en `scenarioTypes.ts`) se resuelven con `getScenario(id)` en `scenarioRegistry.ts`: Barcelona y Mónaco son explícitos, el resto viene de `scenarioCalendar.ts` y cualquier otro usa `scenarioDefault`.
- **Módulos añadidos en los sprints 2.11 y 3**: `Wall.ts` (lectura, avisos y propuestas del muro), `Season.ts` y `Weekend.ts` (temporada y fin de semana sprint), `WeatherForecast.ts` (radar), `Runoff.ts` (superficie del punto de un incidente y vueltas de Safety Car), `Aquaplaning.ts`, y en `src/renderer/` `signals.ts`, `carSprites*.ts` y `SprayParticles.ts`. El agua se lleva en la trazada (`water`) y fuera de ella (`waterOff`) en `WeatherModel`.
- **UI**: componentes React 19 con CSS Modules (`*.module.css`); iconos de `lucide-react`; `animejs` para animaciones y `three` para `F1Wheel3D`. La UI y los textos del juego están en español.

## Tests

- `test-suite.mjs` → `tests/run.mjs` lanza cada módulo del catálogo `tests/catalog.mjs` en un proceso propio (`{id, tasks, sprint, kind: 'contract'|'regression'}`).
- Un módulo es `export default async function run({ assert, server })`. Carga el código fuente real con `server.ssrLoadModule('/src/...ts')` (servidor Vite en modo SSR), así que los tests ejercitan `RaceSimulation` directamente. Es habitual fijar `Math.random` para aislar el comportamiento.
- Los módulos nuevos agrupan casos con `test(...)`; los de regresión conservan sus aserciones históricas. Sin `skip`/`todo`. Los tests de React son solo renderizado SSR (sin clics, timers ni StrictMode).
- Módulo nuevo: añádelo a `tests/catalog.mjs` con sus IDs de tarea. Los resultados se guardan en `tests/results/`. `tests/AUDIT.md` documenta la cobertura y sus límites.
- Para un cambio localizado, ejecuta el módulo afectado y sus consumidores (p. ej. posición → `world-position`, `geometry-rendering`; boxes → `box-orders`, `double-stack`, `box-ui`).

## Notas prácticas de trabajo

- La mayoría de los archivos están en CRLF y `grep` de Git Bash no lo muestra. En un script de edición, normaliza a LF el archivo y los textos, edita y vuelve a escribir con el final de línea original.
- La suite completa tarda unos 12 minutos: lánzala en segundo plano. No encadenes commits detrás de un `grep` de la salida de un build o de la suite.
- Revisión en navegador: `npm run build` y `npx vite preview --port 4174 --strictPort` (el 4173 puede estar ocupado por otra sesión; no mates procesos ajenos). Con el panel del navegador oculto, `requestAnimationFrame` no corre: monta la aplicación en un `iframe srcdoc` con `requestAnimationFrame` sustituido por `setTimeout`, toma `simulation` y `camera` de la fibra de React del canvas y avanza con `sim.update(0.1)` en bucles cortos. Al terminar, vacía la página, limpia `localStorage` y para tu servidor.
- Otras sesiones pueden dejar commits en la rama local del sprint: antes de `git push`, mira `git log origin/RAMA..RAMA`.
- Para provocar casos raros en el navegador: `sim.reportCrash(car)`, `sim.reportIncident(car, tipo)`, `sim.startRedFlag(motivo)`, `car.hasPuncture = true`, `sim.setWallDelegation(id, true)`.

## Punto de reanudación (09/10/2026)

- **Estado:** Sprint 2.11 y Sprint 3 están enteros en `main` (pull requests 7 a 13 de `Mbuendia/F1Sim`). El Sprint 4 se trabaja en la rama `sprint/4`, sin subir (`git push` no se ha pedido). Última suite completa: 4106 PASS / 0 FAIL en 124 módulos, antes del Sprint 4; durante el sprint solo se han ejecutado los módulos afectados por cada tarea. **Conviene lanzar la suite completa antes de seguir.**
- **Revisión del usuario:** R04, R23, R24, R47-R58, T3.1 y T3.2 constan como revisadas y aprobadas. T3.3 y T3.4 siguen «en revisión». Todo lo entregado del Sprint 4 está «en revisión local».
- **Sprint 4** (`DASHBOARD.md`, sección 7.2): 20 tareas, T4.1 a T4.20. Planificado y refinado el 09/10/2026 en dos entrevistas con el usuario (funcional y de diseño visual, `docs/design/grill-sprint4-visual.md`); sus decisiones están en cada ficha. El usuario autorizó ese día escribir los tests e implementar todo el sprint: cada tarea lleva su contrato de tests escrito antes, sin revisión previa caso a caso. El usuario pidió parar tras T4.9.
- **Entregado (en revisión):** T4.12 (tiempo por circuito y neumático de salida), T4.18 (maqueta, `docs/design/maqueta-sprint4.html`), T4.1 (economía), T4.2 (costes), T4.4 (instalaciones), T4.6 (equipo de boxes) y T4.9 (patrocinio). La nota de cada entrega está en el dashboard.
- **Pendiente del usuario:** (1) revisar la maqueta de T4.18, de la que dependen las páginas (T4.19, T4.3, T4.20 y el invierno de T4.11); (2) dar el visto bueno al cambio de cuatro comprobaciones de `finance-t41.mjs` (miden los conceptos de T4.1 en vez del saldo total, porque otras tareas añaden gastos e ingresos a la ronda); (3) decidir en T4.5 si el personal por debajo del nivel de referencia empeora las cosas y qué mejora concretamente el jefe de estrategia; (4) revisar los importes y efectos decididos al implementar (`FINANCE`, `COSTS`, `FACILITIES`, `PIT_CREW`, `SPONSORS`).
- **Sin empezar:** T4.19, T4.3, T4.20, T4.5, T4.7, T4.8, T4.10, T4.11, T4.13, T4.14, T4.15, T4.16 (necesita permiso para descargar grabaciones) y T4.17.
- **Cómo está montada la gestión:** `ManagementState` (`src/simulation/Management.ts`) es el estado único (equipo del jugador, semilla, dinero, instalaciones, equipos de boxes y patrocinio); va en la carrera profesional (`CareerData.management`, clave `f1_management`) y `Season.settleRace`, `settleSkip` y el cierre lo liquidan en la misma operación que el campeonato. Cada tarea nueva añade su pieza al estado, a `readManagement` (para partidas guardadas sin ella), a `settleManagementRound` y a `closeManagementSeason`. Los importes son enteros en miles (`formatMoney`). Mientras no exista el centro de gestión, cada panel es una sección plegable del paddock (`HomeScreen.tsx`), con los estilos de `Management.module.css`. El equipo del jugador es el del piloto elegido en el paddock hasta T4.19. Los rivales actúan (componentes, proyectos, obras, plan de boxes, patrocinio) cuando el jugador entra a un Gran Premio de temporada.
- **Para los tests:** no comparar el saldo total de un equipo tras `settleRace`: cada tarea añade conceptos a la ronda; comparar las líneas del libro por concepto. Evitar comprobaciones sobre el texto de `App.tsx`. `sim.autoStartTyres` solo lo activa la aplicación. El paso de «semáforo apagado» a carrera va con reloj real: poner `sim.lightState = 'racing'` a mano.
