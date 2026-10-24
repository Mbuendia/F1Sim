# Graph Report - brave-mendeleev  (2026-10-23)

## Corpus Check
- Large corpus: 688 files · ~1,335,766 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 4882 nodes · 12303 edges · 194 communities (181 shown, 13 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 478 edges (avg confidence: 0.85)
- Token cost: 1,058,778 input · 0 output

## Community Hubs (Navigation)
- App principal y simulación
- Tests de carrera y banderas
- Carrera automática y equipos
- Pilotos, contratos y reserva
- Visor 3D de coches
- Trazados y circuito Barcelona
- Reglamento y notificaciones DNF
- Tests de React y carrera
- Menú de carrera y ajustes radio
- Referencias externas del App
- Intérprete de órdenes de radio
- Sala multijugador y clasificación
- Puente 3D del circuito
- Estado de gestión y personal
- Escenarios de clima
- Aerodinámica y rebufo
- Banco de respuestas de pilotos
- Cámara y lienzo de carrera
- Detalle visual del coche
- Paneles de gestión UI
- Reglas de neumáticos
- Tests con Node y auditoría radio
- Sesión de carrera en red
- Scripts de auditoría scratch
- Motor en Worker (N3)
- Componentes y penalizaciones
- Incidentes y banderas
- Resultados y sanciones
- Desarrollo del coche y HUD
- Escenografía 3D
- Máquina de enlace y órdenes
- Rediseño UI Sprint 2.9
- Evaluación del modelo de radio
- Calendario y campeonato
- DRS
- RaceCanvas y revisión de puente
- Controles de box
- Órdenes de box y semáforo
- Panel de radio del piloto
- Log suite N3
- Modelo local web-llm
- Enlace remoto Firebase
- Pronóstico del tiempo
- Agarre y permisos DRS
- Motor de audio
- Dataset del modelo de radio
- Configuración Firebase
- Catálogo de palabras clave
- Despliegue y flujo de trabajo
- Cámaras 3D
- Diseño visual Sprint 4
- Finanzas e informe de ronda
- Escenarios por circuito
- Auditoría Q12-Q19
- Instalaciones
- Tests de hosting y clasificador
- Clasificación en directo
- Brief de revisión UX/UI
- Carrera del invitado
- Log suite N5
- usage
- align circuit references
- scrollcraft
- scenery models
- Practice
- DASHBOARD
- Sponsors
- svgTrackParser
- Snapshot
- RaceCanvas top
- fakeDb
- scenario contract
- DASHBOARD (2)
- build dashboard
- RainForecastPanel
- CarChassisSvg
- Setup
- DASHBOARD (3)
- DASHBOARD (4)
- F1Wheel3D
- SprayParticles
- tsconfig
- DASHBOARD (5)
- multijugador
- scenery models (2)
- AGENTS
- DASHBOARD (6)
- DASHBOARD (7)
- package
- ResultsTable
- q20 apply redraw
- OvertakingZones
- DASHBOARD (8)
- DASHBOARD (9)
- svgPathSampler
- q20 redraw
- SeasonEndScreen
- systemVoice
- package (2)
- figura boxes
- RaceFormatSelect
- SaveGame
- capture 3d
- capture 3d b
- capture 3d c
- capture 3d d
- capture 3d e
- capture 3d f
- capture 3d g
- capture radio ia4
- capture suzuka
- capture yas
- eval ia10
- eval ia5
- q19 drs
- q20 align
- trackGeometry
- bench
- scenery models (3)
- AppErrorBoundary
- scenery models (4)
- build
- n3 run1
- capture radio ia5
- teamProfiles
- main
- capture bridge
- capture radio
- capture radio ia2
- circuitGeometry
- n3 box
- webllm radio test
- scenery models (5)
- capture screens
- eventData
- parody names
- eval ia10 q0f16
- Spy
- pit route
- f1 architecture rendered
- package (3)
- ers energy
- scenery 3d 3
- AGENTS (2)
- CONTEXT
- DASHBOARD (10)
- package (4)
- landing
- q19 apply
- g7 shift fixtures
- q20 circuits set
- scenery models (6)
- build dataset
- RenderPose
- analysis points
- blender build circuits
- g7 apply shift
- q20 fixture
- pace contract
- scenery 3d 2
- rooms rules n4
- n3 canvas
- LEEME
- units3
- scenery models (7)
- scenery 3d
- engine worker
- blocks
- combined v2
- q12 decompose
- q15 debug
- QualifyingResults
- modal lifecycle
- radio replies ia2
- rules n10
- scenery 3d 5
- q13 model
- build dataset (2)
- scenery 3d 4
- viewport movil
- CONTEXT (2)
- cdp peek
- build dataset (3)
- build dataset (4)
- backlog t421
- pdf view
- vite env d
- rule set
- weather fronts t32

## God Nodes (most connected - your core abstractions)
1. `RaceSimulation` - 204 edges
2. `App()` - 182 edges
3. `raceFactory()` - 165 edges
4. `react` - 147 edges
5. `CarState` - 109 edges
6. `TrackDefinition` - 68 edges
7. `react-dom` - 65 edges
8. `fixedRandom()` - 57 edges
9. `Camera` - 53 edges
10. `vite` - 52 edges

## Surprising Connections (you probably didn't know these)
- `row()` --indirect_call--> `CompoundBadge()`  [INFERRED]
  scratch/q21-preview.mjs → src/components/CompoundBadge.tsx
- `cars` --indirect_call--> `F1CarSilhouette()`  [INFERRED]
  scratch/q21-preview.mjs → src/components/F1CarSilhouette.tsx
- `cell()` --indirect_call--> `CarChassisSvg()`  [INFERRED]
  scratch/q22-preview.mjs → src/components/CarChassisSvg.tsx
- `small` --indirect_call--> `CarChassisSvg()`  [INFERRED]
  scratch/q22-preview.mjs → src/components/CarChassisSvg.tsx
- `Landing F1 Race Manager: La carrera se decide en el muro` --semantically_similar_to--> `F1 Race Manager`  [INFERRED] [semantically similar]
  public/landing/index.html → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Entradas de instrucciones por cliente que remiten a AGENTS.md** — claude_project_instructions, gemini_project_instructions, _github_copilot_instructions_project_instructions, agents_golden_test_rules, _ai_readme_quota_management [EXTRACTED 1.00]
- **Despliegue: juego en Firebase Hosting y landing en GitHub Pages** — _github_workflows_deploy_github_pages_workflow, _github_workflows_deploy_pages_solo_landing, _github_workflows_firebase_hosting_firebase_workflow, public_landing_index_landing_page [INFERRED 0.85]
- **Sincronización de tareas desde DASHBOARD.md** — agents_dashboard_workflow, agents_orden_vigente, index_project_task_index, dashboard_visual_project_status [INFERRED 0.85]
- **Cadena de documentos del rediseño de escritorio (brief → grill → referencias/playtest → plan)** — docs_design_brief_revision_ux_ui_brief, docs_design_grill_redesign_doc, docs_design_referencias_visuales_doc, docs_design_playtest_managers_doc, docs_design_plan_implementacion_ui_doc [EXTRACTED 1.00]
- **Diseño de transporte multijugador: anfitrión, WebRTC, respaldo Firebase y cuota Spark** — docs_multijugador_anfitrion_corre_motor, docs_multijugador_webrtc_directo, docs_multijugador_respaldo_firebase, docs_multijugador_plan_spark, docs_n1_viabilidad_respaldo_medido [INFERRED 0.85]
- **Artefactos de revisión de Q12–Q19 del Sprint 2.8** — docs_reviews_auditoria_q12_q19_doc, tests_audit_doc, tests_results_fix83_verification_doc, docs_reviews_revision_sprint_2_8_doc, docs_reviews_revision_sprint_2_8_review_page, docs_reviews_pr_sprint_2_8_doc [INFERRED 0.85]
- **N3 rival telemetry privacy across views and panels** — scratch_rv_state_carstate_heavy, scratch_rv_laps_public_laps_sectors, scratch_dock_n3_rival_telemetry_hidden, scratch_rsp_n3_rival_detail_hidden, scratch_rc_laps_lap_history_merge [INFERRED 0.85]
- **Radio model quantizations: evaluation and Hugging Face publishing** — scratch_eval_ia10_q0f16_f1_radio_0_5b_q0f16_mlc, scratch_eval_ia10_q4_f1_radio_0_5b_q4f16_1_mlc, scratch_subir_modelos_hf_upload_guide, scratch_subir_modelos_webllm [INFERRED 0.85]
- **Neutralizaciones reglamentarias (SC, VSC, roja, banderas)** — dashboard_q14_sc_cinematico, dashboard_r10_safety_car, dashboard_r11_vsc, dashboard_r12_bandera_roja, dashboard_r09_direccion_carrera, dashboard_q15_banderas_azules [INFERRED 0.85]
- **Pila de la carrera compartida (Worker, Zustand, WebRTC, Firebase)** — dashboard_n2_motor_worker, dashboard_n3_almacenes_zustand, dashboard_n4_salas_firebase, dashboard_n5_transporte, dashboard_firebase_realtime_database, dashboard_webrtc_stun [EXTRACTED 1.00]
- **Cadena de interpretación de la radio con respaldo a palabras clave** — dashboard_ia1_interprete, dashboard_ia5_webllm, dashboard_ia8_clasificador, dashboard_ia10_modelo_propio, dashboard_principio_ia_traduce [EXTRACTED 1.00]
- **Game loop: App ticks RaceSimulation, gets State, draws via Renderers** — f1_architecture_rendered_app, f1_architecture_rendered_race_simulation, f1_architecture_rendered_renderers [EXTRACTED 1.00]
- **RaceSimulation dependencies (models, math utils, static data)** — f1_architecture_rendered_race_simulation, f1_architecture_rendered_simulation_models, f1_architecture_rendered_math_utils, f1_architecture_rendered_static_data [EXTRACTED 1.00]
- **Engine host / race session message protocol** — scratch_n3_all_engine_host_n2, scratch_n3_all_race_session_n3, scratch_n3_all_ack_protocol, scratch_n3_all_fast_view_budget, scratch_n3_all_team_private_view [INFERRED 0.85]
- **Failures in the full run** — scratch_n3_all_fail_n3_devredflag, scratch_n3_all_fail_q14_dev_button, scratch_n3_all_total_results [EXTRACTED 1.00]
- **Multiplayer stack N2-N5 (engine host, session, rooms, transport)** — scratch_n5_all_engine_host_n2, scratch_n5_all_race_session_n3, scratch_n5_all_rooms_n4, scratch_n5_all_transport_n5 [INFERRED 0.85]
- **Five N5 transport failures** — scratch_n5_all_fail_retry_abandon, scratch_n5_all_fail_order_after_reload, scratch_n5_all_fail_lost_order_resend [EXTRACTED 1.00]

## Communities (194 total, 13 thin omitted)

### Community 0 - "App principal y simulación"
Cohesion: 0.04
Nodes (112): App(), CAMERA_LABELS, FLAG_CHIPS, FLAG_NOTICES, FREE_RACE_PADDOCK, newRaceSeed(), playerDriverIds(), TYRE_WORDS (+104 more)

### Community 1 - "Tests de carrera y banderas"
Cohesion: 0.04
Nodes (50): run(), run(), run(), run(), run(), run(), run(), run() (+42 more)

### Community 2 - "Carrera automática y equipos"
Cohesion: 0.04
Nodes (17): teamView, advanceAutoRace(), AUTO_RACE, autoRaceDone(), startAutoRace(), applyAttributes(), DriverAttributes, overtakeAdvantageNeeded() (+9 more)

### Community 3 - "Pilotos, contratos y reserva"
Cohesion: 0.05
Nodes (91): DriverAttributesCardProps, DriverContractsPanel(), perSeason(), Props, Facts(), hundred(), paceAt(), Props (+83 more)

### Community 4 - "Visor 3D de coches"
Cohesion: 0.05
Nodes (72): three, Car3DViewer(), Car3DViewerProps, Car3DViewer, CarShowcase(), CarShowcaseProps, supportsWebGL(), F1CarSilhouette() (+64 more)

### Community 5 - "Trazados y circuito Barcelona"
Cohesion: 0.05
Nodes (75): BARCELONA_CIRCUIT, BARCELONA_FIA_EXACT_POINTS, CornerMarker, pitLanePoints, points, CircuitReview(), IDS, Layer (+67 more)

### Community 6 - "Reglamento y notificaciones DNF"
Cohesion: 0.04
Nodes (67): DnfNotificationModalProps, LeaderboardProps, RunoffZone, DEFAULT_RULE_SET_ID, FIA_2025_VALUES, GAME_2025_VALUES, GAME_KEYS, GameKey (+59 more)

### Community 7 - "Tests de React y carrera"
Cohesion: 0.05
Nodes (24): react, react-dom, run(), source(), run(), run(), run(), run() (+16 more)

### Community 8 - "Menú de carrera y ajustes radio"
Cohesion: 0.04
Nodes (59): RaceMenu(), RaceMenuProps, RadioSettings, browserEstimate(), fromDevice(), RadioSettings(), RadioSettingsProps, realStores (+51 more)

### Community 9 - "Referencias externas del App"
Cohesion: 0.02
Nodes (5): CAMERA_LABELS, FLAG_CHIPS, FLAG_NOTICES, FREE_RACE_PADDOCK, TYRE_WORDS

### Community 10 - "Intérprete de órdenes de radio"
Cohesion: 0.06
Nodes (66): EngineOrder, INTENT_KINDS, keywordInterpreter, createFinetunedInterpreter(), finetunedParse(), keywords(), SCHEDULED_REASON, selectedIds() (+58 more)

### Community 11 - "Sala multijugador y clasificación"
Cohesion: 0.07
Nodes (65): QualifyingResults(), RaceFormatId, FIREBASE, GUEST_CONFIG, GuestRace(), playersOf(), RoomFlow(), stable() (+57 more)

### Community 12 - "Puente 3D del circuito"
Cohesion: 0.05
Nodes (52): bridgeRoadHeight(), DECK_HALF_M, DECK_HEIGHT_M, Pt, RAMP_M, SIDE_M, Sun, ASPHALT_DRY (+44 more)

### Community 13 - "Estado de gestión y personal"
Cohesion: 0.06
Nodes (65): ManagementState: estado único de la gestión, roleName(), StaffPanel(), isAcademy(), reserveSalary(), advanceAges(), Ages, agesFor() (+57 more)

### Community 14 - "Escenarios de clima"
Cohesion: 0.05
Nodes (27): DRY_DRAW, RAIN_DRAW, WEATHER_TESTS, WeatherScenarioId, ClientRaceReview(), post(), tick(), createEngine() (+19 more)

### Community 15 - "Aerodinámica y rebufo"
Cohesion: 0.05
Nodes (38): R05: aerodinámica, rebufo y adelantamiento físico, CarTechnical, chassisGripAt(), resolveTechnical(), AERO, AeroParams, CAR_DRY_MASS_KG, CORNER_MASS_EXPONENT (+30 more)

### Community 16 - "Banco de respuestas de pilotos"
Cohesion: 0.06
Nodes (48): Temperament, ALL, allLines(), BANK, btn, KINDS, Line, NAMES (+40 more)

### Community 17 - "Cámara y lienzo de carrera"
Cohesion: 0.08
Nodes (20): RaceCanvasProps, TrackDefinition, Camera, TrackRenderer, cloudShade(), dropCount(), DROPS, dryLineOpacity() (+12 more)

### Community 18 - "Detalle visual del coche"
Cohesion: 0.08
Nodes (42): RAIN_LIGHT_HZ, rearLight, safetyCarLightOn(), WHEEL_CIRCUMFERENCE_M, wheelMarkPhase(), buildCarDraws(), buildSafetyCarDraw(), CarDraw (+34 more)

### Community 19 - "Paneles de gestión UI"
Cohesion: 0.07
Nodes (46): BoardPanel(), ChampionshipTable(), DriverAttributesCard(), oneDecimal(), F1WheelSvg(), F1WheelSvgProps, Pips(), GameMenuScreen() (+38 more)

### Community 20 - "Reglas de neumáticos"
Cohesion: 0.07
Nodes (38): usedPracticeTyre(), chooseCompound(), STRATEGY, StrategyState, availableSets(), COMPOUND_LABEL, createInventory(), inventoryFromSets() (+30 more)

### Community 21 - "Tests con Node y auditoría radio"
Cohesion: 0.07
Nodes (22): bad, f, hold, files, swaps, car(), cars, compounds (+14 more)

### Community 22 - "Sesión de carrera en red"
Cohesion: 0.07
Nodes (25): RaceConfig, SharedInit, EngineLink, Ack, now(), RaceSession, StartOutcome, toDb() (+17 more)

### Community 23 - "Scripts de auditoría scratch"
Cohesion: 0.04
Nodes (18): vite, [circuit, format, step], picked, turn, f, right, toModel, wrongOk (+10 more)

### Community 24 - "Motor en Worker (N3)"
Cohesion: 0.06
Nodes (37): App.tsx N3 patch: race engine behind Worker link, restartEngine (engineEpoch bump), syncFromEngine (session.save then restoreSnapshot), raceCars sectors/lapHistory from public or own state, Public sectors and laps (times + compound, no wear), aheadInfo/behindInfo in public car view, carState() with HEAVY excluded fields (own-car state in view), CarView (+29 more)

### Community 25 - "Componentes y penalizaciones"
Cohesion: 0.09
Nodes (48): ComponentsPanel(), ComponentsPanelProps, aiReplace(), ALLOCATION, BACK_OF_GRID_PLACES, COMPONENT_LABEL, COMPONENT_TYPES, ComponentPenalty (+40 more)

### Community 26 - "Incidentes y banderas"
Cohesion: 0.08
Nodes (26): RaceFlagsHUDProps, DEFAULT_RULES, IncidentModel, DOUBLE_YELLOW_SPEED_FACTOR, LocalFlag, localFlagsFrom(), MARSHAL_SECTOR_COUNT, marshalSectorOf() (+18 more)

### Community 27 - "Resultados y sanciones"
Cohesion: 0.06
Nodes (25): R13: comisarios y sanciones ejecutables, CLASSIFIED_FRACTION, classify(), compareByResults(), ConstructorRow, constructorStandings(), EndReason, POINTS_2025 (+17 more)

### Community 28 - "Desarrollo del coche y HUD"
Cohesion: 0.08
Nodes (39): DevelopmentPanel(), DevelopmentPanelProps, STATUS_LABEL, Helmet(), ICONS, NextRace, StatusCard, Row() (+31 more)

### Community 29 - "Escenografía 3D"
Cohesion: 0.11
Nodes (47): getScenario(), barrierOffset(), Box, build(), buildBarriers(), buildPitBuilding(), cache, deepestPoint() (+39 more)

### Community 30 - "Máquina de enlace y órdenes"
Cohesion: 0.07
Nodes (21): LINK_TIMING, LinkAction, LinkMode, OrderInbox, acksPath(), DirectChannel, fastPath(), GuestTransportOptions (+13 more)

### Community 31 - "Rediseño UI Sprint 2.9"
Cohesion: 0.06
Nodes (29): Bloque R29–R34 (rediseño Sprint 2.9), R39: el Muro tapa el circuito, Tamaños objetivo 1024×768–1920×1080 (R30), Clasificación compacta de 20 pilotos, Rediseño de F1Sim — entrevista y decisiones, Entrevista GrillMe (cuatro rondas), Menú «Herramientas de desarrollo» (SC y bandera roja), Identidad visual grafito, marfil y rojo de acción (+21 more)

### Community 32 - "Evaluación del modelo de radio"
Cohesion: 0.07
Nodes (40): alwaysThere, base(), fpsDuring(), outcome(), OWN_KEYS, params, pct(), Phrase (+32 more)

### Community 33 - "Calendario y campeonato"
Cohesion: 0.09
Nodes (41): ChampionshipTableProps, CalendarRound, ORDER, SEASON_CALENDAR, SPRINT_VENUES, addRace(), ChampionshipRace, ChampionshipState (+33 more)

### Community 34 - "DRS"
Cohesion: 0.07
Nodes (34): DrsStatusBadgeProps, LABEL, decimal(), DRS_FLAP_SECONDS, DrsDetection, DrsReading, DrsState, drsStatus (+26 more)

### Community 35 - "RaceCanvas y revisión de puente"
Cohesion: 0.09
Nodes (34): RaceCanvas(), segmentAt(), BridgeReview(), cameraMode, clouds, q, raceTimeSec, zoom (+26 more)

### Community 36 - "Controles de box"
Cohesion: 0.10
Nodes (30): BoxControls(), CROSSOVER_LABEL, decimal(), ORDER_STATUS, CompoundBadge(), CompoundBadgeProps, DrsStatusBadge(), OPTIONS (+22 more)

### Community 37 - "Órdenes de box y semáforo"
Cohesion: 0.10
Nodes (17): PaintScene, StartLightsProps, commitmentT(), nextCrossing(), normalizeLap(), orderIsActive(), updateOrderCommitment(), PitStopModel (+9 more)

### Community 38 - "Panel de radio del piloto"
Cohesion: 0.08
Nodes (32): callChooser, RadioPanel(), STATUS_LABEL, useDriverCalls(), DEFAULT_DRIVER_RADIO, DRIVER_RADIO, driverRadio, radioNames() (+24 more)

### Community 39 - "Log suite N3"
Cohesion: 0.06
Nodes (42): Order acknowledgement protocol ({type:ack, seq, ok, reason}), box-orders (Q9, Q10): 65 PASS, Career T4.x modules (finance, costs, facilities, pit crew, sponsors, hub, board, academy, staff, practice), circuit-quality (G1): 347 PASS, contracts-t47 (T4.7): 198 PASS, documentation (Regla de Oro 6): 4 PASS, drs-detection (Q19): 16 PASS, drs-references (Q19): 141 PASS (+34 more)

### Community 40 - "Modelo local web-llm"
Cohesion: 0.08
Nodes (23): @mlc-ai/web-llm, CATALOG_VERSION, LoadProgress, Embedder, bank, classifierAi, key, loadVectors() (+15 more)

### Community 41 - "Enlace remoto Firebase"
Cohesion: 0.10
Nodes (5): fromDb(), RemoteLink, LinkMachine, OrderOutbox, GuestTransport

### Community 42 - "Pronóstico del tiempo"
Cohesion: 0.08
Nodes (25): weatherLayers, FORECAST, ForecastSector, ForecastSlot, normalize(), radarForecast(), SeenCell, seenRate() (+17 more)

### Community 43 - "Agarre y permisos DRS"
Cohesion: 0.06
Nodes (9): fitnessNoiseFactor(), wetGripFactor(), DrsPermissions, LineCrossing, lineCrossings(), TimingLine, TimingService, lapsToPitEntry() (+1 more)

### Community 44 - "Motor de audio"
Cohesion: 0.08
Nodes (18): AUDIO_LEVEL_LABEL, AUDIO_LEVELS, AUDIO_STORAGE_KEY, AudioContextLike, AudioEngine, parseAudioLevel(), AudioSnapshot, FLAG_SOUND (+10 more)

### Community 45 - "Dataset del modelo de radio"
Cohesion: 0.05
Nodes (32): A_FORMS, A_RE, ALL_NAMES, AT_LAP, B_FORMS, B_RE, base, COMPOUND_FORMS (+24 more)

### Community 46 - "Configuración Firebase"
Cohesion: 0.09
Nodes (26): firebase, HostStart, firebaseConfig, ConnectOptions, generateRoomCode(), ROOM_ALPHABET, ROOM_CODE_LENGTH, ROOM_LINK_PARAM (+18 more)

### Community 47 - "Catálogo de palabras clave"
Cohesion: 0.09
Nodes (32): BOX_WORDS, CANCEL_WORDS, COMPOUND_WORDS, DELEGATE_WORDS, GROUP_WORDS, Keyword, kw(), PACE_WORDS (+24 more)

### Community 48 - "Despliegue y flujo de trabajo"
Cohesion: 0.07
Nodes (32): Workflow Deploy to GitHub Pages, Variable PAGES_SOLO_LANDING, Proyecto Firebase f1sim-d5085, Workflow Deploy game to Firebase Hosting, Flujo de trabajo con DASHBOARD.md y sync:tasks, Línea **Orden vigente:** (tarea actual y siguiente), Punto de reanudación (19/10/2026), Piezas del Sprint 5: src/engine, src/state, src/net (+24 more)

### Community 49 - "Cámaras 3D"
Cohesion: 0.11
Nodes (24): CAMERA_LABELS, CameraMode3D, CameraView, CarPose, CENITAL_HEIGHT, cenitalGiroView(), cenitalView(), CHASE_DISTANCE (+16 more)

### Community 50 - "Diseño visual Sprint 4"
Cohesion: 0.11
Nodes (30): Autoguardado visible y menú «Partida», Carrera libre como modo aparte, Centro de gestión (Inicio, Carrera, Equipo, Fábrica, Finanzas, Temporada), Sprint 4 — diseño visual de la gestión: entrevista y decisiones, Elegir equipo (se elige equipo, no piloto), Fábrica: coche en el centro, proyectos e instalaciones, Finanzas: saldo, gráfica y libro, Iconos lucide-react (+22 more)

### Community 51 - "Finanzas e informe de ronda"
Cohesion: 0.13
Nodes (28): BalanceChart(), byKind(), FinancePanel(), balanceByRound(), balanceOf(), carriedForward(), closeFinanceSeason(), debtOf() (+20 more)

### Community 52 - "Escenarios por circuito"
Cohesion: 0.12
Nodes (25): Escenarios visuales por circuito (getScenario), barcelonaScenario, buildProfile(), calendarScenarios, profiles, VisualProfile, defaultScenario, monacoScenario (+17 more)

### Community 53 - "Auditoría Q12-Q19"
Cohesion: 0.14
Nodes (28): DASHBOARD.md (fuente de verdad del plan), Auditoría Q12–Q19 (Sprint 2.8), drsDetections, getRejoinProjection, Q12 Modos de ritmo, Q13 Predictor de reincorporación, Q14 Movimiento en neutralizaciones, Q15 Banderas azules (+20 more)

### Community 54 - "Instalaciones"
Cohesion: 0.14
Nodes (28): FacilitiesPanel(), HomeScreenProps, aiInvestFacilities(), allAt(), buildRounds(), FACILITIES, FacilitiesState, FACILITY_EFFECT (+20 more)

### Community 55 - "Tests de hosting y clasificador"
Cohesion: 0.11
Nodes (17): root, run(), walk(), run(), never(), run(), tick(), files() (+9 more)

### Community 56 - "Clasificación en directo"
Cohesion: 0.13
Nodes (24): fitOutline(), OutlinePoint, QualifyingLive(), formatLapTime(), GridSlot, QualiCompound, QualiCompounds, QualiFormat (+16 more)

### Community 57 - "Brief de revisión UX/UI"
Cohesion: 0.10
Nodes (18): Atajos de carrera (Espacio, 1–6, C, Esc), Brief: revisión de diseño y refactor UX/UI de F1Sim, F1Sim (simulador de Team Principal), MOB01 consulta móvil, Módulos de test de UI (visual-icons, race-ui, box-ui, pace-ui, luck-modal, sc-deploy…), Stack React 19 + TS + Vite + CSS Modules, D20LuckModal(), D20LuckModalProps (+10 more)

### Community 58 - "Carrera del invitado"
Cohesion: 0.11
Nodes (19): zustand, ClientRaceScreen(), LINK_TEXT, PauseRequestBanner(), SharedRaceEnd(), startNotice(), buildWeatherScenario(), CONFIG (+11 more)

### Community 59 - "Log suite N5"
Cohesion: 0.10
Nodes (28): circuit-quality (G1): 347 PASS, Direct (WebRTC/STUN) vs fallback (Firebase) link modes, documentation suite (Regla de Oro 6): dashboard/index sync, engine-host-n2 suite (N2): 39 PASS, FAIL N5: lost order not resent within 2 s / not applied once and acked, FAIL N5: first order after reload is not applied (direct and fallback), FAIL N5: retry that does not open in 5 s is not abandoned, Fast / slow / team views (+20 more)

### Community 60 - "usage"
Cohesion: 0.10
Nodes (17): RoomBackend, UsageMeter(), roomPaths, DirectConnector, DirectListener, createWebRtcConnector(), createWebRtcListener(), ICE_SERVERS (+9 more)

### Community 61 - "align circuit references"
Cohesion: 0.09
Nodes (12): f1-car.glb (Qvist_designs, CC BY 4.0), safety-car.glb (OUTPISTON, CC BY-NC-SA 4.0), Créditos: TUMFTM y MultiViewer API, root, root, MODELS, modules, args (+4 more)

### Community 62 - "scrollcraft"
Cohesion: 0.14
Nodes (23): dwell(), formatNum(), lerpRate(), lingerEase(), mixColor(), mount(), api, drawSeq() (+15 more)

### Community 63 - "scenery models"
Cohesion: 0.11
Nodes (15): billboard(), box(), building(), city_wall(), _hull(), mat(), paddock(), pavilion() (+7 more)

### Community 64 - "Practice"
Cohesion: 0.13
Nodes (23): ICON, PracticeLearned(), setupText(), TYRE_LIFE_LAPS, bySetup(), fastest(), PRACTICE, PRACTICE_PROGRAMS (+15 more)

### Community 65 - "DASHBOARD"
Cohesion: 0.09
Nodes (24): FIA 2025 F1 Sporting Regulations (Issue 5), FIA 2025 F1 Technical Regulations (Issue 3), MOB01: seguimiento móvil de solo lectura (sustituida por Sprint 5), Q16: ERS, combustible y penalización térmica, R01: perfil de reglas versionado y procedencia, R02: cronometraje por cruces y tráfico físico, R03: datos de evento y geometría con unidades, R07: juegos de neumáticos e inventario legal (+16 more)

### Community 66 - "Sponsors"
Cohesion: 0.14
Nodes (23): SponsorsPanel(), Terms(), GoalKind, goalMet(), goalText(), isDeal(), isObject(), isSponsors() (+15 more)

### Community 67 - "svgTrackParser"
Cohesion: 0.12
Nodes (19): BRAKE_LOOKAHEAD_M, DEFAULT_CURVATURE_GAIN, LAP_REFERENCE_NOTE, LAP_REFERENCE_PROVENANCE, LAP_REFERENCES, LapReference, AxisFrame, pitLaneClearance() (+11 more)

### Community 68 - "Snapshot"
Cohesion: 0.13
Nodes (23): CAR_PARTS, createSnapshot(), FLAG_STATES, Internal, isObject(), isUint32(), migrateSnapshot(), migrateV1() (+15 more)

### Community 70 - "fakeDb"
Cohesion: 0.23
Nodes (13): run(), run(), run(), run(), run(), run(), run(), clone() (+5 more)

### Community 72 - "DASHBOARD (2)"
Cohesion: 0.10
Nodes (22): G11: circuitos en 3D con Blender, G2: escala real, un metro por unidad, Motorsport Manager 2 (inspiración), Q7: anchura de pista variable y capacidad de adelantamiento, R22: clima físico mínimo y decisiones de seguridad, R43: fluidez de conducción en pantalla (interpolación de pose), R44: lluvia visible y radar meteorológico, R45: atributos de piloto y mejora entre carreras (+14 more)

### Community 73 - "build dashboard"
Cohesion: 0.12
Nodes (19): bySprint, clean(), closedSprints, detail, esc(), group(), index, markdown (+11 more)

### Community 74 - "RainForecastPanel"
Cohesion: 0.16
Nodes (15): RaceHeader(), RaceHeaderProps, cell, minutes(), RainForecastPanel(), RainForecastPanelProps, RightPanelTab, RightStatsPanel() (+7 more)

### Community 75 - "CarChassisSvg"
Cohesion: 0.19
Nodes (14): animejs, BottomTelemetryDock(), BottomTelemetryDockProps, CarChassisSvg(), CarChassisSvgProps, WheelId, WHEELS, TelemetryPanel() (+6 more)

### Community 76 - "Setup"
Cohesion: 0.17
Nodes (15): SHORT, SetupPanel(), SetupPanelProps, Setups, clamp(), GEARING_NOTE, isNeutralSetup(), NEUTRAL_SETUP (+7 more)

### Community 77 - "DASHBOARD (3)"
Cohesion: 0.11
Nodes (19): docs/design/grill-sprint4-visual.md (diseño de la gestión), R19: vida de componentes y cupos de temporada, Sprint 4: director de equipo, gestión entre carreras (T4.1-T4.24), T4.10: junta y objetivos de temporada, T4.11: cambio de temporada (invierno), T4.12: tiempo por circuito y neumático de salida, T4.17: pulido y limpieza, T4.18: maqueta navegable de la gestión (+11 more)

### Community 78 - "DASHBOARD (4)"
Cohesion: 0.18
Nodes (19): Alojamiento del modelo en Hugging Face con commit fijado, IA10: radio con el modelo propio ajustado (q0f16 / q4), IA1: catálogo de órdenes de radio e intérprete por palabras clave, IA2: respuestas de los pilotos y voz (Web Speech), IA3: obediencia del piloto según su carácter, IA4: ajustes de la radio y gestión del modelo (ModelStore), IA5: modelo de IA en el navegador con WebLLM (evaluación), IA6: voces Piper y órdenes por micro (Whisper) (+11 more)

### Community 79 - "F1Wheel3D"
Cohesion: 0.14
Nodes (13): chooseLandingCompound(), COMPOUND_COLORS, CompoundStorage, createBremboF1Caliper(), createCrossDrilledBrakeRotorTexture(), createSidewallDecalTexture(), createTreadBumpTexture(), F1Wheel3D() (+5 more)

### Community 80 - "SprayParticles"
Cohesion: 0.13
Nodes (5): SPRAY, SprayCar, SpraySystem, TrackLayerGL, sprayLevel()

### Community 81 - "tsconfig"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, isolatedModules, jsx, lib, module (+11 more)

### Community 82 - "DASHBOARD (5)"
Cohesion: 0.12
Nodes (11): Correcciones de auditoría C1-C7 y A1-A6 (SC, boxes, mutaciones), Comandos de verificación (sync:tasks, check:tasks, test-suite, build), Deuda técnica M1-M10 y B1-B7 (capas del monoplaza, desgaste por rueda, limpieza), F1 Simulator Dashboard & Plan de Implementación, Para valorar más adelante: grabaciones de audio, sesiones jugables, PWA sin internet, Roadmap y estado global de sprints, Sprint 1: trazado SVG Barcelona, core loop, timing tower, cámaras, Sprint 2: SC físico, undercut/overcut, monoplaza vectorial 2D (+3 more)

### Community 83 - "multijugador"
Cohesion: 0.14
Nodes (15): database.rules.json, El anfitrión corre el motor (Web Worker), Multijugador: puesta en marcha, prueba entre redes y consumo, Flujo firebase-hosting.yml (N11), Firebase como punto de encuentro (sala y señalización), Medidor de consumo ?medir, Plan gratuito Spark (100 conexiones, 1 GB, 10 GB/mes), Proyecto Firebase f1sim-d5085 (+7 more)

### Community 84 - "scenery models (2)"
Cohesion: 0.13
Nodes (11): biosfera(), cyl(), esfera(), _link(), pine(), torre_cota(), torre_eiffel(), torre_sakhir() (+3 more)

### Community 85 - "AGENTS"
Cohesion: 0.19
Nodes (11): Gestión de cuota y roles opcionales, Entradas del repositorio por herramienta (Codex, Claude, Gemini, Copilot, Cursor, Cline, Windsurf), Perfil de implementación (delegado), Perfil de planificación y coordinación, Perfil de tests (delegado), Perfil UX/UI (delegado), Disparador /graphify del skill graphify, Instrucciones de proyecto para GitHub Copilot (+3 more)

### Community 86 - "DASHBOARD (6)"
Cohesion: 0.15
Nodes (17): Firebase Realtime Database (salas, señalización y respaldo), N10: prueba entre redes y guía de puesta en marcha, N11: el juego en Firebase Hosting (f1sim-d5085.web.app), N12: landing de presentación en GitHub Pages, N1: prueba de viabilidad (Worker + WebRTC + cuotas Firebase), N2: motor en un Web Worker, foto del estado y órdenes como mensajes, N3: almacenes Zustand y pantalla de carrera leyendo de la foto, N4: salas en Firebase (+9 more)

### Community 87 - "DASHBOARD (7)"
Cohesion: 0.12
Nodes (17): Q10: línea de compromiso y cancelación de parada, Q11: gestión dual de pilotos y doble parada, Q13: predictor de ventana de reincorporación, Q15: banderas azules y tráfico de doblados, Q17: rebalanceo del D20 de suerte, Q19: DRS medido en detección y permiso persistente, Q1-Q5: escala, carril de boxes, geometría de muro, coordenada cartesiana única, LOD, Q21: iconos de neumático coherentes (absorbe Q24) (+9 more)

### Community 88 - "package"
Cohesion: 0.11
Nodes (15): name, private, type, version, firebase-tools, @huggingface/transformers, pixi.js, qrcode-generator (+7 more)

### Community 89 - "ResultsTable"
Cohesion: 0.18
Nodes (12): DriverProgressEntry, DriverProgressPanel(), DriverProgressPanelProps, PodiumModal(), PodiumModalProps, END_REASON, formatTime(), ResultsTable() (+4 more)

### Community 90 - "q20 apply redraw"
Cohesion: 0.12
Nodes (9): calendar, circuits, meta, R, refs, report, root, routes (+1 more)

### Community 91 - "OvertakingZones"
Cohesion: 0.17
Nodes (10): cache, computeOvertakingZones(), contains(), OvertakingZone, overtakingZonesOf(), referenceKmh(), zoneAt(), ZonePoint (+2 more)

### Community 92 - "DASHBOARD (8)"
Cohesion: 0.13
Nodes (14): G10: repaso de los 23 circuitos, G1: banco de medidas y página de revisión de circuitos, G3: eje suave y remuestreado, G4: bordes, asfalto y arcenes de una sola fuente, G5: trazada de mínima curvatura y coches que la siguen, G6: boxes fuera de la pista, G7: línea de meta y parrilla, G8: pista en WebGL (PixiJS) (+6 more)

### Community 93 - "DASHBOARD (9)"
Cohesion: 0.13
Nodes (14): Q14: SC y bandera roja sin asignaciones de posición, R10: SC, desdoblamiento y relanzamiento, R29-R34: rediseño de escritorio (paddock, muro, accesibilidad), Sprint 3.7: rediseño visual y adaptación a móvil y tableta (V1-V10), T4.13: entrenamientos libres, V10: Safety Car, recogida del pelotón, V1: base visual y auditoría repetible (__uiAudit), V2: carrera adaptada a móvil y tableta (RaceTabs) (+6 more)

### Community 94 - "svgPathSampler"
Cohesion: 0.24
Nodes (6): pitRoutesSvg(), arcPoints(), flattenSvgPath(), PathReader, Pt, sampleSvgPath()

### Community 95 - "q20 redraw"
Cohesion: 0.17
Nodes (9): catmullRomClosed(), centers, cumulative(), dist(), dtw(), osm, resampleClosed(), results (+1 more)

### Community 96 - "SeasonEndScreen"
Cohesion: 0.20
Nodes (10): GridPenaltyNoticeProps, detail(), points(), SeasonEndScreen(), SeasonEndScreenProps, SeasonHistory(), SeasonHistoryProps, withPoints() (+2 more)

### Community 97 - "systemVoice"
Cohesion: 0.15
Nodes (8): browserSpeaker(), createSystemSpeaker(), pickVoice(), Speaker, SynthLike, UtteranceCtor, UtteranceLike, VoiceLike

### Community 98 - "package (2)"
Cohesion: 0.14
Nodes (14): dependencies, animejs, firebase, @huggingface/transformers, lucide-react, @mlc-ai/web-llm, pixi.js, qrcode-generator (+6 more)

### Community 99 - "figura boxes"
Cohesion: 0.34
Nodes (13): crono(), montar(), colocar(), fotograma(), leer(), ordenar(), pintar(), reposo() (+5 more)

### Community 100 - "RaceFormatSelect"
Cohesion: 0.19
Nodes (9): lucide-react, RaceFormatSelect(), RaceFormatSelectProps, SpeedControlsProps, Segmented(), SegmentOption, ICONS, WeatherScenarioSelectProps (+1 more)

### Community 101 - "SaveGame"
Cohesion: 0.22
Nodes (5): App(), newRaceSeed(), playerDriverIds(), SaveStore, StorageLike

### Community 102 - "capture 3d"
Cohesion: 0.22
Nodes (12): chrome, errors, evaluate(), open(), run(), send(), shot(), size() (+4 more)

### Community 103 - "capture 3d b"
Cohesion: 0.22
Nodes (12): chrome, errors, evaluate(), open(), run(), send(), shot(), size() (+4 more)

### Community 104 - "capture 3d c"
Cohesion: 0.22
Nodes (12): chrome, errors, evaluate(), open(), run(), send(), shot(), size() (+4 more)

### Community 105 - "capture 3d d"
Cohesion: 0.22
Nodes (12): chrome, errors, evaluate(), open(), run(), send(), shot(), size() (+4 more)

### Community 106 - "capture 3d e"
Cohesion: 0.22
Nodes (12): chrome, errors, evaluate(), open(), run(), send(), shot(), size() (+4 more)

### Community 107 - "capture 3d f"
Cohesion: 0.22
Nodes (12): chrome, errors, evaluate(), open(), run(), send(), shot(), size() (+4 more)

### Community 108 - "capture 3d g"
Cohesion: 0.22
Nodes (12): chrome, errors, evaluate(), open(), run(), send(), shot(), size() (+4 more)

### Community 109 - "capture radio ia4"
Cohesion: 0.24
Nodes (13): base, chrome, evaluate(), open(), press(), run(), send(), shot() (+5 more)

### Community 110 - "capture suzuka"
Cohesion: 0.22
Nodes (12): chrome, errors, evaluate(), open(), run(), send(), shot(), size() (+4 more)

### Community 111 - "capture yas"
Cohesion: 0.22
Nodes (12): chrome, errors, evaluate(), open(), run(), send(), shot(), size() (+4 more)

### Community 112 - "eval ia10"
Cohesion: 0.22
Nodes (12): base, chrome, evaluate(), open(), run(), send(), shot(), size() (+4 more)

### Community 113 - "eval ia5"
Cohesion: 0.22
Nodes (12): base, chrome, evaluate(), open(), run(), send(), shot(), size() (+4 more)

### Community 114 - "q19 drs"
Cohesion: 0.19
Nodes (7): closedPolyline(), cum(), dist(), legend, out, pointAt(), resample()

### Community 115 - "q20 align"
Cohesion: 0.26
Nodes (11): apexes(), apply(), geo, icp(), median(), nearest(), pct(), project() (+3 more)

### Community 116 - "trackGeometry"
Cohesion: 0.19
Nodes (6): createTrackScale(), normalizeT(), Point, polylineLength(), trackInterval, TrackScale

### Community 117 - "bench"
Cohesion: 0.29
Nodes (11): run(), run(), ALL_SCENARIOS, BASELINE_PATH, compareToBaseline(), CONTINUOUS, CONTINUOUS_TOLERANCE, createBench() (+3 more)

### Community 118 - "scenery models (3)"
Cohesion: 0.26
Nodes (7): build_all(), build_car_lod(), casino(), clear(), finish(), prism(), scene()

### Community 119 - "AppErrorBoundary"
Cohesion: 0.19
Nodes (6): Punto de entrada de la app (#root, /src/main.tsx), AppErrorBoundary, name(), uiAudit, visible(), root

### Community 120 - "scenery models (4)"
Cohesion: 0.15
Nodes (6): floodlight(), foro_sol(), grandstand(), peralte(), the_wing(), torre_doncella()

### Community 121 - "build"
Cohesion: 0.15
Nodes (3): CHOICE, out, out

### Community 122 - "n3 run1"
Cohesion: 0.21
Nodes (12): Engine order kinds (devSafetyCar, devRedFlag, pause, speed, luckReward, luckClear, luckVariant, confirmStart, startSequence, dnfClear, endSuspended, confirmResult, weatherTest), sendOrder (EngineOrder to RaceSession), Documentation fail: dashboard and index aligned, engine-host-n2 test module (N2, 39 PASS), race-session-n3 test module (N3), R53 fail: weather panel shows radar forecast, N3 test suite run 1 (1085 PASS, 13 FAIL, 33 modules), T4.14 fail: app enables rival team orders and notices (+4 more)

### Community 123 - "capture radio ia5"
Cohesion: 0.24
Nodes (11): chrome, evaluate(), open(), requests, run(), send(), shot(), size() (+3 more)

### Community 124 - "teamProfiles"
Cohesion: 0.17
Nodes (11): CHASSIS_BLEND, HIGH_DOWNFORCE, LOW_DOWNFORCE, PackageId, PACKAGES, PowerUnit, ProfileValue, PU_BY_SUPPLIER (+3 more)

### Community 125 - "main"
Cohesion: 0.21
Nodes (9): bc, COLS, ICE, params, record(), rows, runClient(), runHost() (+1 more)

### Community 126 - "capture bridge"
Cohesion: 0.27
Nodes (11): chrome, evaluate(), open(), run(), send(), shot(), size(), sleep() (+3 more)

### Community 127 - "capture radio"
Cohesion: 0.29
Nodes (11): chrome, evaluate(), open(), run(), say(), send(), shot(), size() (+3 more)

### Community 128 - "capture radio ia2"
Cohesion: 0.29
Nodes (11): chrome, evaluate(), open(), run(), say(), send(), shot(), size() (+3 more)

### Community 129 - "circuitGeometry"
Cohesion: 0.29
Nodes (11): closedFrames(), closedLength(), closedRadii(), minimumCurvatureOffsets(), periodicInterpolate(), resampleClosed(), smoothClosed(), smoothPass() (+3 more)

### Community 130 - "n3 box"
Cohesion: 0.18
Nodes (4): content, t, spec, content

### Community 131 - "webllm radio test"
Cohesion: 0.31
Nodes (10): chrome, evaluate(), open(), run(), send(), shot(), size(), sleep() (+2 more)

### Community 132 - "scenery models (5)"
Cohesion: 0.18
Nodes (6): blob(), dune(), estadio(), fuente(), shanghai_bridge(), yas_hotel()

### Community 133 - "capture screens"
Cohesion: 0.31
Nodes (10): chrome, evaluate(), open(), run(), send(), shot(), size(), sleep() (+2 more)

### Community 134 - "eventData"
Cohesion: 0.20
Nodes (9): EVENT_DATA_IDS, EventData, EventLine, EventLineKind, inRange(), Provenance, PROVENANCES, UNIT (+1 more)

### Community 135 - "parody names"
Cohesion: 0.24
Nodes (10): BRANDS, DRIVER_NAMES, ENGINES, files(), REAL_DRIVERS, run(), stripComments(), SURNAMES (+2 more)

### Community 136 - "eval ia10 q0f16"
Cohesion: 0.22
Nodes (10): F1-Radio-0.5B-q0f16-MLC model, IA10 eval: F1-Radio-0.5B-q0f16-MLC (WebGPU), Radio intent classes (boxes, anular-boxes, ritmo-*, equipo-*, propuesta-*, delegar-*, ninguna, orden-doble), Reserva v3 holdout dataset (101 phrases), F1-Radio-0.5B-q4f16_1-MLC model, IA10 eval: F1-Radio-0.5B-q4f16_1-MLC (partial run), HF repo gooday89/F1-Radio-0.5B-q0f16-MLC (~1 GB), HF repo gooday89/F1-Radio-0.5B-q4f16_1-MLC (~290 MB) (+2 more)

### Community 137 - "Spy"
Cohesion: 0.36
Nodes (7): SetupCompare(), SpyPanel(), canSpy(), SPY, SPY_LABEL, SPY_LEVELS, SpyLevel

### Community 138 - "pit route"
Cohesion: 0.31
Nodes (9): centerAt(), CIRCUITS, circularDelta(), dist(), distanceToRoute(), median(), REFERENCE_CIRCUITS, references (+1 more)

### Community 139 - "f1 architecture rendered"
Cohesion: 0.25
Nodes (9): App.tsx (Game Loop & UI, React, frontend), Archify 2.17.0-dev.1 (diagram generator/viewer), F1 Simulator Architecture Diagram, Archify interactive viewer (route probe, semantic lens, radar, export), Math & Utils (carPosition, spline), RaceSimulation (Core Physics, 60 Hz), Renderers (Track, Car, Camera; Canvas), Simulation Models (Pit, SC, Tires) (+1 more)

### Community 140 - "package (3)"
Cohesion: 0.22
Nodes (9): devDependencies, @firebase/rules-unit-testing, firebase-tools, @types/node, @types/react, @types/react-dom, typescript, vite (+1 more)

### Community 141 - "ers energy"
Cohesion: 0.22
Nodes (4): run(), run(), run(), run()

### Community 142 - "scenery 3d 3"
Cohesion: 0.33
Nodes (8): glbInfo(), HOT, inside(), luminance(), median(), MOUNTAIN, run(), STREET_CLOSE

### Community 143 - "AGENTS (2)"
Cohesion: 0.25
Nodes (7): Revisión en navegador con iframe srcdoc y rAF sustituido, Doble bucle: React a ~15 FPS y requestAnimationFrame en RaceCanvas, Simulación: RaceSimulation y modelos en src/simulation, Módulos de test con server.ssrLoadModule, __uiAudit() para medir maquetación en navegador, Dirección de carrera (banderas, SC, VSC, roja, comisarios), Simular un Gran Premio

### Community 144 - "CONTEXT"
Cohesion: 0.25
Nodes (8): Aquaplaning, Escapatoria, Nubosidad, Radar, Perfil personalizado / perfil FIA 2025, Salida de pista, Trazada, Meteorología: celdas de lluvia, radar, agua, aquaplaning

### Community 145 - "DASHBOARD (10)"
Cohesion: 0.25
Nodes (8): Q18: reconciliación de timers y reset limpio, R06: cuatro neumáticos con temperatura, carga y desgaste, R28: guardado, reinicio y calidad de datos (snapshot), R48: cargar y continuar una partida (snapshot v2), Sprint 3: audio, telemetría, radar y clima (T3.1-T3.4), T3.1: escapatorias vs muros (duración del SC, Runoff.ts), T3.3: compuestos intermedio y wet (físicas de agua), T3.4: pista mojada y spray de partículas

### Community 146 - "package (4)"
Cohesion: 0.25
Nodes (8): scripts, build, check:tasks, dashboard, dev, prebuild, preview, sync:tasks

### Community 147 - "landing"
Cohesion: 0.36
Nodes (4): bloque(), fotograma(), progreso(), recorrido()

### Community 148 - "q19 apply"
Cohesion: 0.25
Nodes (6): crlf, file, fmt(), R, root, s

### Community 149 - "g7 shift fixtures"
Cohesion: 0.32
Nodes (6): after, before, KEYS, norm(), r4(), walk()

### Community 150 - "q20 circuits set"
Cohesion: 0.25
Nodes (3): commitment, s, out

### Community 151 - "scenery models (6)"
Cohesion: 0.25
Nodes (4): limb(), noria(), palm(), red_bull()

### Community 152 - "build dataset"
Cohesion: 0.32
Nodes (8): callForms(), cap(), maybeMoveName(), pick(), rand(), say(), teamContext(), valPhrases

### Community 153 - "RenderPose"
Cohesion: 0.36
Nodes (4): interpolatePose(), Pose, RenderInterpolator, shortestTurn()

### Community 154 - "analysis points"
Cohesion: 0.29
Nodes (7): Geometría: svgTrackParser a escala real (1 unidad = 1 m), Análisis de rectas de los 22 circuitos, Circuitos sin SVG (monza, silverstone, spa, red_bull_ring, …), Muestras x,y del trazado SVG cada 0.1 de t, Análisis de las tres rectas principales por circuito, 23 circuitos a escala real, Física: velocidad por radio, trazada de mínima curvatura, rebufo, neumáticos, ERS

### Community 155 - "blender build circuits"
Cohesion: 0.48
Nodes (3): build_circuits(), _linear(), _material()

### Community 156 - "g7 apply shift"
Cohesion: 0.38
Nodes (4): interval(), norm(), r4(), shifts

### Community 157 - "q20 fixture"
Cohesion: 0.29
Nodes (3): C, out, REASONS

### Community 158 - "pace contract"
Cohesion: 0.43
Nodes (4): run(), run(), run(), advance()

### Community 159 - "scenery 3d 2"
Cohesion: 0.48
Nodes (6): area(), glbInfo(), inside(), REAL_SPONSORS, run(), word()

### Community 160 - "rooms rules n4"
Cohesion: 0.60
Nodes (5): @firebase/rules-unit-testing, run(), startEmulator(), stopEmulator(), up()

### Community 161 - "n3 canvas"
Cohesion: 0.33
Nodes (5): at, bottom, o, orig, top

### Community 162 - "LEEME"
Cohesion: 0.33
Nodes (6): Q20 comparison: OSM pit lane vs track SVG overlays (8 circuits), buildTrackFromSvg, find-rels.cjs / dl-rels.cjs / build.cjs / meta.cjs / q20-fixture.cjs, Q20 pit-lane references from OpenStreetMap (tool pipeline), tests/fixtures/pit-lane-references.json, q20-align.mjs (fit OSM to buildTrackFromSvg track)

### Community 163 - "units3"
Cohesion: 0.33
Nodes (5): fv, host, o, place, sim

### Community 164 - "scenery models (7)"
Cohesion: 0.33
Nodes (3): flame_towers(), loft(), marina_bay_sands()

### Community 165 - "scenery 3d"
Cohesion: 0.60
Nodes (5): area(), footprint(), glbTriangles(), inside(), run()

### Community 166 - "engine worker"
Cohesion: 0.70
Nodes (3): makeView(), r(), tick()

### Community 167 - "blocks"
Cohesion: 0.40
Nodes (4): blocks, [file, changes], spec, t

### Community 168 - "combined v2"
Cohesion: 0.40
Nodes (3): MODEL_FAILS, notes, phrases

### Community 169 - "q12 decompose"
Cohesion: 0.50
Nodes (3): mean(), report(), undo

### Community 170 - "q15 debug"
Cohesion: 0.50
Nodes (4): a, b, frac(), mk()

### Community 171 - "QualifyingResults"
Cohesion: 0.70
Nodes (4): QualifyingResultsProps, GridChange, QualifyingResult, PitLaneStart

### Community 172 - "modal lifecycle"
Cohesion: 0.70
Nodes (4): dependencyArrays(), read(), run(), stateUpdaters()

### Community 173 - "radio replies ia2"
Cohesion: 0.60
Nodes (4): run(), SURNAMES, tick(), word()

### Community 174 - "rules n10"
Cohesion: 0.80
Nodes (4): run(), startEmulator(), stopEmulator(), up()

### Community 175 - "scenery 3d 5"
Cohesion: 0.40
Nodes (3): ICONS, MINIMUM, WATER

### Community 176 - "q13 model"
Cohesion: 0.83
Nodes (3): model(), run(), vTarget()

### Community 177 - "build dataset (2)"
Cohesion: 0.50
Nodes (4): addressee(), answerFor(), compoundIn(), mentioned()

### Community 178 - "scenery 3d 4"
Cohesion: 0.67
Nodes (3): EXPECTED_RUNOFF, luminance(), run()

### Community 179 - "viewport movil"
Cohesion: 0.67
Nodes (3): css(), run(), SCREENS

### Community 180 - "CONTEXT (2)"
Cohesion: 0.67
Nodes (3): Asistencia discreta, Consulta de detalle, Información esencial de carrera

### Community 182 - "build dataset (3)"
Cohesion: 0.67
Nodes (3): coreOf(), leaks(), v2Bodies

### Community 183 - "build dataset (4)"
Cohesion: 0.67
Nodes (3): example(), test2, test3

## Knowledge Gaps
- **192 isolated node(s):** `@types/animejs`, `@types/three`, `@types/node`, `@types/react`, `@types/react-dom` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1487 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Tests de React y carrera` to `App principal y simulación`, `Tests de carrera y banderas`, `Pilotos, contratos y reserva`, `Visor 3D de coches`, `Trazados y circuito Barcelona`, `Reglamento y notificaciones DNF`, `Menú de carrera y ajustes radio`, `Referencias externas del App`, `Spy`, `Sala multijugador y clasificación`, `ers energy`, `Banco de respuestas de pilotos`, `Paneles de gestión UI`, `Tests con Node y auditoría radio`, `Componentes y penalizaciones`, `Desarrollo del coche y HUD`, `Evaluación del modelo de radio`, `Calendario y campeonato`, `DRS`, `RaceCanvas y revisión de puente`, `Controles de box`, `Órdenes de box y semáforo`, `Panel de radio del piloto`, `QualifyingResults`, `Finanzas e informe de ronda`, `Clasificación en directo`, `Brief de revisión UX/UI`, `Carrera del invitado`, `backlog t421`, `usage`, `weather fronts t32`, `RaceCanvas top`, `fakeDb`, `RainForecastPanel`, `CarChassisSvg`, `Setup`, `F1Wheel3D`, `package`, `ResultsTable`, `SeasonEndScreen`, `RaceFormatSelect`, `AppErrorBoundary`?**
  _High betweenness centrality (0.304) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `App()` (e.g. with `.run()` and `projectCost()`) actually correct?**
  _`App()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@types/animejs`, `@types/three`, `@types/node` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App principal y simulación` be split into smaller, more focused modules?**
  _Cohesion score 0.03815426997245179 - nodes in this community are weakly interconnected._
- **Why does `RaceSimulation` connect `Carrera automática y equipos` to `App principal y simulación`, `Pilotos, contratos y reserva`, `Trazados y circuito Barcelona`, `Reglamento y notificaciones DNF`, `Sala multijugador y clasificación`, `Escenarios de clima`, `Aerodinámica y rebufo`, `Cámara y lienzo de carrera`, `Reglas de neumáticos`, `Sesión de carrera en red`, `Motor en Worker (N3)`, `RenderPose`, `Incidentes y banderas`, `Resultados y sanciones`, `DRS`, `RaceCanvas y revisión de puente`, `Órdenes de box y semáforo`, `engine worker`, `Pronóstico del tiempo`, `Agarre y permisos DRS`, `Carrera del invitado`, `Practice`, `Snapshot`, `RainForecastPanel`, `Setup`, `OvertakingZones`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `Tests de carrera y banderas` be split into smaller, more focused modules?**
  _Cohesion score 0.03864824495892457 - nodes in this community are weakly interconnected._
- **Why does `vite` connect `Scripts de auditoría scratch` to `units3`, `combined v2`, `q12 decompose`, `q15 debug`, `Dataset del modelo de radio`, `q13 model`, `q19 drs`, `Tests con Node y auditoría radio`, `Tests de hosting y clasificador`, `package`, `align circuit references`, `svgPathSampler`, `q20 redraw`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._