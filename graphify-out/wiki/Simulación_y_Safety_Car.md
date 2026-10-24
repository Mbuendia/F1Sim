# Simulación y Safety Car

> 86 nodes

## Key Concepts

- **RaceSimulation** (203 connections) — `simulation/RaceSimulation.ts`
- **SafetyCarState** (29 connections) — `types/f1.ts`
- **.prepareRace()** (26 connections) — `simulation/RaceSimulation.ts`
- **RaceSnapshot** (17 connections) — `simulation/Snapshot.ts`
- **.respondToIncident()** (16 connections) — `simulation/RaceSimulation.ts`
- **Runoff.ts** (14 connections) — `simulation/Runoff.ts`
- **random()** (13 connections) — `simulation/Random.ts`
- **TrackWeatherState** (12 connections) — `types/f1.ts`
- **.stream()** (12 connections) — `simulation/RaceSimulation.ts`
- **DriverAttributes** (11 connections) — `simulation/DriverDevelopment.ts`
- **.frame()** (10 connections) — `renderer/RenderPose.ts`
- **.initRace()** (10 connections) — `simulation/RaceSimulation.ts`
- **D20LuckEvent** (9 connections) — `types/f1.ts`
- **.runoffSurfaceAt()** (9 connections) — `simulation/RaceSimulation.ts`
- **.triggerD20LuckRoll()** (9 connections) — `simulation/RaceSimulation.ts`
- **StartLightState** (8 connections) — `types/f1.ts`
- **.update()** (8 connections) — `simulation/RaceSimulation.ts`
- **RunoffZone** (7 connections) — `data/scenarioTypes.ts`
- **.applySafetyCarMinimum()** (7 connections) — `simulation/RaceSimulation.ts`
- **.deploySafetyCar()** (7 connections) — `simulation/RaceSimulation.ts`
- **.runWide()** (7 connections) — `simulation/RaceSimulation.ts`
- **.registerIncident()** (6 connections) — `simulation/IncidentModel.ts`
- **.reportIncident()** (6 connections) — `simulation/RaceSimulation.ts`
- **.setSafetyCarPhase()** (6 connections) — `simulation/RaceSimulation.ts`
- **.startRaceSequence()** (6 connections) — `simulation/RaceSimulation.ts`
- *... and 61 more nodes in this community*

## Relationships

- [Avance de la simulación](Avance_de_la_simulación.md) (57 shared connections)
- [Paradas en boxes](Paradas_en_boxes.md) (44 shared connections)
- [Carrera automática](Carrera_automática.md) (28 shared connections)
- [Incidentes y dirección](Incidentes_y_dirección.md) (27 shared connections)
- [Comisarios y resultado](Comisarios_y_resultado.md) (19 shared connections)
- [Reincorporación y aerodinámica](Reincorporación_y_aerodinámica.md) (13 shared connections)
- [Vistas e interpolación](Vistas_e_interpolación.md) (11 shared connections)
- [Academia y contratos](Academia_y_contratos.md) (11 shared connections)
- [Neumáticos y estratega](Neumáticos_y_estratega.md) (9 shared connections)
- [Motor y combustible](Motor_y_combustible.md) (8 shared connections)
- [App y temporada](App_y_temporada.md) (7 shared connections)
- [Posición del coche](Posición_del_coche.md) (6 shared connections)

## Source Files

- `components/RaceCanvas.tsx`
- `data/scenarioTypes.ts`
- `renderer/RenderPose.ts`
- `simulation/DRSModel.ts`
- `simulation/DriverDevelopment.ts`
- `simulation/IncidentModel.ts`
- `simulation/RaceSimulation.ts`
- `simulation/Random.ts`
- `simulation/Runoff.ts`
- `simulation/SafetyCarModel.ts`
- `simulation/Snapshot.ts`
- `simulation/Stewards.ts`
- `simulation/Weekend.ts`
- `types/f1.ts`

## Audit Trail

- EXTRACTED: 482 (96%)
- INFERRED: 18 (4%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*