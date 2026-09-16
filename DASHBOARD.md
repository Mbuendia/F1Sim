# 🏁 F1 SIMULATOR — DASHBOARD & PLAN DE IMPLEMENTACIÓN
> **FUENTE ÚNICA DE VERDAD ("LA BIBLIA DEL PROYECTO") PARA TODOS LOS MODELOS DE IA.**
> Todo modelo debe consultar este documento antes de planificar o codificar cualquier tarea.

---

## 📜 1. LEYES INMUTABLES DE DESARROLLO (REGLAS DE ORO)

1. **🧪 Testing Automatizado Obligatorio**: Cada cambio de código debe incluir su prueba automatizada ejecutable en `test-suite.mjs`. Ninguna tarea se da por cerrada sin `✅ PASS`.
2. **📋 Refinamiento y Validación Previa**: Antes de escribir código para un sprint, la solución técnica propuesta debe estar descrita aquí y contar con la aprobación explícita del usuario.
3. **🎮 100% Team Principal / Gestión**: El usuario es el director de equipo desde el muro de boxes (UI y ratón). Prohibido implementar mecánicas de conducción manual o controles de pilotaje arcade.
4. **🏎️ Físicas Orgánicas sin Saltos**: Prohibido teleportar coches hacia adelante o usar hacks de posición estáticos. Todo adelantamiento, doblaje, relanzamiento y parada en boxes debe calcularse matemáticamente por velocidad, `progress` y `trackT`.
5. **🔒 Mutaciones Prohibidas**: Prohibido mutar arrays de estado in-place (`this.cars.sort` directo). Los estados de bandera (SC, VSC, Red Flag) deben ser coherentes y limpiar temporizadores previos al escalar.
6. **🔄 Dashboard e index siempre alineados**: Al añadir, eliminar, reordenar o cambiar el estado de una tarea, es obligatorio actualizar **`DASHBOARD.md` e `index.html` en el mismo cambio**. El dashboard conserva el detalle; el bloque JSON `project-task-index` del index refleja roadmap, tareas y orden vigente, sin mostrarse en la interfaz del juego. Toda tarea nueva debe tener ID único y casilla de estado. Ejecutar `npm run sync:tasks` para regenerarlo y `npm run check:tasks` para comprobarlo; la compilación debe fallar si están desalineados. No confundir prioridad técnica con autorización para saltar tareas: un cambio del orden acordado requiere indicarlo y obtener el OK del usuario.

---

## 🧭 2. ROADMAP Y ESTADO GLOBAL DE SPRINTS

**Orden vigente:** Sprint **2.9** · Tarea actual **R01** · Siguiente **R02**.

**Alcance vigente: exclusivamente planificación del próximo Sprint 2.9.** El usuario solicita integrar esta planificación desde `codex/planificacion` en `main` y subirla al remoto; no autoriza implementar mecánicas. R01/R02 señalan el orden propuesto de la primera entrega y siguen pendientes. Q1-Q5 están completadas; Q6-Q19 siguen pendientes y el Sprint 2.8 permanece en pausa. **Q6 queda expresamente excluida**, también del trabajo de escenarios que se solapaba con R23. No continuar ni refinar Sprint 2.8 en esta entrega. Los registros históricos posteriores no sustituyen este alcance.

**Registro de publicación anterior:** Q5 y el contexto documental del backlog se subieron en `0577e76`. Las referencias posteriores a Q5 sin commit describen una fotografía anterior. La autorización actual de integración/publicación corresponde solo a la planificación de Sprint 2.9.

```
Leyenda de Estado:
✅ [COMPLETADO]   - Implementado, probado con test suite y verificado con npm run build
🟡 [REFINADO]     - Solución técnica detallada en este documento, pendiente de tu aprobación
⏳ [BACKLOG]      - Planificado para sprints posteriores
```

| Sprint | Contenido | Estado |
|---|---|---|
| **Sprint 1** | Trazado SVG Barcelona, Core Loop, Timing Tower, 5 Modos de Cámara | ✅ **COMPLETADO** |
| **Sprint 2** | SC Físico, Undercut/Overcut Orgánico, Monoplaza Vectorial 2D, Desdoblamiento | ✅ **COMPLETADO** |
| **Sprint 2.1** | **Resolución de Bugs Críticos y Altos de Auditoría (C1-C7, A1-A6)** | ✅ **COMPLETADO (23/23 Tests PASS)** |
| **Sprint 2.5** | **Deuda Técnica de Auditoría (M1-M10, B1-B7)** | ✅ **COMPLETADO (17/17 Tareas - 46 Tests PASS)** |
| **Sprint 2.8** | **Salto de Calidad: Fidelidad de Simulación, Geometría, Muro Táctico y revisión DRS (Q1-Q19)** | 🟡 **Q1-Q5 aprobadas localmente; 232 tests PASS; Q6-Q19 pendientes, implementación en pausa** |
| **Sprint 2.9** | **Reglamento FIA 2025, identidad técnica de equipos y experiencia de carrera (R01-R28)** | 🟡 **PLANIFICACIÓN ACTUAL — integración/publicación autorizadas; implementación pendiente de autorización** |
| **Sprint 3** | **Audio, Telemetría Avanzada, Radar GPS & Clima (4 tareas definidas; desglose histórico de 16 incompleto)** | ⏳ **PLANIFICADO (Después del Sprint 2.9; coordinar clima con R22)** |
| **Sprint 4** | **Épica: F1 Team Principal & Race Manager (estimación histórica de 12 tareas sin desglose)** | ⏳ **BACKLOG — requiere definición antes de implementar** |

---

### 2.1 Contexto de relevo para la siguiente IA (auditoría de código del 17/09/2026)

**Punto de partida y permiso:** esta entrega solo amplía documentación e índice. Q6 no está iniciada ni autorizada por este mensaje. No continuar automáticamente una tarea por ser «la siguiente». Leer primero la instrucción más reciente del usuario y `git status`; conservar los cambios locales de Q5. En esta revisión el HEAD es `a9b94a6` (Q3/Q4) y Q5 sigue sin commit/push. Estos datos son una fotografía, no una orden de restaurar ese commit.

**Baseline verificada en Q5:** 232 pruebas PASS, 0 FAIL y build correcto; aviso previo de chunk >500 kB. No se han vuelto a ejecutar las físicas para una ampliación exclusivamente documental. Las pruebas de dibujo usan Canvas instrumentado; las de Node pueden usar geometría fallback sin DOM. No equivalen a ver todos los SVG reales en navegador. Conservar Q1 (huella vectorial), Q2/Q3 (ruta y geometría de boxes), Q4 (posición única) y Q5 (zoom/LOD/selección) al añadir funcionalidades.

| Zona | Entrada real en el código | Contrato que debe conservarse |
|---|---|---|
| Motor | `src/simulation/RaceSimulation.ts`: `update`, `advanceSimulation`, `initRace`, `setCircuit` | El motor mantiene `CarState`; React muestra su estado. No introducir un segundo motor en un panel. Revisar también caminos de formación, boxes, retirados y final. |
| Tiempo y distancia | `CarState.progress`, `trackT`, `speed`, `currentSpeedKmh`; `CircuitSpec.lapLengthMeters` | `progress` son vueltas acumuladas (negativas en parrilla), `trackT` es fracción normalizada [0,1), `speed` se usa como vueltas/s y `currentSpeedKmh` como km/h. El mundo gráfico no está expresado automáticamente en metros. Conversiones explícitas y cruces de meta sin módulo negativo. |
| Pistas | `src/data/circuits.ts`, `svgTrackPaths.json`, `src/utils/svgTrackParser.ts`, `src/data/barcelonaTrack.ts` | El parser construye `activeTrack`; normaliza sentido, meta y tamaño. El tipo `TrackDefinition` está en `barcelonaTrack.ts`, pero ese trazado de respaldo no es la única pista del juego. No modificar solo el fallback y declarar resueltos los circuitos SVG. |
| Coordenadas y dibujo | `carPosition.ts`, `pitLaneGeometry.ts`, `TrackRenderer.ts`, `CarRenderer.ts`, `CarLabels.ts`, `Camera.ts`, `MinimapRenderer.ts`, `RaceCanvas.tsx` | `worldX/Y/Angle` se calculan en el motor y los consumen dibujo/cámara/minimapa/clic. Geometría en mundo; zoom una vez. La caché de boxes usa identidad de `TrackDefinition`: invalidarla o reconstruir el objeto al cambiar geometría. |
| Muro / React | `src/App.tsx`, `HomeScreen.tsx`, `BottomTelemetryDock.tsx`, `TelemetryPanel.tsx`, `RightStatsPanel.tsx`, `Leaderboard.tsx` | Seleccionar un coche para cámara no significa ser dueño de ese equipo. App refresca datos cada 66 ms; `RaceCanvas` usa RAF. Los botones DEV de SC/roja escriben estado directamente y no acreditan los procedimientos normales. |
| Verificación | `test-suite.mjs`, `scripts/sync-task-index.mjs`, `package.json`, `vite.config.ts` | Suite Node con Vite SSR, actualmente con rutas absolutas a este workspace. No dar por portables esos tests sin comprobarlo. `npm run dev -- --host 127.0.0.1` sirve `/F1Sim/` en puerto 3000 por configuración. |

**Cómo tomar una tarea:** reproducir el problema por el camino real, leer sus contratos y dependencias, documentar el refinamiento si cambia el alcance y trabajar solo lo autorizado. Las rutas de este documento son relativas al repo; los símbolos son más fiables que números de línea antiguos. Los nombres de módulos futuros son propuestas, no archivos existentes. Los ejemplos numéricos de diseño no son normativa ni mediciones. Para validar artículos usar las ediciones de 6.1 y sus páginas, incluidas tachaduras; no hace falta releer ambos PDF para una tarea puramente gráfica.

**Entrega mínima de cada tarea:** comportamiento observable y límites explícitos; pruebas de regresión por comportamiento en `test-suite.mjs` y comprobación del camino de integración; `node test-suite.mjs`, `npm run sync:tasks`, `npm run check:tasks`, `npm run build`, `git diff --check`; revisión local cuando cambie dibujo/interacción. Registrar escenarios, resultado y limitaciones en la tarea. No borrar una prueba antigua solo porque detecta una regresión; si su expectativa cambia justificadamente, documentar el contrato nuevo. Para física/tiempos, incluir semilla o fixtures reproducibles y distintos pasos/velocidades; para dibujo, rotación, zoom y Barcelona/Mónaco. La autorización de implementar no sustituye el OK de revisión antes de subir.

**Inventario real pendiente:** 14 tareas Q6-Q19, 28 tareas R01-R28 y 4 tareas detalladas T3.1-T3.4. Las «16 subtareas» de Sprint 3 y las «12» de Sprint 4 eran estimaciones sin fichas completas; no inventar tareas ni contarlas como desarrolladas. Las lagunas se explican en la sección 7.

---

## ✅ 3. TRABAJO RECIÉN COMPLETADO Y VALIDADO (SPRINT 2.1)

Los 13 bugs críticos y altos detectados en la auditoría fueron implementados y verificados con **23 pruebas automatizadas pasando al 100%**:

- **C1**: Safety Car infinito eliminado. `fieldSpread` ahora solo evalúa coches en la vuelta del líder y tiene un `hardTimeout` de seguridad (`sc.lapCount >= targetLaps + 3`).
- **C2**: Restricción de velocidad en retirada de SC corregida (`getMaxAllowedSpeed('sc', 'returning')` = 140 km/h en vez de `null`).
- **C3**: SC spawnea justo delante del líder (`progress = leaderProgress + 0.03`) y transiciona sin deadlock a 40 km/h.
- **C4**: Ventana de entrada a boxes del SC ampliada (`trackT >= 0.94`) para evitar vueltas extra por saltos de frames.
- **C5**: `scEndingLap` se resetea en `initRace()` y se limpia automáticamente a `null` al cruzar todos los coches la meta.
- **C6**: `vscActive` se apaga al desplegar SC o Bandera Roja.
- **C7**: Eliminadas mutaciones in-place (`this.cars.sort()`).
- **A1**: `isCatchingPack` corregido para no acelerar coches que ya están en la cola del pelotón.
- **A2**: Lógica de banderas azules invertida corregida.
- **A3**: Calibración física de boxes en Barcelona (`pitEntryT: 0.92`, `pitExitT: 0.11`) eliminando saltos visuales.
- **A4**: Probabilidad de parada bajo SC desacoplada de la tasa de frames mediante `dt`.
- **A5**: Pinchazos no se curan al entrar a boxes; se reparan tras completar el tiempo de cambio de neumáticos.
- **A6**: Cierre del `endLap` del stint anterior al montar neumáticos nuevos.

---

## ✅ 4. SPRINT 2.5: DEUDA TÉCNICA (17 / 17 COMPLETADAS — 46 TESTS PASS)

### 🎨 Bloque A: Modelado 2D de Monoplazas (✅ 3/3 COMPLETADO - 3 Tests PASS)
* **M1 — Z-Order y Capas del Monoplaza Vectorial:** `[x] COMPLETADO`
  * *Solución:* Reordenar `drawSingleCar` en 5 capas: 1) Fondo plano/Difusor, 2) Brazos de suspensión, 3) Neumáticos con banda de color de compuesto, 4) Chasis y pontones con color del equipo, 5) Alerón delantero/trasero, DRS flap, Halo, casco y T-Cam.
  * *Test:* Verificación del pipeline de dibujo y capas (Group 4 PASS).
* **M2 — Sombra del Coche Desacoplada de la Rotación:** `[x] COMPLETADO`
  * *Solución:* Dibujar la sombra elíptica en coordenadas de pantalla fija antes de aplicar la rotación del ángulo de pista.
  * *Test:* Comprobar que el offset de la sombra permanece invariante frente al ángulo del coche (Group 4 PASS).
* **M3 — Humo de Retirada con Rotación de Cámara:** `[x] COMPLETADO`
  * *Solución:* Sumar `camera.rotation` al ángulo relativo de eyección de humo (`smokeAngle = angle + camera.rotation`).
  * *Test:* Verificar orientación exacta compensando cualquier rotación de cámara (Group 4 PASS).

### 🏎️ Bloque B: Físicas de Neumáticos y Paradas (✅ 4/4 COMPLETADO - 7 Tests PASS)
* **M4 — Desgaste Individual No Oscilante:** `[x] COMPLETADO`
  * *Solución:* Añadir `healthFL`, `healthFR`, `healthRL`, `healthRR` persistentes a `TireState`. Desgaste monótono acumulativo según las fuerzas G laterales de cada curva sin curaciones mágicas y sin pérdida de precisión.
  * *Test:* Simulación de 60 pasos comprobando que ninguna rueda aumenta salud (cero curación) y que el apoyo exterior sufre mayor desgaste (FL: 98.68% < FR: 99.05%) (Group 5 PASS).
* **M5 — Recalibración del Cliff Térmico:** `[x] COMPLETADO`
  * *Solución:* Cliff exponencial activo únicamente por debajo del 30% de salud; base degradada a 0.82 para que los blandos alcancen su límite natural al final de 15 vueltas nominales.
  * *Test:* Stint de 15 vueltas en blandos finalizando entre 5% y 25% (obtenido: 16.5%) (Group 5 PASS).
* **M9 — Estado `'pit'` en `car.status`:** `[x] COMPLETADO`
  * *Solución:* Establecer `car.status = 'pit'` al entrar al carril y restaurar `'running'` al reincorporarse a pista.
  * *Test:* Validación del ciclo de vida del estado durante la parada (Group 5 PASS).
* **M10 — Activación de Paradas Programadas (`scheduledLap`):** `[x] COMPLETADO`
  * *Solución:* En `shouldEnterPit()`, parar si `car.pitStop.scheduledLap > 0 && car.currentLap >= car.pitStop.scheduledLap && !car.pitStop.isPitting && car.pitStop.totalPitStops === 0`.
  * *Test:* Comprobación de activación automática en la vuelta programada y rechazo previo (Group 5 PASS).

### 🎨 Bloque C: Identidad de Equipos y Coherencia (✅ 3/3 COMPLETADO - 4 Tests PASS)
* **M6 — Contraste de Mercedes (WCAG AAA):** `[x] COMPLETADO`
  * *Solución:* Cambiar texto de Mercedes a negro puro (`textColor: '#000000'`, ratio 15.6:1).
  * *Test:* Verificación en `TEAMS.mercedes.textColor === '#000000'` (Group 6 PASS).
* **M7 — Diferenciación Red Bull vs Racing Bulls:** `[x] COMPLETADO`
  * *Solución:* Red Bull a su azul marino mate oficial (`#041E42` con acento rojo toro) y Racing Bulls en su azul metálico brillante (`#1634CC` con acento plateado `#E0E0E0`).
  * *Test:* Comprobación de colores oficiales y distinción cromática (Group 6 PASS).
* **M8 — Unificación de Sectores:** `[x] COMPLETADO`
  * *Solución:* Usar dinámicamente `activeTrack.sector1EndT` y `sector2EndT` en `computeTrackSpline`, `IncidentModel` y `RaceSimulation`.
  * *Test:* Consistencia de sectores con límites variables y registro de incidentes (Group 6 PASS).

### 🧹 Bloque D: Limpieza de Código Muerto (✅ 7/7 COMPLETADO - 5 Tests PASS)
* **B1 — Retiro de `SpriteManager`:** `[x] COMPLETADO` Código de sprites no utilizado eliminado de `CarRenderer.ts` (Group 7 PASS).
* **B2 — Limpieza de `speedFactor` en `TireModel`:** `[x] COMPLETADO` Firma normalizada y parametrización limpia.
* **B3 — Fallback Seguro en `getCompoundProperties`:** `[x] COMPLETADO` Soporte para `intermediate`, `wet` y retorno por defecto para compuestos desconocidos (Group 7 PASS).
* **B4 — Reset Estático `IncidentModel.reset()`:** `[x] COMPLETADO` Helper de reinicio del contador de incidentes a 1 (Group 7 PASS). **Auditoría 17/09/2026:** el helper existe, pero `RaceSimulation.initRace()` no lo invoca; la integración pendiente se sigue en Q18. La prueba histórica del helper no acredita el reinicio de una carrera completa.
* **B5 — Incidentes de Tipo `'spin'`:** `[x] COMPLETADO` Soporte completo con tiempo de resolución de 8-12s (Group 7 PASS).
* **B6 — Unificación `drsAvailable` y `drsEligible`:** `[x] COMPLETADO` Tipos alineados en `f1.ts`.
* **B7 — Clarificación `tireWear` vs `tireHealth`:** `[x] COMPLETADO` Porcentajes consistentes y alias complementarios en telemetría.

---

## 🎯 5. SPRINT 2.8: SALTO DE CALIDAD, GEOMETRÍA Y DECISIONES DE MURO (19 TAREAS)

*(Sprint de consolidación previa al Sprint 3: alineación de geometrías, eliminación de solapamientos, carril de boxes continuo y control táctico real del Team Principal)*

**Registro histórico de revisión del 15/09/2026:** alcance limitado a las implementaciones Q1 y Q2 del commit `6b30e57`, sus pruebas y esta documentación. El usuario dio el OK local y autorizó aquella subida; en ese momento Q3-Q19 no estaban implementadas. Q3-Q5 se completaron después, según sus resultados individuales y el estado vigente de la sección 2. La ampliación documental del 16/09/2026 incorpora Q19 y el Sprint 2.9; su planificación no implica autorización para implementar nuevas mecánicas.

* **Refinamiento de Q1:** las pruebas originales medían `carWid`, pero las ruedas dibujadas ocupan 2.2 veces esa medida. Además, comparar únicamente desplazamientos opuestos no verifica el adelantamiento a un coche centrado. Calibrar el tamaño completo (ruedas y alerones incluidos) contra la separación lateral disponible, con un margen de 1.25, y escalarlo linealmente con el zoom para evitar solapamientos al alejar la cámara. Probar la geometría que emite el renderer, pistas de capacidad 2/3, coche centrado y coches en carriles opuestos.
* **Refinamiento de Q2:** `floor(t * númeroDePuntos)` truncaba los extremos cuando entrada/salida caían entre muestras (por ejemplo, salida de Barcelona en 0.15 con 750 puntos). Muestrear el intervalo exacto con interpolación, conservar extremos y normales, y verificar tanto tramos que cruzan meta como tramos interiores, incluida Silverstone. La envolvente smootherstep suaviza el desplazamiento lateral; por sí sola no demuestra continuidad de velocidad ni un perfil de frenado físico. Los tests deben expresar esta limitación y distinguir coordenadas del mundo de metros reales.
* **Integración de Q2 en el dibujo:** el motor actualiza `pitLaneProgress` antes de avanzar `progress`; dibujarlo directamente deja el coche un paso atrás. Derivar la interpolación visual del `progress` actual y volver a la pista al superar la salida, aunque `isInPitLane` aún conserve el estado del paso previo. Probar entrada, tránsito y salida con un estado de boxes deliberadamente retrasado, sin mutar la posición física.
* **Validación realizada antes de la aprobación:** `node test-suite.mjs`, `npm run build` y revisión de una carrera en el navegador local. Tras el OK del usuario, quedan autorizados el commit y el push de estas correcciones y de la planificación solicitada.

**Resultado de la revisión:** la suite pasa **80 pruebas, 0 fallos** (54 previas + 26 nuevas). Antes de corregir el código, las primeras pruebas de regresión reprodujeron 15 fallos que la suite anterior no detectaba. `npm run build` pasa; conserva un aviso de bundle superior a 500 kB. `git diff --check` pasa. En navegador se verificaron entrada al paddock, selección, formación, salida y seguimiento de una carrera en Barcelona hasta la vuelta 3, sin errores de consola. Se dejó la carrera pausada en `http://127.0.0.1:3000/F1Sim/`; posteriormente el usuario dio su OK y pidió subir los cambios.

**Límites de esta validación:** las regresiones geométricas usan trazados sintéticos y un contexto Canvas que registra el dibujo real. No equivalen a una carrera completa en cada circuito ni a un modelo de colisiones; la separación comprobada corresponde a carriles estabilizados. El perfil de velocidad de boxes y las dependencias Q3/Q4/Q14 siguen fuera de estas correcciones. El OK visual del usuario se ha recibido; no amplía el alcance de las pruebas.

### 📐 Bloque A: Escala, Geometría y Cinemática Espacial (5 Tareas)
* **Q1 — Calibración de Escala de Monoplaza y Anchura Real de Pista (Anti-Solapamiento):** `[x] CORREGIDO, PROBADO Y APROBADO POR EL USUARIO`
  * *Problema:* `CarRenderer.ts:34` y `RaceSimulation.ts:495`. Los coches se desplazan lateralmente demasiado poco para su ancho dibujado (`carWid = 6` vs `lateralOffset` estrecho), provocando solapamiento visual al rodar en paralelo.
  * *Solución:* `getCarDimensions` calibra la huella completa (ruedas y alerones incluidos) con la separación de `getLateralDisplacement`, dejando un margen de 1.25 respecto a un coche centrado. El renderer utiliza esas dimensiones según anchura/capacidad y escala linealmente con el zoom.
  * *Test:* Groups 8 y 9 PASS. Registro de rectángulos realmente dibujados para coches centrados, carriles opuestos y offset 0.85, anchos 16/24, capacidad 2/3, zoom 0.25–8 y rotaciones 0°, 90° y -0.7 radianes. Huellas separadas y dentro del asfalto en los casos comprobados.

* **Q2 — Carril de Boxes con Entrada/Salida Propias y Continuidad Física:** `[x] CORREGIDO, PROBADO Y APROBADO POR EL USUARIO`
  * *Problema:* `svgTrackParser.ts:221`. El carril de boxes se genera desplazando puntos de la pista, incluidos los extremos, sin curvas de transición suaves (saltos al entrar y salir).
  * *Solución:* `generatePitLanePoints` interpola los extremos exactos y las normales sobre un intervalo uniforme, con separación lateral smootherstep quíntica. El renderer utiliza `progress` actual para evitar desfase de un paso y conserva la posición al regresar a la ruta principal. Esto corrige la continuidad geométrica; no sustituye la simulación de frenado/aceleración.
  * *Test:* Groups 8 y 9 PASS. Extremos coincidentes con tolerancia 1e-7 unidades del mundo en intervalos entre muestras, con/sin cruce de meta y offset negativo; comparación angular de segmentos menor de 0.05 radianes en los escenarios sintéticos (aproximación tangencial, no prueba de derivada analítica C1). Pruebas del renderer para entrada, tránsito y salida con `pitLaneProgress` retrasado y retorno sin retención visual.

* **Q3 — Geometría Diferenciada para Muro, Carril Rápido y Cajones de Boxes:** `[x] COMPLETADO — APROBADO POR EL USUARIO`
  * *Problema:* `TrackRenderer.ts:165`. El muro de boxes se dibuja sobre el centro del carril; los límites blancos reutilizan el centro de pista.
  * *Solución:* Construir geometrías separadas: 1) borde exterior de pista, 2) muro divisor de boxes, 3) carril rápido (fast lane de 80 km/h) y 4) zona de trabajo con los 10 cajones de parada.
  * *Test:* Comprobación de que las coordenadas del muro no colisionan con el carril rápido del pit lane.
  * *Refinamiento autorizado (16/09/2026):* generar geometría de dibujo en coordenadas del mundo: dos bordes de pista, bordes del carril rápido, plataforma de trabajo al lado opuesto de la pista, muro hacia la pista y diez cajones identificados por equipo. Orientar los cajones con la tangente y distribuirlos por distancia recorrida, no por índices fijos. Determinar el lado de boxes a partir de la ruta existente; conservar exactamente la trayectoria de entrada/salida Q2. Recortar el muro en incorporaciones y donde invada el asfalto o carril rápido, comprobando segmentos completos. Cachear geometría por trazado y aplicar zoom una sola vez.
  * *Escala y alcance:* las cotas visuales siguen las unidades del mundo del renderer y el tamaño actual de los coches; no son una certificación del ancho FIA de 3.5 m. La calibración física por circuito queda en R03/Q7. Q3 dibuja cajones; el servicio físico por equipo, órdenes y double-stack siguen en Q9-Q11/R08. Mantener el límite actual de boxes de 80 km/h; la configuración por evento queda en R03/R08.
  * *Validación:* regresiones ejecutables de separación muro/carril y muro/pista, cajones únicos y fuera del carril rápido, trazados curvos y ambos lados de boxes, entrada/salida sin barrera, geometría degenerada, dibujo real con distintos zoom/rotación y no mutación del trazado. Verificar Barcelona y Mónaco en navegador, además de `node test-suite.mjs`, comprobación documental y build. Dejar Q3 en revisión local hasta el OK; sin subida nueva hasta esa revisión.
  * *Resultado local (16/09/2026):* geometría separada y cacheada implementada en `pitLaneGeometry.ts` y `TrackRenderer.ts`; diez cajones con color de equipo y nombres al acercarse. **124 pruebas PASS, 0 FAIL**, sincronización documental y build correctos (persiste el aviso de tamaño del bundle). Revisadas visualmente las vistas generales de Barcelona y Mónaco en el navegador local; zoom/rotación comprobados en las regresiones del renderer. Esta revisión no acredita una carrera completa, colisiones físicas ni fidelidad topográfica de los trazados. OK del usuario y autorización de commit/push recibidos el 16/09/2026.

* **Q4 — Coordenada Cartesiana Única (Unificación Pista vs Boxes):** `[x] COMPLETADO — APROBADO POR EL USUARIO`
  * *Problema:* `Camera.ts`, `CarRenderer.ts`, `Minimap`, detección de click en `App.tsx`. Cámara, minimapa y selección calculan la posición basándose en la pista principal aunque el coche esté en boxes.
  * *Solución:* Almacenar en `CarState` una posición cartesiana real única `(worldX, worldY)` calculada tanto en pista como en boxes, compartida idénticamente por `CarRenderer`, `Camera.followCar`, `Minimap` y hit-testing de click.
  * *Test:* Comprobación de que `Camera.targetX/Y` coincide exactamente con `(worldX, worldY)` del coche seleccionado durante toda la trayectoria de boxes.
  * *Refinamiento autorizado (16/09/2026):* almacenar `worldX`, `worldY` y `worldAngle` en `CarState`. Tras cada paso del motor y al crear/reiniciar la parrilla, calcularlos con una única función pura que conserve la interpolación Q2 y el desplazamiento lateral Q1, usando el progreso actual. Cubrir formación, aparcamiento, pausa, retirados, boxes y reanudación tras roja. Renderer, modos de seguimiento, minimapa y selección por clic consumirán esos campos sin recalcular otra ruta. Mantener zoom y suavizado de cámara; centrar su objetivo en el coche también en boxes. Unificar la visibilidad de retirados/finalizados y dibujar la ruta de boxes en el minimapa.
  * *Validación prevista:* coordenadas y continuidad en entrada/salida (incluido cruce de meta y estado de boxes retrasado), cámara durante toda la ruta, minimapa y clic con zoom/rotación y offsets laterales, inicialización/cambio de circuito y ramas del motor. Ejecutar regresiones Q1-Q3, pruebas Q4, sincronización y build. Dejar revisión local disponible, sin commit ni push.
  * *Resultado local (16/09/2026):* implementados los campos compartidos y su cálculo en `carPosition.ts`/`RaceSimulation.ts`; consumidos por `CarRenderer`, `Camera`, `MinimapRenderer` y la selección en `RaceCanvas`. **152 pruebas PASS, 0 FAIL** (28 nuevas para Q4), incluyendo una parada completa con el motor y cuatro cámaras sobre 101 muestras de cada ruta de prueba. Build correcto; persiste el aviso previo de tamaño del bundle. Seguimiento y minimapa revisados en el navegador durante formación y carrera en Barcelona, sin errores de consola. Las comprobaciones exhaustivas de boxes son automatizadas sobre geometría sintética/fallback de Node; no equivalen a una carrera completa validada visualmente en todos los circuitos. OK del usuario y autorización de commit/push recibidos el 16/09/2026.

* **Q5 — Corrección de Doble Zoom en Meta y Nivel de Detalle (LOD) de Etiquetas:** `[x] COMPLETADO — APROBADO EN LOCAL POR EL USUARIO`
  * *Problema:* `TrackRenderer.ts:renderFinishLine`, `CarRenderer.ts`. La meta aplica el zoom dos veces (`scale * zoom`) creciendo desproporcionadamente. Las etiquetas de nombres saturan la pantalla.
  * *Solución:* Desacoplar medidas fijas del circuito (metros) del factor de zoom de pantalla. Implementar LOD: círculos/números minimalistas en vista general; etiquetas detalladas en zoom cercano únicamente para el coche seleccionado y batallas activas (< 0.8s).
  * *Test:* Verificar que las dimensiones de la línea de meta en píxeles de pantalla crecen de forma lineal con el zoom (no cuadrática).
  * *Refinamiento autorizado (16/09/2026):* mantener el ancho y el grosor de la meta en unidades del mundo y proyectarlos una sola vez; conservar el ajedrezado sin una línea blanca superpuesta que lo oculte. Corregir también la distancia de las etiquetas de curvas, afectada por el mismo doble zoom. Usar marcadores circulares de equipo y posiciones compactas hasta zoom 0.7; recuperar el monoplaza vectorial por encima de ese umbral. Los marcadores son símbolos de lectura, no cambian la huella física Q1 ni la posición Q4. Mostrar nombres solo a zoom > 1.2 para el seleccionado y ambos participantes de batallas con gap positivo < 0.8 s, en pista y sin doblajes ni banderas azules. Priorizar seleccionado y evitar solapamientos entre etiquetas, omitiendo las secundarias si no caben. Mantener alertas compactas de DNF/bandera azul, sin desplegar textos largos para todos.
  * *Validación prevista:* medir dibujo real de meta a varios zoom y rotaciones (ancho y grosor lineales, extremos en los bordes); comprobar detalle lejano/cercano, umbral de 0.8 s, ambos participantes, exclusión de boxes/doblados y colisiones de etiquetas. Ejecutar regresiones Q1-Q4, build y sincronización documental; revisión visual local antes de subir.
  * *Corrección de integración detectada en revisión:* el efecto de animación de `RaceCanvas` debe renovarse cuando cambia `selectedCarId`; de lo contrario, cámara y telemetría siguen al nuevo coche pero el renderer conserva la selección inicial y no muestra su etiqueta/halo. Verificados en navegador el cambio Norris → Verstappen y la vuelta a vista general sin etiqueta ni halo de selección, sin errores de consola.
  * *Resultado final local (17/09/2026):* meta con ancho/grosor lineales y ajedrezado visible; distancia de etiquetas de curva corregida; LOD y colocación sin solapamientos en `CarLabels.ts`; actualización de selección conectada al bucle de `RaceCanvas`. **232 pruebas PASS, 0 FAIL** (80 nuevas para Q5), build correcto y documentos sincronizados. Las regresiones Q1 siguen midiendo la huella vectorial; los símbolos de vista general se verifican aparte y no modifican las físicas ni las posiciones Q4. Revisadas en navegador la vista general, la meta y el seguimiento cercano en Barcelona. Los límites de zoom, giros, batallas, alertas y pelotones densos se comprueban con contextos Canvas instrumentados; no se declara revisión visual de todos los circuitos. Persiste únicamente el aviso previo de tamaño del bundle en build. Implementación finalizada y OK local recibido el 17/09/2026. El usuario solicita completar el contexto del backlog y no empezar Q6; esta entrega documental no incluye commit/push.

### 🏛️ Bloque B: Identidad de Circuitos (Barcelona & Mónaco de Referencia) (3 Tareas)
* **Q6 — Escenario SVG por Capas con Identidad Real (Barcelona Permanente vs Mónaco Urbano):** `[ ] PENDIENTE`
  * *Problema:* Las pistas son genéricas (bandas uniformes de hierba, grava y pianos alrededor de toda la vuelta sin importar el circuito).
  * *Solución:* Estructura por capas: terreno base, escapatorias específicas (asfalto/grava en Barcelona vs muros contiguos sin grava en Mónaco), asfalto, pianos localizados en entradas/ápices/salidas, gradas y edificios emblemáticos.
  * *Test:* Verificación de que Mónaco no genera franjas de grava y Barcelona utiliza zonas de escapatoria amplia acordes a su especificación.
  * *Contexto de código:* `TrackRenderer.renderTrack` pinta hoy bandas cerradas de hierba/grava/pianos y una banda central oscura en toda la vuelta. `CircuitSpec` no tiene zonas de escenario ni `trackType`. El SVG proporciona el centro del trazado, no un plano de superficies; los comentarios «oficial FIA» del renderer no validan el arte.
  * *Implementación a preparar cuando se autorice:* definir datos por circuito con intervalos normalizados, lado respecto al sentido de marcha, superficie y polígonos/elementos decorativos. Transformarlos al mismo mundo que `activeTrack`, después de resolver sentido/meta. Orden de capas estable: terreno y escapatorias, pista, marcas/pianos, boxes y elementos periféricos; conservar coches/etiquetas legibles. Cachear lo estático, no recalcular polígonos en cada frame. Barcelona y Mónaco son las primeras referencias; otros circuitos deben tener un fallback explícito, sin heredar decoraciones del anterior.
  * *Límite y aceptación ampliada:* sin cambiar físicas, anchura Q7, trayectoria Q8 ni posiciones de DRS. No certificar edificios, superficies o dimensiones sin fuente; identificar arte aproximado. Probar los polígonos realmente dibujados, lateralidad, cruce de meta y cambio de circuito. Revisar ambas pistas a zoom general/cercano y cámara girada: sin franjas de grava en Mónaco, sin pianos continuos, sin tapar boxes, meta, coches ni selección. Medir coste del dibujo antes/después con el mismo escenario. **No empezada por petición expresa del usuario.**

* **Q7 — Anchura de Pista Variable por Tramo y Capacidad de Adelantamiento:** `[ ] PENDIENTE`
  * *Problema:* Anchura constante en toda la pista limita o falsea adelantamientos.
  * *Solución:* Matriz de anchos de pista por tramo (`trackWidthMeters` en sectores del spline). Recta principal ancha (14m, hasta 3 coches en paralelo) vs curvas lentas o horquillas (8-10m, máximo 2 coches en paralelo).
  * *Test:* Cálculo de capacidad de monoplazas en paralelo en función de la anchura del sector actual.
  * *Contexto y archivos:* `svgTrackParser` devuelve `trackWidthMeters: 24` global; `CircuitSpec.trackWidthCars` limita capacidad por circuito. `carPosition.getTrackHalfWidth/getLateralDisplacement`, `CarRenderer.getCarDimensions`, `pitLaneGeometry` y `TrackRenderer` comparten supuestos de ancho global. Revisar también elección lateral en `RaceSimulation`.
  * *Contrato propuesto:* una consulta común de anchura izquierda/derecha y capacidad por progreso; interpolación continua entre muestras y en meta. Establecer conversión metros↔mundo antes de usar 8/10/14 m (son ejemplos, no mediciones). Mantener tamaño físico del coche constante por circuito: no encogerlo al entrar en una curva estrecha. Recalibrar conjuntamente la huella Q1 y el desplazamiento lateral, permitir espacio de seguridad y abandonar una maniobra si no cabe.
  * *Aceptación ampliada:* transiciones ancho→estrecho con dos/tres coches, ambos sentidos y meta; huellas completas dentro de límites y sin saltos de posición/tamaño. Renderer, motor y límites de boxes deben consultar la misma geometría. R03 completará procedencia/calibración por evento; no duplicar tablas de anchos.

* **Q8 — Trazada Ideal Engomada (Racing Line Exterior-Ápice-Exterior):** `[ ] PENDIENTE`
  * *Problema:* Coches se mueven referenciados únicamente al centro geométrico del trazado.
  * *Solución:* Trazada geométrica exterior-ápice-exterior precalculada para cada circuito. Acumulación progresiva de adherencia y engomado visual en la trazada seca vuelta a vuelta.
  * *Test:* Comprobación de que la adherencia aumenta en la trazada ideal durante una carrera en seco.
  * *Contexto y archivos:* la banda central de `TrackRenderer` es decoración estática. `calculateCarWorldPosition` usa centro + offset lateral; `RaceSimulation` calcula maniobras sobre ese offset. Extender el spline y la consulta de posición común, no solo desplazar el dibujo.
  * *Contrato propuesto:* precalcular offset ideal continuo a partir de curvas verificadas, con margen para la huella Q1/Q7 y unión suave en meta; componer ideal + maniobra sin salir de pista ni cambiar la ruta de boxes Q2. Acumular goma por distancia realmente recorrida y paso de coches, con saturación y estado reiniciable, independiente de FPS. El agarre alimenta el movimiento; la opacidad solo representa ese estado.
  * *Aceptación ampliada:* curva izquierda/derecha, enlazadas, adelantamiento y entrada/salida de boxes, continuidad de cámara/clic Q4. Engomado acotado a lo largo de varias vueltas, sin crecer durante pausa y sin regenerar neumáticos. Lluvia/lavado se integrarán con R22; no crear aquí otro motor meteorológico.

### 👔 Bloque C: Muro Táctico & Decisiones de Estrategia (100% Team Principal) (5 Tareas)
* **Q9 — Órdenes de Boxes Vinculantes (Compuesto Elegido por el Jugador):** `[ ] PENDIENTE`
  * *Problema:* `PitStopModel.ts`, el servicio puede sobrescribir el compuesto seleccionado aleatoriamente.
  * *Solución:* La elección del Team Principal (Soft, Medium, Hard, Intermediate, Wet) es absoluta y prioritaria; el modelo de boxes monta exactamente el compuesto ordenado y lo registra en el historial de stints.
  * *Test:* Llamada a boxes con compuesto específico (ej. 'hard') montando 'hard' en el 100% de los casos sin desvíos.
  * *Contexto y archivos:* `PitStopState.targetCompound` ya existe, pero `PitStopModel.updatePitStop` sortea el compuesto al terminar el servicio. `shouldEnterPit` limita `scheduledLap` a la primera parada. Conectar una orden explícita en `RaceSimulation`, tipos en `f1.ts` y controles de muro en `App`/panel elegido; no basta con cambiar el texto del selector.
  * *Contrato y límites:* orden por coche con ID, emisor, compuesto y estado pendiente/aceptada/consumida; prioridad del jugador frente a IA, consumo exactamente una vez al completar servicio. Separar solicitud de parada, entrada física y cambio de ruedas; no renovar neumáticos al pulsar. Permitir segunda orden tras primera parada. R07 añadirá juegos/stock y R08 sanciones: prever rechazo explicado, sin sustitución silenciosa.
  * *Aceptación ampliada:* cinco compuestos por el camino real del motor, dos paradas sucesivas, SC, pinchazo, retirada y reinicio; selección, neumático montado, contador e historial de stints coinciden. La elección meteorológica óptima no forma parte de Q9.

* **Q10 — Punto de Compromiso (Pit Commitment Line) y Cancelación de Parada:** `[ ] PENDIENTE`
  * *Problema:* No existe ventana delimitada de compromiso para anular una llamada a boxes.
  * *Solución:* Definir una línea de compromiso propia del circuito y una orden cancelable antes de cruzarla. La fórmula histórica `pitEntryT - 0.05` era un boceto; no usarla como dato FIA ni como valor universal. Antes de la línea, permitir "Abortar / Stay Out"; después, mostrar la entrada confirmada.
  * *Test:* Intentar cancelar parada antes y después de la línea de compromiso, validando el comportamiento esperado.
  * *Contexto y contrato:* ampliar la orden Q9, `CircuitSpec`, parser y `PitStopModel`. Detectar el cruce entre progreso previo y nuevo, también si la línea está antes de meta y entrada después. Una orden emitida después del compromiso se programa para la siguiente oportunidad válida; no saltar lateralmente a boxes. Documentar convención temporal cuando llamada/cancelación coinciden con el cruce; el motor devuelve acuse y motivo.
  * *Aceptación ampliada:* cancelar justo antes/después, cruzar compromiso y entrada en un mismo paso, vuelta siguiente sin reactivación de orden cancelada y velocidad x16/x32. No confundir línea de decisión táctica con línea del limitador o SC1. Coordenadas no verificadas deben figurar como calibradas hasta R03.

* **Q11 — Gestión Dual de Pilotos del Equipo & Parada Doble (Double Stack):** `[ ] PENDIENTE`
  * *Problema:* Falta de soporte táctico para ambos coches de la escudería en el muro.
  * *Solución:* Panel dual de control de pilotos y un recurso de servicio compartido por equipo. El segundo coche espera lo que reste de ocupación del cajón; los 3–5 s históricos son un ejemplo de efecto, no un recargo fijo ni reglamentario.
  * *Test:* Dos coches entrando consecutivamente a boxes registrando el tiempo de espera adicional en el segundo monoplaza.
  * *Contexto y contrato:* `App` maneja coche favorito y coche seguido, pero no un equipo controlado con dos órdenes independientes. Usar `driver.teamId` y `TEAMS.drivers` para propiedad; mirar un rival no permite darle órdenes. Q3 solo dibuja diez cajones: hoy todos paran en `pitLaneProgress >= 0.45`; falta relacionar equipo→cajón→ruta de servicio.
  * *Implementación/aceptación:* con Q9/Q10, modelar ocupación, cola y liberación por equipo; esperar antes del cajón sin atravesar al compañero ni bloquear artificialmente otros equipos. Q4 debe seguir leyendo la posición común durante la maniobra, nunca una animación separada. Probar llegadas simultáneas y separadas, dos equipos, segundo coche cancelado/retirado y reset; espera medida por reloj de simulación y servicio una vez por coche. R08 ampliará salida segura/sanciones sobre el mismo recurso.

* **Q12 — Modos de Ritmo del Piloto (Pace Modes: Push, Balanced, Save):** `[ ] PENDIENTE`
  * *Problema:* Faltan órdenes persistentes desde el muro, aunque ya existen `EngineMode` y multiplicadores de desgaste/consumo.
  * *Solución:* Push, Balanced y Save como órdenes del jugador. Objetivos iniciales de calibración: Push reduce el tiempo por vuelta alrededor de 0.3 s a costa de recursos; Save lo aumenta alrededor de 0.4 s para ahorrar. Los porcentajes históricos (+40%/-30%) son hipótesis a calibrar, no constantes FIA ni otro multiplicador encima de los actuales.
  * *Test:* Comparar desgaste de neumáticos y consumo de combustible tras 5 vueltas en Push vs Save.
  * *Contexto y archivos:* `EngineModel`, `TireModel.updateTire`, `FuelModel.updateFuel` ya leen `engineMode`; `RaceSimulation` fuerza `push/standard` al observar al rival entrar a boxes. Separar orden persistente y modo efectivo: IA, banderas, temperatura y energía pueden limitar ejecución sin borrar la intención del jugador. Mapear Save→low, Balanced→standard, Push→push o documentar por qué cambia ese contrato; `overtake` no es conducción manual.
  * *Aceptación ampliada:* mismas condiciones/semilla, cinco vueltas y recursos iniciales iguales, orden mantenida tras parada del rival, cambio de piloto sin afectar al otro, pausa/reset. Mostrar modo pedido/efectivo y motivo de limitación. Q16/R14-R16 reemplazarán recursos provisionales; no prometer cifras de ahorro basadas en telemetría ficticia.

* **Q13 — Predictor de Ventana de Reincorporación (Rejoin & Undercut Window):** `[ ] PENDIENTE`
  * *Problema:* El jugador no puede predecir el tráfico tras salir de boxes.
  * *Solución:* Proyectar en la Timing Tower y el Minimapa una marca de "Posición Estimada de Reincorporación" calculada restando el `pitLaneTimeLoss` (~22s) al tiempo del coche actual.
  * *Test:* Predicción contrastada con un escenario controlado de reincorporación; expresar incertidumbre en carrera real, no prometer posición exacta con tráfico variable.
  * *Contexto y archivos:* `CircuitSpec.pitLaneTimeLossSec` existe y HomeScreen lo muestra; el servicio real no impone ese tiempo fijo. `gapToCarAheadSec` aún deriva de vueltas ×77.8. Crear cálculo puro compartido por `Leaderboard` y `MinimapRenderer`, usando Q9/Q11 y posición Q4.
  * *Contrato/aceptación:* estimar tránsito + servicio + cola, menos el tiempo equivalente en pista, para el coche que recibe la orden. Identificar fuente y margen; un valor de ficha sirve de fallback visible, no de cronometraje FIA. Excluir retirados, separar doblados/ruta de boxes y tener en cuenta neutralización sin adivinar incidentes futuros. Probar pista libre, tráfico, segundo en cola, SC y meta; no alterar `progress` real para dibujar el marcador. R02/R08 mejorarán entradas sin crear un predictor alternativo.

### 🏎️ Bloque D: Físicas Orgánicas, Banderas y Consistencia de Simulación (5 Tareas)
* **Q14 — Eliminación de Asignaciones Directas de Posición en SC y Bandera Roja:** `[ ] PENDIENTE`
  * *Problema:* En SC y red flag existen saltos forzados de `progress`.
  * *Solución:* Realizar deceleraciones, agrupamiento y relanzamientos de forma 100% cinemática mediante velocidad, aceleración y distancia de seguridad sin alterar `progress` artificialmente.
  * *Test:* Simulación de retorno y parada en el carril rápido de boxes bajo bandera roja mediante deceleración suave hasta `speed = 0`, sin saltos discretos en `progress`. La parrilla se reserva para la excepción de seguridad del artículo 57.2 (ver R12).
  * *Contexto verificable:* `RaceSimulation.advanceSimulation` recoloca tras el coche precedente y tras el SC; la salida de roja asigna una parrilla nueva. `SafetyCarModel` también reposiciona el SC al desplegar/recoger. Auditar asignaciones de `progress` en ambos archivos y los botones DEV de `App`; no confundir inicialización de carrera con un salto durante carrera.
  * *Contrato:* estados explícitos y velocidad objetivo limitada por separación/frenada, integración común y subpasos/cruces cuando haga falta. Durante roja, desacelerar, circular a fast lane y detenerse en orden; no reutilizar automáticamente el servicio ordinario de neumáticos como aparcamiento. No curar salud ni combustible al reanudar. Procedimientos completos de avisos/trabajos quedan en R12; si se requiere ampliar alcance para una reanudación mínima coherente, documentarlo antes de programar.
  * *Aceptación ampliada:* registrar posición anterior/nueva y distancia recorrida frente a integral de velocidad; formación, SC que alcanza al líder, pelotón de doblados, roja antes/después de boxes y relanzamiento. Preservar vueltas completadas, orden y posiciones Q4 a distintos pasos; ni compactación instantánea ni deadlocks. Las pruebas C3 históricas de spawn deberán migrar con explicación del nuevo contrato.

* **Q15 — Centralización de Reglas de Banderas Azules y Tráfico de Doblados:** `[ ] PENDIENTE`
  * *Problema:* Fallos de lógica entre la posición en vuelta y la proximidad física en pista.
  * *Solución:* Algoritmo unificado de banderas azules: cuando un coche con una o más vueltas de ventaja se encuentra a menos de 1.2s (delta métrico) detrás de un doblado, este último reduce su velocidad un 15% y se desplaza al exterior en recta.
  * *Test:* Doblado cediendo el paso de forma fluida ante la aproximación del líder.
  * *Contexto y archivos:* lógica dispersa de proximidad/adelantamiento en `RaceSimulation`; `updateLeaderboardPositions` da el rival por clasificación, que no siempre es el vecino físico. Consultar progreso acumulado para vuelta de ventaja y distancia circular para cercanía, sin incluir un coche en otra ruta de boxes.
  * *Contrato/aceptación:* extraer una consulta común de tráfico consumida por banderas y maniobras; ceder donde exista espacio Q7/Q8 y levantar progresivamente, sin aplicar -15% como salto instantáneo. 1.2 s/15% son ajustes de juego a validar. Probar líder P1 detrás de P20, dos líderes próximos, cruce de meta, coche en misma vuelta, boxes, curva estrecha, SC y retirada. Apagar la señal cuando termine la causa; R02/R09 sustituirán el gap aproximado con tiempo real y permisos centrales.

* **Q16 — Modelo Dinámico de ERS, Combustible y Penalización Térmica en Agarre:** `[ ] PENDIENTE`
  * *Problema:* `RaceSimulation.ts:834`, batería estática al 85%, clamp de 0.5 kg en combustible, penalización térmica tardía.
  * *Solución refinada con FIA 2025:* Conectar el ERS al ciclo real: **MGU-K → ES máximo 2 MJ/vuelta; ES → MGU-K máximo 4 MJ/vuelta; MGU-K ±120 kW**, con contabilidad separada del MGU-H y ventana de carga del ES de 4 MJ (T5.3.2). Consumo continuo sin reserva artificial infinita y penalización térmica aplicada antes de integrar el movimiento. Desarrollo completo y dependencias en R14-R16.
  * *Test:* Conservación de energía, saturación y agotamiento, límites por flujo/vuelta, reset reglamentario al entrar en boxes y ausencia de energía creada por cambios de modo. No exigir oscilaciones arbitrarias de SOC del 20% al 100%.
  * *Contexto real:* `FuelModel.updateFuel` mantiene mínimo 0.5 kg; `RaceSimulation` emite `batterySoc: 85` y aplica parte de la penalización térmica después del movimiento. `EngineModel` no contiene un libro de energía. Cambiar solo los números de telemetría no implementa Q16.
  * *Contrato y dependencia a resolver al autorizar:* dividir en combustible finito, libro energético y orden térmico de actualización; unidades kg/kW/kJ o MJ/segundos documentadas. Integrar potencia×tiempo, acotar flujos por recurso y límites, y aplicar rendimiento disponible antes de mover el coche. Un reset de contador reglamentario no rellena la batería. Compartir desde el principio contratos mínimos R01/R02/R14-R16; Q16 entrega el núcleo y las R amplían legalidad/calibración, sin dos modelos paralelos. Acordar el refinamiento de esta tarea amplia antes de codificarla.
  * *Aceptación ampliada:* salida, frenada con batería llena, fin de vuelta, entrada a boxes y cero combustible a x1/x16; balance con tolerancia declarada, cero negativos y agotamiento con pérdida física de propulsión. Telemetría derivada del mismo estado. No afirmar modelo FIA completo hasta verificar fuentes y todas las condiciones R14-R16.

* **Q17 — Rebalanceo del D20 de Suerte hacia el Reglamento FIA:** `[ ] PENDIENTE`
  * *Problema:* `RaceSimulation.ts:1262`, el D20 monta neumáticos nuevos mágicamente en pista sin parar en boxes.
  * *Solución vigente (sustituye el boceto anterior):* beneficio opcional de preparación de boxes o información del ingeniero, con coste/alcance explícito y efecto aplicado en una oportunidad legal. No implementar el antiguo +15% ERS ni +3 km/h por cambio instantáneo de setup; R26 exige conservar recursos, límites y parc fermé. Elegir y aprobar el catálogo concreto al refinar Q17; 1.9 s no es una garantía FIA.
  * *Test:* Validar que el D20 ya no cambia los neumáticos de un monoplaza mientras rueda por la pista.
  * *Contexto y archivos:* `triggerD20LuckRoll` redacta recompensas, pero `applyLuckEventReward` crea ruedas nuevas para cualquier tirada aplicada. Coordinar ambos métodos, `D20LuckEvent`, `D20LuckModal` y Q9/Q11 para que texto y efecto coincidan. La aplicación debe ser idempotente por ID aunque coincidan clic y temporizador.
  * *Aceptación ampliada:* tiradas baja/media/20, beneficiario retirado, doble aplicación, evento sustituido y reset; antes/después en pista conserva ruedas, combustible, energía y piezas. Una mejora de ejecución solo consume su beneficio al servicio válido, no salta el tiempo de tránsito. R26 añadirá selección de variante/perfil sin cambiar este contrato.

* **Q18 — Reconciliación de Dashboard, Timers de React y Reset Limpio:** `[ ] PENDIENTE`
  * *Problema confirmado el 17/09:* `IncidentModel.reset()` existe pero `initRace()` no lo llama. `SafetyCarModel.deploy` fija 2–3 vueltas sin clasificar circuito (la antigua mención a una fórmula 6–9 no describe este código). El botón DEV fija 999. `D20LuckModal` depende de callbacks y realiza efectos desde un actualizador de estado.
  * *Solución:* centralizar la política personalizada de duración urbana mínima 10 vueltas, conectar el reset real y estabilizar ciclo de vida de modal/animaciones/callbacks. `RaceSimulation` es una clase, no contiene hooks React; auditar estos en `App`/componentes. El perfil FIA alternativo y zonificación completa se desarrollan en R10/T3.1.
  * *Test:* Verificar que en circuito urbano el SC tiene `targetLaps >= 10` y que `IncidentModel.nextId` es 1 al reiniciar la carrera.
  * *Contexto y límites:* revisar `activeLuckEvent`, clima, pausa/velocidad, relojes, incidentes, banderas, IDs, selección/cámara y contadores de cada coche al iniciar/cambiar circuito. Un modal nuevo con el mismo `rollValue` debe reiniciar animación/cuenta por `event.id`. No ejecutar recompensas desde el callback de `setState`; limpiar timers/animaciones al cerrar y desmontar, sin duplicar efectos en StrictMode. Conservar el arreglo de selección Q5.
  * *Aceptación ampliada:* crear incidente→reiniciar→crear otro por API normal, no solo llamar al helper; eventos D20 consecutivos de igual tirada, clic simultáneo al timeout, desmontaje y cambio de GP. Comparar reset con instancia nueva, sin borrar el historial de resultados que el usuario quiera conservar. Centralizar política de duración compartida con T3.1; no usar botón DEV para probar mínimo urbano. La regla de alineación documental ya está implementada y solo requiere conservar sus checks.

### 🚦 Bloque E: Revisión Prioritaria de DRS (1 Tarea)

* **Q19 — DRS medido en detección, permiso persistente y apertura reglamentaria:** `[ ] PENDIENTE — P0, SOLICITADO POR EL USUARIO`
  * *Problema reproducible en el código:* `RaceSimulation.ts` decide `drsActive` cada paso usando el gap actual y `trackPoint.isDrsZone`; no existe medición guardada al cruzar detección. Un adelantamiento cambia el coche de referencia y puede encender/apagar el DRS indebidamente. `DrsZoneSpec` solo tiene inicio y fin de zona. Además, `DRSModel.ts` admite 1.05 s, mientras el motor usa 1.0 s y no llama al modelo importado; hay dos criterios distintos.
  * *Regla:* S22.1, pp. 23-24: en carrera/sprint, menos de 1 s en un punto de detección predeterminado; apertura solo en zonas autorizadas; una vuelta completada tras salida o periodo de SC; cierre en la primera frenada; veto de Dirección de Carrera. La FIA puede modificar el umbral. La restricción de proximidad es de carrera/sprint, no de libres/clasificación. T3.10.10, pp. 33-34: dos posiciones del flap, transición menor de 400 ms.
  * *Solución propuesta:* unificar la lógica en un servicio con `DetectionPoint` independiente y relación detección → una o varias zonas. Registrar tiempos interpolados de cruce y un permiso por coche/detección/paso, con rival observado, gap y causa de denegación. Comparar el tráfico físico en la misma ruta, incluidos doblados, sin usar el puesto de clasificación ni `progress * 77.8` como cronómetro. Conservar el permiso de las zonas asociadas aunque cambien el gap o el orden después de detectar; renovarlo en la siguiente detección correspondiente. Procesar cruces en orden temporal, también en meta y con simulación acelerada. No inventar la posición de detección restando una distancia fija a la zona.
  * *Activación:* distinguir `enabledByRaceControl`, `eligibleAtDetection`, `inActivationZone`, petición del piloto IA y flap realmente abierto. Cerrar por frenada, salida de zona o veto; conservar la causa en telemetría. Revisar los actuales contadores de 2 vueltas tras SC y 1 tras VSC: el artículo 22 exige una vuelta tras SC, pero no establece una espera adicional de una vuelta tras VSC. Evitar errores entre vuelta en curso y vueltas completadas.
  * *Tests obligatorios:* gap 0.999/1.000/1.001 s; entrar en detección a 1.2 s y acercarse luego a 0.5 s no autoriza; detectar a 0.8 s y separarse después a 1.3 s conserva permiso; adelantar después de detectar no lo crea ni lo borra; líder detrás de doblado; dos zonas con detección compartida y con detecciones independientes; zona que cruza meta; freno; SC/VSC/roja; libres/clasificación; reinicio; pasos grandes que cruzan detección y activación. Probar el camino real de `RaceSimulation`, no solo el helper.
  * *Dependencias y cierre:* R01-R03 definen contratos reutilizables; R04 añade integración visual y escenarios de aceptación sobre Q19, sin implementar el DRS dos veces. Primera referencia Barcelona/Mónaco con notas oficiales de evento pendientes de aportar/verificar. Registrar cualquier geometría provisional como estimada. **Esta tarea aún no corrige el DRS en el juego.**
  * *Puntos de entrada y frontera de entrega:* modificar `DrsZoneSpec`/`CircuitSpec`, parser, `CarState`, `DRSModel` y llamada real de `RaceSimulation`; consumidores en `CarRenderer` y telemetría solo leen estado. Los contratos mínimos de cruces/evento/permisos necesarios para Q19 no cierran automáticamente R01-R03. Preparar fixtures de detección verificados o explícitamente sintéticos antes de sustituir la lógica; sin datos reales suficientes, indicar el límite de la entrega. R04 completa explicación visual/animación y R05 el efecto aerodinámico; Q19 no debe introducir otro bonus de velocidad.

**Reconciliación de propuestas anteriores con el Sprint 2.9:** Q3 debe permitir límite de boxes por evento (80 km/h por defecto) y fast lane de hasta 3.5 m; Q10 necesita una línea de compromiso basada en geometría, no una supuesta distancia FIA universal de 0.05 vueltas. Los modificadores de Q11/Q12/Q15 y las recompensas Q17 son propuestas de diseño, no constantes reglamentarias. Q17 queda sujeto a R26: no montar piezas ni alterar límites del ERS durante una vuelta. Q18 y T3.1 mantienen el requisito personalizado de SC urbano mínimo 10 vueltas; no se atribuye a la FIA. El perfil reglamentario alternativo de R10 requiere aprobación antes de cambiar ese comportamiento.

---

## 🏎️ 6. SPRINT 2.9: REGLAMENTO FIA 2025 Y SENSACIÓN DE CARRERA (28 TAREAS)

**Estado: `[ ] REFINADO — PENDIENTE DE APROBACIÓN PARA IMPLEMENTAR`.** Investigación inicial documentada el 16/09/2026; planificación acotada posteriormente por el usuario a Sprint 2.9 y autorizada para integrar/publicar en main. Este cambio no implementa nuevas reglas. Objetivo: que el jugador entienda por qué un coche alcanza a otro, cuándo puede adelantar y qué coste tienen sus decisiones sobre neumáticos, energía, combustible y evolución del equipo. Se conservan las seis Reglas de Oro y la experiencia 100% Team Principal.

### 6.0 Alcance acordado y primera entrega propuesta

Se mantienen **las 28 tareas R01-R28 y las cinco entregas A-E**. Esta revisión concreta su planificación, no cierra ninguna tarea ni reanuda las Q pendientes. Los contratos propuestos deben contrastarse con el código cuando se autorice implementar; la presencia de una interfaz o una prueba sintética no acredita una mecánica completa.

| Entrega | Contenido conservado | Límite de la planificación actual |
|---|---|---|
| **A — Reglas, cronometraje, circuito y DRS** | R01-R04 | Primera entrega acotada a R01, R02 y la parte inicial de R03 descrita debajo. R04 depende de Q19 pendiente: no prometer DRS corregido como resultado de ese primer bloque. |
| **B — Rendimiento y recursos** | R05, R06, R14-R17 | Reglas comunes y diferencias técnicas de equipos; dependencias Q7/Q8/Q16 documentadas, no presupuestas ni implementadas en esta revisión. |
| **C — Carrera y estrategia** | R07-R13, R22, R25; resultado de una carrera de R21 | Incluir clasificación/puntos de una carrera sin esperar al campeonato. Órdenes, boxes y continuidad dependen de Q9-Q15/Q18 donde corresponda; reconocer esas carencias antes de autorizar cada bloque. |
| **D — Fin de semana y temporada** | R18-R21, R26 | R21 amplía el resultado de carrera con campeonato, sin contarlo como tarea nueva. Q17 permanece como dependencia de R26, no se considera entregada. |
| **E — Presentación y verificación transversal** | R23, R24, R27, R28 | R27 acompaña desde el inicio; definir el esquema R28 temprano sin declarar guardado completado. R23 excluye los nuevos escenarios por capas de Q6. |

**Primera entrega propuesta, pendiente de autorización para codificar:**

1. **R01 — Perfil de reglas y procedencia.** Especificar edición/perfil, unidades, datos de evento y ajustes del juego separados. Ubicaciones iniciales: `src/types/f1.ts`, `src/data/circuits.ts` y constantes dispersas de los modelos. Contrato verificable: dato con origen/unidad, perfil inválido rechazado y comportamiento personalizado existente conservado mientras no se apruebe otro. No aplicar todas las reglas FIA solo por centralizar sus constantes.
2. **R02 — Cronometraje y reproducibilidad.** Definir reloj, cruce de líneas interpolado y tráfico físico separado de clasificación, paso estable y RNG reproducible. Integración prevista en `RaceSimulation.update/advanceSimulation`, sectores y gaps; fixtures con meta, doblados, rutas de boxes y varios cruces por paso. La comparación a distintas tasas/velocidades debe declarar tolerancias y evidenciar los límites; no dar por resuelta toda la física por una semilla fija.
3. **R03 — Solo base inicial de datos/líneas/unidades.** Documentar y validar la geometría existente de Barcelona/Mónaco: sentido, meta, normalización, distancias y transformación mundo/metros, líneas/rutas y esquema de procedencia. No redibujar escenarios, añadir edificios, escapatorias ni pianos Q6, ni implementar anchura variable Q7/trazada Q8. Datos de detección no verificados se mantienen provisionales o en fixtures sintéticos identificados; esta fase parcial no cierra R03 ni convierte esos puntos en oficiales.

**Trabajo transversal de ese bloque:** R27 aporta fixtures y comparaciones desde el comienzo, apoyándose en `test-suite.mjs`; R28 define el contrato de snapshot versionado (perfil/evento, reloj, RNG y referencias de estado que habrá que persistir). Esquema no equivale a botones de guardar/cargar, migraciones ni continuidad validada: R27 y R28 conservan estado pendiente hasta cumplir sus criterios completos.

**Puerta de salida del primer bloque futuro:** evidencias de validación del perfil, cronometraje reproducible, cruces/convenciones y geometría existente documentada; dashboard/index sincronizados, pruebas y build correctos. Registrar qué parte de R03 quedó entregada y lo que falta. Ni R04, ni Q19, ni guardado completo se declaran resueltos con este hito. Antes de programar debe existir una autorización de implementación distinta de esta orden de publicar la planificación.

**Dependencias pendientes del Sprint 2.8:** Q19 bloquea la integración funcional de DRS en R04; Q7/Q8 afectan R03/R05/R23; Q9-Q13 afectan R07/R08/R25; Q14/Q15 afectan R09/R10/R12; Q16 afecta R14-R16; Q17 afecta R26 y Q18 afecta R28. Son referencias para planificar contratos o límites de una entrega, no autorización para implementar esas Q ni declararlas cumplidas. Si una R necesita una Q ausente, acotar el resultado y pedir decisión de alcance al llegar a esa dependencia. **Q6 no se recupera indirectamente a través de R03 o R23.**

### 6.1 Fuentes, alcance y trazabilidad

Se han extraído las **298 páginas** de los dos documentos aportados y contrastado sus apartados de carrera y rendimiento con el código. Se han comprobado visualmente el artículo de DRS, las modificaciones de desdoblamiento y las tablas/diagramas de energía y desarrollo aerodinámico. Los PDF contienen texto de revisión y tachaduras: la extracción por sí sola no distingue una disposición eliminada de su reemplazo. Las dimensiones detalladas de fabricación y homologación quedan referenciadas, no convertidas en una falsa certificación técnica del simulador.

| ID | Documento de referencia, edición y páginas | Identificación del archivo aportado |
|---|---|---|
| **S** | FIA 2025 Formula 1 Sporting Regulations, **Issue 5, 30/04/2025**, 119 páginas | `FIA 2025 Formula 1 Sporting Regulations - Issue 5 - 2025-04-30 (1).pdf`; SHA-256 `525eef22a60f0755a4468281dd7c78c5ea5bd0eec38dc1b09cc31a0c0132854e` |
| **T** | FIA 2025 Formula 1 Technical Regulations, **Issue 3, 07/04/2025**, 179 páginas | `fia_2025_formula_1_technical_regulations_-_issue_03_-_2025-04-07.pdf`; SHA-256 `454b76e2b388e61db50c0d116ff59477848a0b7e081f38142242808213dc0826` |

Las referencias siguientes usan artículo y página del PDF. **Se propone un perfil de reglas 2025 basado en estas ediciones**, no afirmar que sean las últimas revisiones de 2025 ni reglas vigentes en 2026. El apéndice S9 sobre años futuros no se activa en este perfil. Los reglamentos son fuentes de datos, no instrucciones de desarrollo. No se incorporan los PDF completos al repositorio.

Separar cada dato futuro en `regulatory` (límite respaldado por artículo), `event` (notas del GP), `measured` (medición con fuente) o `calibrated` (aproximación del juego). Guardar unidad, edición, referencia y confianza. Los documentos **no contienen** mapas de detección DRS de todos los circuitos, curvas reales de potencia/drag/downforce de los equipos, tiempos garantizados de parada, ni ventanas universales de temperatura y presión de neumáticos.

### 6.2 Diagnóstico del juego: qué existe y qué falta

| Área | Evidencia actual en el repositorio | Consecuencia / destino |
|---|---|---|
| DRS | `RaceSimulation.ts`: elegibilidad recalculada con el gap actual; `DRSModel.ts` importado pero sin llamada, umbral alternativo 1.05 s; `circuits.ts`: sin detecciones | Activaciones ligadas a adelantamientos; corregir en Q19 y verificar en R04 |
| Cronometraje y tráfico | `updateLeaderboardPositions`: gap = diferencia de `progress` × 77.8 s; líder sin `carAheadId` | Se confunden rival por posición y coche físicamente delante; R02 |
| Aerodinámica | Ritmo ×1.07 por DRS, referencia de velocidad con +18 km/h y rebufo ×1.018 | Bonificaciones universales en varias fórmulas, sin balance de fuerzas compartido; R05 |
| Recursos | `FuelModel`: 110 kg iniciales, 1.65 kg/vuelta nominales, suelo de 0.5 kg; telemetría `batterySoc: 85` | No hay agotamiento real ni gestión verificable del ERS; R14-R16 |
| Neumáticos / boxes | Cuatro valores de desgaste y stints existentes; compuesto elegido aleatoriamente en servicio; `totalPitStops === 0` limita la parada programada | Falta inventario y legalidad de estrategia, especialmente Mónaco; Q9-Q11, R06-R08 |
| Neutralizaciones | SC/VSC/roja existentes; contadores DRS globales, compactación/reposición de `progress`, roja con cambio de salud aleatorio | Motor parcialmente implementado, requiere procedimientos y continuidad; Q14-Q18, R09-R12 |
| Equipos | `teams.ts`: diez equipos con ratings, motor, fiabilidad y media de pit stop; ritmo dependiente de `carPerformance` | Hay diferenciación inicial, no perfiles técnicos completos con evoluciones versionadas; R17-R19 |
| Sesiones / resultados | Parrilla `STARTING_GRID_ORDER`, semáforos y vuelta rápida; sin módulos completos de clasificación deportiva, penalizaciones o temporada | R13, R20-R21; no confundir Q1/Q2 de tareas geométricas con sesiones de clasificación |
| Muro y estadísticas | Órdenes incompletas; `pushLaps` por porcentaje de vueltas, adelantamientos por puestos ganados desde parrilla | Deben proceder de eventos reales; R24-R25 |
| D20 / clima | D20 puede renovar neumáticos en pista; tipos inter/wet y meteorología no equivalen a un modelo de agua completo | Q17, R22 y R26; aprovechar T3.2-T3.4 sin duplicar motores |

Los estados históricos «completado» certifican las pruebas de aquel momento, no el cumplimiento integral del reglamento. Las carencias anteriores requieren pruebas de integración antes de cerrar su tarea.

### 6.3 Registro de datos deportivos que afectan a la partida

| Regla / fuente | Datos y condiciones a conservar | Aplicación |
|---|---|---|
| **DRS — S22.1, pp. 23-24** | Menos de 1 s en detección en carrera/sprint; umbral modificable por FIA; solo zonas de activación; una vuelta después de salida/SC; cierre al frenar; autorización y veto de Dirección. Si se deshabilita durante Q1/Q2/Q3 o SQ1/SQ2/SQ3, permanece así el resto de ese periodo | Q19, R04. Un adelantamiento posterior no vuelve a medir la detección |
| **Seguridad — S26, pp. 28-30** | Retirar coches con daño peligroso; luces reglamentarias con inter/wet; Heat Hazard por previsión de índice térmico >31 °C o decisión del director. No confundir índice térmico con temperatura ambiente | R09, R16, R23 |
| **PU por piloto/temporada — S28.1-28.4, p. 31** | 4 ICE, 4 TC, 4 MGU-H, 4 MGU-K, 2 ES, 2 CE y 8 de cada uno de los cuatro elementos de escape. Primer exceso por tipo: 10 puestos; siguientes: 5. Se considera usado al salir de boxes; sustituto hereda el cupo | R19; aplicar acumulación y orden de parrilla de S42 |
| **Inventario de neumáticos — S30.1-30.5, pp. 32-37** | Fin de semana normal sin ensayo adicional: 13 slicks (2 H / 3 M / 8 S), 5 inter y 2 wet por piloto; sprint: 12 slicks (2 H / 4 M / 6 S), 5 inter y 2 wet. Mónaco: 3 wet. Ensayos adicionales y devoluciones tienen excepciones que requieren tabla por sesión | R07, R20; las etiquetas H/M/S son relativas a la selección del evento |
| **Compuestos de carrera — S30.5m, p. 37** | Sin usar inter/wet: al menos dos especificaciones slick diferentes, una de ellas obligatoria para carrera. Exención de esa obligación al usar inter/wet. Aplicar a carrera, no inventar obligación equivalente para sprint | R07 y mensajes preventivos al muro |
| **Mónaco — S30.5m, p. 37** | Al menos **tres juegos** durante la carrera, también con lluvia; además dos especificaciones slick si no usa inter/wet. No equivale jurídicamente a exigir dos entradas a boxes: un cambio durante suspensión puede contar cuando el juego se utilice | R07, R12, R25 |
| **Incumplimiento de neumáticos — S30.5m, p. 37** | Carrera terminada normalmente: DSQ. Suspendida sin reinicio: +30 s si incumple lo exigible; Mónaco +30 s por incumplir dos especificaciones cuando sean exigibles o tres juegos, y +30 s adicionales si solo utilizó un juego | R07, R13, R21; evitar duplicar indebidamente el primer +30 |
| **Wet bajo SC — S30.5n, S49.1 y S58.1, pp. 37, 60, 69** | Wet obligatorio en los supuestos de formación/reanudación indicados cuando se ordene; conservar mandato y periodo de aplicación, no imponer wet automáticamente a todo SC | R10, R12, R22 |
| **Boxes — S34.1-34.7, pp. 41-42** | Entrada/salida ligadas a líneas SC1/SC2; fast lane máximo 3.5 m; un puesto de parada por equipo; 80 km/h, modificable por evento; no marcha atrás propulsada | Q3/Q10/Q11, R03, R08 |
| **Salida insegura / pit cerrado — S34.14-34.15, pp. 42-43; S53.1, p. 62** | Comprobar salida segura, semáforo y restricciones; cierre excepcional de entrada con acceso para reparaciones esenciales según artículo | R08, R13; cola real de dos pilotos |
| **Combustible — S36.2, p. 44** | No añadir ni retirar desde salida para reconocimiento hasta señal de final; la suspensión no autoriza repostar | R12, R14 |
| **Clasificación — S39, pp. 46-48** | Con 20 coches: Q1/Q2/Q3 de 18/15/12 min; descansos 7/8 min; eliminados 5/5. SQ1/SQ2/SQ3 de 12/10/8 min; descansos 7/7. Igual tiempo: prioridad a quien lo marcó primero. 107% en Q1/SQ1 salvo pista declarada mojada, con decisión de comisarios para participar | R20. Parametrizar eliminaciones según tamaño de parrilla |
| **Parc fermé — S40, pp. 48-52; S60, p. 73** | Ventanas separadas SQ→sprint y Q→carrera; catálogo de trabajos permitidos, sustitución equivalente y ajustes autorizados. Incumplimiento de S40.9: salida desde boxes. Sin mejoras libres entre clasificación y carrera | R18, R20 |
| **Formación/salidas — S43-S52, pp. 53-62** | Secuencia y luces, salida abortada, vuelta adicional, salida desde boxes, salida parada/lanzada y condiciones de lluvia. No reducir toda reanudación a una nueva parrilla | R20 y R12 |
| **Sanciones — S54.3-54.4, pp. 63-64** | 5/10 s: cumplir antes de trabajar en siguiente parada, incluso SC/VSC, o sumar al final si no vuelve a parar. Drive-through / stop-go de 10 s: plazo de no más de dos cruces de meta antes de entrar, ajustado por neutralización; no servir bajo SC/VSC salvo excepción de estar entrando para cumplirla | R13 y R08 |
| **Sanciones tardías — S54.3, p. 63** | Si se imponen en últimas tres vueltas o después del final: 5/10/20/30 s según penalización de 5 s/10 s/drive-through/stop-go; incidentes requieren determinación, no una sanción universal por contacto | R13, R21 |
| **SC — S55, pp. 64-67** | Reducción mediante tiempos mínimos, fila normalmente a ≤10 longitudes, excepciones de adelantamiento, desdoblamiento autorizado de todos los elegibles, mensaje «in this lap», sin adelantar hasta cruzar la línea tras retorno. Cuenta vueltas; final con SC sin adelantamientos | R10. Duración ligada a seguridad; no fija 10 vueltas en urbano |
| **VSC — S56, pp. 67-68** | Delta mínimo por sector de comisarios y líneas SC, también al verde; excepciones de paso por boxes/problema. Aviso de final y verde entre 10 y 15 s después; no reagrupar pelotón | R11. Sectores de comisarios no son los tres sectores cronometrados |
| **Pit bajo neutralización — S55.12 y S56.4, pp. 66-67** | En carrera/sprint, entrada para cambiar neumáticos, con la excepción indicada cuando el SC guía por boxes; coordinar con servicio de sanciones y órdenes específicas | R08, R10-R13 |
| **Roja — S57-S58, pp. 68-72** | Retorno lento a fast lane, salida cerrada, orden en último punto fiable; parrilla solo por excepción. Trabajos permitidos incluyen neumáticos y reparación de daño genuino; aviso mínimo de 10 min para reanudar; salida parada/lanzada. El cronometraje continúa y el tiempo de suspensión se contabiliza con sus límites | R12, R20-R21 |
| **Final y clasificación — S58.14, S59, S61-S62, pp. 72-74** | Final por distancia/tiempo; vuelta de cierre de cada coche; vueltas completas y orden de llegada; clasificar si alcanza `floor(0.9 × vueltas del ganador)`. Puede haber retirado clasificado. Suspensión definitiva: retroceso reglamentario a la penúltima vuelta anterior a la vuelta de suspensión | R21; separar DNF, NC y DSQ |
| **Duración — S5.3-S5.4, pp. 3-4** | Carrera: vueltas mínimas para superar 305 km, Mónaco 260 km; límite 2 h, total con suspensión hasta 3 h y procedimiento de final correspondiente. Sprint: superar 100 km, 1 h / 1.5 h. Reducción por formación tras SC: vueltas del SC menos una | R20-R21. Modo de carrera corta del juego debe identificarse como adaptación |
| **Puntos — S6.4-6.6 y S7, pp. 4-6** | GP: 25/18/15/12/10/8/6/4/2/1; sprint: 8/7/6/5/4/3/2/1. Sin punto extra de vuelta rápida. Carreras cortas: <25% = 6/4/3/2/1; 25–<50% = 13/10/8/6/5/4/3/2/1; 50–<75% = 19/14/12/9/8/6/5/3/2/1; ≥75% completos. Exigir mínimo de vueltas y dos vueltas sin SC/VSC de S6.5; sprint suspendido: ≥50% y dos vueltas sin SC/VSC. Desempates S7 | R21; consultar condiciones de carrera suspendida, no aplicar puntos reducidos a una carrera corta configurada sin declararlo |
| **Desarrollo aerodinámico — S ap. 7.6, p. 108** | Coeficiente ATR según puesto 1→10+/nuevo: 70/75/80/85/90/95/100/105/110/115%. Base por periodo: 320 tandas, 80 h de viento, 400 h de ocupación; CFD 2000 nuevas geometrías y 6 MAUh. Primeros tres periodos según campeonato anterior, siguientes tres según clasificación al cierre del tercero | R18; más recursos de investigación no garantizan más rendimiento |

### 6.4 Registro técnico común y diferencias entre coches

| Sistema / fuente | Restricción o dato verificado | Traducción a simulación y aspecto visual |
|---|---|---|
| **Geometría — T3.4, p. 15** | Carrocería dentro de ±1000 mm, con excepciones expresas de neumáticos/llantas/tapas; batalla ≤3600 mm | Dimensiones físicas separadas del zoom. No interpretar 3600 mm como longitud total del coche |
| **Suelo — T3.5.9, p. 19** | Plank nuevo 10 ±0.2 mm; mínimo por desgaste 9 mm en puntos reglamentarios | Altura/setup, roce, desgaste acumulado e inspección; chispas condicionadas por contacto real, no decorativas permanentes |
| **DRS mecánico — T3.10.10, pp. 33-34** | Dos posiciones, transición <400 ms, abertura reglamentaria hasta 85 mm (condiciones geométricas completas en artículo) | Animación del flap ligada a estado mecánico, menor resistencia aerodinámica, cierre y posible avería; no +7% de velocidad universal |
| **Masa — T2.4, T4, pp. 8, 47-48** | Mínimo sin combustible 800 kg, sujeto a ajustes por neumáticos y Heat Hazard. Piloto/asiento/equipo y lastre de referencia ≥82 kg, ya dentro de masa del coche. Heat Hazard +5 kg en carrera/sprint, +2 kg otras sesiones | Masa real = coche/piloto/lastre + combustible; no sumar al mínimo los 82 kg por segunda vez. Reparto en Q/SQ: ejes ≥0.446/0.539 del mínimo según condiciones de T4.2 |
| **Motor — T5.2, pp. 52-53** | V6 a 90°, cuatro tiempos, 1600 cc (+0/−10); flujo ≤100 kg/h; bajo 10500 rpm, Q≤0.009N+5.5 kg/h; aplicar también curva de carga parcial de T5.2.5 | Curva de par/consumo, tracción y temperatura. No se deduce una potencia real de cada fabricante ni un objetivo de rpm constante |
| **ERS — T5.3.2, pp. 53-54, diagrama** | MGU-K→ES ≤2 MJ/vuelta; ES→MGU-K ≤4 MJ/vuelta; ventana entre carga máxima/mínima del ES ≤4 MJ; potencia MGU-K ±120 kW. MGU-H tiene flujos sin ese límite energético por vuelta, sujetos al resto del sistema | Contadores separados, integración kW×s→kJ, pérdidas explícitas; 4 MJ de descarga del ES no es límite de toda energía que pueda recibir el MGU-K desde MGU-H |
| **ERS en salida y pit — T5.3.2, pp. 53-54** | En salida parada, MGU-K solo tras alcanzar 100 km/h, salvo coches que salen/reanudan desde boxes. Aumento de energía almacenada estacionado en boxes durante Q o parada de carrera ≤100 kJ. Vuelta energética termina/comienza en inicio de pit lane al entrar | Eventos específicos para contadores; evitar batería llena instantáneamente en parada o doble reset al cruzar meta de boxes |
| **Máquinas eléctricas — T5.3.3-5.3.4, p. 55** | MGU-K ≤120 kW, ≤200 Nm referidos según artículo, ≤50000 rpm, masa ≥7 kg; MGU-H ≤125000 rpm, masa ≥4 kg; corrección de eficiencia de control 0.95 en T5.3.2 | Límites comunes al homologar perfiles. La corrección reglamentaria de medición no sustituye el modelo de pérdidas físicas |
| **Muestra/combustible — T6.5.2, p. 68; T16.4.4, p. 132** | Muestra de 1 litro disponible; si no vuelve por sus medios, combustible adicional equivalente al retorno según FIA. Etanol sostenible avanzado mínimo 10% en masa | Reserva estratégica calculada con densidad, sin crear combustible. Los 110 kg iniciales actuales son un parámetro del juego, no un máximo acreditado por estos artículos |
| **Electrónica / radio — T8.6-8.7, p. 76** | Telemetría coche→equipo; prohibición general de telemetría equipo→coche, con excepciones FIA; entradas del piloto | Órdenes del muro se interpretan como radio al piloto IA, con confirmación, no control remoto directo ni conducción manual |
| **Transmisión — T9.2.2 y T9.7-T9.9, pp. 82, 86-87** | Sin control de tracción; ocho marchas hacia delante y marcha atrás; cambios solicitados por piloto, con límites temporales | Piloto IA maneja acelerador/cambio; bloqueo, patinaje y pérdida de tracción posibles. Telemetría coherente con velocidad/relación |
| **Suspensión/neumáticos — T10, pp. 88-95** | Restricciones de suspensión/dirección; llantas de suministro estándar. T10.8: ancho delantero 345–375 mm, trasero 440–470 mm; diámetro máximo slick 725 mm / mojado 735 mm, medidos según condiciones del artículo | Diferenciar ejes en SVG/Canvas; balance mecánico y apoyo exterior. 1.4 bar del método dimensional no es presión operativa obligatoria |
| **Neumáticos — T10.8, pp. 93-94; S30.5a, p. 34** | Uso como suministrados, sin tratamientos; calentamiento permitido bajo condiciones; prescripciones del proveedor/evento | Inventario, mantas y temperatura al montar. Presiones, temperatura y crossover del juego deben llevar fuente/calibración, no atribuirse a FIA por defecto |
| **Frenos — T11, pp. 96-97** | Dos circuitos, sin ABS; discos ≤32 mm de espesor, delanteros 325–330 mm, traseros 275–280 mm; control trasero permitido bajo condiciones de T11.6; sin refrigeración líquida | Frenada, bloqueo, reparto, temperatura y recuperación conectados. Evitar bonus de frenado sin carga/grip o doble cómputo de regeneración |
| **Homologación / seguridad — T12-T15, pp. 98-129** | Célula, estructuras de impacto, halo, retenciones, luces, refrigeración del piloto y materiales | Componentes legales como base de diseño; daño funcional y retirada. No simular lesiones ni afirmar que un dibujo pasa ensayos FIA |
| **Componentes — T17 y ap. 5, pp. 135-141, 172-179** | Categorías LTC/SSC/TRC/OSC y sus perímetros | Catálogo de desarrollo propio, estándar, transferible y abierto; evitar mejoras de piezas estándar prohibidas |
| **PU homologada — T ap. 3-4, pp. 162-171** | Un dossier por fabricante; igualdad de especificación/operación a clientes con excepciones previstas. Cambios de fiabilidad/seguridad/coste/suministro requieren aprobación; no desarrollo libre de potencia | Separar proveedor de motor de integración del chasis; calendario de piezas aprobadas, sin inventar motores inferiores para clientes |

**Datos de equipos ya presentes en `src/data/teams.ts` (inventario, no mediciones FIA):**

| Equipo | PU configurada | Rendimiento / aero / motor | Fiabilidad | Media de parada (s) |
|---|---|---|---|---|
| McLaren | Mercedes-AMG | .999 / .998 / .996 | .99 | 2.1 |
| Red Bull | Honda RBPT | .998 / .997 / .998 | .98 | 2.0 |
| Ferrari | Ferrari | .997 / .996 / .999 | .98 | 2.2 |
| Mercedes | Mercedes-AMG | .995 / .994 / .996 | .99 | 2.3 |
| Aston Martin | Mercedes-AMG | .993 / .992 / .994 | .98 | 2.4 |
| Williams | Mercedes-AMG | .991 / .989 / .996 | .98 | 2.3 |
| Racing Bulls | Honda RBPT | .990 / .989 / .993 | .97 | 2.4 |
| Haas | Ferrari | .989 / .987 / .995 | .97 | 2.4 |
| Alpine | Renault | .988 / .987 / .990 | .97 | 2.5 |
| Sauber | Ferrari | .986 / .985 / .990 | .96 | 2.6 |

El código también asigna 1045/1030/1038/1015 `horsepower` por fabricante, respectivamente Mercedes/Honda/Ferrari/Renault. Estos números y nombres de modelos no quedan validados por los PDF. Antes de usarlos físicamente hay que documentar unidad (hp/CV/kW), procedencia, año y conversión. No trasladar el orden de este rating a una clasificación garantizada en todos los circuitos.

**Perfil propuesto por equipo y versión:** carga por velocidad/altura, resistencia con DRS abierto/cerrado, sensibilidad a aire sucio, balance y agarre mecánico, eficiencia de refrigeración, gestión térmica/desgaste, masa legal y lastre, fiabilidad por componente, eficacia de recuperación y ejecución de boxes. Todos comparten los límites reglamentarios. Los clientes de una PU comparten su base homologada; diferencias de instalación, drag, masa, refrigeración y uso pueden cambiar el rendimiento del coche completo. Cada mejora debe registrar componente, efecto, contrapartida, coste/plazo de juego, homologación, GP de entrada y unidades disponibles para cada piloto. No inventar coeficientes reales de cada equipo a partir del reglamento.

### 6.5 Backlog de implementación y criterios de aceptación

Todas las tareas siguientes están **pendientes**. P0 = corregir validez del núcleo; P1 = estrategia y sensación; P2 = profundidad de fin de semana/temporada. Las prioridades no autorizan empezar a programar.

#### Entrega A — Reglas, circuito y DRS verificables

* **R01 — Perfil de reglas versionado y procedencia (P0):** `[ ]`
  * Crear `RuleSet2025` y contratos de evento, con unidades explícitas y artículos del registro anterior. Separar configuración reglamentaria, decisiones de Dirección y ajustes de dificultad. Mantener el perfil personalizado existente hasta aprobar cambios de comportamiento.
  * *Aceptación:* fixtures de estas dos ediciones, límites validados y mensajes que identifican perfil/año. No importar cambios 2026, ayudas arcade o constantes sin origen como reglas FIA.
* **R02 — Cronometraje por cruces y tráfico físico (P0):** `[ ]`
  * Sustituir los 77.8 s universales para gaps reglamentarios por pasos por líneas con timestamp interpolado. Separar clasificación por vueltas, vecino físico en pista y tráfico de boxes. Paso de simulación estable, RNG con semilla y orden de actualización sin ventaja por índice de coche.
  * *Aceptación:* vueltas perdidas, líder doblando, adelantamientos, pit y cruce de meta; mismo resultado reglamentario a 30/60/144 FPS y x1/x4/x16. No perder eventos por atravesar varias líneas en un paso.
* **R03 — Datos de evento y geometría con unidades (P0):** `[ ]`
  * Extender `CircuitSpec`/`TrackDefinition` con detecciones, zonas asociadas, límites de velocidad, líneas SC1/SC2, sectores de comisarios, límites de pista, entrada/salida y cajones. Una transformación SVG→metros compartida con cámara/minimapa/hit-testing (Q4/Q7). Auditar trazado, sentido, meta y número de curvas del año elegido.
  * *Aceptación:* Barcelona y Mónaco de referencia; intervalos que cruzan meta, dirección inversa y pit que no cruza meta. Datos no verificados llevan estado provisional. Obtener notas y mapas oficiales de cada GP antes de declarar una detección «real».
* **R04 — Integración y lectura visual del DRS (P0; depende de Q19/R01-R03):** `[ ]`
  * Reutilizar Q19 como implementación única. Mostrar punto de detección, segmento de activación y estados «sin permiso / permiso obtenido / abierto / bloqueado» con motivo y gap detectado. Animar flap según estado real T3.10.10; piloto IA solicita apertura, el usuario dirige desde el muro.
  * *Aceptación:* todos los escenarios Q19 probados entrando por `RaceSimulation`, contador real de usos y revisión visual de adelantamiento antes/después de detección. No cerrar esta tarea solo porque cambie el badge de DRS.

#### Entrega B — Coches con comportamiento propio y recursos finitos

* **R05 — Aerodinámica, rebufo y adelantamiento físico (P1; A):** `[ ]`
  * Usar un único cálculo de drag, carga, tracción y potencia para obtener aceleración/velocidad. DRS reduce drag; el rebufo ayuda en recta y el aire sucio perjudica apoyo/refrigeración según distancia y offset. Conectar Q7/Q8 para elegir trayectoria viable y dejar espacio.
  * *Aceptación:* maniobra sin salto, sin aumento instantáneo de velocidad ni multiplicadores duplicados; comparación con/sin DRS a igual masa/energía; efecto distinto entre recta y curva. Coeficientes calibrados, nunca «ganancia FIA garantizada».
* **R06 — Cuatro neumáticos con temperatura, carga y desgaste (P1; R05):** `[ ]`
  * Grip dependiente de compuesto, temperatura, carga, presión y agua; transferencia de apoyo según signo de curva, desgaste irreversible, calentamiento tras parada, bloqueo/flat spot y pinchazo. Conservar estado por rueda e historial, también al reutilizar un juego.
  * *Aceptación:* curvas izquierda/derecha cargan rueda exterior correcta; out-lap fría cuesta tiempo; Push aumenta exigencia y riesgo; enfriar no repara desgaste. Prueba de undercut/overcut dependiente de tráfico y calentamiento, sin victoria programada.
* **R14 — Masa, combustible y reserva para muestra (P0; R01-R02):** `[ ]`
  * Retirar el suelo infinito de 0.5 kg; integrar consumo limitado por flujo/carga, masa y efecto sobre aceleración/frenada. Calcular combustible inicial por distancia y estrategia, guardar reserva de muestra con densidad y combustible de retorno. Agotamiento provoca pérdida de propulsión/retirada física.
  * *Aceptación:* conservación de masa, cero combustible sin negativos, ahorro real con lift-and-coast, diferencia entre stint cargado y ligero; ninguna parada o roja reposta. Validar masa mínima y Heat Hazard sin doble cómputo del piloto.
* **R15 — ERS energético 2025 completo (P0; R02/R14, amplía Q16):** `[ ]`
  * Libro de flujos MGU-K/MGU-H/ES, SOC y pérdidas; mapas de despliegue acordes al circuito y modo de muro. Límites de energía, potencia, salida y recarga de boxes del registro. La energía disponible y temperatura limitan la demanda; no exigir consumo uniforme toda la vuelta.
  * *Aceptación:* 2 MJ de recuperación K→ES, 4 MJ ES→K, 120 kW y saturación; caso de flujo H→K; reinicio energético al entrar a pit sin doble reset; parada ≤100 kJ en condiciones aplicables; salida parada antes/después de 100 km/h. Comprobar balance de energía en carrera completa.
* **R16 — Motor, frenos, transmisión, refrigeración y daño (P1; R05/R06/R14/R15):** `[ ]`
  * Calcular consecuencias térmicas antes del movimiento; ocho relaciones coherentes, frenada hidráulica/regenerativa compartida, bloqueo y patinaje sin ABS/TC. Daño de alerón/suelo modifica carga/drag; conducción con daño peligroso activa retirada. Modelo de roce del plank y comprobación de mínimo de 9 mm. Incluir Heat Hazard y refrigeración del piloto a nivel de equipamiento/masa.
  * *Aceptación:* frenos fríos/calientes producen efectos coherentes, batería llena limita regeneración, seguir otro coche afecta refrigeración; reparar solo partes permitidas y en lugar autorizado. Desgaste de suelo y daños persistentes, sin retiradas aleatorias desligadas del estado.
* **R17 — Identidad de los diez equipos y paquetes por circuito (P1; R05/R06/R14-R16):** `[ ]`
  * Migrar ratings a los perfiles de 6.4 con versión por equipo/GP/piloto; chasis, PU común y setup separados. Exponer fortalezas, debilidades y contrapartidas comprensibles: alta carga vs velocidad punta, refrigeración vs drag, calentamiento vs degradación.
  * *Aceptación:* repetir pruebas de recta, curva rápida/lenta, stint y tráfico con mismo piloto/condiciones. Diferencias explicables por parámetros, no por nombre/posición; paquete de baja carga no debe mejorar toda curva y toda recta. Cada coeficiente real necesita fuente; los demás se etiquetan como calibración.

#### Entrega C — Carrera, estrategia y decisiones reglamentarias

* **R07 — Juegos de neumáticos e inventario legal (P0; R01/R06, Q9):** `[ ]`
  * Identificar juegos, compuesto nominal/relativo, estado y asignación; aplicar cupos/devoluciones por sesión, dos especificaciones cuando proceda y tres juegos de Mónaco. No confundir juegos, compuestos y número de paradas; contar uso según S30.5c, incluidos cambios bajo roja cuando se utilicen.
  * *Aceptación:* seco normal, inter/wet, Mónaco seco/mojado, suspensión definitiva, juego reutilizado y stock agotado. Avisar con antelación y aplicar DSQ/+30/+60 solo en supuestos correctos, no cambiar neumáticos automáticamente para evitar sanción.
* **R08 — Boxes reglamentarios y doble parada (P0; R03/R07/R13, Q3/Q9-Q11):** `[ ]`
  * Entrar mediante cruce de línea, respetar limitador, frenar al cajón y acelerar por ruta propia. Un cajón/servicio compartido por equipo; segundo coche espera el recurso ocupado. Compuesto elegido vinculante; paradas sucesivas, reparaciones, sanción antes del servicio y liberación segura con tráfico/semáforo.
  * *Aceptación:* overspeed en ambos límites, cancelación antes/después del compromiso, double-stack con espera calculada, dos o más paradas programadas y pit cerrado. La pérdida se mide por tránsito/servicio/cola, no 22 s para todos los circuitos.
* **R09 — Dirección de Carrera, banderas locales y límites (P0; R02/R03):** `[ ]`
  * Unificar permisos de adelantar/velocidad/DRS y prioridad verde→amarillas→VSC/SC→roja; sectores de comisarios independientes del cronometraje. Banderas azules con tráfico físico, retorno seguro tras salida de pista y devolución de ventaja. Evaluar incidentes con causa/responsabilidad registrada.
  * *Aceptación:* prohibición no sobrescrita después por lógica de adelantamiento, salida de sector restaura permisos, doblado no se teleporta ni cede en zona peligrosa. Detalles de banderas/conducta dependientes de Código Deportivo/Apéndices H/L quedan pendientes de esas fuentes, no se inventa un baremo universal.
* **R10 — SC, desdoblamiento y relanzamiento (P0; R02/R03/R09, Q14/Q15):** `[ ]`
  * Estado explícito despliegue→recogida→fila→desdoblamiento autorizado→retirada→cruce individual de línea. Insertar SC desde su ruta, agrupar por cinemática, aplicar deltas, excepciones de boxes y lista de doblados elegibles en el instante reglamentario. Luces/mensajes coherentes y DRS tras una vuelta.
  * *Aceptación:* todos los doblados elegibles, último coche aún sin cruzar línea, SC entrando/saliendo, SC en última vuelta, otro incidente durante retirada. En perfil FIA, final por condiciones seguras; en perfil personalizado, conservar mínimo urbano 10 vueltas solicitado. No cambiar el perfil por defecto sin aprobación.
* **R11 — VSC con deltas y final anunciado (P0; R02/R03/R09):** `[ ]`
  * Tiempo mínimo por sector/SC1/SC2, sin compactar; final anunciado y espera reproducible de 10–15 s hasta verde, control de delta al verde y restricciones de pit/adelantamiento. No aplicar automáticamente la espera DRS de SC a VSC.
  * *Aceptación:* gaps no colapsan artificialmente, atajo/overspeed no permite ganar tiempo, pit válido y casos de excepción; VSC→SC→roja limpia temporizadores y conserva reloj.
* **R12 — Suspensión y reanudación completas (P0; R08-R11/R20):** `[ ]`
  * Reducir velocidad y retornar a fast lane; conservar orden en último punto fiable y separar coche en garaje/entrada/pista. Ofrecer trabajos permitidos, elección de neumáticos y tiempo mínimo de aviso. Reanudar parada o lanzada según condiciones; excepción de parrilla explícita, sin reset global de salud o combustible.
  * *Aceptación:* roja antes/después de entrar a boxes, vuelta parcial, doble suspensión, mojado, reparación legal y orden de reinicio; relojes de carrera/suspensión correctos. Ningún coche cambia de coordenadas por asignación de `progress`.
* **R13 — Comisarios y sanciones ejecutables (P0; R01/R02):** `[ ]`
  * Modelo independiente de infracción, investigación, decisión y cumplimiento; 5/10 s, drive-through, stop-go, puestos y DSQ. Emitir artículo, motivo y plazo; procesar sanciones de neumáticos/boxes/recursos desde el mismo servicio.
  * *Aceptación:* servir antes de tocar coche, no duplicar penalización al finalizar, plazos con SC/VSC, imposición tardía, retirada y reclasificación. Diferenciar infracción objetiva de contacto que requiere juicio; política de comisarios del juego documentada.
* **R22 — Clima físico mínimo y decisiones de seguridad (P1; R06/R09/R12):** `[ ]`
  * Adelantar de T3.2/T3.3 únicamente el estado funcional necesario: lluvia, agua por tramo, temperatura, visibilidad, secado y compatibilidad de neumáticos. Fuente única para grip, Dirección de Carrera, radar y previsión; escenario determinista, previsión con incertidumbre para jugador/IA.
  * *Aceptación:* seco→lluvia→secado, cambio inter/wet, pérdida de visibilidad que bloquea DRS o neutraliza, estrategia sin conocimiento del futuro. Crossover y temperaturas son calibraciones, no cifras FIA. Arte final de reflejos/spray y audio queda coordinado con Sprint 3.
* **R25 — Estrategia IA y muro con dos pilotos (P1; Q9-Q13/R07-R17/R22):** `[ ]`
  * Órdenes de ritmo, energía, ahorro y pit con acuse del piloto IA; prioridad del jugador respetada. Prever tráfico, inventario, neutralización y cola del compañero; estimación de reincorporación con intervalo de incertidumbre. Rivales usan las mismas reglas y recursos.
  * *Aceptación:* llamada de segundo stint, cancelar a tiempo, double-stack, undercut que falla por tráfico, ahorro para llegar y respuesta a lluvia. Sin pit obligatorio aleatorio que sobrescriba al jugador; sin ventaja de conocer futuros incidentes.

#### Entrega D — Fin de semana y evolución de equipos

* **R18 — Mejoras, setup, parc fermé y desarrollo ATR (P2; R01/R17):** `[ ]`
  * Catálogo versionado LTC/SSC/TRC/OSC; investigación/producción e instalación con fechas, unidades para cada coche y contrapartidas. ATR según tabla de 6.3 como presupuesto de desarrollo; no convertir más túnel en bonus garantizado. Validar dossier PU y cambios autorizados; bloquear cambios de setup fuera de excepciones de parc fermé.
  * *Aceptación:* mejora disponible para un piloto, paquete retrasado, reglamento común pese a equipo distinto; mismo proveedor no vende deliberadamente una PU de inferior especificación. Cambio de suspensión en parc fermé produce salida de boxes; ajuste permitido no la produce. Costes/plazos son diseño del juego; el reglamento financiero no está entre los PDF aportados.
* **R19 — Vida de componentes y cupos de temporada (P2; R13/R16/R18/R21):** `[ ]`
  * Pool por piloto, seriales, kilometraje/ciclos, daños, mantenimiento permitido y elección de sustitución. Separar límite de unidades de homologación de mejoras. Registrar transferencia a piloto sustituto y primer uso al salir del pit.
  * *Aceptación:* cuarto/quinto ICE, tercer ES, múltiples excesos y arrastre entre eventos; +10/+5 por tipo y algoritmo S42 para parrilla. No inventar un cupo antiguo de cajas de cambio: S29 figura VOID en esta edición; gestionar vida mecánica aparte.
* **R20 — Sesiones de clasificación, sprint y salidas (P2; R01/R02/R07/R13/R18):** `[ ]`
  * Estado de fin de semana con sesiones, tiempos, eliminaciones, parc fermé, neumáticos SQ según S30.5, clasificación y sanciones de parrilla. Formación, luces y salidas/reanudaciones mediante procedimientos reutilizables; modo GP directo conserva acceso rápido y declara parrilla prefijada cuando se use.
  * *Aceptación:* tiempos iguales, vueltas borradas, 107% seco/mojado, pilotos sin tiempo, sprint, salida abortada, pit start, formación mojada y MGU-K bloqueado en salida parada hasta condición válida. No simular físicamente minutos de espera a tiempo real si el usuario avanza la sesión.
* **R21 — Final, clasificación y campeonato (P0 para resultado; P2 para temporada; R02/R13):** `[ ]`
  * Bandera a cuadros por líder y cierre al paso de cada coche, límite temporal y suspensión definitiva; clasificación por vueltas/tiempo corregida por sanciones. Tabla de puntos 2025, carreras suspendidas, constructores y desempates; vueltas rápidas informativas sin punto adicional.
  * *Aceptación:* doblados, retirado con distancia suficiente, NC, DSQ, fin por tiempo, fronteras 25/50/75%, falta de dos vueltas sin SC/VSC, sprint <50% y final bajo SC. Guardar provisional/final y explicación de diferencias.
* **R26 — D20 compatible con gestión y reglas (P1; Q17/R01/R18):** `[ ]`
  * Reformular como variante opcional identificada: información del ingeniero, preparación o reducción acotada de riesgo de ejecución. Modo FIA determinista sin recompensas mágicas. Beneficios nunca crean neumáticos/combustible, exceden potencia/energía o instalan aerodinámica durante carrera/parc fermé.
  * *Aceptación:* comparar estado físico antes/después de tirada en pista; cero cambios de juego montado o piezas. Registrar causa y alcance; sustituir la propuesta de «+3 km/h por setup instantáneo» por efecto legal pendiente de aprobación.

#### Entrega E — Presentación, honestidad de telemetría y validación

* **R23 — SVG/Canvas que explica la física (P1; Q4/Q5, Q7/Q8 pendientes, R03-R16; Q6 excluida):** `[ ]`
  * Usar geometría y escenario existentes para explicar el estado físico: detección DRS diferenciada de activación cuando Q19/R04 estén disponibles; flap, daño, luces y contacto de suelo vinculados al motor. Preservar proporciones, LOD, cámara/minimapa/selección compartiendo coordenadas y transiciones suaves. Nuevos escenarios por capas, edificios, escapatorias y pianos localizados de Q6 quedan fuera de esta planificación.
  * *Aceptación:* coherencia de las señales con el estado real, coches y boxes a distintos zooms sobre Barcelona/Mónaco existentes, colores legibles sin depender solo de rojo/verde y coste medido con 20 coches/lluvia cuando exista ese estado. La eliminación de grava genérica en Mónaco y el rediseño de identidad visual siguen en Q6 excluida; no son criterios que obliguen a implementarla para cerrar R23. Q7/Q8 pendientes limitan las verificaciones que dependan de su geometría.
* **R24 — Telemetría y mensajes de muro basados en eventos (P1; R02/R04/R07-R16):** `[ ]`
  * Mostrar gap real, permiso DRS y causa, energía recuperada/desplegada/restante, combustible previsto y reserva, neumáticos disponibles/obligatorios, delta VSC, sanciones, daños y estado de mejoras. Sustituir porcentajes ficticios de Push/ahorro y puestos ganados como contador de adelantamientos por registros reales.
  * *Aceptación:* cada cifra reconstruible desde eventos; misma información en panel/torre/minimapa; diferenciar adelantamiento en pista, ganancia por pit y sanción; pocas alertas prioritarias y explicaciones claras sin inundar al jugador de artículos.
* **R27 — Banco de escenarios y calibración de experiencia (P0/P1; todas las entregas):** `[ ]`
  * Añadir pruebas por comportamiento a `test-suite.mjs`, fixtures con semilla y carreras completas de referencia. Comparar baseline antes/después: cronometraje, continuidad, adelantamientos, pit loss, energía, temperatura y resultado. Validar geometría real además de escenarios sintéticos.
  * *Aceptación:* suite y build PASS; cero usos DRS sin permiso, cero recursos creados, cero adelantamientos ilegales no detectados, cero saltos de posición; invariancia de reglas con FPS/velocidad de simulación. Objetivo inicial de precisión de cruce ≤1 ms en fixtures; calibración de tiempos por circuito frente a fuentes identificadas, sin prometer precisión no medida. Revisión humana de carreras seca/mojada/SC/roja antes de publicar nuevas mecánicas.
* **R28 — Guardado, reinicio y calidad de datos (P1; R01/R02, Q18):** `[ ]`
  * Snapshot versionado: semilla, reloj, órdenes, permisos DRS, inventario, energía/contadores, sanciones, eventos, mejoras y temporada. Reinicio limpia timers, IDs y permisos. Validador de circuitos/unidades y migraciones con diagnóstico de datos faltantes.
  * *Aceptación:* guardar/cargar antes de detección, durante pit, SC/VSC/roja y tras fin; continuar con mismo resultado. Cambiar circuito no hereda DRS ni incidentes, y datos provisionales nunca pasan a oficiales silenciosamente.

### 6.6 Secuencia, dependencias y límite de alcance

1. **Alcance actual: planificar Sprint 2.9**, sin continuar ni refinar Sprint 2.8. Q1-Q5 completadas; Q6-Q19 pendientes. Q6 excluida. Las dependencias técnicas entre Q y R no cambian esos estados ni autorizan implementarlas. La secuencia anterior que exigía continuar primero todas las Q queda sustituida, a efectos de esta planificación, por la primera entrega acotada de 6.0.
2. **2.9-A:** proponer R01, R02 y únicamente la base inicial de R03, con R27 transversal y esquema R28. Hito: perfil, cronometraje y validación de datos/geometría existente verificables. R04 y la demostración de permiso DRS correcto quedan condicionados a resolver Q19 con autorización independiente; no forman parte del resultado prometido de este primer bloque.
3. **2.9-B:** recursos finitos y comportamiento por equipo. Hito: decidir ahorrar/empujar cambia energía, temperaturas y ritmo de forma comprobable.
4. **2.9-C:** estrategia, incidentes y resultado reglamentario de una carrera completa (incluye la parte de resultados de R21). Hito: Mónaco exige estrategia legal, SC/VSC/roja y sanciones tienen consecuencias coherentes.
5. **2.9-D:** fin de semana y evolución de temporada. Hito: mejoras y uso de piezas tienen fechas, costes y restricciones, con diferencias legítimas entre equipos.
6. **2.9-E y verificación transversal:** presentación y mensajes se incorporan a cada entrega; benchmark, guardado y aceptación final cierran el sprint. No aplazar todas las pruebas a la última fase. Publicar solo el bloque que haya recibido OK local.

**No es una promesa de implementar 28 tareas en una sesión:** son cinco entregas revisables de una épica 2.9. Las fases D de temporada pueden ejecutarse después del núcleo de carrera, sin marcar el sprint completo antes de tiempo. Compartir implementaciones con Q9-Q19 y T3.2-T3.4; no mantener motores alternativos de DRS, clima o boxes.

**Datos externos todavía necesarios:** notas del director/mapas oficiales por GP y año (detecciones, zonas y líneas); prescripciones del proveedor de neumáticos (compuestos, presiones, mantas); Código Deportivo Internacional y apéndices H/L para detalle de banderas/conducta; clasificación de constructores para ATR; fuentes de rendimiento público para calibrar cada equipo. El mapa SVG, una URL oficial genérica o el PDF general no sustituyen esos datos. La falta de un mapa puede resolverse con fixtures sintéticos para probar lógica, pero no con coordenadas inventadas etiquetadas «FIA».

**Cobertura de los documentos y lo que se difiere conscientemente:**

| Apartados | Tratamiento en el proyecto |
|---|---|
| S1-S9 | Perfil/edición, participantes, licencias, campeonato y desempates: R01/R20/R21; trámites y contratos no son una mecánica de carrera |
| S10-S21 | Ensayos, organización, seguros, oficiales, comunicaciones, protestas, medios y componentes cubiertos: conservar referencia; mensajes R09/R13 y desarrollo R18; burocracia/media fuera del núcleo |
| S22-S28 | DRS, personal/cierres de fábrica, seguridad, coches y PU: Q19/R04/R16/R18/R19; calendario de cierres para expansión de gestión |
| S29/S41 | VOID: no reconstruir normas antiguas bajo estos números |
| S30-S40 | Neumáticos, verificaciones, sustitución de pilotos, conducción, boxes, pesaje, combustible, sesiones y parc fermé: R06-R09/R13-R20 |
| S42-S58 | Parrillas, salidas, carrera, incidentes y neutralizaciones: R09-R13/R20 |
| S59-S64 | Final, parc fermé, clasificación, podio y equipamiento: R16/R21/R23; protocolo completo de prensa/podio fuera del núcleo |
| S ap. 1-6 | Datos del evento, inscripción, contratos, tasas, podio y suministro PU: referencias R01/R03/R18-R21; formularios/comercial se difieren |
| S ap. 7-8 | Restricciones aerodinámicas y bancos de PU: R18; ATR numérico recogido, granularidad industrial del banco se difiere a gestión avanzada |
| S ap. 9 | Cambios de años futuros: excluidos del perfil 2025 |
| T1-T3 y ap. 1-2 | Marco, coordenadas, volúmenes, aero y dibujos: R01/R03/R05/R16/R23. Geometría simplificada legal como referencia, no solver CAD de homologación |
| T4-T8 | Masa, PU, combustible, aceite/refrigeración y electrónica: R14-R17/R24 |
| T9-T11 | Transmisión, suspensión, ruedas/neumáticos y frenos: R06/R16/R23 |
| T12-T16 | Chasis, pruebas de impacto, seguridad, materiales y química de combustibles/aceites: base homologada R16/R18; no reproducir laboratorio, crash tests ni análisis químico |
| T17 y ap. 3-5 | Clasificación, perímetro y homologación de componentes/PU: R17-R19; conservar trazabilidad de piezas y desarrollo permitido |

**Criterio de cierre del Sprint 2.9:** 28 tareas con evidencia de aceptación y pruebas ejecutables, datos oficiales separados de calibración, documentación de simplificaciones, build correcto y OK del usuario sobre el bloque jugable en local. Las reglas críticas y los resultados deben ser explicables desde el registro de carrera. Hasta entonces permanece planificado/en curso, aunque una parte visual esté terminada.

### 6.7 Mapa de implementación para retomar R01-R28

Complementa, no sustituye, las reglas y escenarios de 6.3/6.5. **No hay módulos reglamentarios completos implementados por esta planificación.** Al llegar a una R, comprobar qué parte ya entregaron las Q y ampliar esa misma implementación. Los módulos nuevos sugeridos deben separarse por responsabilidad del gran `RaceSimulation.ts`, sin una reescritura general previa ni estados duplicados en React.

| Tarea | Dónde empezar y estado real | Contrato de entrega / comprobación adicional |
|---|---|---|
| **R01** | `f1.ts`, `circuits.ts`, constantes de `RaceSimulation`, `DRSModel`, `FuelModel` y `PitStopModel`. Hoy las reglas están dispersas; la UI mezcla referencias 2026 con planificación FIA 2025. | Perfil con ID/edición, unidad, fuente y configuración de evento; inyectarlo en motor en vez de leer constantes distintas. Separar nombre comercial/temporada visual de reglas activas y evitar migrar silenciosamente una carrera. Probar campo faltante, perfil desconocido y defaults personalizados. |
| **R02** | `updateLeaderboardPositions`, `updateCarSectors`, conteo de vueltas y avance de `RaceSimulation`; `Math.random` aparece en varios modelos. | Reloj común y cruces interpolados con ID de línea, coche, vuelta/ruta y tiempo. Separar orden deportivo de vecino físico; instantánea de todos los coches antes del paso para no favorecer al primero del array. Subpasos con tiempo acumulado, RNG reproducible y consumo de azar estable; no sustituir 77.8 por otra constante. Probar simultaneidad y varios cruces por tick además de 6.5. |
| **R03** | `CircuitSpec`, `TrackDefinition`, `buildTrackFromSvg`, `carPosition`, `pitLaneGeometry`. El parser ajusta cada SVG a un rectángulo gráfico; nombre `trackWidthMeters` no acredita conversión física. | Registro por evento con líneas referenciadas al sentido/meta normalizados y procedencia por dato. Transformaciones ida/vuelta y distancia de arco verificadas; las nuevas coordenadas no deben desalinear Q4 ni Q7. Validar detecciones asociadas, rangos, duplicados y unidades antes de arrancar. Sin mapa oficial, fixture provisional etiquetado y alcance limitado. |
| **R04** | Resultado Q19, `CarRenderer` (flap), `TrackRenderer`, `BottomTelemetryDock`/`TelemetryPanel`, `RightStatsPanel`. | El renderer no decide elegibilidad. Recibir permiso, gap detectado, motivo de bloqueo y estado/tiempo de flap; representar detección y activación con símbolos distintos. Probar que una denegación sigue visible al adelantar y que animación, badge y contador corresponden al mismo evento. |
| **R05** | Bloque de velocidad/aceleración en `RaceSimulation`, `EngineModel`, geometría Q7/Q8. Hoy hay ×1.07 y +18 km/h por DRS en rutas distintas. | Resolver fuerza longitudinal y límite de apoyo desde parámetros comunes; contabilizar una sola vez DRS/rebufo/masa/energía. Vecino físico y separación lateral para aire sucio, no rival de clasificación. Carreras comparables con parámetros distintos, sin ganador prefijado; conservación y aceleración limitada al entrar/salir de zona. |
| **R06** | `TireState`, `TireModel`, desgaste por rueda existente, actualización térmica de `RaceSimulation` y servicio de boxes. | Estado físico por rueda separado del juego inventariado R07. Cargas y temperaturas alimentan grip antes del movimiento; desgaste acumulativo sin curación al enfriar. Persistir daño/flat spots al desmontar y reutilizar; repetir pruebas con curvas de signo opuesto y agua. Las tablas de crossover se calibran, no se deducen del color del compuesto. |
| **R07** | `PitStopState.stints`, `targetCompound` y orden Q9; hoy `createFreshTire` crea recursos sin inventario. | ID de juego y cuatro ruedas persistentes, compuesto nominal y etiqueta H/M/S del evento; seleccionar, reservar, montar, desmontar y registrar uso. No descontar dos veces por callback ni contar una simple reserva como uso reglamentario. Conectar validación a R13 y mostrar faltantes al jugador; mismo stock y reglas para rivales. |
| **R08** | `PitStopModel.updatePitStop` y recurso de cajón Q11, rutas Q2/Q3/Q4, orden Q9/Q10. | Máquina de estados solicitud→entrada→limitador→espera→sanción→servicio→liberación→salida. Línea de compromiso, inicio/fin de límite y cajón son entidades distintas. Compartir ocupación entre compañeros y controlar tráfico de liberación. Registrar tiempos separados para Q13; no sumar además una penalización fija de pit loss. |
| **R09** | `IncidentModel`, decisiones en `SafetyCarModel`/`RaceSimulation` y caminos DEV en `App`. | Un servicio devuelve permisos por coche/tramo y causa antes de mover; incidente conserva causa, ubicación y estado de retirada de obstáculos. Sectores de comisarios no son los tres sectores cronometrados. Reutilizar tráfico Q15 y emitir infracciones a R13. Probar escalada y limpieza de temporizadores sin que otro bloque vuelva a permitir adelantar. |
| **R10** | `SafetyCarModel.deploy/update`, `scEndingLap`, límites y adelantamientos de `RaceSimulation`, continuidad Q14. | Estado SC, coches autorizados a desdoblar y permiso de relanzamiento por coche; entrada/salida recorren ruta común sin spawn durante carrera. Mantener separado el perfil personalizado de mínimo urbano del perfil FIA propuesto. Probar reinicio de incidente durante retirada y estado del último coche, no solo del líder. |
| **R11** | `vscActive`, `vscTimer`, `vscDuration`, final VSC y `getMaxAllowedSpeed`. Hoy límite global de velocidad no equivale a delta reglamentario. | Referencia temporal por minisector/líneas, delta individual y ventana de anuncio→verde; mostrar motivo y tiempo debido. Estado bajo R09 y reloj R02. Probar que un coche lento no recibe avance/compactación para compensar y que el retraso final no depende del FPS. |
| **R12** | Bloque de roja en `advanceSimulation`, `StartLights`, ruta de aparcamiento Q14 y contrato de sesiones R20. Hoy asigna parrilla y salud al reanudar. | Snapshot de orden fiable, fase suspensión y trabajo permitido por coche; retorno físico y reanudación mediante el procedimiento elegido. No usar `initRace()` para reanudar ni borrar vueltas/recursos. Distinguir reloj de carrera, suspensión y espera de aviso; probar dos rojas consecutivas y coche ya en pit. |
| **R13** | No existe servicio completo de sanciones. Consumidores futuros: `RaceSimulation`, `PitStopModel`, `PodiumModal`, `Leaderboard`. | IDs de infracción/decisión/ejecución para idempotencia; separar provisional y definitivo. Contrato mínimo temprano para neumáticos/boxes/resultados, aun sin pantalla de comisarios completa. Probar imponer, servir y reclasificar una sola vez; la UI no edita directamente segundos ni posición. |
| **R14** | Núcleo combustible Q16, `FuelModel.updateFuel`, masa/rendimiento R05 y datos `teams.ts`. | Consumo por tiempo/carga, masa seca y combustible separados, muestra como obligación calculada (no suelo infinito). Motor pierde capacidad al agotarse; no retirar por un número mostrado redondeado. Probar último intervalo que consume el resto y retorno/muestra al final. Datos de densidad/flujo requieren fuente y unidad. |
| **R15** | Núcleo energético Q16, `EngineModel`, `CarState`/telemetría y reloj R02. | Libro por flujo y pérdidas, contadores por periodo reglamentario, estado de carga y potencia realmente disponible. Fronteras de vuelta y entrada a pit procesadas una vez; contador reseteado no crea carga. Aclarar alcance de energía H/K y salida parada con la tabla de 6.3. Integrar con frenada R16, no una animación de batería independiente. |
| **R16** | `EngineModel`, temperaturas y cálculo de marcha/telemetría en `RaceSimulation`, `IncidentModel`, visuales `CarRenderer`. | Resultado físico de demanda, temperatura y daño antes de integrar; fallos basados en estado/riesgo reproducible y no en un sorteo por frame. Frenos mecánicos y regeneración comparten demanda sin duplicarla. Reparaciones registradas por componente, sitio y tiempo; distinguir daño reparable de retirada obligatoria. |
| **R17** | `teams.ts` y consumidor `team.carPerformance` en motor; tabla inicial en 6.4. | Perfil versionado de chasis/PU/setup, parámetros con origen y efectos adversos además de ventajas. Resolver perfil una vez por coche/evento; evitar multiplicar rating antiguo y nuevo modelo a la vez. Bancos recta/curvas/stint con mismo piloto/semilla y diferencias que cambien por circuito de forma explicable. |
| **R18** | `Team` carece de catálogo de desarrollo; `HomeScreen` muestra atributos, no producción ni homologación. | Catálogo/paquetes, trabajos, fechas y unidades separados del coche instalado; política de parc fermé en R01/R20. Primero definir contratos de instalación/restricciones que necesita R20; economía y ATR completo después. Probar paquete para un solo coche y retraso sin aplicarlo retroactivamente a una carrera iniciada. |
| **R19** | No hay pool de componentes de temporada. Reutilizar componentes/daño R16, versiones R18 y resultados R21. | Serial, propietario piloto, usos, ciclos y penalizaciones independientes de rendimiento del componente. Primer uso y sustitución generan eventos idempotentes; conservar entre GPs/guardados. Probar unidad usada/extra, piloto sustituto y varias infracciones en mismo evento; no inventar cupos de una edición distinta. |
| **R20** | `StartLightState`, `startRaceSequence`, formación/parking/luces, `STARTING_GRID_ORDER`, HomeScreen. | Entregar primero tipo de sesión y procedimientos salida/reanudación reutilizables por R12; no esperar a terminar campeonato. Después clasificación/sprint y restricciones conectadas a R07/R13/R18. No confundir IDs de tareas Q1/Q2/Q3 con tandas de clasificación. Modo GP directo mantiene entrada rápida con origen de parrilla visible. |
| **R21** | `leaderFinished`, `isFinished`, `podiumCars`, `PodiumModal` y historial `f1_race_history` en `App`. | Separar cierre físico por coche, resultado provisional, aplicación de sanciones y resultado final. Primer bloque: carrera y puntos reglamentarios; después acumulación/desempate del campeonato. No usar podio provisional como resultado persistido definitivo; guardar identificador del evento/perfil. Probar doblado que acaba después del líder y corrección posterior. |
| **R22** | `TrackWeatherState` ya incluye agua/condición; `updateWeather` solo oscila temperatura/viento; visuales de charcos ya existen. | Servicio meteorológico único, inicialmente mínimo, con estado por tramo y escenario reproducible; devuelve temperatura/agua/visibilidad al grip y Dirección. Previsión derivada con incertidumbre y sin acceso del estratega al futuro. T3.2 amplía frentes/radar y T3.4 presentación sobre este mismo estado. Probar estabilidad temporal, pausa y cambio de circuito. |
| **R23** | Q1-Q5 existentes, Q7/Q8 pendientes; `TrackRenderer`, `CarRenderer`, `CarLabels`, `RaceCanvas`, minimapa/cámara. Q6 excluida. | Auditoría de coherencia entre estados R03-R16 y presentación sobre geometría existente; no rehacer Q3/Q4/Q5 ni incorporar escenarios Q6. DRS, daños, luces y agua consumen datos, sin producir reglas. Presupuesto visual con 20 coches, zoom/rotación y lluvia, comparación de coste en equipo y viewport declarados. Si faltan física/datos de una señal, no dibujar un efecto que afirme que existen. |
| **R24** | `DriverStatsSummary`, bloque stats/telemetría en `RaceSimulation`, `RightStatsPanel`, `TelemetryPanel`, `BottomTelemetryDock`, `Leaderboard`. | Registro de eventos R02/R09 más estado físico como única fuente. Distinguir valor medido, estimación y no disponible; eliminar porcentajes de Push/ahorro inventados y ganancias de parrilla contadas como adelantamientos. Probar mismo dato en paneles, prioridad/expiración de mensajes y reinicio de contadores. |
| **R25** | Órdenes Q9-Q13, decisión de parar en `PitStopModel`, heurística que fuerza `push` en motor. | Estratega lee snapshot e información observable, propone órdenes al mismo API que jugador; no escribe compuestos/recursos directamente. Prioridad del jugador y restricciones físicas/reglamentarias resueltas explícitamente. Probar forecast incierto, cancelación, compañero y dos paradas con la misma semilla, sin usar incidentes futuros. |
| **R26** | Resultado Q17, `D20LuckEvent`, `triggerD20LuckRoll`/`applyLuckEventReward`, `D20LuckModal`. | Configuración explícita de variante, catálogo legal e información sobre qué hace la recompensa. Reutilizar idempotencia/beneficios pendientes de Q17; apagar variante sin dejar bonos activos en perfil FIA. Comparar con/sin D20 a recursos iguales y comprobar texto frente a efecto consumido. |
| **R27** | `test-suite.mjs` y baseline 232 de Q5, fixtures de cada tarea nueva. | Infraestructura transversal desde R02: semilla, escenarios con eventos y métricas de error/continuidad/recursos. No esperar al final del sprint para escribir pruebas. Ejecutar tanto fixtures sintéticos como SVG reales en navegador; documentar qué se ha medido y en qué entorno. Hacer portable la ruta absoluta de suite cuando se aborde su infraestructura, sin mezclarlo con una tarea gráfica ajena. |
| **R28** | `initRace`, `setCircuit`, estado Q18; `localStorage` guarda historial de resultados, no snapshot de carrera. | Esquema versionado y validado con estado serializable, semilla/estado RNG, reloj y eventos; reconstruir geometría/cachés al cargar, no serializar canvas/timers. Guardar selección/preferencias aparte de físicas. Migración explícita o rechazo explicado; prueba guardar→cargar→continuar equivalente antes/durante/después de eventos clave. |

**Resolver dependencias sin declarar tareas enteras terminadas:** el orden de entregas es de producto, no una lista estricta de clases a escribir. A → contratos físicos/recursos B → carrera C → temporada D sigue vigente, con estos contratos mínimos adelantados dentro del bloque autorizado:

- Q19 requiere contratos de R01-R03; Q16 necesita núcleo de R14-R16. Si el alcance aprobado no permite esos mínimos, documentar el bloqueo y el refinamiento necesario; no simular cumplimiento con constantes inventadas.
- R13 debe exponer sanción/ejecución antes de R07/R08; la UI completa de comisarios puede llegar después. R20 debe exponer procedimientos de salida/reanudación antes de R12; no necesita toda la clasificación ni temporada para ello.
- R22 necesita parámetros de grip R06 y devuelve seguridad a R09/R12. Romper el ciclo aparente con un contrato de clima mínimo y escenarios seco/mojado; después integrar la política de suspensión. R18/R20 comparten un contrato de parc fermé antes de construir desarrollo y fin de semana completos.
- R02/R27 aportan reloj, RNG y fixtures desde el comienzo; R21 entrega clasificación de una carrera antes que campeonato; R28 define serialización/versiones antes de que aumente el estado persistente. Ninguno de estos acuerdos permite empezar otra tarea sin el alcance autorizado por el usuario.

---

## 🔮 7. SPRINT 3: AUDIO, TELEMETRÍA AVANZADA, RADAR GPS & CLIMA (4 TAREAS DEFINIDAS)

*(Planificado tras el Sprint 2.9. Coordinar con R22-R24: reutilizar estado de clima/telemetría y completar aquí presentación meteorológica, audio y radar avanzado.)*

**Corrección de inventario del 17/09/2026:** este documento solo contiene T3.1-T3.4. La cifra histórica de 16 no incluye doce fichas recuperables en el dashboard/index. Audio, radar avanzado y telemetría adicional son objetivos de épica pendientes de desglose, no doce tareas aprobadas implícitamente. Antes de añadirlas, definir UX, alcance, dependencias, aceptación e IDs únicos y sincronizar ambos documentos. No renumerar T3.1-T3.4 para cubrir ese hueco ni contar dos veces lo implementado en R22-R24.

### 🏗️ T3.1: Escapatorias vs Muros (Zonas de Severidad y Duración de SC)
* **T3.1 — Escapatorias vs Muros:** `[ ] PENDIENTE`
* **Requisito del Usuario:** *"Si es un choque contra el muro y es un circuito urbano, Safety Car mínimo 10 vueltas. Si es un circuito abierto y tiene escapatorias, tendremos que sacar el Safety Car durante 2 o 3 vueltas."*
* **Solución Técnica:**
  1. **Tipificación de Circuitos en `CircuitSpec`**:
     - Añadir `trackType: 'street' | 'permanent' | 'hybrid'`.
     - Monóco, Baku, Las Vegas, Marina Bay: `'street'` (muros pegados a la pista).
     - Barcelona, Silverstone, Spa, Red Bull Ring: `'permanent'` (amplias escapatorias de asfalto y grava).
  2. **Zonificación de Pista en `TrackDefinition`**:
     - Cada curva o sector tendrá un flag de contorno: `runoffType: 'wall' | 'gravel' | 'asphalt'`.
     - Curva con muro (ej. T16 de Barcelona, muro de campeones en Canadá): impacto directo.
     - Curva con escapatoria de asfalto: salida de pista con reincorporación (pérdida de 4-8s) sin neutralización o solo bandera amarilla local.
     - Curva con grava: coche encallado ➔ grúa necesaria ➔ VSC o SC corto (2-3 vueltas).
  3. **Cálculo Dinámico de Duración del SC**:
     - Si el accidente es contra muro (`runoffType === 'wall'` o circuito `'street'`):
       `sc.targetLaps = circuit.trackType === 'street' ? 10 + Math.floor(Math.random() * 3) : 4 + Math.floor(Math.random() * 3);`
     - Si hay escapatoria:
       `sc.targetLaps = 2 + Math.floor(Math.random() * 2);`
* **Estrategia de Test:** Test de incidentes en distintas coordenadas y tipos de circuito, comprobando que en circuitos callejeros con muro el SC programa mínimo 10 vueltas (10-12), mientras que en circuitos con escapatoria programa entre 2 y 3 vueltas.
* **Contexto de relevo:** `CircuitSpec` aún no tiene `trackType/runoffType`; `IncidentModel` registra tipo y sector y `SafetyCarModel.deploy` parte de 2–3 vueltas. Reutilizar superficies localizadas Q6, anchura Q7 y política central Q18/R09/R10; no mantener una segunda lista de circuitos urbanos en el renderer. El tipo de circuito sirve de fallback, pero la superficie del punto del incidente debe gobernar el caso cuando exista información.
* **Alcance vigente:** las fórmulas anteriores describen el perfil personalizado pedido por el usuario, no una duración mínima FIA. Conservar esa variante al añadir un perfil de seguridad reglamentario; la política de final real también debe considerar despeje, posición del pelotón y procedimientos R10. Los ejemplos de zonas y mapas se verifican por año antes de marcarlos como reales. Usar RNG del motor R02 y no un `Math.random()` nuevo cada frame.
* **Aceptación adicional:** incidente a cada lado de un límite de superficie, muro en permanente, asfalto en urbano, dos incidentes con requisitos distintos y escalada a roja. Registrar por qué se eligió duración/neutralización y asegurar que no se acorta por un timer anterior. Si Q18/R10 ya implementaron política/duración, aquí queda zonificación e integración, no repetir esas tareas.

---

### 🌧️ T3.2: Sistema Meteorológico Dinámico y Nubes Pasajeras
* **T3.2 — Sistema Meteorológico Dinámico y Nubes Pasajeras:** `[ ] PENDIENTE`
* **Solución Técnica:**
  1. **Simulación de Frentes Meteorológicos**:
     - Extender `TrackWeatherState` con evolución continua: `cloudCover` (0-100%), `rainIntensity` (0.0 a 1.0) y `waterDepthMm` (0.0 a 6.0 mm).
     - Probabilidad de lluvia configurada por circuito (ej. Spa 45%, Silverstone 35%, Barcelona 15%, Bahréin 0%).
     - Transición orgánica: Seco ➔ Nublado ➔ Llovizna (0.1-1.0 mm) ➔ Lluvia media (1.0-3.0 mm) ➔ Tormenta (> 3.0 mm) ➔ Secado de pista.
  2. **Secado Dinámico por la Trazada (Drying Line)**:
     - El paso continuo de los monoplazas dispersa el agua del asfalto, reduciendo `waterDepthMm` en la trazada ideal más rápido que fuera de ella.
* **Estrategia de Test:** Test de avance temporal meteorológico comprobando que la profundidad de agua se incrementa con lluvia y decrece cuando la lluvia cesa.
* **Contexto de relevo:** `TrackWeatherState` ya declara condición, agua, temperaturas, viento y previsión; `CircuitSpec` ya tiene `rainProbabilityPercent`. `RaceSimulation.updateWeather` actualmente solo oscila temperatura y viento. Las probabilidades Spa/Silverstone/etc. anteriores son ejemplos de calibración a contrastar con los datos existentes, no climatología acreditada.
* **Contrato de implementación:** ampliar el servicio único de R22 con frentes y agua por tramos/trazada, lluvia entrante, drenaje/evaporación y dispersión por paso de coches. Integrar con tiempo de simulación, conservar unidades y acotar agua; no secar por cantidad de frames. Previsión/radar muestran estimación, mientras jugador e IA desconocen el futuro exacto. La animación meteorológica no modifica la física.
* **Aceptación adicional:** lluvia localizada que llega a distintos tramos, cese y secado desigual, mismo resultado con igual semilla a velocidades distintas, pausa, reinicio y carga R28. No reiniciar toda la pista a mojada/seca al cambiar de etiqueta meteorológica. R22 aporta seguridad; R06/T3.3 grip; Q8 engomado y T3.4 presentación consumen el mismo estado.

---

### 🛞 T3.3: Compuestos Intermedios y Wet (Físicas de Agua)
* **T3.3 — Compuestos Intermedios y Wet:** `[ ] PENDIENTE`
* **Solución Técnica:**
   1. **Integración Oficial de Compuestos**:
      - `TireCompound`: `'soft' | 'medium' | 'hard' | 'intermediate' | 'wet'` (con badge/etiqueta 'inter' en UI).
      - `intermediate` (Intermedios - Verde Pirelli): temperatura óptima 70-90°C.
      - `wet` (Lluvia Extrema - Azul Pirelli): temperatura óptima 60-80°C.
  2. **Mecánica de Grip y Aquaplaning**:
     - Slicks en mojado (`waterDepthMm > 1.0`): grip cae al 35%, riesgo de trompo se multiplica por 10.
     - Intermedios en seco (`waterDepthMm < 0.5`): sobrecalentamiento (> 125°C) y desgaste x4 (destrucción en 3-4 vueltas).
     - Ventana de Crossover:
       - `0.0 - 0.5 mm`: Slicks (Soft/Med/Hard)
       - `0.5 - 2.5 mm`: Intermedios (Inter)
       - `> 2.5 mm`: Lluvia Extrema (Wet)
  3. **Estrategia de Paradas de la IA**:
     - Si empieza a llover y `waterDepthMm > 0.8 mm`, los monoplazas con slicks entran en masa a cambiar a Intermedios.
* **Estrategia de Test:** Test de rendimiento y cálculo de grip en función de `waterDepthMm` para slicks vs inter vs wet.
* **Contexto de relevo:** `TireCompound` ya contiene `intermediate/wet` y `TireModel` tiene propiedades/fallback para ellos (B3). No volver a añadir esos tipos ni afirmar soporte físico completo solo por existir el badge. Revisar primero qué han entregado R06/R07/R22 y qué falta del modelo de agua.
* **Contrato de implementación:** curvas continuas de agarre, evacuación de agua, temperatura y desgaste por compuesto; presión/carga/velocidad pueden influir. Los umbrales mm/°C y multiplicadores de esta ficha son calibración inicial, no datos normativos ni transiciones instantáneas. Añadir histéresis y previsión incierta a estrategia R25 para evitar llamadas alternas cada tick; respetar orden Q9 y stock R07.
* **Aceptación adicional:** barrido de agua alrededor de cada crossover, curva/recta, inter en seco y slick en mojado sin grip negativo/NaN. Calentamiento y desgaste persisten al volver al box; IA no cambia ruedas fuera del servicio ni obliga al jugador por conocer la evolución futura. Validar una transición seco→inter→wet→seco con dos pilotos y cola Q11.

---

### 💦 T3.4: Renderizado Visual de Pista Mojada y Spray
* **T3.4 — Renderizado Visual de Pista Mojada y Spray:** `[ ] PENDIENTE`
* **Solución Técnica:**
  1. **Asfalto Húmedo y Reflejos**: En `TrackRenderer.ts`, modular el color del asfalto haciéndolo más oscuro y brillante con la acumulación de agua.
  2. **Efecto Spray de Agua en Monoplazas**: En `CarRenderer.ts`, cuando `waterDepthMm > 0.5`, generar partículas de estela de agua semitransparentes detrás del alerón trasero proporcional a la velocidad.
* **Estrategia de Test:** Verificación de llamada a renderizado de partículas de spray cuando `waterDepthMm > 0.5`.
* **Contexto de relevo:** `TrackRenderer` ya oscurece asfalto y dibuja charcos con agua; revisar esas funciones antes de sumar otra capa. Implementar spray en `CarRenderer` o renderer de partículas con posiciones Q4 y agua local R22/T3.2; cámara/zoom no pueden desplazar el origen del efecto respecto al coche.
* **Contrato y aceptación ampliada:** densidad ligada a velocidad/agua, cero spray de coche parado o en superficie seca; vida de partículas por tiempo, límite de cantidad y reciclaje para 20 coches. Reflejos acotados al asfalto, sentido de estela correcto al rotar y visibilidad de etiquetas Q5 preservada. Probar seco/lluvia/secado, zoom/rotación y coste de frame comparado; no basta espiar que se llamó a una función. Consumo de azar visual separado del RNG físico para que activar efectos no cambie el resultado de carrera.

### 7.1 Sprint 4 y objetivos todavía sin ficha

**Estado real:** solo existe en el roadmap la épica «F1 Team Principal & Race Manager» y una estimación histórica de 12 tareas; no hay IDs, desglose ni aceptación suficientes para implementar ese sprint. Esta revisión no inventa doce requisitos ni autoriza desarrollarlos.

Al retomarlo, partir de lo que entreguen Q9-Q13 (muro dual), R17-R21 (perfiles, mejoras, piezas, sesiones y campeonato), R25 (estrategia) y R28 (guardado). Definir con el usuario qué profundidad adicional quiere: economía, personal, instalaciones, calendario u otras decisiones. Son opciones a concretar, no alcance comprometido. Cada ficha futura debe indicar decisión del director, recursos persistentes, calendario de efecto, feedback/UX, interacción con reglamento y prueba observable; no añadir conducción manual. Distinguir costes/plazos de diseño de cualquier norma financiera, que no está cubierta por los dos PDF aportados.

Para el audio aún sin ficha de Sprint 3, el punto de integración será el estado/eventos del motor y ciclo de vida React, con activación tras interacción del usuario, volumen/silencio y limpieza al salir. Para radar/telemetría avanzada, revisar `RightStatsPanel`, `TelemetryPanel` y R22/R24 antes de duplicar widgets; se debe decidir qué información nueva permite una decisión del muro. Todo desglose futuro debe actualizar este inventario y `index.html` mediante el sincronizador.

---

## 🧪 8. COMANDOS DE EJECUCIÓN Y VERIFICACIÓN

```bash
# Sincronizar y comprobar roadmap/tareas entre DASHBOARD.md e index.html:
npm run sync:tasks
npm run check:tasks

# Ejecutar suite de pruebas de simulación:
node test-suite.mjs

# Compilación TypeScript y empaquetado Vite:
npm run build
```
