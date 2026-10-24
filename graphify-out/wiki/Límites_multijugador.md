# Límites multijugador

> 14 nodes

## Key Concepts

- **EngineHost.ts** (45 connections) — `engine/EngineHost.ts`
- **limits.ts** (3 connections) — `engine/limits.ts`
- **MULTIPLAYER_LIMITS** (3 connections) — `engine/limits.ts`
- **TeamOrderMode** (2 connections) — `simulation/RaceSimulation.ts`
- **EngineHostOptions** (1 connections) — `engine/EngineHost.ts`
- **EngineRequest** (1 connections) — `engine/EngineHost.ts`
- **JoinResult** (1 connections) — `engine/EngineHost.ts`
- **Member** (1 connections) — `engine/EngineHost.ts`
- **PermissionCode** (1 connections) — `engine/EngineHost.ts`
- **CAR_ORDERS** (1 connections) — `engine/EngineHost.ts`
- **COMPOUNDS** (1 connections) — `engine/EngineHost.ts`
- **LUCK_ORDERS** (1 connections) — `engine/EngineHost.ts`
- **PACES** (1 connections) — `engine/EngineHost.ts`
- **TEAM_ORDERS** (1 connections) — `engine/EngineHost.ts`

## Relationships

- [Motor en worker](Motor_en_worker.md) (4 shared connections)
- [Instantáneas](Instantáneas.md) (3 shared connections)
- [Radio: panel y respuestas](Radio-_panel_y_respuestas.md) (3 shared connections)
- [Avance de la simulación](Avance_de_la_simulación.md) (2 shared connections)
- [Meteorología](Meteorología.md) (2 shared connections)
- [Vistas e interpolación](Vistas_e_interpolación.md) (2 shared connections)
- [Muro de boxes](Muro_de_boxes.md) (2 shared connections)
- [Carrera del invitado](Carrera_del_invitado.md) (2 shared connections)
- [Sesión de carrera compartida](Sesión_de_carrera_compartida.md) (2 shared connections)
- [Radio: palabras clave](Radio-_palabras_clave.md) (2 shared connections)
- [Anfitrión del motor](Anfitrión_del_motor.md) (2 shared connections)
- [Salas multijugador](Salas_multijugador.md) (2 shared connections)

## Source Files

- `engine/EngineHost.ts`
- `engine/limits.ts`
- `simulation/RaceSimulation.ts`

## Audit Trail

- EXTRACTED: 49 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*