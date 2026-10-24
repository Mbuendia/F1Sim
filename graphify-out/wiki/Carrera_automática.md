# Carrera automática

> 27 nodes

## Key Concepts

- **.getCarById()** (33 connections) — `simulation/RaceSimulation.ts`
- **.order()** (24 connections) — `engine/EngineHost.ts`
- **teamView** (20 connections) — `engine/RaceView.ts`
- **.getRejoinEstimate()** (9 connections) — `simulation/RaceSimulation.ts`
- **advanceAutoRace()** (8 connections) — `simulation/AutoRace.ts`
- **.acceptWallProposal()** (8 connections) — `simulation/RaceSimulation.ts`
- **startAutoRace()** (7 connections) — `simulation/AutoRace.ts`
- **.getTyreCrossover()** (7 connections) — `simulation/RaceSimulation.ts`
- **AutoRace.ts** (7 connections) — `simulation/AutoRace.ts`
- **.getPaceStatus()** (6 connections) — `simulation/RaceSimulation.ts`
- **.setFixedStep()** (6 connections) — `simulation/RaceSimulation.ts`
- **.setWallDelegation()** (6 connections) — `simulation/RaceSimulation.ts`
- **.getRejoinProjection()** (5 connections) — `simulation/RaceSimulation.ts`
- **.issuePaceOrder()** (5 connections) — `simulation/RaceSimulation.ts`
- **.setSpeed()** (5 connections) — `simulation/RaceSimulation.ts`
- **.applyLuckEventReward()** (4 connections) — `simulation/RaceSimulation.ts`
- **.cancelBoxOrder()** (4 connections) — `simulation/RaceSimulation.ts`
- **.getWallProposals()** (4 connections) — `simulation/RaceSimulation.ts`
- **.rejoinPositionAt()** (4 connections) — `simulation/RaceSimulation.ts`
- **TyreClass** (3 connections) — `simulation/WeatherModel.ts`
- **.confirmRaceStart()** (3 connections) — `simulation/RaceSimulation.ts`
- **.discardWallProposal()** (3 connections) — `simulation/RaceSimulation.ts`
- **tyreClassOf()** (3 connections) — `simulation/WeatherModel.ts`
- **autoRaceDone()** (2 connections) — `simulation/AutoRace.ts`
- **.getTeamOrder()** (2 connections) — `simulation/RaceSimulation.ts`
- *... and 2 more nodes in this community*

## Relationships

- [Simulación y Safety Car](Simulación_y_Safety_Car.md) (28 shared connections)
- [Paradas en boxes](Paradas_en_boxes.md) (16 shared connections)
- [Anfitrión del motor](Anfitrión_del_motor.md) (10 shared connections)
- [Avance de la simulación](Avance_de_la_simulación.md) (7 shared connections)
- [App y temporada](App_y_temporada.md) (6 shared connections)
- [Reincorporación y aerodinámica](Reincorporación_y_aerodinámica.md) (6 shared connections)
- [Comisarios y resultado](Comisarios_y_resultado.md) (4 shared connections)
- [Vistas e interpolación](Vistas_e_interpolación.md) (3 shared connections)
- [Carrera del anfitrión](Carrera_del_anfitrión.md) (3 shared connections)
- [Meteorología](Meteorología.md) (3 shared connections)
- [Neumáticos y estratega](Neumáticos_y_estratega.md) (3 shared connections)
- [Revisión del invitado](Revisión_del_invitado.md) (2 shared connections)

## Source Files

- `engine/EngineHost.ts`
- `engine/RaceView.ts`
- `simulation/AutoRace.ts`
- `simulation/RaceSimulation.ts`
- `simulation/WeatherModel.ts`

## Audit Trail

- EXTRACTED: 104 (70%)
- INFERRED: 44 (30%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*