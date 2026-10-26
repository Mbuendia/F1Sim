# Graph Report - brave-mendeleev  (2026-10-26)

## Corpus Check
- 730 files · ~1,445,958 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 258 file(s) not represented in the graph (top: .meta 108, .glb 63, .css 46)

## Summary
- 5233 nodes · 13119 edges · 215 communities (195 shown, 20 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 494 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b896b2fc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Season.ts
- Tests de carrera y banderas
- RaceSimulation
- Pilotos, contratos y reserva
- carSprites3d.ts
- barcelonaTrack.ts
- fixedRandom
- Tests de React y carrera
- RadioSettings.tsx
- Referencias externas del App
- normalize.ts
- RoomFlow.tsx
- RaceScene3D.ts
- Costs.ts
- EngineHost
- RaceSimulation.ts
- Banco de respuestas de pilotos
- RaceCanvas.tsx
- Detalle visual del coche
- Management.ts
- Reglas de neumáticos
- Tests con Node y auditoría radio
- Sesión de carrera en red
- vite
- Motor en Worker (N3)
- Random.ts
- f1.ts
- TeamRadio.ts
- RoomScreens.tsx
- Escenografía 3D
- TrackRenderer.ts
- Rediseño UI Sprint 2.9
- ExampleInterpreter.ts
- PodiumModal.tsx
- TrackDefinition
- DriverDevelopment.ts
- BoxControls.tsx
- Runoff.ts
- RadioPanel.tsx
- Log suite N3
- RadioPanel.tsx
- piperVoice.ts
- CarState
- usage.ts
- .lapProfile
- Dataset del modelo de radio
- Development.ts
- Driver
- Despliegue y flujo de trabajo
- Cámaras 3D
- Diseño visual Sprint 4
- AiStatusBadge.tsx
- scenarioRegistry.ts
- Auditoría Q12-Q19
- LlmEngine.ts
- Tests de hosting y clasificador
- Clasificación en directo
- CarShowcase.tsx
- .lapFuelKg
- Log suite N5
- RadioEval.tsx
- ref_node_child_process
- scrollcraft
- scenery models
- Practice.ts
- DASHBOARD
- GuestTransport
- svgTrackParser.ts
- Finance.ts
- RaceCanvas top
- fakeDb
- scenario contract
- DASHBOARD (2)
- build dashboard
- .step
- BottomTelemetryDock.tsx
- ruleSets.ts
- DASHBOARD (3)
- DASHBOARD (4)
- PitCrew.ts
- Snapshot.ts
- tsconfig
- DASHBOARD (5)
- radioFilter.ts
- scenery models (2)
- AGENTS
- DASHBOARD (6)
- DASHBOARD (7)
- package
- driverCalls.ts
- q20 apply redraw
- OvertakingZones
- DASHBOARD (8)
- DASHBOARD (9)
- ref_node_child_process
- q20 redraw
- Multijugador: puesta en marcha, prueba entre redes y consumo
- HomeScreen.tsx
- package (2)
- figura boxes
- eventData.ts
- Career.ts
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
- F1Wheel3D.tsx
- trackGeometry
- bench
- scenery models (3)
- AppErrorBoundary
- scenery models (4)
- build
- n3 run1
- capture radio ia5
- sounds.ts
- main
- capture bridge
- capture radio
- capture radio ia2
- RightStatsPanel.tsx
- n3 box
- webllm radio test
- scenery models (5)
- capture screens
- download.ts
- parody names
- eval ia10 q0f16
- FreeRaceWizard.tsx
- pit route
- f1 architecture rendered
- package (3)
- WeatherModel.ts
- scenery 3d 3
- react
- CONTEXT
- RoomLive.tsx
- WeatherModel
- landing
- q19 apply
- g7 shift fixtures
- q20 circuits set
- scenery models (6)
- build dataset
- capture-radio-ia7.mjs
- SettingsScreen.tsx
- blender build circuits
- g7 apply shift
- q20 fixture
- Simulación: RaceSimulation y modelos en src/simulation
- scenery 3d 2
- rooms-rules-n4.mjs
- n3 canvas
- LEEME
- LapStrip.tsx
- scenery models (7)
- scenery 3d
- n1/engine.worker.ts
- blocks
- units3.mjs
- q12 decompose
- RenderPose.ts
- scripts
- modal lifecycle
- radio replies ia2
- RadioChain
- scenery 3d 5
- firebaseDb.ts
- build dataset (2)
- scenery 3d 4
- viewport movil
- CONTEXT (2)
- cdp peek
- build dataset (3)
- build dataset (4)
- combined-v2.mjs
- pdf view
- vite env d
- rules-n10.mjs
- AudioEngine
- R28: guardado, reinicio y calidad de datos (snapshot)
- kw-audit.mjs
- q15-debug.mjs
- team-orders-probe.mjs
- voice/runtime.ts
- ParamLike
- Wall.ts
- kw-holdout.mjs
- radio-ia1.mjs
- mon.mjs
- align-circuit-references.mjs
- finalize-models.mjs
- StorageLike
- WeatherForecast.ts
- q13-model.mjs
- Modelo propio de la radio: ciclo de mejora (IA7)
- piper-wasm.d.ts
- roomStore.ts
- SaveStore

## God Nodes (most connected - your core abstractions)
1. `RaceSimulation` - 209 edges
2. `App()` - 195 edges
3. `raceFactory()` - 167 edges
4. `react` - 160 edges
5. `CarState` - 108 edges
6. `react-dom` - 72 edges
7. `TrackDefinition` - 68 edges
8. `fixedRandom()` - 57 edges
9. `Camera` - 53 edges
10. `vite` - 53 edges

## Surprising Connections (you probably didn't know these)
- `row()` --indirect_call--> `CompoundBadge()`  [INFERRED]
  scratch/q21-preview.mjs → src/components/CompoundBadge.tsx
- `cars` --indirect_call--> `F1CarSilhouette()`  [INFERRED]
  scratch/q21-preview.mjs → src/components/F1CarSilhouette.tsx
- `cell()` --indirect_call--> `CarChassisSvg()`  [INFERRED]
  scratch/q22-preview.mjs → src/components/CarChassisSvg.tsx
- `small` --indirect_call--> `CarChassisSvg()`  [INFERRED]
  scratch/q22-preview.mjs → src/components/CarChassisSvg.tsx
- `Tests de React como renderizado SSR` --semantically_similar_to--> `Limitación: suite sin entorno DOM (solo SSR)`  [INFERRED] [semantically similar]
  tests/README.md → docs/reviews/auditoria-q12-q19.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Entradas de instrucciones por cliente que remiten a AGENTS.md** — claude_project_instructions, gemini_project_instructions, _github_copilot_instructions_project_instructions, agents_golden_test_rules, _ai_readme_quota_management [EXTRACTED 1.00]
- **Cadena de interpretación de la radio con respaldo a palabras clave** — dashboard_ia1_interprete, dashboard_ia5_webllm, dashboard_ia8_clasificador, dashboard_ia10_modelo_propio, dashboard_principio_ia_traduce [EXTRACTED 1.00]
- **Pila de la carrera compartida (Worker, Zustand, WebRTC, Firebase)** — dashboard_n2_motor_worker, dashboard_n3_almacenes_zustand, dashboard_n4_salas_firebase, dashboard_n5_transporte, dashboard_firebase_realtime_database, dashboard_webrtc_stun [EXTRACTED 1.00]
- **Cadena de documentos del rediseño de escritorio (brief → grill → referencias/playtest → plan)** — docs_design_brief_revision_ux_ui_brief, docs_design_grill_redesign_doc, docs_design_referencias_visuales_doc, docs_design_playtest_managers_doc, docs_design_plan_implementacion_ui_doc [EXTRACTED 1.00]
- **Failures in the full run** — scratch_n3_all_fail_n3_devredflag, scratch_n3_all_fail_q14_dev_button, scratch_n3_all_total_results [EXTRACTED 1.00]
- **RaceSimulation dependencies (models, math utils, static data)** — f1_architecture_rendered_race_simulation, f1_architecture_rendered_simulation_models, f1_architecture_rendered_math_utils, f1_architecture_rendered_static_data [EXTRACTED 1.00]
- **Game loop: App ticks RaceSimulation, gets State, draws via Renderers** — f1_architecture_rendered_app, f1_architecture_rendered_race_simulation, f1_architecture_rendered_renderers [EXTRACTED 1.00]
- **Five N5 transport failures** — scratch_n5_all_fail_retry_abandon, scratch_n5_all_fail_order_after_reload, scratch_n5_all_fail_lost_order_resend [EXTRACTED 1.00]
- **Neutralizaciones reglamentarias (SC, VSC, roja, banderas)** — dashboard_q14_sc_cinematico, dashboard_r10_safety_car, dashboard_r11_vsc, dashboard_r12_bandera_roja, dashboard_r09_direccion_carrera, dashboard_q15_banderas_azules [INFERRED 0.85]
- **Sincronización de tareas desde DASHBOARD.md** — agents_dashboard_workflow, agents_orden_vigente, index_project_task_index, dashboard_visual_project_status [INFERRED 0.85]
- **Despliegue: juego en Firebase Hosting y landing en GitHub Pages** — _github_workflows_deploy_github_pages_workflow, _github_workflows_deploy_pages_solo_landing, _github_workflows_firebase_hosting_firebase_workflow, public_landing_index_landing_page [INFERRED 0.85]
- **Diseño de transporte multijugador: anfitrión, WebRTC, respaldo Firebase y cuota Spark** — docs_multijugador_anfitrion_corre_motor, docs_multijugador_webrtc_directo, docs_multijugador_respaldo_firebase, docs_multijugador_plan_spark, docs_n1_viabilidad_respaldo_medido [INFERRED 0.85]
- **N3 rival telemetry privacy across views and panels** — scratch_rv_state_carstate_heavy, scratch_rv_laps_public_laps_sectors, scratch_dock_n3_rival_telemetry_hidden, scratch_rsp_n3_rival_detail_hidden, scratch_rc_laps_lap_history_merge [INFERRED 0.85]
- **Radio model quantizations: evaluation and Hugging Face publishing** — scratch_eval_ia10_q0f16_f1_radio_0_5b_q0f16_mlc, scratch_eval_ia10_q4_f1_radio_0_5b_q4f16_1_mlc, scratch_subir_modelos_hf_upload_guide, scratch_subir_modelos_webllm [INFERRED 0.85]
- **Engine host / race session message protocol** — scratch_n3_all_engine_host_n2, scratch_n3_all_race_session_n3, scratch_n3_all_ack_protocol, scratch_n3_all_fast_view_budget, scratch_n3_all_team_private_view [INFERRED 0.85]
- **Multiplayer stack N2-N5 (engine host, session, rooms, transport)** — scratch_n5_all_engine_host_n2, scratch_n5_all_race_session_n3, scratch_n5_all_rooms_n4, scratch_n5_all_transport_n5 [INFERRED 0.85]
- **Artefactos de revisión de Q12–Q19 del Sprint 2.8** — docs_reviews_auditoria_q12_q19_doc, tests_audit_doc, tests_results_fix83_verification_doc, docs_reviews_revision_sprint_2_8_doc, docs_reviews_revision_sprint_2_8_review_page, docs_reviews_pr_sprint_2_8_doc [INFERRED 0.85]

## Communities (215 total, 20 thin omitted)

### Community 0 - "Season.ts"
Cohesion: 0.04
Nodes (131): App(), CAMERA_LABELS, FLAG_CHIPS, FLAG_NOTICES, newRaceSeed(), playerDriverIds(), SettingsScreen, TYRE_WORDS (+123 more)

### Community 1 - "Tests de carrera y banderas"
Cohesion: 0.04
Nodes (45): run(), run(), run(), run(), run(), run(), run(), run() (+37 more)

### Community 2 - "RaceSimulation"
Cohesion: 0.05
Nodes (16): CarTechnical, teamView, advanceAutoRace(), AUTO_RACE, autoRaceDone(), startAutoRace(), technicalWith(), applyAttributes() (+8 more)

### Community 3 - "Pilotos, contratos y reserva"
Cohesion: 0.07
Nodes (69): DriverContractsPanel(), Helmet(), perSeason(), Props, Facts(), hundred(), paceAt(), Props (+61 more)

### Community 4 - "carSprites3d.ts"
Cohesion: 0.08
Nodes (52): three, Car3DViewer(), Car3DViewerProps, SafetyCar3D(), DEFAULT_LIVERY, LIVERIES, Livery, liveryFor() (+44 more)

### Community 5 - "barcelonaTrack.ts"
Cohesion: 0.06
Nodes (65): BARCELONA_CIRCUIT, BARCELONA_FIA_EXACT_POINTS, pitLanePoints, points, CircuitReview(), IDS, Layer, LAYERS (+57 more)

### Community 6 - "fixedRandom"
Cohesion: 0.07
Nodes (29): run(), run(), run(), run(), run(), run(), run(), run() (+21 more)

### Community 7 - "Tests de React y carrera"
Cohesion: 0.04
Nodes (15): react, react-dom, cars, compounds, row(), cases, cell(), small (+7 more)

### Community 8 - "RadioSettings.tsx"
Cohesion: 0.05
Nodes (64): browserEstimate(), CorrectionsSettings(), fromDevice(), MicSettings(), ModelBlock(), previousStores, RadioSettings(), RadioSettingsProps (+56 more)

### Community 9 - "Referencias externas del App"
Cohesion: 0.02
Nodes (5): CAMERA_LABELS, FLAG_CHIPS, FLAG_NOTICES, FREE_RACE_PADDOCK, TYRE_WORDS

### Community 10 - "normalize.ts"
Cohesion: 0.16
Nodes (15): fail(), findHits(), findMentions(), interpretSync(), filterReply(), isBanned(), REAL, VETOED (+7 more)

### Community 11 - "RoomFlow.tsx"
Cohesion: 0.08
Nodes (47): HostStart, playersOf(), RoomFlow(), stable(), Waiting(), LobbyMember, LobbyPhase, metaPath() (+39 more)

### Community 12 - "RaceScene3D.ts"
Cohesion: 0.06
Nodes (48): bridgeRoadHeight(), DECK_HALF_M, DECK_HEIGHT_M, Pt, RAMP_M, SIDE_M, Sun, BLUE (+40 more)

### Community 13 - "Costs.ts"
Cohesion: 0.07
Nodes (58): ComponentsPanel(), aiReplace(), ALLOCATION, applyGridPenalties(), BACK_OF_GRID_PLACES, COMPONENT_LABEL, COMPONENT_TYPES, ComponentPenalty (+50 more)

### Community 14 - "EngineHost"
Cohesion: 0.06
Nodes (25): WEATHER_TESTS, ClientRaceReview(), post(), tick(), createEngine(), EngineInit, CAR_ORDERS, Compliance (+17 more)

### Community 15 - "RaceSimulation.ts"
Cohesion: 0.05
Nodes (60): R05: aerodinámica, rebufo y adelantamiento físico, CHASSIS_BLEND, chassisGripAt(), HIGH_DOWNFORCE, LOW_DOWNFORCE, PackageId, PACKAGES, PowerUnit (+52 more)

### Community 16 - "Banco de respuestas de pilotos"
Cohesion: 0.08
Nodes (37): Temperament, ALL, allLines(), BANK, btn, KINDS, Line, NAMES (+29 more)

### Community 17 - "RaceCanvas.tsx"
Cohesion: 0.10
Nodes (30): PaintScene, RaceCanvas(), segmentAt(), BridgeReview(), cameraMode, clouds, q, raceTimeSec (+22 more)

### Community 18 - "Detalle visual del coche"
Cohesion: 0.08
Nodes (42): CameraMode, RAIN_LIGHT_HZ, rearLight, safetyCarLightOn(), WHEEL_CIRCUMFERENCE_M, wheelMarkPhase(), buildCarDraws(), buildSafetyCarDraw() (+34 more)

### Community 19 - "Management.ts"
Cohesion: 0.04
Nodes (89): ManagementState: estado único de la gestión, Pips(), roleName(), StaffPanel(), isAcademy(), advanceAges(), Ages, agesFor() (+81 more)

### Community 20 - "Reglas de neumáticos"
Cohesion: 0.05
Nodes (48): SPRINT_VENUES, WeekendState, chooseCompound(), STRATEGY, StrategyState, allocationSets(), availableSets(), COMPOUND_LABEL (+40 more)

### Community 21 - "Tests con Node y auditoría radio"
Cohesion: 0.07
Nodes (15): files, swaps, buildTaskIndex(), projectRoot, synchronizeIndex(), run(), glbNodes(), run() (+7 more)

### Community 22 - "Sesión de carrera en red"
Cohesion: 0.08
Nodes (27): GuestRace(), RaceConfig, SharedInit, EngineOrder, EngineLink, Ack, now(), RaceSession (+19 more)

### Community 23 - "vite"
Cohesion: 0.06
Nodes (8): vite, [circuit, format, step], picked, turn, a, b, by, sc

### Community 24 - "Motor en Worker (N3)"
Cohesion: 0.06
Nodes (42): App.tsx N3 patch: race engine behind Worker link, restartEngine (engineEpoch bump), syncFromEngine (session.save then restoreSnapshot), raceCars sectors/lapHistory from public or own state, Public sectors and laps (times + compound, no wear), aheadInfo/behindInfo in public car view, carState() with HEAVY excluded fields (own-car state in view), ClientRaceScreen() (+34 more)

### Community 25 - "Random.ts"
Cohesion: 0.07
Nodes (29): FLAG_CONFIG, getSectorDotClass(), RaceFlagsHUD(), RaceFlagsHUDProps, DEFAULT_RULES, Frame3D, IncidentModel, DOUBLE_YELLOW_SPEED_FACTOR (+21 more)

### Community 26 - "f1.ts"
Cohesion: 0.08
Nodes (23): DnfNotificationModalProps, StartLightsProps, EngineModel, FuelModel, AggressionLevel, BoxOrderStatus, CarTelemetryLog, CrewServiceBenefit (+15 more)

### Community 27 - "TeamRadio.ts"
Cohesion: 0.14
Nodes (13): TeamComplianceView, applySituation(), Compliance, complianceOdds, COMPLIANCES, decideCompliance(), INSIST_LAPS, LAST_LAPS (+5 more)

### Community 28 - "RoomScreens.tsx"
Cohesion: 0.10
Nodes (31): calm(), circuitName(), devMode(), Ended(), FORMAT_TEXT, GuestWaiting(), HostLobby(), JOIN_ERRORS (+23 more)

### Community 29 - "Escenografía 3D"
Cohesion: 0.10
Nodes (50): getScenario(), barrierOffset(), Box, build(), buildBarriers(), buildPitBuilding(), cache, deepestPoint() (+42 more)

### Community 30 - "TrackRenderer.ts"
Cohesion: 0.08
Nodes (16): shadowOffset(), ASPHALT, contrastRatio(), DRS_SLOT_COLOR, luminance(), MIN_SIGNAL_CONTRAST, Signal, SIGNALS (+8 more)

### Community 31 - "Rediseño UI Sprint 2.9"
Cohesion: 0.05
Nodes (34): Atajos de carrera (Espacio, 1–6, C, Esc), Brief: revisión de diseño y refactor UX/UI de F1Sim, F1Sim (simulador de Team Principal), MOB01 consulta móvil, Módulos de test de UI (visual-icons, race-ui, box-ui, pace-ui, luck-modal, sc-deploy…), Bloque R29–R34 (rediseño Sprint 2.9), R39: el Muro tapa el circuito, Stack React 19 + TS + Vite + CSS Modules (+26 more)

### Community 32 - "ExampleInterpreter.ts"
Cohesion: 0.06
Nodes (41): Reserva, CLASSES, forcedOf(), intentOfClass(), NO_ORDER, PACE, RadioClass, TEAM (+33 more)

### Community 33 - "PodiumModal.tsx"
Cohesion: 0.11
Nodes (21): animejs, D20LuckModal(), D20LuckModalProps, D20LuckResult(), DriverProgressEntry, DriverProgressPanel(), DriverProgressPanelProps, COUNTRY_TO_ISO (+13 more)

### Community 34 - "TrackDefinition"
Cohesion: 0.08
Nodes (20): RaceCanvasProps, TrackDefinition, Camera, renderLeftMinimap(), TrackRenderer, cloudShade(), dropCount(), DROPS (+12 more)

### Community 35 - "DriverDevelopment.ts"
Cohesion: 0.15
Nodes (19): ageAttributes(), ageStep(), AGING, clamp(), retirementChance(), retirementsOf(), ATTRIBUTE_LABEL, attributesOf() (+11 more)

### Community 36 - "BoxControls.tsx"
Cohesion: 0.11
Nodes (23): BoxControls(), CROSSOVER_LABEL, decimal(), ORDER_STATUS, WallSpeedometer(), OPTIONS, Pace, PACE_LABEL (+15 more)

### Community 37 - "Runoff.ts"
Cohesion: 0.16
Nodes (11): RunoffZone, asphaltLossSec(), crashReason(), isWall(), noMinimumText(), normalize(), RUNOFF, RunoffProfile (+3 more)

### Community 38 - "RadioPanel.tsx"
Cohesion: 0.08
Nodes (22): useDriverCalls(), driverRadio, ACK_TIMEOUT_MS, COMPOUND_NAME, driverSays(), RadioAck, replyKindForCompliance(), sharedChooser (+14 more)

### Community 39 - "Log suite N3"
Cohesion: 0.06
Nodes (42): Order acknowledgement protocol ({type:ack, seq, ok, reason}), box-orders (Q9, Q10): 65 PASS, Career T4.x modules (finance, costs, facilities, pit crew, sponsors, hub, board, academy, staff, practice), circuit-quality (G1): 347 PASS, contracts-t47 (T4.7): 198 PASS, documentation (Regla de Oro 6): 4 PASS, drs-detection (Q19): 16 PASS, drs-references (Q19): 141 PASS (+34 more)

### Community 40 - "RadioPanel.tsx"
Cohesion: 0.05
Nodes (40): @mlc-ai/web-llm, callChooser, RadioPanel(), STATUS_LABEL, usePushToTalk(), useRadioModeCheck(), revisionsOf(), handler (+32 more)

### Community 41 - "piperVoice.ts"
Cohesion: 0.12
Nodes (20): @diffusionstudio/piper-wasm, @diffusionstudio/vits-web, applyRadioVoice(), RADIO_VOICE_PREF_KEY, StorageLike, VoicePref, chooseVoiceEngine(), createPiperSpeaker() (+12 more)

### Community 42 - "CarState"
Cohesion: 0.13
Nodes (13): commitmentT(), nextCrossing(), normalizeLap(), orderIsActive(), updateOrderCommitment(), PitStopModel, FieldCar, BoxOrder (+5 more)

### Community 43 - "usage.ts"
Cohesion: 0.08
Nodes (24): zustand, FIREBASE, GUEST_CONFIG, RoomBackend, TEAM_IDS, TEAM_LIST, UsageMeter(), roomPaths (+16 more)

### Community 44 - ".lapProfile"
Cohesion: 0.12
Nodes (8): LeaderboardProps, QualiEntrant, cacheFor(), RejoinModel, trackPace(), RejoinEstimate, run(), run()

### Community 45 - "Dataset del modelo de radio"
Cohesion: 0.05
Nodes (34): A_FORMS, A_RE, ALL_NAMES, ARGS, AT_LAP, B_FORMS, B_RE, base (+26 more)

### Community 46 - "Development.ts"
Cohesion: 0.07
Nodes (38): DevelopmentPanel(), DevelopmentPanelProps, STATUS_LABEL, HubHome(), NextRace, RaceWeekendPanel(), Row(), STEPS (+30 more)

### Community 47 - "Driver"
Cohesion: 0.20
Nodes (12): ComponentsPanelProps, DriverAttributesCard(), DriverAttributesCardProps, oneDecimal(), Bar(), DriverSheet(), Facts(), pct() (+4 more)

### Community 48 - "Despliegue y flujo de trabajo"
Cohesion: 0.07
Nodes (32): Workflow Deploy to GitHub Pages, Variable PAGES_SOLO_LANDING, Proyecto Firebase f1sim-d5085, Workflow Deploy game to Firebase Hosting, Flujo de trabajo con DASHBOARD.md y sync:tasks, Línea **Orden vigente:** (tarea actual y siguiente), Punto de reanudación (19/10/2026), Piezas del Sprint 5: src/engine, src/state, src/net (+24 more)

### Community 49 - "Cámaras 3D"
Cohesion: 0.11
Nodes (25): CAMERA_LABELS, CAMERA_MODES, CameraMode3D, CameraView, CarPose, CENITAL_HEIGHT, cenitalGiroView(), cenitalView() (+17 more)

### Community 50 - "Diseño visual Sprint 4"
Cohesion: 0.11
Nodes (30): Autoguardado visible y menú «Partida», Carrera libre como modo aparte, Centro de gestión (Inicio, Carrera, Equipo, Fábrica, Finanzas, Temporada), Sprint 4 — diseño visual de la gestión: entrevista y decisiones, Elegir equipo (se elige equipo, no piloto), Fábrica: coche en el centro, proyectos e instalaciones, Finanzas: saldo, gráfica y libro, Iconos lucide-react (+22 more)

### Community 51 - "AiStatusBadge.tsx"
Cohesion: 0.15
Nodes (15): AiStatusBadge(), LiveAiStatusBadge(), useAiStatusSummary(), RaceMenu(), RaceMenuProps, RadioSettings, AiStatusInput, AiStatusItem (+7 more)

### Community 52 - "scenarioRegistry.ts"
Cohesion: 0.12
Nodes (25): Escenarios visuales por circuito (getScenario), barcelonaScenario, buildProfile(), calendarScenarios, profiles, VisualProfile, defaultScenario, monacoScenario (+17 more)

### Community 53 - "Auditoría Q12-Q19"
Cohesion: 0.14
Nodes (28): DASHBOARD.md (fuente de verdad del plan), Auditoría Q12–Q19 (Sprint 2.8), drsDetections, getRejoinProjection, Q12 Modos de ritmo, Q13 Predictor de reincorporación, Q14 Movimiento en neutralizaciones, Q15 Banderas azules (+20 more)

### Community 54 - "LlmEngine.ts"
Cohesion: 0.04
Nodes (84): BOX_WORDS, CANCEL_WORDS, CATALOG_VERSION, COMPOUND_WORDS, DELEGATE_WORDS, GROUP_WORDS, INTENT_KINDS, Keyword (+76 more)

### Community 55 - "Tests de hosting y clasificador"
Cohesion: 0.12
Nodes (15): root, run(), walk(), run(), never(), run(), tick(), never() (+7 more)

### Community 56 - "Clasificación en directo"
Cohesion: 0.10
Nodes (31): fitOutline(), OutlinePoint, QualifyingLive(), QualifyingResults(), QualifyingResultsProps, SharedRaceRecord, GridChange, formatLapTime() (+23 more)

### Community 57 - "CarShowcase.tsx"
Cohesion: 0.26
Nodes (11): Car3DViewer, CarShowcase(), CarShowcaseProps, supportsWebGL(), F1CarSilhouette(), F1CarSilhouetteProps, ModelCredit(), ModelCreditProps (+3 more)

### Community 58 - ".lapFuelKg"
Cohesion: 0.22
Nodes (5): EnergyModel, run(), run(), run(), run()

### Community 59 - "Log suite N5"
Cohesion: 0.10
Nodes (28): circuit-quality (G1): 347 PASS, Direct (WebRTC/STUN) vs fallback (Firebase) link modes, documentation suite (Regla de Oro 6): dashboard/index sync, engine-host-n2 suite (N2): 39 PASS, FAIL N5: lost order not resent within 2 s / not applied once and acked, FAIL N5: first order after reload is not applied (direct and fallback), FAIL N5: retry that does not open in 5 s is not abandoned, Fast / slow / team views (+20 more)

### Community 60 - "RadioEval.tsx"
Cohesion: 0.12
Nodes (23): DEFAULT_DRIVER_RADIO, DRIVER_RADIO, radioNames(), radioNamesById(), alwaysThere, base(), fpsDuring(), outcome() (+15 more)

### Community 61 - "ref_node_child_process"
Cohesion: 0.15
Nodes (8): R29: inventario funcional y contrato de pruebas, root, modules, args, cwd, assert(), report, test()

### Community 62 - "scrollcraft"
Cohesion: 0.14
Nodes (23): dwell(), formatNum(), lerpRate(), lingerEase(), mixColor(), mount(), api, drawSeq() (+15 more)

### Community 63 - "scenery models"
Cohesion: 0.11
Nodes (15): billboard(), box(), building(), city_wall(), _hull(), mat(), paddock(), pavilion() (+7 more)

### Community 64 - "Practice.ts"
Cohesion: 0.06
Nodes (55): ICON, PracticeLearned(), PracticePanel(), setupText(), SetupCompare(), SHORT, SetupPanel(), SetupPanelProps (+47 more)

### Community 65 - "DASHBOARD"
Cohesion: 0.09
Nodes (24): FIA 2025 F1 Sporting Regulations (Issue 5), FIA 2025 F1 Technical Regulations (Issue 3), MOB01: seguimiento móvil de solo lectura (sustituida por Sprint 5), Q16: ERS, combustible y penalización térmica, R01: perfil de reglas versionado y procedencia, R02: cronometraje por cruces y tráfico físico, R03: datos de evento y geometría con unidades, R07: juegos de neumáticos e inventario legal (+16 more)

### Community 66 - "GuestTransport"
Cohesion: 0.04
Nodes (28): fromDb(), readRace(), RemoteLink, LINK_TIMING, LinkAction, LinkMachine, LinkMode, OrderInbox (+20 more)

### Community 67 - "svgTrackParser.ts"
Cohesion: 0.05
Nodes (55): Geometría: svgTrackParser a escala real (1 unidad = 1 m), Análisis de rectas de los 22 circuitos, Circuitos sin SVG (monza, silverstone, spa, red_bull_ring, …), Muestras x,y del trazado SVG cada 0.1 de t, Análisis de las tres rectas principales por circuito, 23 circuitos a escala real, Física: velocidad por radio, trazada de mínima curvatura, rebufo, neumáticos, ERS, apexes() (+47 more)

### Community 68 - "Finance.ts"
Cohesion: 0.08
Nodes (52): FacilitiesPanel(), BalanceChart(), byKind(), FinancePanel(), RoundReportScreen(), aiInvestFacilities(), buildRounds(), FACILITIES (+44 more)

### Community 70 - "fakeDb"
Cohesion: 0.23
Nodes (13): run(), run(), run(), run(), run(), run(), run(), clone() (+5 more)

### Community 72 - "DASHBOARD (2)"
Cohesion: 0.11
Nodes (20): G11: circuitos en 3D con Blender, G2: escala real, un metro por unidad, Motorsport Manager 2 (inspiración), Q7: anchura de pista variable y capacidad de adelantamiento, R43: fluidez de conducción en pantalla (interpolación de pose), R44: lluvia visible y radar meteorológico, R45: atributos de piloto y mejora entre carreras, R46: coche en 3D en el paddock (three.js) (+12 more)

### Community 73 - "build dashboard"
Cohesion: 0.12
Nodes (20): ahead(), bySprint, clean(), closedSprints, detail, esc(), group(), index (+12 more)

### Community 74 - ".step"
Cohesion: 0.06
Nodes (25): R13: comisarios y sanciones ejecutables, CLASSIFIED_FRACTION, classify(), compareByResults(), ConstructorRow, constructorStandings(), EndReason, POINTS_2025 (+17 more)

### Community 75 - "BottomTelemetryDock.tsx"
Cohesion: 0.10
Nodes (26): BottomTelemetryDock(), BottomTelemetryDockProps, CarChassisSvg(), CarChassisSvgProps, WheelId, WHEELS, CompoundBadge(), CompoundBadgeProps (+18 more)

### Community 76 - "ruleSets.ts"
Cohesion: 0.12
Nodes (19): FIA_2025_VALUES, GAME_2025_VALUES, GAME_KEYS, GameKey, ORIGINS, REGULATION_KEYS, RegulationKey, RULE_SETS (+11 more)

### Community 77 - "DASHBOARD (3)"
Cohesion: 0.10
Nodes (21): docs/design/grill-sprint4-visual.md (diseño de la gestión), Para valorar más adelante: grabaciones de audio, sesiones jugables, PWA sin internet, R19: vida de componentes y cupos de temporada, Sprint 4: director de equipo, gestión entre carreras (T4.1-T4.24), T4.10: junta y objetivos de temporada, T4.11: cambio de temporada (invierno), T4.12: tiempo por circuito y neumático de salida, T4.16: audio por eventos (AudioEngine) (+13 more)

### Community 78 - "DASHBOARD (4)"
Cohesion: 0.18
Nodes (19): Alojamiento del modelo en Hugging Face con commit fijado, IA10: radio con el modelo propio ajustado (q0f16 / q4), IA1: catálogo de órdenes de radio e intérprete por palabras clave, IA2: respuestas de los pilotos y voz (Web Speech), IA3: obediencia del piloto según su carácter, IA4: ajustes de la radio y gestión del modelo (ModelStore), IA5: modelo de IA en el navegador con WebLLM (evaluación), IA6: voces Piper y órdenes por micro (Whisper) (+11 more)

### Community 79 - "PitCrew.ts"
Cohesion: 0.23
Nodes (13): PitCrewPanel(), seconds(), CREW_PLAN_EFFECT, CREW_PLAN_LABEL, CREW_PLANS, CrewPlan, crewStats(), initialCrewLevel() (+5 more)

### Community 80 - "Snapshot.ts"
Cohesion: 0.13
Nodes (23): CAR_PARTS, createSnapshot(), FLAG_STATES, Internal, isObject(), isUint32(), migrateSnapshot(), migrateV1() (+15 more)

### Community 81 - "tsconfig"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, isolatedModules, jsx, lib, module (+11 more)

### Community 82 - "DASHBOARD (5)"
Cohesion: 0.14
Nodes (9): Correcciones de auditoría C1-C7 y A1-A6 (SC, boxes, mutaciones), Comandos de verificación (sync:tasks, check:tasks, test-suite, build), Deuda técnica M1-M10 y B1-B7 (capas del monoplaza, desgaste por rueda, limpieza), F1 Simulator Dashboard & Plan de Implementación, Roadmap y estado global de sprints, Sprint 1: trazado SVG Barcelona, core loop, timing tower, cámaras, Sprint 2: SC físico, undercut/overcut, monoplaza vectorial 2D, Sprint 2.1: bugs críticos y altos de auditoría (C1-C7, A1-A6) (+1 more)

### Community 83 - "radioFilter.ts"
Cohesion: 0.12
Nodes (12): AudioContextLike, buildRadioChain(), ENGINE_BASE_HZ, ENGINE_LEVEL, engineFrequency(), EngineInfo, NodeLike, RADIO_COMPRESSOR (+4 more)

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
Nodes (16): name, private, type, version, firebase-tools, @huggingface/transformers, pixi.js, qrcode-generator (+8 more)

### Community 89 - "driverCalls.ts"
Cohesion: 0.22
Nodes (9): CALL_GAP_SEC, CallCar, CallSnapshot, createCallDetector(), DriverCall, Memory, OVERTAKE_GAP_LAPS, WEAR_CALL_PCT (+1 more)

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

### Community 94 - "ref_node_child_process"
Cohesion: 0.22
Nodes (5): chrome, res, t0, waiting, ws

### Community 95 - "q20 redraw"
Cohesion: 0.17
Nodes (9): catmullRomClosed(), centers, cumulative(), dist(), dtw(), osm, resampleClosed(), results (+1 more)

### Community 96 - "Multijugador: puesta en marcha, prueba entre redes y consumo"
Cohesion: 0.14
Nodes (15): database.rules.json, El anfitrión corre el motor (Web Worker), Multijugador: puesta en marcha, prueba entre redes y consumo, Flujo firebase-hosting.yml (N11), Firebase como punto de encuentro (sala y señalización), Medidor de consumo ?medir, Plan gratuito Spark (100 conexiones, 1 GB, 10 GB/mes), Proyecto Firebase f1sim-d5085 (+7 more)

### Community 97 - "HomeScreen.tsx"
Cohesion: 0.09
Nodes (30): BoardPanel(), HomeScreenProps, HubHeader(), ICONS, StatusCard, formatSavedAt(), SaveGameMessage, SaveGamePanel() (+22 more)

### Community 98 - "package (2)"
Cohesion: 0.12
Nodes (16): dependencies, animejs, @diffusionstudio/piper-wasm, @diffusionstudio/vits-web, firebase, @huggingface/transformers, lucide-react, @mlc-ai/web-llm (+8 more)

### Community 99 - "figura boxes"
Cohesion: 0.34
Nodes (13): crono(), montar(), colocar(), fotograma(), leer(), ordenar(), pintar(), reposo() (+5 more)

### Community 100 - "eventData.ts"
Cohesion: 0.20
Nodes (9): EVENT_DATA_IDS, EventData, EventLine, EventLineKind, inRange(), Provenance, PROVENANCES, UNIT (+1 more)

### Community 101 - "Career.ts"
Cohesion: 0.09
Nodes (27): elapsedText(), GameMenu(), ACCENT, GameMenuScreen(), image(), Mode, Panel, slotStatus() (+19 more)

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

### Community 115 - "F1Wheel3D.tsx"
Cohesion: 0.11
Nodes (17): chooseLandingCompound(), COMPOUND_COLORS, CompoundStorage, createBremboF1Caliper(), createCrossDrilledBrakeRotorTexture(), createSidewallDecalTexture(), createTreadBumpTexture(), F1Wheel3D() (+9 more)

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
Cohesion: 0.13
Nodes (11): Punto de entrada de la app (#root, /src/main.tsx), AppErrorBoundary, PerfOverlay(), name(), uiAudit, visible(), params, renderApp() (+3 more)

### Community 120 - "scenery models (4)"
Cohesion: 0.15
Nodes (6): floodlight(), foro_sol(), grandstand(), peralte(), the_wing(), torre_doncella()

### Community 121 - "build"
Cohesion: 0.15
Nodes (3): CHOICE, out, out

### Community 122 - "n3 run1"
Cohesion: 0.19
Nodes (12): Engine order kinds (devSafetyCar, devRedFlag, pause, speed, luckReward, luckClear, luckVariant, confirmStart, startSequence, dnfClear, endSuspended, confirmResult, weatherTest), sendOrder (EngineOrder to RaceSession), Documentation fail: dashboard and index aligned, engine-host-n2 test module (N2, 39 PASS), race-session-n3 test module (N3), R53 fail: weather panel shows radar forecast, N3 test suite run 1 (1085 PASS, 13 FAIL, 33 modules), T4.14 fail: app enables rival team orders and notices (+4 more)

### Community 123 - "capture radio ia5"
Cohesion: 0.24
Nodes (11): chrome, evaluate(), open(), requests, run(), send(), shot(), size() (+3 more)

### Community 124 - "sounds.ts"
Cohesion: 0.25
Nodes (7): AudioSnapshot, FLAG_SOUND, LIGHTS, pending, SOUND_IDS, SOUNDS, SoundSpec

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

### Community 129 - "RightStatsPanel.tsx"
Cohesion: 0.14
Nodes (18): lucide-react, RaceHeader(), RaceHeaderProps, cell, minutes(), RainForecastPanel(), RainForecastPanelProps, RightPanelTab (+10 more)

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

### Community 134 - "download.ts"
Cohesion: 0.12
Nodes (18): browserModelDownload(), holders, listenForReturn(), LockArgs, pageHidden(), sharedTabLock(), createTabLock(), DownloadState (+10 more)

### Community 135 - "parody names"
Cohesion: 0.24
Nodes (10): BRANDS, DRIVER_NAMES, ENGINES, files(), REAL_DRIVERS, run(), stripComments(), SURNAMES (+2 more)

### Community 136 - "eval ia10 q0f16"
Cohesion: 0.22
Nodes (10): F1-Radio-0.5B-q0f16-MLC model, IA10 eval: F1-Radio-0.5B-q0f16-MLC (WebGPU), Radio intent classes (boxes, anular-boxes, ritmo-*, equipo-*, propuesta-*, delegar-*, ninguna, orden-doble), Reserva v3 holdout dataset (101 phrases), F1-Radio-0.5B-q4f16_1-MLC model, IA10 eval: F1-Radio-0.5B-q4f16_1-MLC (partial run), HF repo gooday89/F1-Radio-0.5B-q0f16-MLC (~1 GB), HF repo gooday89/F1-Radio-0.5B-q4f16_1-MLC (~290 MB) (+2 more)

### Community 137 - "FreeRaceWizard.tsx"
Cohesion: 0.09
Nodes (40): CircuitSheet(), Facts(), Tab, TABS, TrackMap(), FreeRaceWizard(), FreeRaceWizardProps, HomeScreen() (+32 more)

### Community 138 - "pit route"
Cohesion: 0.31
Nodes (9): centerAt(), CIRCUITS, circularDelta(), dist(), distanceToRoute(), median(), REFERENCE_CIRCUITS, references (+1 more)

### Community 139 - "f1 architecture rendered"
Cohesion: 0.25
Nodes (9): App.tsx (Game Loop & UI, React, frontend), Archify 2.17.0-dev.1 (diagram generator/viewer), F1 Simulator Architecture Diagram, Archify interactive viewer (route probe, semantic lens, radar, export), Math & Utils (carPosition, spline), RaceSimulation (Core Physics, 60 Hz), Renderers (Track, Car, Camera; Canvas), Simulation Models (Pit, SC, Tires) (+1 more)

### Community 140 - "package (3)"
Cohesion: 0.22
Nodes (9): devDependencies, @firebase/rules-unit-testing, firebase-tools, @types/node, @types/react, @types/react-dom, typescript, vite (+1 more)

### Community 141 - "WeatherModel.ts"
Cohesion: 0.25
Nodes (5): DRY_DRAW, RAIN_DRAW, WEATHER_SCENARIOS, CloudBank, WeatherScenario

### Community 142 - "scenery 3d 3"
Cohesion: 0.33
Nodes (8): glbInfo(), HOT, inside(), luminance(), median(), MOUNTAIN, run(), STREET_CLOSE

### Community 144 - "CONTEXT"
Cohesion: 0.25
Nodes (8): Aquaplaning, Escapatoria, Nubosidad, Radar, Perfil personalizado / perfil FIA 2025, Salida de pista, Trazada, Meteorología: celdas de lluvia, radar, agua, aquaplaning

### Community 145 - "RoomLive.tsx"
Cohesion: 0.18
Nodes (10): PauseRequestBanner(), buildWeatherScenario(), CONFIG, Fakes, HostRace(), RoomLive(), LocalLink, rosterOf() (+2 more)

### Community 146 - "WeatherModel"
Cohesion: 0.22
Nodes (4): weatherLayers, cloudCover(), normalize(), WeatherModel

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

### Community 153 - "capture-radio-ia7.mjs"
Cohesion: 0.29
Nodes (11): chrome, evaluate(), open(), run(), say(), send(), shot(), size() (+3 more)

### Community 154 - "SettingsScreen.tsx"
Cohesion: 0.09
Nodes (25): AUDIO_LEVEL_LABEL, AUDIO_LEVELS, AUDIO_STORAGE_KEY, parseAudioLevel(), SettingsAudio, SettingsScreen(), SHORTCUTS, toolHref() (+17 more)

### Community 155 - "blender build circuits"
Cohesion: 0.48
Nodes (3): build_circuits(), _linear(), _material()

### Community 156 - "g7 apply shift"
Cohesion: 0.38
Nodes (4): interval(), norm(), r4(), shifts

### Community 157 - "q20 fixture"
Cohesion: 0.29
Nodes (3): C, out, REASONS

### Community 158 - "Simulación: RaceSimulation y modelos en src/simulation"
Cohesion: 0.25
Nodes (7): Revisión en navegador con iframe srcdoc y rAF sustituido, Doble bucle: React a ~15 FPS y requestAnimationFrame en RaceCanvas, Simulación: RaceSimulation y modelos en src/simulation, Módulos de test con server.ssrLoadModule, __uiAudit() para medir maquetación en navegador, Dirección de carrera (banderas, SC, VSC, roja, comisarios), Simular un Gran Premio

### Community 159 - "scenery 3d 2"
Cohesion: 0.48
Nodes (6): area(), glbInfo(), inside(), REAL_SPONSORS, run(), word()

### Community 160 - "rooms-rules-n4.mjs"
Cohesion: 0.60
Nodes (5): @firebase/rules-unit-testing, run(), startEmulator(), stopEmulator(), up()

### Community 161 - "n3 canvas"
Cohesion: 0.33
Nodes (5): at, bottom, o, orig, top

### Community 162 - "LEEME"
Cohesion: 0.33
Nodes (6): Q20 comparison: OSM pit lane vs track SVG overlays (8 circuits), buildTrackFromSvg, find-rels.cjs / dl-rels.cjs / build.cjs / meta.cjs / q20-fixture.cjs, Q20 pit-lane references from OpenStreetMap (tool pipeline), tests/fixtures/pit-lane-references.json, q20-align.mjs (fit OSM to buildTrackFromSvg track)

### Community 163 - "LapStrip.tsx"
Cohesion: 0.33
Nodes (5): LapStrip(), LapStripCar, LapStripDot, lapStripDots(), NEAR_LINE

### Community 164 - "scenery models (7)"
Cohesion: 0.33
Nodes (3): flame_towers(), loft(), marina_bay_sands()

### Community 165 - "scenery 3d"
Cohesion: 0.60
Nodes (5): area(), footprint(), glbTriangles(), inside(), run()

### Community 166 - "n1/engine.worker.ts"
Cohesion: 0.70
Nodes (3): makeView(), r(), tick()

### Community 167 - "blocks"
Cohesion: 0.40
Nodes (4): blocks, [file, changes], spec, t

### Community 168 - "units3.mjs"
Cohesion: 0.33
Nodes (5): fv, host, o, place, sim

### Community 169 - "q12 decompose"
Cohesion: 0.50
Nodes (3): mean(), report(), undo

### Community 170 - "RenderPose.ts"
Cohesion: 0.31
Nodes (4): interpolatePose(), Pose, RenderInterpolator, shortestTurn()

### Community 171 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, check:tasks, dashboard, dev, prebuild, preview, sync:tasks

### Community 172 - "modal lifecycle"
Cohesion: 0.70
Nodes (4): dependencyArrays(), read(), run(), stateUpdaters()

### Community 173 - "radio replies ia2"
Cohesion: 0.60
Nodes (4): run(), SURNAMES, tick(), word()

### Community 175 - "scenery 3d 5"
Cohesion: 0.40
Nodes (3): ICONS, MINIMUM, WATER

### Community 176 - "firebaseDb.ts"
Cohesion: 0.29
Nodes (6): firebase, FIREBASE_MISSING, firebaseConfig, firebaseConfigured(), connectFirebase(), ConnectOptions

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

### Community 184 - "combined-v2.mjs"
Cohesion: 0.40
Nodes (3): MODEL_FAILS, notes, phrases

### Community 190 - "rules-n10.mjs"
Cohesion: 0.80
Nodes (4): run(), startEmulator(), stopEmulator(), up()

### Community 192 - "AudioEngine"
Cohesion: 0.16
Nodes (3): AudioContextLike, AudioEngine, SoundId

### Community 194 - "R28: guardado, reinicio y calidad de datos (snapshot)"
Cohesion: 0.20
Nodes (10): Q18: reconciliación de timers y reset limpio, R06: cuatro neumáticos con temperatura, carga y desgaste, R22: clima físico mínimo y decisiones de seguridad, R28: guardado, reinicio y calidad de datos (snapshot), R48: cargar y continuar una partida (snapshot v2), Sprint 3: audio, telemetría, radar y clima (T3.1-T3.4), T3.1: escapatorias vs muros (duración del SC, Runoff.ts), T3.2: sistema meteorológico dinámico y trazada que seca (+2 more)

### Community 195 - "kw-audit.mjs"
Cohesion: 0.40
Nodes (4): f, right, toModel, wrongOk

### Community 196 - "q15-debug.mjs"
Cohesion: 0.50
Nodes (4): a, b, frac(), mk()

### Community 199 - "voice/runtime.ts"
Cohesion: 0.11
Nodes (15): activeSpeaker, deps, engineOf(), radioClock(), radioEngineOf(), radioVoice, systemSpeaker, browserSpeaker() (+7 more)

### Community 201 - "Wall.ts"
Cohesion: 0.04
Nodes (32): decimal(), DRS_FLAP_SECONDS, DrsDetection, DrsPermissions, DrsReading, drsStatus, Passage, Permission (+24 more)

### Community 202 - "kw-holdout.mjs"
Cohesion: 0.33
Nodes (4): bad, f, hold, car()

### Community 203 - "radio-ia1.mjs"
Cohesion: 0.47
Nodes (4): files(), phrases, run(), same()

### Community 204 - "mon.mjs"
Cohesion: 0.50
Nodes (3): out, pit, pitPts

### Community 206 - "finalize-models.mjs"
Cohesion: 0.33
Nodes (5): `f1-car.glb`, Modelos 3D de terceros, `safety-car.glb`, Créditos: TUMFTM y MultiViewer API, MODELS

### Community 210 - "WeatherForecast.ts"
Cohesion: 0.16
Nodes (16): FORECAST, ForecastSector, ForecastSlot, normalize(), SeenCell, seenRate(), DRY_MM_PER_SEC, DRY_SCENARIO (+8 more)

### Community 211 - "q13-model.mjs"
Cohesion: 0.83
Nodes (3): model(), run(), vTarget()

### Community 213 - "Modelo propio de la radio: ciclo de mejora (IA7)"
Cohesion: 0.50
Nodes (3): Cambio de versión en el juego, El ciclo, Modelo propio de la radio: ciclo de mejora (IA7)

### Community 218 - "SaveStore"
Cohesion: 0.22
Nodes (5): App(), newRaceSeed(), playerDriverIds(), SaveStore, StorageLike

## Knowledge Gaps
- **191 isolated node(s):** `firebase-tools`, `@types/animejs`, `@types/node`, `@types/react`, `@types/react-dom` (+186 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1617 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Tests de React y carrera` to `Season.ts`, `RightStatsPanel.tsx`, `Tests de carrera y banderas`, `Pilotos, contratos y reserva`, `carSprites3d.ts`, `barcelonaTrack.ts`, `fixedRandom`, `RadioSettings.tsx`, `Referencias externas del App`, `FreeRaceWizard.tsx`, `Costs.ts`, `EngineHost`, `Banco de respuestas de pilotos`, `RaceCanvas.tsx`, `RoomLive.tsx`, `Tests con Node y auditoría radio`, `Motor en Worker (N3)`, `Random.ts`, `f1.ts`, `SettingsScreen.tsx`, `RoomScreens.tsx`, `PodiumModal.tsx`, `BoxControls.tsx`, `RadioPanel.tsx`, `usage.ts`, `Development.ts`, `Driver`, `AiStatusBadge.tsx`, `Clasificación en directo`, `CarShowcase.tsx`, `.lapFuelKg`, `RadioEval.tsx`, `Practice.ts`, `Finance.ts`, `RaceCanvas top`, `fakeDb`, `kw-holdout.mjs`, `BottomTelemetryDock.tsx`, `package`, `HomeScreen.tsx`, `Career.ts`, `F1Wheel3D.tsx`, `AppErrorBoundary`?**
  _High betweenness centrality (0.272) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `App()` (e.g. with `.run()` and `projectCost()`) actually correct?**
  _`App()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `firebase-tools`, `@types/animejs`, `@types/node` to the rest of the system?**
  _191 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Season.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03503867300344796 - nodes in this community are weakly interconnected._
- **Why does `CarState` connect `CarState` to `Season.ts`, `RightStatsPanel.tsx`, `RaceSimulation`, `barcelonaTrack.ts`, `RaceScene3D.ts`, `RaceSimulation.ts`, `RaceCanvas.tsx`, `Detalle visual del coche`, `Reglas de neumáticos`, `Motor en Worker (N3)`, `Random.ts`, `f1.ts`, `TeamRadio.ts`, `TrackRenderer.ts`, `PodiumModal.tsx`, `TrackDefinition`, `BoxControls.tsx`, `Runoff.ts`, `RadioPanel.tsx`, `RenderPose.ts`, `.lapProfile`, `Cámaras 3D`, `RadioEval.tsx`, `Wall.ts`, `.step`, `BottomTelemetryDock.tsx`, `Snapshot.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `Tests de carrera y banderas` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Why does `RaceSimulation` connect `RaceSimulation` to `Season.ts`, `barcelonaTrack.ts`, `FreeRaceWizard.tsx`, `EngineHost`, `RaceSimulation.ts`, `RaceCanvas.tsx`, `RoomLive.tsx`, `Reglas de neumáticos`, `Sesión de carrera en red`, `Motor en Worker (N3)`, `Random.ts`, `f1.ts`, `TeamRadio.ts`, `TrackDefinition`, `Runoff.ts`, `n1/engine.worker.ts`, `RenderPose.ts`, `usage.ts`, `CarState`, `.lapProfile`, `Driver`, `Practice.ts`, `Wall.ts`, `.step`, `ruleSets.ts`, `Snapshot.ts`, `OvertakingZones`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._