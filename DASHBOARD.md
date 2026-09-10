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
| **Sprint 3** | **Track Layout & Weather (Escapatorias vs Muros, Lluvia, Charcos, Wet/Inter)** | 🟡 **REFINADO (Listo para validación)** |
| **Sprint 4** | **Radar GPS en Vivo, Docking de Telemetría Avanzada, Audio Espacial** | ⏳ **BACKLOG** |

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

## 🟡 5. REFINAMIENTO DEL SPRINT 3: TRACK LAYOUT & WEATHER DYNAMICS

*(El siguiente gran sprint tras limpiar la deuda técnica)*

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
       `sc.targetLaps = circuit.trackType === 'street' ? 6 + Math.floor(Math.random() * 4) : 4 + Math.floor(Math.random() * 3);`
     - Si hay escapatoria:
       `sc.targetLaps = 2 + Math.floor(Math.random() * 2);`
* **Estrategia de Test:** Test de incidentes en distintas coordenadas y tipos de circuito, comprobando que en circuitos callejeros con muro el SC programa entre 6 y 10 vueltas, mientras que en circuitos con escapatoria programa entre 2 y 3 vueltas.

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
     - Ampliar `TireCompound`: `'soft' | 'medium' | 'hard' | 'inter' | 'wet'`.
     - `inter` (Intermedios - Verde Pirelli): temperatura óptima 70-90°C.
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
