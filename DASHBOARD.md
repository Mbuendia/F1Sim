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

---

## 🧭 2. ROADMAP Y ESTADO GLOBAL DE SPRINTS

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
| **Sprint 2.8** | **Salto de Calidad: Fidelidad de Simulación, Geometría y Muro Táctico (Q1-Q18)** | 🟡 **REFINADO (Listo para validación del usuario)** |
| **Sprint 3** | **Audio, Telemetría Avanzada, Radar GPS & Clima (16 Subtareas)** | ⏳ **PLANIFICADO (A continuación de Sprint 2.8)** |
| **Sprint 4** | **Épica: F1 Team Principal & Race Manager (12 Subtareas)** | ⏳ **BACKLOG** |

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
* **B4 — Reset Estático `IncidentModel.reset()`:** `[x] COMPLETADO` Reinicio automático del contador de incidentes a 1 (Group 7 PASS).
* **B5 — Incidentes de Tipo `'spin'`:** `[x] COMPLETADO` Soporte completo con tiempo de resolución de 8-12s (Group 7 PASS).
* **B6 — Unificación `drsAvailable` y `drsEligible`:** `[x] COMPLETADO` Tipos alineados en `f1.ts`.
* **B7 — Clarificación `tireWear` vs `tireHealth`:** `[x] COMPLETADO` Porcentajes consistentes y alias complementarios en telemetría.

---

## 🎯 5. SPRINT 2.8: SALTO DE CALIDAD, GEOMETRÍA Y DECISIONES DE MURO (18 TAREAS)

*(Sprint de consolidación previa al Sprint 3: alineación de geometrías, eliminación de solapamientos, carril de boxes continuo y control táctico real del Team Principal)*

### 📐 Bloque A: Escala, Geometría y Cinemática Espacial (5 Tareas)
* **Q1 — Calibración de Escala de Monoplaza y Anchura Real de Pista (Anti-Solapamiento):** `[ ] PENDIENTE`
  * *Problema:* `CarRenderer.ts:34` y `RaceSimulation.ts:495`. Los coches se desplazan lateralmente demasiado poco para su ancho dibujado (`carWid = 6` vs `lateralOffset` estrecho), provocando solapamiento visual al rodar en paralelo.
  * *Solución:* Parametrizar la anchura de pista (`trackHalfWidth`) y el ancho del monoplaza para garantizar un margen transversal de seguridad (> `1.2 * carWid`) entre coches en paralelo.
  * *Test:* Verificación geométrica de que los bounding boxes no intersecan con `lateralOffset` opuestos.

* **Q2 — Carril de Boxes con Entrada/Salida Propias y Continuidad Física:** `[ ] PENDIENTE`
  * *Problema:* `svgTrackParser.ts:221`. El carril de boxes se genera desplazando puntos de la pista, incluidos los extremos, sin curvas de transición suaves (saltos al entrar y salir).
  * *Solución:* Generar splines dedicados de deceleración en entrada (`pitEntryT`) y aceleración en salida (`pitExitT`), empalmando tangencialmente con la pista principal sin discontinuidades de primer orden (`C1`).
  * *Test:* Comprobación de continuidad en derivadas `dx/dt`, `dy/dt` entre la pista principal y el carril de boxes.

* **Q3 — Geometría Diferenciada para Muro, Carril Rápido y Cajones de Boxes:** `[ ] PENDIENTE`
  * *Problema:* `TrackRenderer.ts:165`. El muro de boxes se dibuja sobre el centro del carril; los límites blancos reutilizan el centro de pista.
  * *Solución:* Construir geometrías separadas: 1) borde exterior de pista, 2) muro divisor de boxes, 3) carril rápido (fast lane de 80 km/h) y 4) zona de trabajo con los 10 cajones de parada.
  * *Test:* Comprobación de que las coordenadas del muro no colisionan con el carril rápido del pit lane.

* **Q4 — Coordenada Cartesiana Única (Unificación Pista vs Boxes):** `[ ] PENDIENTE`
  * *Problema:* `Camera.ts`, `CarRenderer.ts`, `Minimap`, detección de click en `App.tsx`. Cámara, minimapa y selección calculan la posición basándose en la pista principal aunque el coche esté en boxes.
  * *Solución:* Almacenar en `CarState` una posición cartesiana real única `(worldX, worldY)` calculada tanto en pista como en boxes, compartida idénticamente por `CarRenderer`, `Camera.followCar`, `Minimap` y hit-testing de click.
  * *Test:* Comprobación de que `Camera.targetX/Y` coincide exactamente con `(worldX, worldY)` del coche seleccionado durante toda la trayectoria de boxes.

* **Q5 — Corrección de Doble Zoom en Meta y Nivel de Detalle (LOD) de Etiquetas:** `[ ] PENDIENTE`
  * *Problema:* `TrackRenderer.ts:renderFinishLine`, `CarRenderer.ts`. La meta aplica el zoom dos veces (`scale * zoom`) creciendo desproporcionadamente. Las etiquetas de nombres saturan la pantalla.
  * *Solución:* Desacoplar medidas fijas del circuito (metros) del factor de zoom de pantalla. Implementar LOD: círculos/números minimalistas en vista general; etiquetas detalladas en zoom cercano únicamente para el coche seleccionado y batallas activas (< 0.8s).
  * *Test:* Verificar que las dimensiones de la línea de meta en píxeles de pantalla crecen de forma lineal con el zoom (no cuadrática).

### 🏛️ Bloque B: Identidad de Circuitos (Barcelona & Mónaco de Referencia) (3 Tareas)
* **Q6 — Escenario SVG por Capas con Identidad Real (Barcelona Permanente vs Mónaco Urbano):** `[ ] PENDIENTE`
  * *Problema:* Las pistas son genéricas (bandas uniformes de hierba, grava y pianos alrededor de toda la vuelta sin importar el circuito).
  * *Solución:* Estructura por capas: terreno base, escapatorias específicas (asfalto/grava en Barcelona vs muros contiguos sin grava en Mónaco), asfalto, pianos localizados en entradas/ápices/salidas, gradas y edificios emblemáticos.
  * *Test:* Verificación de que Mónaco no genera franjas de grava y Barcelona utiliza zonas de escapatoria amplia acordes a su especificación.

* **Q7 — Anchura de Pista Variable por Tramo y Capacidad de Adelantamiento:** `[ ] PENDIENTE`
  * *Problema:* Anchura constante en toda la pista limita o falsea adelantamientos.
  * *Solución:* Matriz de anchos de pista por tramo (`trackWidthMeters` en sectores del spline). Recta principal ancha (14m, hasta 3 coches en paralelo) vs curvas lentas o horquillas (8-10m, máximo 2 coches en paralelo).
  * *Test:* Cálculo de capacidad de monoplazas en paralelo en función de la anchura del sector actual.

* **Q8 — Trazada Ideal Engomada (Racing Line Exterior-Ápice-Exterior):** `[ ] PENDIENTE`
  * *Problema:* Coches se mueven referenciados únicamente al centro geométrico del trazado.
  * *Solución:* Trazada geométrica exterior-ápice-exterior precalculada para cada circuito. Acumulación progresiva de adherencia y engomado visual en la trazada seca vuelta a vuelta.
  * *Test:* Comprobación de que la adherencia aumenta en la trazada ideal durante una carrera en seco.

### 👔 Bloque C: Muro Táctico & Decisiones de Estrategia (100% Team Principal) (5 Tareas)
* **Q9 — Órdenes de Boxes Vinculantes (Compuesto Elegido por el Jugador):** `[ ] PENDIENTE`
  * *Problema:* `PitStopModel.ts`, el servicio puede sobrescribir el compuesto seleccionado aleatoriamente.
  * *Solución:* La elección del Team Principal (Soft, Medium, Hard, Intermediate, Wet) es absoluta y prioritaria; el modelo de boxes monta exactamente el compuesto ordenado y lo registra en el historial de stints.
  * *Test:* Llamada a boxes con compuesto específico (ej. 'hard') montando 'hard' en el 100% de los casos sin desvíos.

* **Q10 — Punto de Compromiso (Pit Commitment Line) y Cancelación de Parada:** `[ ] PENDIENTE`
  * *Problema:* No existe ventana delimitada de compromiso para anular una llamada a boxes.
  * *Solución:* Definir línea de compromiso (`pitCommitmentT = pitEntryT - 0.05`). Antes de este punto, el botón de boxes permite "Abortar / Stay Out"; rebasado el punto, la entrada es irreversible.
  * *Test:* Intentar cancelar parada antes y después de la línea de compromiso, validando el comportamiento esperado.

* **Q11 — Gestión Dual de Pilotos del Equipo & Parada Doble (Double Stack):** `[ ] PENDIENTE`
  * *Problema:* Falta de soporte táctico para ambos coches de la escudería en el muro.
  * *Solución:* Panel dual de control de pilotos en HUD; detección de parada doble simultánea bajo SC con penalización de retraso en cola (espera de 3 a 5 segundos para el segundo coche en el cajón).
  * *Test:* Dos coches entrando consecutivamente a boxes registrando el tiempo de espera adicional en el segundo monoplaza.

* **Q12 — Modos de Ritmo del Piloto (Pace Modes: Push, Balanced, Save):** `[ ] PENDIENTE`
  * *Problema:* Ausencia de órdenes de ritmo desde el muro para gestionar desgaste o consumo.
  * *Solución:* 3 modos tácticos: Push (+0.3s ritmo, +40% degradación y consumo), Balanced (estándar), Save (-0.4s ritmo, -30% degradación, refrigeración térmica y ahorro de combustible).
  * *Test:* Comparar desgaste de neumáticos y consumo de combustible tras 5 vueltas en Push vs Save.

* **Q13 — Predictor de Ventana de Reincorporación (Rejoin & Undercut Window):** `[ ] PENDIENTE`
  * *Problema:* El jugador no puede predecir el tráfico tras salir de boxes.
  * *Solución:* Proyectar en la Timing Tower y el Minimapa una marca de "Posición Estimada de Reincorporación" calculada restando el `pitLaneTimeLoss` (~22s) al tiempo del coche actual.
  * *Test:* Cálculo exacto de posición virtual de reincorporación frente a la clasificación en tiempo real.

### 🏎️ Bloque D: Físicas Orgánicas, Banderas y Consistencia de Simulación (5 Tareas)
* **Q14 — Eliminación de Asignaciones Directas de Posición en SC y Bandera Roja:** `[ ] PENDIENTE`
  * *Problema:* En SC y red flag existen saltos forzados de `progress`.
  * *Solución:* Realizar deceleraciones, agrupamiento y relanzamientos de forma 100% cinemática mediante velocidad, aceleración y distancia de seguridad sin alterar `progress` artificialmente.
  * *Test:* Simulación de parada en parrilla bajo bandera roja mediante deceleración suave hasta `speed = 0` sin saltos discretos en `progress`.

* **Q15 — Centralización de Reglas de Banderas Azules y Tráfico de Doblados:** `[ ] PENDIENTE`
  * *Problema:* Fallos de lógica entre la posición en vuelta y la proximidad física en pista.
  * *Solución:* Algoritmo unificado de banderas azules: cuando un coche con una o más vueltas de ventaja se encuentra a menos de 1.2s (delta métrico) detrás de un doblado, este último reduce su velocidad un 15% y se desplaza al exterior en recta.
  * *Test:* Doblado cediendo el paso de forma fluida ante la aproximación del líder.

* **Q16 — Modelo Dinámico de ERS, Combustible y Penalización Térmica en Agarre:** `[ ] PENDIENTE`
  * *Problema:* `RaceSimulation.ts:834`, batería estática al 85%, clamp de 0.5 kg en combustible, penalización térmica tardía.
  * *Solución:* Conectar el ERS al ciclo real (recuperación en frenada hasta 4MJ/vuelta, despliegue en aceleración), consumo continuo sin topes artificiales, y penalización térmica calculada directamente sobre el coeficiente de fricción de neumáticos.
  * *Test:* Comprobar fluctuación del nivel de batería entre 20% y 100% a lo largo de una vuelta de carrera.

* **Q17 — Rebalanceo del D20 de Suerte hacia el Reglamento FIA:** `[ ] PENDIENTE`
  * *Problema:* `RaceSimulation.ts:1262`, el D20 monta neumáticos nuevos mágicamente en pista sin parar en boxes.
  * *Solución:* Reemplazar la magia por ventajas de ingeniería y muro: 1) Parada en boxes perfecta asegurada (1.9s), 2) Eficiencia ERS +15%, 3) Ajuste de setup aerodinámico óptimo (+3 km/h en recta).
  * *Test:* Validar que el D20 ya no cambia los neumáticos de un monoplaza mientras rueda por la pista.

* **Q18 — Reconciliación de Dashboard, Timers de React y Reset Limpio:** `[ ] PENDIENTE`
  * *Problema:* `D20LuckModal.tsx:71`, `IncidentModel.reset()` no invocado en `initRace()`, fórmula de SC urbano produce 6-9 vueltas en vez de mínimo 10.
  * *Solución:* Ajustar targetLaps para SC urbano a mínimo 10 vueltas (`10 + Math.floor(Math.random() * 3)`); conectar `IncidentModel.reset()` en `initRace()`; estabilizar dependencias de hooks en `D20LuckModal` y `RaceSimulation`.
  * *Test:* Verificar que en circuito urbano el SC tiene `targetLaps >= 10` y que `IncidentModel.nextId` es 1 al reiniciar la carrera.

---

## 🔮 6. SPRINT 3: AUDIO, TELEMETRÍA AVANZADA, RADAR GPS & CLIMA (16 TAREAS)

*(Planificado para ejecución inmediata tras el Sprint 2.8)*

### 🏗️ T3.1: Escapatorias vs Muros (Zonas de Severidad y Duración de SC)
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

---

### 🌧️ T3.2: Sistema Meteorológico Dinámico y Nubes Pasajeras
* **Solución Técnica:**
  1. **Simulación de Frentes Meteorológicos**:
     - Extender `TrackWeatherState` con evolución continua: `cloudCover` (0-100%), `rainIntensity` (0.0 a 1.0) y `waterDepthMm` (0.0 a 6.0 mm).
     - Probabilidad de lluvia configurada por circuito (ej. Spa 45%, Silverstone 35%, Barcelona 15%, Bahréin 0%).
     - Transición orgánica: Seco ➔ Nublado ➔ Llovizna (0.1-1.0 mm) ➔ Lluvia media (1.0-3.0 mm) ➔ Tormenta (> 3.0 mm) ➔ Secado de pista.
  2. **Secado Dinámico por la Trazada (Drying Line)**:
     - El paso continuo de los monoplazas dispersa el agua del asfalto, reduciendo `waterDepthMm` en la trazada ideal más rápido que fuera de ella.
* **Estrategia de Test:** Test de avance temporal meteorológico comprobando que la profundidad de agua se incrementa con lluvia y decrece cuando la lluvia cesa.

---

### 🛞 T3.3: Compuestos Intermedios y Wet (Físicas de Agua)
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

---

### 💦 T3.4: Renderizado Visual de Pista Mojada y Spray
* **Solución Técnica:**
  1. **Asfalto Húmedo y Reflejos**: En `TrackRenderer.ts`, modular el color del asfalto haciéndolo más oscuro y brillante con la acumulación de agua.
  2. **Efecto Spray de Agua en Monoplazas**: En `CarRenderer.ts`, cuando `waterDepthMm > 0.5`, generar partículas de estela de agua semitransparentes detrás del alerón trasero proporcional a la velocidad.
* **Estrategia de Test:** Verificación de llamada a renderizado de partículas de spray cuando `waterDepthMm > 0.5`.

---

## 🧪 6. COMANDOS DE EJECUCIÓN Y VERIFICACIÓN

```bash
# Ejecutar suite de pruebas de simulación:
node C:/Users/Usuario/.gemini/antigravity/brain/1d588c5d-02ad-48dc-b465-762f65caa9f5/scratch/test-suite.mjs

# Compilación TypeScript y empaquetado Vite:
npm run build
```
