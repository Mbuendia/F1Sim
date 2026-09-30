# Brief: revisión de diseño y refactor UX/UI de F1Sim

> **Encargo para la IA revisora.** Revisa el diseño de esta web y propón (y, si se te autoriza, aplica) un refactor visual para hacerla más clara, legible y agradable de usar, **sin perder ninguna funcionalidad** ni tocar el motor de simulación. Lee entero este documento antes de empezar: al final están las restricciones que rompen el proyecto si se ignoran.

Estado de referencia: rama `main`, commit `ffe2094` (merge del Sprint 2.8, 30/09/2026). Repositorio: `https://github.com/Mbuendia/F1Sim`. Web publicada: `https://mbuendia.github.io/F1Sim/`.

---

## 1. Qué es

Simulador de F1 en el navegador desde el punto de vista del **Team Principal**. El jugador no conduce: elige piloto y circuito, ve la carrera en un Canvas 2D y da órdenes desde el muro (boxes, compuesto, ritmo). Temporada 2025–2026: 20 pilotos, 10 equipos, 23 circuitos con trazados SVG reales, pit lanes reales y zonas DRS oficiales FIA.

Público: aficionados a la F1 que quieren gestionar estrategia. Uso en escritorio (no hay versión móvil; la consulta móvil está planificada aparte como MOB01).

## 2. Stack y comandos

- React 19 + TypeScript 5.7 + Vite 6. Sin framework CSS: **CSS Modules** (`*.module.css`) + `src/index.css` global.
- Librerías: `lucide-react` (iconos), `animejs` 4 (animaciones), `three` (rueda 3D de la portada). Sin gestor de estado: `App.tsx` sondea el motor cada 66 ms y reparte props.
- Fuentes (Google Fonts en `index.html`): **Orbitron** (≈108 usos, casi todo el texto de interfaz), **Rajdhani** (≈61), **Inter** (base del contenedor).
- `base: '/F1Sim/'`.

```bash
npm install
npm run dev              # http://localhost:3000/F1Sim/
npm run build            # tsc + vite build (falla si DASHBOARD.md e index.html no están sincronizados)
npx vite preview         # build de producción en http://localhost:4173/F1Sim/
node test-suite.mjs --all              # suite completa (1313 PASS / 0 FAIL, 73 módulos)
node test-suite.mjs --module visual-icons   # un módulo
```

## 3. Estructura relevante para UI

```
src/
  App.tsx, App.module.css        # layout de carrera, sondeo del motor, atajos de teclado, modales
  index.css                      # reset global y fondo
  components/
    LandingPage        # portada: rueda 3D (F1Wheel3D), selector de compuestos, «ENTRAR AL PADDOCK»
    HomeScreen         # paddock: lista de 20 pilotos / 23 circuitos, ficha con pestañas, resumen, «ENTRAR A PISTA»
    Leaderboard        # torre de tiempos (izquierda): posiciones, flechas ▲▼, neumático, gap, PIT/QUEUE, fila fantasma de reincorporación
    RaceCanvas         # Canvas 2D del circuito (usa src/renderer/*), minimapa
    RaceHeader, SpeedControls, StartLights, RaceFlagsHUD   # vuelta/tiempo, velocidades 1x-32x, semáforo, banderas
    BoxControls, PaceControls   # «Muro»: órdenes de boxes, compuesto y ritmo para los DOS pilotos del equipo
    BottomTelemetryDock         # dock inferior: coche delante/detrás, piloto seguido, velocidad, chasis, ERS, DRS, modo
    RightStatsPanel             # panel derecho con pestañas: sectores, previsión de degradación, balance, historial de vueltas / radar GPS
    TelemetryPanel              # (no montado actualmente en App; sus piezas viven en el dock)
    D20LuckModal, DnfNotificationModal, PodiumModal
    CompoundBadge, CarChassisSvg, F1CarSilhouette, FlagIcon, F1Wheel3D, F1WheelSvg
  renderer/                     # dibujo del Canvas (pista, coches, etiquetas, minimapa, cámara)
  simulation/, data/, utils/    # MOTOR — fuera de alcance
```

## 4. Pantallas y flujo

1. **Portada** → rueda 3D + botón «ENTRAR AL PADDOCK».
2. **Paddock** → columna izquierda con pestañas *Pilotos (20)* / *Circuitos (23)*; centro con ficha del piloto (pestañas *Atributos & ficha*, *Estrategia & estilo*, *Rendimiento 2026*); derecha con la selección activa y «ENTRAR A PISTA».
3. **Carrera** (pantalla principal, 3 columnas a pantalla completa):
   - Izquierda fija 310 px: torre de tiempos.
   - Centro flexible: Canvas del circuito con capas superpuestas → barra superior (GPs, Overview/Follow, cámara, botones DEV «TEST SC» / «TEST RED FLAG», vuelta, velocidades, tiempo, reinicio), panel **Muro** flotante sobre el centro, **dock de telemetría** abajo, minimapa, banners (formación, SC…), semáforo.
   - Derecha fija 360 px: panel de estadísticas con pestañas.
   - Modales: dado D20 (con cuenta atrás de 6 s), abandono (DNF), podio.
4. **Atajos**: `Espacio` pausa, `1`–`6` velocidad (1x…32x), `C` modo de cámara, `Esc` deseleccionar coche. Clic en fila de la torre o en coche del Canvas = seguirlo.

## 5. Problemas de UX/UI ya detectados (punto de partida)

Revisión en local del 30/09/2026 y planificación del rediseño (tareas R29–R34 y R39 en `DASHBOARD.md`, sección 6, entrega E/F):

- **El Muro tapa el circuito** (R39): el panel de órdenes flota sobre el centro del Canvas y oculta el coche seguido y el Safety Car. Con torre (310 px) + panel derecho (360 px), a 1366 px queda poco circuito útil.
- **Tipografía**: Orbitron (display) usada en cifras y textos operativos de 9–11 px; difícil de leer. Objetivo acordado: letras decorativas solo en títulos, texto operativo ≥ 14 px de referencia (R33).
- **Sin sistema de diseño**: colores en hex repetidos por todos los CSS (≈59 `#ffffff`, 44 `#94a3b8`, 27 `#38bdf8`, 24 `#e10600` rojo F1, 14 `#ffd700`…); no hay tokens ni escala de espaciado/tamaños.
- **Jerarquía y densidad**: todo compite al mismo nivel; paneles laterales muy densos; información secundaria (historial, balance) siempre visible.
- **Estados de carrera** (R32): avisos y banners se superponen a controles; durante la formación el dock anuncia «LÍDER DE CARRERA (P1)» sin datos; botones DEV visibles en uso normal.
- **Accesibilidad** (R33): foco visible irregular, controles sin nombre accesible en algunos iconos, contraste por verificar, dependencia del color (compuestos, banderas).
- **Tamaños objetivo** (R30): 1024×768, 1366×768, 1440×900 y 1920×1080 sin recortes ni scroll horizontal.

Objetivo de producto acordado para el rediseño: **circuito protagonista, clasificación compacta y órdenes de ambos pilotos siempre accesibles**; telemetría detallada e historial en paneles desplegables que se pueden cerrar.

## 6. Qué se espera de la revisión

1. **Auditoría** por pantalla (portada, paddock, carrera, modales): problemas de jerarquía, legibilidad, espaciado, color, consistencia, accesibilidad y uso del espacio, priorizados.
2. **Propuesta de sistema visual**: tokens CSS (`:root` con colores, tipografía, espaciado, radios, sombras, z-index), escala tipográfica y reglas de uso de cada fuente.
3. **Propuesta de layout de carrera** para los 4 tamaños, con el circuito como protagonista y el Muro sin tapar el Canvas.
4. **Refactor incremental** (si se autoriza): primero tokens y tipografía, después layout, después componentes; cada paso con la suite en verde.

## 7. Restricciones (obligatorias)

- **No tocar el motor**: `src/simulation/**`, `src/data/**`, `src/utils/**` y la lógica de `src/renderer/**` (solo estilos de dibujo si se acuerda). El rediseño cambia presentación, no reglas ni física.
- **Ninguna función puede desaparecer ni quedar inaccesible**: todas las órdenes, atajos, selección de coche, cámara, velocidades, pausa/reinicio, modales y paneles deben seguir funcionando (R29 exige inventario función → acceso → prueba).
- **Contratos de test en la UI** (se renderizan en SSR y se comprueban). Mantener exactamente:
  - Atributos `data-*`: `data-compound`, `data-health`, `data-wheel`, `data-drs`, `data-car-silhouette`, `data-odometer`, `data-animate`, `data-ers-soc`, `data-ers-deploying`, `data-pos-change`, `data-pos-delta`, `data-pos-car`, `data-pit-status`, `data-rejoin-projection`, `data-rejoin-estimate`, `data-rejoin-car`, `data-rejoin-source`, `data-rejoin-reason`, `data-crew-benefit`, `data-d20-benefit`, `data-d20-recommendation`.
  - Clases globales: `position-change`, `pos-up`, `pos-down`, `pit-pulse`, `drs-open`, `drs-closed`.
  - `aria-label` existentes (p. ej. «Órdenes de boxes del equipo», «Compuesto para {código}», «Ritmo para {código}», chasis).
  - Textos comprobados: «ACEPTAR CONSEJO», «≈P{n}», «{código} TRAS BOXES», «Compuesto recomendado para la próxima parada», «orden de boxes», nombres de compuesto del `CompoundBadge`.
  - `App.tsx`: `<D20LuckModal key={activeLuckEvent.id} …>`, callbacks estables con `useCallback`, botón DEV usando `simulation.deploySafetyCar(...)` / `recallSafetyCar()`; `D20LuckModal` sin efectos dentro de actualizadores de estado (tests estructurales `modal-lifecycle`, `sc-deploy`).
  - Módulos de UI a ejecutar tras cada cambio: `visual-icons`, `visual-animations`, `visual-chassis`, `race-ui`, `box-ui`, `pace-ui`, `rejoin-ui`, `ers-energy`, `luck-modal`, `luck-benefits`, `modal-lifecycle`, `sc-deploy`; al final `--all` y `npm run build`.
- **Reglas del repositorio** (`AGENTS.md`): tests primero y acordados con el usuario; **nunca cambiar un test acordado sin autorización**; validar por módulo; `DASHBOARD.md` es la fuente de verdad del plan y debe quedar sincronizado con `index.html` (`npm run sync:tasks`).
- **Sin dependencias nuevas** salvo acuerdo (no añadir Tailwind ni librerías de componentes sin permiso). Mantener CSS Modules.
- Idioma de la interfaz: **español**.
- Trabajar en una rama nueva desde `main`, con commits pequeños por paso; PR a `main`.

## 8. Cómo revisarla visualmente

- `npm run dev` → `http://localhost:3000/F1Sim/` → «ENTRAR AL PADDOCK» → «ENTRAR A PISTA». La vuelta de formación arranca sola; al terminar aparece «CONFIRMAR INICIO DE CARRERA». Usa `6` (x32) para avanzar rápido y `1` para volver a tiempo real.
- «TEST SC» despliega el Safety Car (sale del pit lane); «TEST RED FLAG» provoca un incidente y suele abrir el modal D20.
- Si el navegador está en segundo plano, `requestAnimationFrame` se detiene y la carrera no avanza: revisar con la ventana visible.
