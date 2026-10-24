# Motor en worker

> 8 nodes

## Key Concepts

- **engineCore.ts** (15 connections) — `engine/engineCore.ts`
- **LocalLink.ts** (12 connections) — `engine/LocalLink.ts`
- **createEngine()** (10 connections) — `engine/engineCore.ts`
- **engine.worker.ts** (7 connections) — `engine/engine.worker.ts`
- **EngineInit** (3 connections) — `engine/engineCore.ts`
- **EngineMessage** (2 connections) — `engine/EngineHost.ts`
- **post()** (2 connections) — `engine/engine.worker.ts`
- **tick()** (2 connections) — `engine/engine.worker.ts`

## Relationships

- [Sesión de carrera compartida](Sesión_de_carrera_compartida.md) (7 shared connections)
- [Anfitrión del motor](Anfitrión_del_motor.md) (6 shared connections)
- [Límites multijugador](Límites_multijugador.md) (4 shared connections)
- [Simulación y Safety Car](Simulación_y_Safety_Car.md) (2 shared connections)
- [Enlace local](Enlace_local.md) (2 shared connections)
- [Avance de la simulación](Avance_de_la_simulación.md) (2 shared connections)
- [App y temporada](App_y_temporada.md) (2 shared connections)
- [Carrera automática](Carrera_automática.md) (1 shared connections)
- [Pantallas de sala](Pantallas_de_sala.md) (1 shared connections)
- [Carrera del anfitrión](Carrera_del_anfitrión.md) (1 shared connections)
- [Enlace con worker](Enlace_con_worker.md) (1 shared connections)

## Source Files

- `engine/EngineHost.ts`
- `engine/LocalLink.ts`
- `engine/engine.worker.ts`
- `engine/engineCore.ts`

## Audit Trail

- EXTRACTED: 37 (90%)
- INFERRED: 4 (10%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*