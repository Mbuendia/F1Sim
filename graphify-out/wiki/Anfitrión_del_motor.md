# Anfitrión del motor

> 20 nodes

## Key Concepts

- **EngineHost** (34 connections) — `engine/EngineHost.ts`
- **.handle()** (11 connections) — `engine/EngineHost.ts`
- **.syncPlayers()** (9 connections) — `engine/EngineHost.ts`
- **.join()** (8 connections) — `engine/EngineHost.ts`
- **.dropped()** (5 connections) — `engine/EngineHost.ts`
- **.returned()** (5 connections) — `engine/EngineHost.ts`
- **isId()** (5 connections) — `engine/EngineHost.ts`
- **.capSpeed()** (4 connections) — `engine/EngineHost.ts`
- **.permission()** (4 connections) — `engine/EngineHost.ts`
- **.teamCars()** (4 connections) — `engine/EngineHost.ts`
- **.teamOfOrder()** (4 connections) — `engine/EngineHost.ts`
- **.constructor()** (3 connections) — `engine/EngineHost.ts`
- **.hasGuests()** (3 connections) — `engine/EngineHost.ts`
- **.leave()** (3 connections) — `engine/EngineHost.ts`
- **.players()** (3 connections) — `engine/EngineHost.ts`
- **.ownerOf()** (2 connections) — `engine/EngineHost.ts`
- **.setPlayerCars()** (2 connections) — `simulation/RaceSimulation.ts`
- **.isShared()** (1 connections) — `engine/EngineHost.ts`
- **.roleOf()** (1 connections) — `engine/EngineHost.ts`
- **.teamOf()** (1 connections) — `engine/EngineHost.ts`

## Relationships

- [Carrera automática](Carrera_automática.md) (10 shared connections)
- [Revisión del invitado](Revisión_del_invitado.md) (7 shared connections)
- [Motor en worker](Motor_en_worker.md) (6 shared connections)
- [Simulación y Safety Car](Simulación_y_Safety_Car.md) (3 shared connections)
- [Lienzo de carrera](Lienzo_de_carrera.md) (2 shared connections)
- [Enlace local](Enlace_local.md) (2 shared connections)
- [Límites multijugador](Límites_multijugador.md) (2 shared connections)
- [Instantáneas](Instantáneas.md) (2 shared connections)
- [Carrera del invitado](Carrera_del_invitado.md) (1 shared connections)
- [Muro de boxes](Muro_de_boxes.md) (1 shared connections)

## Source Files

- `engine/EngineHost.ts`
- `simulation/RaceSimulation.ts`

## Audit Trail

- EXTRACTED: 64 (86%)
- INFERRED: 10 (14%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*