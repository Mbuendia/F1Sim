# Graph Report - brave-mendeleev  (2026-10-29)

## Corpus Check
- 753 files · ~1,474,560 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 259 file(s) not represented in the graph (top: .meta 108, .glb 64, .css 46)

## Summary
- 5376 nodes · 13421 edges · 214 communities (192 shown, 22 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 496 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7da41ce0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- Tests de carrera y banderas
- RaceSimulation
- Pilotos, contratos y reserva
- RaceScene3D.ts
- carPosition.ts
- f1.ts
- Tests de React y carrera
- RadioSettings.tsx
- Referencias externas del App
- keywordInterpreter.ts
- RoomFlow.tsx
- CarState
- download.ts
- EngineHost.ts
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
- Snapshot.ts
- FreeRaceWizard.tsx
- carSprites3d.ts
- Escenografía 3D
- Brief: revisión de diseño y refactor UX/UI de F1Sim
- teams.ts
- RadioEval.tsx
- BottomTelemetryDock.tsx
- TrackDefinition
- DriverDevelopment.ts
- BoxControls.tsx
- VoiceBlindTest.tsx
- RadioPanel.tsx
- Log suite N3
- DriverSheet.tsx
- devMode.ts
- RaceSimulation.ts
- usage.ts
- ruleSets.ts
- Dataset del modelo de radio
- Facilities.ts
- DecisionVisual.tsx
- Despliegue y flujo de trabajo
- Cámaras 3D
- Diseño visual Sprint 4
- AiStatusBadge.tsx
- .issueBoxOrder
- Auditoría Q12-Q19
- LlmEngine.ts
- Tests de hosting y clasificador
- Clasificación en directo
- CarShowcase.tsx
- HomeScreen.tsx
- Log suite N5
- carDots.ts
- ref_node_child_process
- scrollcraft
- scenery models
- Practice.ts
- DASHBOARD
- GuestTransport
- svgTrackParser.ts
- liveries.ts
- RaceCanvas top
- fakeDb
- scenario contract
- DASHBOARD (2)
- build dashboard
- RaceResult.ts
- Leaderboard.tsx
- roomStore.ts
- DASHBOARD (3)
- DASHBOARD (4)
- Hub.ts
- compoundStyle
- tsconfig
- DASHBOARD (5)
- radioFilter.ts
- scenery models (2)
- AGENTS
- DASHBOARD (6)
- DASHBOARD (7)
- package.json
- ia6-run.mjs
- q20 apply redraw
- TrackLayerGL
- DASHBOARD (8)
- DASHBOARD (9)
- modelScene.ts
- q20 redraw
- Multijugador: puesta en marcha, prueba entre redes y consumo
- WeatherScenarioSelect.tsx
- package (2)
- figura boxes
- eventData.ts
- scenarioRegistry.ts
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
- SettingsScreen.tsx
- scenery models (4)
- build
- n3 run1
- capture radio ia5
- webSpeechStt.ts
- main
- capture bridge
- capture radio
- capture radio ia2
- main.tsx
- n3 box
- webllm radio test
- scenery models (5)
- capture screens
- llm/runtime.ts
- parody names
- eval ia10 q0f16
- Costs.ts
- pit route
- f1 architecture rendered
- LapStrip.tsx
- racing-line-geometry.mjs
- scenery 3d 3
- Brief: revisión de diseño y refactor UX/UI de F1Sim
- CONTEXT
- AudioEngine
- q13-trace.mjs
- landing
- q19 apply
- g7 shift fixtures
- q20 circuits set
- scenery models (6)
- build dataset
- capture-radio-ia7.mjs
- OvertakingZones.ts
- blender build circuits
- g7 apply shift
- q20 fixture
- Simulación: RaceSimulation y modelos en src/simulation
- useTweenedNumber.ts
- ref_node_child_process
- n3 canvas
- LEEME
- react
- scenery models (7)
- scenery 3d
- n1/engine.worker.ts
- blocks
- units3.mjs
- q12 decompose
- align-circuit-references.mjs
- StorageLike
- modal lifecycle
- radio replies ia2
- uiAudit.ts
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
- StorageLike
- voice/runtime.ts
- weather-fronts-t32.mjs
- kw-audit.mjs
- q15-debug.mjs
- team-orders-probe.mjs
- voice/runtime.ts
- Wall.ts
- kw-holdout.mjs
- radio-ia1.mjs
- mon.mjs
- finalize-models.mjs
- drs-references.mjs
- SaveStore
- R28: guardado, reinicio y calidad de datos (snapshot)
- WeatherModel.ts
- q13-model.mjs
- UX11 — Prueba en dispositivos reales
- Modelo propio de la radio: ciclo de mejora (IA7)
- piper-wasm.d.ts

## God Nodes (most connected - your core abstractions)
1. `RaceSimulation` - 210 edges
2. `App()` - 194 edges
3. `raceFactory()` - 167 edges
4. `react` - 166 edges
5. `CarState` - 108 edges
6. `react-dom` - 74 edges
7. `TrackDefinition` - 68 edges
8. `fixedRandom()` - 57 edges
9. `Camera` - 53 edges
10. `vite` - 53 edges

## Surprising Connections (you probably didn't know these)
- `cars` --indirect_call--> `F1CarSilhouette()`  [INFERRED]
  scratch/q21-preview.mjs → src/components/F1CarSilhouette.tsx
- `row()` --indirect_call--> `CompoundBadge()`  [INFERRED]
  scratch/q21-preview.mjs → src/components/CompoundBadge.tsx
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

## Communities (214 total, 22 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.03
Nodes (131): App(), CAMERA_LABELS, FLAG_CHIPS, FLAG_NOTICES, newRaceSeed(), playerDriverIds(), SettingsScreen, TYRE_WORDS (+123 more)

### Community 1 - "Tests de carrera y banderas"
Cohesion: 0.04
Nodes (71): run(), run(), run(), run(), run(), run(), run(), run() (+63 more)

### Community 2 - "RaceSimulation"
Cohesion: 0.04
Nodes (19): advanceAutoRace(), AUTO_RACE, autoRaceDone(), DriverAttributes, overtakeAdvantageNeeded(), RaceSimulation, Rng, useRng() (+11 more)

### Community 3 - "Pilotos, contratos y reserva"
Cohesion: 0.08
Nodes (60): DriverContractsPanel(), Helmet(), perSeason(), Facts(), hundred(), paceAt(), ReservePanel(), DRIVERS (+52 more)

### Community 4 - "RaceScene3D.ts"
Cohesion: 0.05
Nodes (54): bridgeRoadHeight(), DECK_HALF_M, DECK_HEIGHT_M, Pt, RAMP_M, SIDE_M, Sun, overpassFor() (+46 more)

### Community 5 - "carPosition.ts"
Cohesion: 0.05
Nodes (71): BARCELONA_CIRCUIT, BARCELONA_FIA_EXACT_POINTS, CornerMarker, pitLanePoints, points, CircuitReview(), IDS, Layer (+63 more)

### Community 6 - "f1.ts"
Cohesion: 0.08
Nodes (22): DnfNotificationModalProps, DEFAULT_RULES, EngineModel, FuelModel, AggressionLevel, BoxOrderStatus, CarTelemetryLog, CrewServiceBenefit (+14 more)

### Community 7 - "Tests de React y carrera"
Cohesion: 0.03
Nodes (16): react, react-dom, cars, compounds, row(), cases, cell(), small (+8 more)

### Community 8 - "RadioSettings.tsx"
Cohesion: 0.04
Nodes (71): browserEstimate(), CorrectionsSettings(), fromDevice(), MicSettings(), ModelBlock(), previousStores, RadioSettings(), RadioSettingsProps (+63 more)

### Community 9 - "Referencias externas del App"
Cohesion: 0.02
Nodes (5): CAMERA_LABELS, FLAG_CHIPS, FLAG_NOTICES, FREE_RACE_PADDOCK, TYRE_WORDS

### Community 10 - "keywordInterpreter.ts"
Cohesion: 0.06
Nodes (55): Reserva, BOX_WORDS, CANCEL_WORDS, COMPOUND_WORDS, DELEGATE_WORDS, GROUP_WORDS, Keyword, kw() (+47 more)

### Community 11 - "RoomFlow.tsx"
Cohesion: 0.05
Nodes (88): FIREBASE, GUEST_CONFIG, HostStart, playersOf(), RoomFlow(), stable(), TEAM_IDS, TEAM_LIST (+80 more)

### Community 12 - "CarState"
Cohesion: 0.09
Nodes (7): DrsPermissions, PitStopModel, lineCrossings(), CarState, run(), run(), run()

### Community 13 - "download.ts"
Cohesion: 0.12
Nodes (18): browserModelDownload(), holders, listenForReturn(), LockArgs, pageHidden(), sharedTabLock(), createTabLock(), DownloadState (+10 more)

### Community 14 - "EngineHost.ts"
Cohesion: 0.08
Nodes (10): ClientRaceReview(), post(), tick(), createEngine(), EngineInit, EngineHost, isId(), LocalLink (+2 more)

### Community 15 - "RaceSimulation.ts"
Cohesion: 0.05
Nodes (47): R05: aerodinámica, rebufo y adelantamiento físico, CarTechnical, CHASSIS_BLEND, chassisGripAt(), HIGH_DOWNFORCE, LOW_DOWNFORCE, PackageId, PACKAGES (+39 more)

### Community 16 - "Banco de respuestas de pilotos"
Cohesion: 0.06
Nodes (48): Temperament, ALL, allLines(), BANK, btn, KINDS, Line, NAMES (+40 more)

### Community 17 - "RaceCanvas.tsx"
Cohesion: 0.10
Nodes (28): RaceCanvas(), segmentAt(), BridgeReview(), cameraMode, clouds, q, raceTimeSec, zoom (+20 more)

### Community 18 - "Detalle visual del coche"
Cohesion: 0.08
Nodes (42): CameraMode, RAIN_LIGHT_HZ, rearLight, safetyCarLightOn(), WHEEL_CIRCUMFERENCE_M, wheelMarkPhase(), buildCarDraws(), buildSafetyCarDraw() (+34 more)

### Community 19 - "Management.ts"
Cohesion: 0.04
Nodes (94): ManagementState: estado único de la gestión, SponsorsPanel(), Terms(), roleName(), StaffPanel(), drawWeatherScenario(), isAcademy(), startAcademy() (+86 more)

### Community 20 - "Reglas de neumáticos"
Cohesion: 0.08
Nodes (38): SPRINT_VENUES, WeekendState, STRATEGY, allocationSets(), availableSets(), COMPOUND_LABEL, createInventory(), inventoryFromSets() (+30 more)

### Community 21 - "Tests con Node y auditoría radio"
Cohesion: 0.08
Nodes (13): files, swaps, buildTaskIndex(), projectRoot, synchronizeIndex(), run(), glbNodes(), run() (+5 more)

### Community 22 - "Sesión de carrera en red"
Cohesion: 0.06
Nodes (32): Punto de reanudación (19/10/2026), Piezas del Sprint 5: src/engine, src/state, src/net, zustand, QualifyingResults(), GuestRace(), RaceConfig, SharedInit, EngineOrder (+24 more)

### Community 23 - "vite"
Cohesion: 0.06
Nodes (8): vite, @vitejs/plugin-react, [circuit, format, step], picked, turn, by, sc, version

### Community 24 - "Motor en Worker (N3)"
Cohesion: 0.04
Nodes (67): App.tsx N3 patch: race engine behind Worker link, restartEngine (engineEpoch bump), syncFromEngine (session.save then restoreSnapshot), ClientRaceScreen(), LINK_TEXT, PauseRequestBanner(), SharedRaceEnd(), startNotice() (+59 more)

### Community 25 - "Random.ts"
Cohesion: 0.05
Nodes (35): R09: Dirección de Carrera, banderas locales y límites, PaintScene, FLAG_CONFIG, getSectorDotClass(), RaceFlagsHUD(), RaceFlagsHUDProps, interpolatePose(), Pose (+27 more)

### Community 26 - "Snapshot.ts"
Cohesion: 0.13
Nodes (23): CAR_PARTS, createSnapshot(), FLAG_STATES, Internal, isObject(), isUint32(), migrateSnapshot(), migrateV1() (+15 more)

### Community 27 - "FreeRaceWizard.tsx"
Cohesion: 0.07
Nodes (45): lucide-react, CircuitSheet(), Facts(), Tab, TABS, TrackMap(), FreeRaceWizard(), FreeRaceWizardProps (+37 more)

### Community 28 - "carSprites3d.ts"
Cohesion: 0.19
Nodes (21): liveryFor(), CAR_MODEL, modelUrl(), buildCarPortraits(), cache, buildCarSprites(), buildSafetyCarSprite(), carSprite() (+13 more)

### Community 29 - "Escenografía 3D"
Cohesion: 0.11
Nodes (48): getScenario(), tvCamerasFor(), barrierOffset(), Box, build(), buildBarriers(), buildPitBuilding(), cache (+40 more)

### Community 30 - "Brief: revisión de diseño y refactor UX/UI de F1Sim"
Cohesion: 0.13
Nodes (12): Atajos de carrera (Espacio, 1–6, C, Esc), Brief: revisión de diseño y refactor UX/UI de F1Sim, F1Sim (simulador de Team Principal), MOB01 consulta móvil, Módulos de test de UI (visual-icons, race-ui, box-ui, pace-ui, luck-modal, sc-deploy…), Stack React 19 + TS + Vite + CSS Modules, OPTIONS, Pace (+4 more)

### Community 31 - "teams.ts"
Cohesion: 0.10
Nodes (27): elapsedText(), GameMenu(), ACCENT, GameMenuScreen(), image(), Mode, Panel, slotStatus() (+19 more)

### Community 32 - "RadioEval.tsx"
Cohesion: 0.07
Nodes (34): DEFAULT_DRIVER_RADIO, DRIVER_RADIO, radioNames(), radioNamesById(), alwaysThere, base(), fpsDuring(), outcome() (+26 more)

### Community 33 - "BottomTelemetryDock.tsx"
Cohesion: 0.23
Nodes (11): BottomTelemetryDock(), BottomTelemetryDockProps, CarChassisSvg(), CarChassisSvgProps, WheelId, WHEELS, DrsStatusBadge(), TIRE_CRITICAL_THRESHOLD (+3 more)

### Community 34 - "TrackDefinition"
Cohesion: 0.08
Nodes (21): RaceCanvasProps, TrackDefinition, Camera, renderLeftMinimap(), TrackRenderer, cloudShade(), dropCount(), DROPS (+13 more)

### Community 35 - "DriverDevelopment.ts"
Cohesion: 0.09
Nodes (27): DriverProgressEntry, DriverProgressPanel(), DriverProgressPanelProps, F1CarSilhouette(), F1CarSilhouetteProps, PodiumModal(), PodiumModalProps, END_REASON (+19 more)

### Community 36 - "BoxControls.tsx"
Cohesion: 0.09
Nodes (32): BoxControls(), CROSSOVER_LABEL, decimal(), ORDER_STATUS, reduceMotion(), rpmText(), WallSpeedometer(), CompoundBadge() (+24 more)

### Community 37 - "VoiceBlindTest.tsx"
Cohesion: 0.05
Nodes (62): @diffusionstudio/piper-wasm, @diffusionstudio/vits-web, BLIND_PHRASES, BLIND_RESULT_KEY, BlindEngine, BlindPick, BlindResult, BlindTrial (+54 more)

### Community 38 - "RadioPanel.tsx"
Cohesion: 0.06
Nodes (42): callChooser, RadioPanel(), STATUS_LABEL, useDriverCalls(), usePushToTalk(), driverRadio, CLASSES, driverSays() (+34 more)

### Community 39 - "Log suite N3"
Cohesion: 0.06
Nodes (42): Order acknowledgement protocol ({type:ack, seq, ok, reason}), box-orders (Q9, Q10): 65 PASS, Career T4.x modules (finance, costs, facilities, pit crew, sponsors, hub, board, academy, staff, practice), circuit-quality (G1): 347 PASS, contracts-t47 (T4.7): 198 PASS, documentation (Regla de Oro 6): 4 PASS, drs-detection (Q19): 16 PASS, drs-references (Q19): 141 PASS (+34 more)

### Community 40 - "DriverSheet.tsx"
Cohesion: 0.20
Nodes (11): DriverAttributesCard(), DriverAttributesCardProps, oneDecimal(), Bar(), DriverSheet(), Facts(), pct(), Tab (+3 more)

### Community 41 - "devMode.ts"
Cohesion: 0.18
Nodes (8): DEV_MODE_KEY, DEV_TAP_WINDOW_MS, DEV_TAPS, DEV_TOOLS, DevTool, devToolsAllowed(), isDevMode(), StorageLike

### Community 42 - "RaceSimulation.ts"
Cohesion: 0.05
Nodes (44): RunoffZone, AQUAPLANING, aquaplaningReason(), aquaplaningRiskPerSec(), BRAKE_WINDOW, brakeDecelFactor(), brakeTempStep(), engineTempStep() (+36 more)

### Community 43 - "usage.ts"
Cohesion: 0.11
Nodes (16): RoomBackend, UsageMeter(), DirectConnector, DirectListener, createWebRtcConnector(), createWebRtcListener(), ICE_SERVERS, blockedConnector (+8 more)

### Community 44 - "ruleSets.ts"
Cohesion: 0.06
Nodes (22): FIA_2025_VALUES, GAME_2025_VALUES, GAME_KEYS, GameKey, ORIGINS, REGULATION_KEYS, RegulationKey, RULE_SETS (+14 more)

### Community 45 - "Dataset del modelo de radio"
Cohesion: 0.05
Nodes (34): A_FORMS, A_RE, ALL_NAMES, ARGS, AT_LAP, B_FORMS, B_RE, base (+26 more)

### Community 46 - "Facilities.ts"
Cohesion: 0.12
Nodes (31): FacilitiesPanel(), Pips(), NewCareerScreen(), TEAM_ORDER, Row(), STEPS, WinterScreen(), teamDifficulty() (+23 more)

### Community 47 - "DecisionVisual.tsx"
Cohesion: 0.18
Nodes (15): DecisionVisual(), PartViewer, VISUAL_SOURCES, inPart(), PartViewer(), CAR_PARTS, CarPart, FACILITY_ALT (+7 more)

### Community 48 - "Despliegue y flujo de trabajo"
Cohesion: 0.07
Nodes (30): Workflow Deploy to GitHub Pages, Variable PAGES_SOLO_LANDING, Proyecto Firebase f1sim-d5085, Workflow Deploy game to Firebase Hosting, Flujo de trabajo con DASHBOARD.md y sync:tasks, Línea **Orden vigente:** (tarea actual y siguiente), Rama por sprint y PR a main, Delegar en el estratega (+22 more)

### Community 49 - "Cámaras 3D"
Cohesion: 0.11
Nodes (24): CAMERA_LABELS, CAMERA_MODES, CameraMode3D, CameraView, CarPose, CENITAL_HEIGHT, cenitalGiroView(), cenitalView() (+16 more)

### Community 50 - "Diseño visual Sprint 4"
Cohesion: 0.11
Nodes (30): Autoguardado visible y menú «Partida», Carrera libre como modo aparte, Centro de gestión (Inicio, Carrera, Equipo, Fábrica, Finanzas, Temporada), Sprint 4 — diseño visual de la gestión: entrevista y decisiones, Elegir equipo (se elige equipo, no piloto), Fábrica: coche en el centro, proyectos e instalaciones, Finanzas: saldo, gráfica y libro, Iconos lucide-react (+22 more)

### Community 51 - "AiStatusBadge.tsx"
Cohesion: 0.15
Nodes (15): AiStatusBadge(), LiveAiStatusBadge(), useAiStatusSummary(), RaceMenu(), RaceMenuProps, RadioSettings, AiStatusInput, AiStatusItem (+7 more)

### Community 52 - ".issueBoxOrder"
Cohesion: 0.29
Nodes (7): commitmentT(), nextCrossing(), normalizeLap(), orderIsActive(), updateOrderCommitment(), BoxOrder, BoxOrderIssuer

### Community 53 - "Auditoría Q12-Q19"
Cohesion: 0.14
Nodes (28): DASHBOARD.md (fuente de verdad del plan), Auditoría Q12–Q19 (Sprint 2.8), drsDetections, getRejoinProjection, Q12 Modos de ritmo, Q13 Predictor de reincorporación, Q14 Movimiento en neutralizaciones, Q15 Banderas azules (+20 more)

### Community 54 - "LlmEngine.ts"
Cohesion: 0.05
Nodes (65): INTENT_KINDS, keywordInterpreter, createFinetunedInterpreter(), finetunedParse(), keywords(), SCHEDULED_REASON, selectedIds(), AiState (+57 more)

### Community 55 - "Tests de hosting y clasificador"
Cohesion: 0.13
Nodes (15): root, run(), walk(), run(), never(), run(), tick(), never() (+7 more)

### Community 56 - "Clasificación en directo"
Cohesion: 0.11
Nodes (30): fitOutline(), OutlinePoint, QualifyingLive(), QualifyingResultsProps, GridChange, formatLapTime(), GridSlot, QualiCompound (+22 more)

### Community 57 - "CarShowcase.tsx"
Cohesion: 0.33
Nodes (9): Car3DViewer, CarShowcase(), CarShowcaseProps, supportsWebGL(), ModelCredit(), ModelCreditProps, SafetyCar3D, SafetyCarShowcase() (+1 more)

### Community 58 - "HomeScreen.tsx"
Cohesion: 0.06
Nodes (59): BoardPanel(), ComponentsPanelProps, Props, F1WheelSvg(), F1WheelSvgProps, FlagIcon(), HomeScreen(), HomeScreenProps (+51 more)

### Community 59 - "Log suite N5"
Cohesion: 0.10
Nodes (28): circuit-quality (G1): 347 PASS, Direct (WebRTC/STUN) vs fallback (Firebase) link modes, documentation suite (Regla de Oro 6): dashboard/index sync, engine-host-n2 suite (N2): 39 PASS, FAIL N5: lost order not resent within 2 s / not applied once and acked, FAIL N5: first order after reload is not applied (direct and fallback), FAIL N5: retry that does not open in 5 s is not abandoned, Fast / slow / team views (+20 more)

### Community 60 - "carDots.ts"
Cohesion: 0.20
Nodes (10): CAR_LENGTH_M, CAR_LOD_M, carLevel, CarPlan, CarPlanInput, DOT_HYSTERESIS, DOT_PX, dotStyle (+2 more)

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
Nodes (52): ICON, PracticeLearned(), PracticePanel(), setupText(), SetupCompare(), SHORT, SetupPanel(), SetupPanelProps (+44 more)

### Community 65 - "DASHBOARD"
Cohesion: 0.10
Nodes (23): FIA 2025 F1 Sporting Regulations (Issue 5), FIA 2025 F1 Technical Regulations (Issue 3), MOB01: seguimiento móvil de solo lectura (sustituida por Sprint 5), Q16: ERS, combustible y penalización térmica, R01: perfil de reglas versionado y procedencia, R02: cronometraje por cruces y tráfico físico, R03: datos de evento y geometría con unidades, R07: juegos de neumáticos e inventario legal (+15 more)

### Community 66 - "GuestTransport"
Cohesion: 0.05
Nodes (25): fromDb(), LINK_TIMING, LinkAction, LinkMachine, LinkMode, OrderInbox, OrderOutbox, acksPath() (+17 more)

### Community 67 - "svgTrackParser.ts"
Cohesion: 0.05
Nodes (54): Geometría: svgTrackParser a escala real (1 unidad = 1 m), Análisis de rectas de los 22 circuitos, Circuitos sin SVG (monza, silverstone, spa, red_bull_ring, …), Muestras x,y del trazado SVG cada 0.1 de t, Análisis de las tres rectas principales por circuito, 23 circuitos a escala real, Física: velocidad por radio, trazada de mínima curvatura, rebufo, neumáticos, ERS, apexes() (+46 more)

### Community 68 - "liveries.ts"
Cohesion: 0.25
Nodes (7): DEFAULT_LIVERY, LIVERIES, Livery, ModelCredit, SAFETY_CAR_LIVERY, SPONSOR_NOTE, SPONSORS

### Community 70 - "fakeDb"
Cohesion: 0.23
Nodes (13): run(), run(), run(), run(), run(), run(), run(), clone() (+5 more)

### Community 72 - "DASHBOARD (2)"
Cohesion: 0.10
Nodes (22): G11: circuitos en 3D con Blender, G2: escala real, un metro por unidad, Motorsport Manager 2 (inspiración), Q7: anchura de pista variable y capacidad de adelantamiento, R22: clima físico mínimo y decisiones de seguridad, R43: fluidez de conducción en pantalla (interpolación de pose), R44: lluvia visible y radar meteorológico, R45: atributos de piloto y mejora entre carreras (+14 more)

### Community 73 - "build dashboard"
Cohesion: 0.12
Nodes (20): ahead(), bySprint, clean(), closedSprints, detail, esc(), group(), index (+12 more)

### Community 74 - "RaceResult.ts"
Cohesion: 0.06
Nodes (25): R13: comisarios y sanciones ejecutables, CLASSIFIED_FRACTION, classify(), compareByResults(), ConstructorRow, constructorStandings(), EndReason, POINTS_2025 (+17 more)

### Community 75 - "Leaderboard.tsx"
Cohesion: 0.12
Nodes (13): animejs, D20LuckModal(), D20LuckModalProps, D20LuckResult(), COUNTRY_TO_ISO, EMOJI_TO_ISO, FlagIconProps, Leaderboard() (+5 more)

### Community 77 - "DASHBOARD (3)"
Cohesion: 0.11
Nodes (19): docs/design/grill-sprint4-visual.md (diseño de la gestión), R19: vida de componentes y cupos de temporada, Sprint 4: director de equipo, gestión entre carreras (T4.1-T4.24), T4.10: junta y objetivos de temporada, T4.11: cambio de temporada (invierno), T4.12: tiempo por circuito y neumático de salida, T4.17: pulido y limpieza, T4.18: maqueta navegable de la gestión (+11 more)

### Community 78 - "DASHBOARD (4)"
Cohesion: 0.18
Nodes (19): Alojamiento del modelo en Hugging Face con commit fijado, IA10: radio con el modelo propio ajustado (q0f16 / q4), IA1: catálogo de órdenes de radio e intérprete por palabras clave, IA2: respuestas de los pilotos y voz (Web Speech), IA3: obediencia del piloto según su carácter, IA4: ajustes de la radio y gestión del modelo (ModelStore), IA5: modelo de IA en el navegador con WebLLM (evaluación), IA6: voces Piper y órdenes por micro (Whisper) (+11 more)

### Community 79 - "Hub.ts"
Cohesion: 0.07
Nodes (50): ComponentsPanel(), GridPenaltyNoticeProps, ICONS, costText(), DECISION_CARDS, DecisionVisual, HubHome(), NextRace (+42 more)

### Community 80 - "compoundStyle"
Cohesion: 0.21
Nodes (10): Car3DViewer(), Car3DViewerProps, StintSegment, stintSegments(), buildCarModelSpec(), CarModelInput, CarModelSpec, CarPart (+2 more)

### Community 81 - "tsconfig"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, isolatedModules, jsx, lib, module (+11 more)

### Community 82 - "DASHBOARD (5)"
Cohesion: 0.12
Nodes (11): Correcciones de auditoría C1-C7 y A1-A6 (SC, boxes, mutaciones), Comandos de verificación (sync:tasks, check:tasks, test-suite, build), Deuda técnica M1-M10 y B1-B7 (capas del monoplaza, desgaste por rueda, limpieza), F1 Simulator Dashboard & Plan de Implementación, Para valorar más adelante: grabaciones de audio, sesiones jugables, PWA sin internet, Roadmap y estado global de sprints, Sprint 1: trazado SVG Barcelona, core loop, timing tower, cámaras, Sprint 2: SC físico, undercut/overcut, monoplaza vectorial 2D (+3 more)

### Community 83 - "radioFilter.ts"
Cohesion: 0.05
Nodes (31): AudioContextLike, buildRadioChain(), ENGINE_BASE_HZ, ENGINE_LEVEL, ENGINE_LOOP_REVS, ENGINE_NOISE_DB, ENGINE_ORDERS_DB, ENGINE_REF_RPM (+23 more)

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

### Community 88 - "package.json"
Cohesion: 0.06
Nodes (31): devDependencies, @firebase/rules-unit-testing, firebase-tools, @types/node, @types/react, @types/react-dom, typescript, vite (+23 more)

### Community 89 - "ia6-run.mjs"
Cohesion: 0.25
Nodes (5): chrome, res, t0, waiting, ws

### Community 90 - "q20 apply redraw"
Cohesion: 0.12
Nodes (9): calendar, circuits, meta, R, refs, report, root, routes (+1 more)

### Community 91 - "TrackLayerGL"
Cohesion: 0.09
Nodes (14): ASPHALT, contrastRatio(), DRS_SLOT_COLOR, luminance(), MIN_SIGNAL_CONTRAST, Signal, SIGNALS, SPRAY (+6 more)

### Community 92 - "DASHBOARD (8)"
Cohesion: 0.13
Nodes (14): G10: repaso de los 23 circuitos, G1: banco de medidas y página de revisión de circuitos, G3: eje suave y remuestreado, G4: bordes, asfalto y arcenes de una sola fuente, G5: trazada de mínima curvatura y coches que la siguen, G6: boxes fuera de la pista, G7: línea de meta y parrilla, G8: pista en WebGL (PixiJS) (+6 more)

### Community 93 - "DASHBOARD (9)"
Cohesion: 0.13
Nodes (14): Q14: SC y bandera roja sin asignaciones de posición, R10: SC, desdoblamiento y relanzamiento, R29-R34: rediseño de escritorio (paddock, muro, accesibilidad), Sprint 3.7: rediseño visual y adaptación a móvil y tableta (V1-V10), T4.13: entrenamientos libres, V10: Safety Car, recogida del pelotón, V1: base visual y auditoría repetible (__uiAudit), V2: carrera adaptada a móvil y tableta (RaceTabs) (+6 more)

### Community 94 - "modelScene.ts"
Cohesion: 0.18
Nodes (18): three, SafetyCar3D(), applyLivery(), DECAL_BACKGROUND, decalTexts(), liveryColors(), MeshLike, Paintable (+10 more)

### Community 95 - "q20 redraw"
Cohesion: 0.17
Nodes (9): catmullRomClosed(), centers, cumulative(), dist(), dtw(), osm, resampleClosed(), results (+1 more)

### Community 96 - "Multijugador: puesta en marcha, prueba entre redes y consumo"
Cohesion: 0.14
Nodes (15): database.rules.json, El anfitrión corre el motor (Web Worker), Multijugador: puesta en marcha, prueba entre redes y consumo, Flujo firebase-hosting.yml (N11), Firebase como punto de encuentro (sala y señalización), Medidor de consumo ?medir, Plan gratuito Spark (100 conexiones, 1 GB, 10 GB/mes), Proyecto Firebase f1sim-d5085 (+7 more)

### Community 97 - "WeatherScenarioSelect.tsx"
Cohesion: 0.50
Nodes (3): ICONS, WeatherScenarioSelectProps, WEATHER_SCENARIOS

### Community 98 - "package (2)"
Cohesion: 0.12
Nodes (16): dependencies, animejs, @diffusionstudio/piper-wasm, @diffusionstudio/vits-web, firebase, @huggingface/transformers, lucide-react, @mlc-ai/web-llm (+8 more)

### Community 99 - "figura boxes"
Cohesion: 0.34
Nodes (13): crono(), montar(), colocar(), fotograma(), leer(), ordenar(), pintar(), reposo() (+5 more)

### Community 100 - "eventData.ts"
Cohesion: 0.20
Nodes (9): EVENT_DATA_IDS, EventData, EventLine, EventLineKind, inRange(), Provenance, PROVENANCES, UNIT (+1 more)

### Community 101 - "scenarioRegistry.ts"
Cohesion: 0.13
Nodes (23): Escenarios visuales por circuito (getScenario), barcelonaScenario, buildProfile(), calendarScenarios, profiles, VisualProfile, defaultScenario, monacoScenario (+15 more)

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
Cohesion: 0.13
Nodes (14): chooseLandingCompound(), COMPOUND_COLORS, CompoundStorage, createBremboF1Caliper(), createCrossDrilledBrakeRotorTexture(), createSidewallDecalTexture(), createTreadBumpTexture(), F1Wheel3D() (+6 more)

### Community 116 - "trackGeometry"
Cohesion: 0.19
Nodes (6): createTrackScale(), normalizeT(), Point, polylineLength(), trackInterval, TrackScale

### Community 117 - "bench"
Cohesion: 0.29
Nodes (11): run(), run(), ALL_SCENARIOS, BASELINE_PATH, compareToBaseline(), CONTINUOUS, CONTINUOUS_TOLERANCE, createBench() (+3 more)

### Community 118 - "scenery models (3)"
Cohesion: 0.26
Nodes (7): build_all(), build_car_lod(), casino(), clear(), finish(), prism(), scene()

### Community 119 - "SettingsScreen.tsx"
Cohesion: 0.19
Nodes (15): parseAudioLevel(), SettingsAudio, SettingsScreen(), SHORTCUTS, toolHref(), Segmented(), SegmentOption, createDevTapCounter() (+7 more)

### Community 120 - "scenery models (4)"
Cohesion: 0.15
Nodes (6): floodlight(), foro_sol(), grandstand(), peralte(), the_wing(), torre_doncella()

### Community 121 - "build"
Cohesion: 0.15
Nodes (3): CHOICE, out, out

### Community 122 - "n3 run1"
Cohesion: 0.14
Nodes (16): Engine order kinds (devSafetyCar, devRedFlag, pause, speed, luckReward, luckClear, luckVariant, confirmStart, startSequence, dnfClear, endSuspended, confirmResult, weatherTest), sendOrder (EngineOrder to RaceSession), Documentation fail: dashboard and index aligned, engine-host-n2 test module (N2, 39 PASS), race-session-n3 test module (N3), R53 fail: weather panel shows radar forecast, N3 test suite run 1 (1085 PASS, 13 FAIL, 33 modules), T4.14 fail: app enables rival team orders and notices (+8 more)

### Community 123 - "capture radio ia5"
Cohesion: 0.24
Nodes (11): chrome, evaluate(), open(), requests, run(), send(), shot(), size() (+3 more)

### Community 124 - "webSpeechStt.ts"
Cohesion: 0.18
Nodes (3): Recognizer, RecognitionLike, ResultLike

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

### Community 129 - "main.tsx"
Cohesion: 0.15
Nodes (9): Punto de entrada de la app (#root, /src/main.tsx), AppErrorBoundary, PerfOverlay(), perfStats, params, renderApp(), REVIEWS, revision (+1 more)

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

### Community 134 - "llm/runtime.ts"
Cohesion: 0.09
Nodes (24): @mlc-ai/web-llm, useRadioModeCheck(), CATALOG_VERSION, handler, radioAi, createWebllmEngine(), radioAppConfig(), ModelManifest (+16 more)

### Community 135 - "parody names"
Cohesion: 0.24
Nodes (10): BRANDS, DRIVER_NAMES, ENGINES, files(), REAL_DRIVERS, run(), stripComments(), SURNAMES (+2 more)

### Community 136 - "eval ia10 q0f16"
Cohesion: 0.22
Nodes (10): F1-Radio-0.5B-q0f16-MLC model, IA10 eval: F1-Radio-0.5B-q0f16-MLC (WebGPU), Radio intent classes (boxes, anular-boxes, ritmo-*, equipo-*, propuesta-*, delegar-*, ninguna, orden-doble), Reserva v3 holdout dataset (101 phrases), F1-Radio-0.5B-q4f16_1-MLC model, IA10 eval: F1-Radio-0.5B-q4f16_1-MLC (partial run), HF repo gooday89/F1-Radio-0.5B-q0f16-MLC (~1 GB), HF repo gooday89/F1-Radio-0.5B-q4f16_1-MLC (~290 MB) (+2 more)

### Community 137 - "Costs.ts"
Cohesion: 0.05
Nodes (80): DevelopmentPanel(), DevelopmentPanelProps, STATUS_LABEL, BalanceChart(), byKind(), FinancePanel(), aiDevelopPaying(), aiReplaceComponents() (+72 more)

### Community 138 - "pit route"
Cohesion: 0.31
Nodes (9): centerAt(), CIRCUITS, circularDelta(), dist(), distanceToRoute(), median(), REFERENCE_CIRCUITS, references (+1 more)

### Community 139 - "f1 architecture rendered"
Cohesion: 0.25
Nodes (9): App.tsx (Game Loop & UI, React, frontend), Archify 2.17.0-dev.1 (diagram generator/viewer), F1 Simulator Architecture Diagram, Archify interactive viewer (route probe, semantic lens, radar, export), Math & Utils (carPosition, spline), RaceSimulation (Core Physics, 60 Hz), Renderers (Track, Car, Camera; Canvas), Simulation Models (Pit, SC, Tires) (+1 more)

### Community 140 - "LapStrip.tsx"
Cohesion: 0.33
Nodes (5): LapStrip(), LapStripCar, LapStripDot, lapStripDots(), NEAR_LINE

### Community 141 - "racing-line-geometry.mjs"
Cohesion: 0.60
Nodes (3): run(), run(), recordingCanvas()

### Community 142 - "scenery 3d 3"
Cohesion: 0.18
Nodes (14): area(), glbInfo(), inside(), REAL_SPONSORS, run(), word(), glbInfo(), HOT (+6 more)

### Community 143 - "Brief: revisión de diseño y refactor UX/UI de F1Sim"
Cohesion: 0.06
Nodes (28): Bloque R29–R34 (rediseño Sprint 2.9), R39: el Muro tapa el circuito, Tamaños objetivo 1024×768–1920×1080 (R30), Clasificación compacta de 20 pilotos, Rediseño de F1Sim — entrevista y decisiones, Entrevista GrillMe (cuatro rondas), Menú «Herramientas de desarrollo» (SC y bandera roja), Identidad visual grafito, marfil y rojo de acción (+20 more)

### Community 144 - "CONTEXT"
Cohesion: 0.25
Nodes (8): Aquaplaning, Escapatoria, Nubosidad, Radar, Perfil personalizado / perfil FIA 2025, Salida de pista, Trazada, Meteorología: celdas de lluvia, radar, agua, aquaplaning

### Community 145 - "AudioEngine"
Cohesion: 0.16
Nodes (3): AudioContextLike, AudioEngine, SoundId

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

### Community 154 - "OvertakingZones.ts"
Cohesion: 0.17
Nodes (10): cache, computeOvertakingZones(), contains(), OvertakingZone, overtakingZonesOf(), referenceKmh(), zoneAt(), ZonePoint (+2 more)

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

### Community 159 - "useTweenedNumber.ts"
Cohesion: 0.60
Nodes (4): speedReadout(), tweenStart(), tweenValue(), useTweenedNumber()

### Community 160 - "ref_node_child_process"
Cohesion: 0.24
Nodes (9): @firebase/rules-unit-testing, run(), startEmulator(), stopEmulator(), up(), run(), startEmulator(), stopEmulator() (+1 more)

### Community 161 - "n3 canvas"
Cohesion: 0.33
Nodes (5): at, bottom, o, orig, top

### Community 162 - "LEEME"
Cohesion: 0.33
Nodes (6): Q20 comparison: OSM pit lane vs track SVG overlays (8 circuits), buildTrackFromSvg, find-rels.cjs / dl-rels.cjs / build.cjs / meta.cjs / q20-fixture.cjs, Q20 pit-lane references from OpenStreetMap (tool pipeline), tests/fixtures/pit-lane-references.json, q20-align.mjs (fit OSM to buildTrackFromSvg track)

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

### Community 172 - "modal lifecycle"
Cohesion: 0.70
Nodes (4): dependencyArrays(), read(), run(), stateUpdaters()

### Community 173 - "radio replies ia2"
Cohesion: 0.60
Nodes (4): run(), SURNAMES, tick(), word()

### Community 174 - "uiAudit.ts"
Cohesion: 0.83
Nodes (3): name(), uiAudit, visible()

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

### Community 192 - "voice/runtime.ts"
Cohesion: 0.18
Nodes (10): AUDIO_LEVEL_LABEL, AUDIO_LEVELS, AUDIO_STORAGE_KEY, AudioSnapshot, FLAG_SOUND, LIGHTS, pending, SOUND_IDS (+2 more)

### Community 195 - "kw-audit.mjs"
Cohesion: 0.40
Nodes (4): f, right, toModel, wrongOk

### Community 196 - "q15-debug.mjs"
Cohesion: 0.50
Nodes (4): a, b, frac(), mk()

### Community 199 - "voice/runtime.ts"
Cohesion: 0.15
Nodes (8): browserSpeaker(), createSystemSpeaker(), pickVoice(), Speaker, SynthLike, UtteranceCtor, UtteranceLike, VoiceLike

### Community 201 - "Wall.ts"
Cohesion: 0.08
Nodes (31): DrsStatusBadgeProps, LABEL, decimal(), DRS_FLAP_SECONDS, DrsDetection, DrsReading, DrsState, drsStatus (+23 more)

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
Cohesion: 0.25
Nodes (7): `f1-car.glb`, `f1-car-piezas.glb`, Imágenes del centro de temporada (`public/hub/`), Modelos 3D de terceros, `safety-car.glb`, Créditos: TUMFTM y MultiViewer API, MODELS

### Community 208 - "SaveStore"
Cohesion: 0.22
Nodes (5): App(), newRaceSeed(), playerDriverIds(), SaveStore, StorageLike

### Community 209 - "R28: guardado, reinicio y calidad de datos (snapshot)"
Cohesion: 0.25
Nodes (8): Q18: reconciliación de timers y reset limpio, R06: cuatro neumáticos con temperatura, carga y desgaste, R28: guardado, reinicio y calidad de datos (snapshot), R48: cargar y continuar una partida (snapshot v2), Sprint 3: audio, telemetría, radar y clima (T3.1-T3.4), T3.1: escapatorias vs muros (duración del SC, Runoff.ts), T3.3: compuestos intermedio y wet (físicas de agua), T3.4: pista mojada y spray de partículas

### Community 210 - "WeatherModel.ts"
Cohesion: 0.06
Nodes (33): cell, minutes(), RainForecastPanel(), RainForecastPanelProps, DRY_DRAW, RAIN_DRAW, WEATHER_TESTS, weatherLayers (+25 more)

### Community 211 - "q13-model.mjs"
Cohesion: 0.83
Nodes (3): model(), run(), vTarget()

### Community 212 - "UX11 — Prueba en dispositivos reales"
Cohesion: 0.20
Nodes (9): 1. Inicio y menú — UX1, 2. Ajustes — UX2 y UX3, 3. Descargas de la radio — UX4, 4. Una carrera — UX5, UX6, UX7, UX8, UX13 y UX14, 5. La temporada — UX9 y UX10, 6. Carrera libre por pasos — UX12, Antes de empezar, Resultado (+1 more)

### Community 213 - "Modelo propio de la radio: ciclo de mejora (IA7)"
Cohesion: 0.50
Nodes (3): Cambio de versión en el juego, El ciclo, Modelo propio de la radio: ciclo de mejora (IA7)

## Knowledge Gaps
- **191 isolated node(s):** `firebase-tools`, `@types/animejs`, `@types/node`, `@types/react`, `@types/react-dom` (+186 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1679 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Tests de React y carrera` to `App.tsx`, `main.tsx`, `Tests de carrera y banderas`, `Pilotos, contratos y reserva`, `carPosition.ts`, `f1.ts`, `RadioSettings.tsx`, `Referencias externas del App`, `Costs.ts`, `RoomFlow.tsx`, `Banco de respuestas de pilotos`, `RaceCanvas.tsx`, `Tests con Node y auditoría radio`, `Motor en Worker (N3)`, `Random.ts`, `FreeRaceWizard.tsx`, `teams.ts`, `RadioEval.tsx`, `BottomTelemetryDock.tsx`, `useTweenedNumber.ts`, `DriverDevelopment.ts`, `BoxControls.tsx`, `VoiceBlindTest.tsx`, `RadioPanel.tsx`, `DriverSheet.tsx`, `usage.ts`, `Facilities.ts`, `DecisionVisual.tsx`, `AiStatusBadge.tsx`, `Clasificación en directo`, `CarShowcase.tsx`, `HomeScreen.tsx`, `Practice.ts`, `weather-fronts-t32.mjs`, `RaceCanvas top`, `fakeDb`, `Wall.ts`, `kw-holdout.mjs`, `Leaderboard.tsx`, `Hub.ts`, `compoundStyle`, `WeatherModel.ts`, `package.json`, `modelScene.ts`, `WeatherScenarioSelect.tsx`, `F1Wheel3D.tsx`, `SettingsScreen.tsx`?**
  _High betweenness centrality (0.307) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `App()` (e.g. with `.run()` and `projectCost()`) actually correct?**
  _`App()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `firebase-tools`, `@types/animejs`, `@types/node` to the rest of the system?**
  _191 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.034571062740076826 - nodes in this community are weakly interconnected._
- **Why does `RaceSimulation` connect `RaceSimulation` to `App.tsx`, `carPosition.ts`, `f1.ts`, `RoomFlow.tsx`, `CarState`, `EngineHost.ts`, `RaceSimulation.ts`, `RaceCanvas.tsx`, `Reglas de neumáticos`, `Sesión de carrera en red`, `Motor en Worker (N3)`, `Random.ts`, `OvertakingZones.ts`, `Snapshot.ts`, `TrackDefinition`, `n1/engine.worker.ts`, `RaceSimulation.ts`, `ruleSets.ts`, `.issueBoxOrder`, `HomeScreen.tsx`, `Practice.ts`, `Wall.ts`, `RaceResult.ts`, `WeatherModel.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Should `Tests de carrera y banderas` be split into smaller, more focused modules?**
  _Cohesion score 0.03649254509435929 - nodes in this community are weakly interconnected._
- **Why does `CarState` connect `CarState` to `App.tsx`, `RaceSimulation`, `RaceScene3D.ts`, `carPosition.ts`, `f1.ts`, `RaceSimulation.ts`, `RaceCanvas.tsx`, `Detalle visual del coche`, `Reglas de neumáticos`, `Motor en Worker (N3)`, `Random.ts`, `Snapshot.ts`, `FreeRaceWizard.tsx`, `Brief: revisión de diseño y refactor UX/UI de F1Sim`, `RadioEval.tsx`, `BottomTelemetryDock.tsx`, `TrackDefinition`, `DriverDevelopment.ts`, `BoxControls.tsx`, `RadioPanel.tsx`, `RaceSimulation.ts`, `Cámaras 3D`, `.issueBoxOrder`, `Wall.ts`, `RaceResult.ts`, `Leaderboard.tsx`, `TrackLayerGL`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._