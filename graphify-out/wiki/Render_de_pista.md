# Render de pista

> 33 nodes

## Key Concepts

- **TrackDefinition** (68 connections) — `data/barcelonaTrack.ts`
- **Camera** (53 connections) — `renderer/Camera.ts`
- **.worldToScreen()** (20 connections) — `renderer/Camera.ts`
- **.renderTrack()** (19 connections) — `renderer/TrackRenderer.ts`
- **TrackRenderer** (18 connections) — `renderer/TrackRenderer.ts`
- **GuestRace()** (15 connections) — `components/RoomFlow.tsx`
- **.path()** (8 connections) — `renderer/TrackRenderer.ts`
- **.renderBarrierShadows()** (8 connections) — `renderer/TrackRenderer.ts`
- **.renderPitLane()** (7 connections) — `renderer/TrackRenderer.ts`
- **.scenarioFor()** (7 connections) — `renderer/TrackRenderer.ts`
- **.geometryFor()** (6 connections) — `renderer/TrackRenderer.ts`
- **.renderDrsMarkers()** (6 connections) — `renderer/TrackRenderer.ts`
- **.renderGrid()** (6 connections) — `renderer/TrackRenderer.ts`
- **.renderScenarioLayers()** (6 connections) — `renderer/TrackRenderer.ts`
- **ScenarioGeometry** (5 connections) — `utils/scenarioGeometry.ts`
- **.renderBarriers()** (5 connections) — `renderer/TrackRenderer.ts`
- **.renderCornerLabels()** (5 connections) — `renderer/TrackRenderer.ts`
- **.renderStartFinishLine()** (5 connections) — `renderer/TrackRenderer.ts`
- **.resetToFullTrack()** (4 connections) — `renderer/Camera.ts`
- **.setMode()** (4 connections) — `renderer/Camera.ts`
- **.update()** (4 connections) — `renderer/Camera.ts`
- **.racingLineFor()** (4 connections) — `renderer/TrackRenderer.ts`
- **.resize()** (3 connections) — `renderer/Camera.ts`
- **.cycleMode()** (2 connections) — `renderer/Camera.ts`
- **.labelsOnly()** (2 connections) — `renderer/TrackRenderer.ts`
- *... and 8 more nodes in this community*

## Relationships

- [Lienzo de carrera](Lienzo_de_carrera.md) (21 shared connections)
- [Pintado de coches](Pintado_de_coches.md) (17 shared connections)
- [Geometría de pista](Geometría_de_pista.md) (17 shared connections)
- [Capas WebGL y cámara](Capas_WebGL_y_cámara.md) (14 shared connections)
- [Cámaras 3D](Cámaras_3D.md) (7 shared connections)
- [Capa WebGL de pista](Capa_WebGL_de_pista.md) (6 shared connections)
- [Paradas en boxes](Paradas_en_boxes.md) (6 shared connections)
- [Reincorporación y aerodinámica](Reincorporación_y_aerodinámica.md) (5 shared connections)
- [App y temporada](App_y_temporada.md) (4 shared connections)
- [Escenario de la pista](Escenario_de_la_pista.md) (4 shared connections)
- [Posición del coche](Posición_del_coche.md) (4 shared connections)
- [Sesión de carrera compartida](Sesión_de_carrera_compartida.md) (4 shared connections)

## Source Files

- `components/RoomFlow.tsx`
- `data/barcelonaTrack.ts`
- `renderer/Camera.ts`
- `renderer/TrackRenderer.ts`
- `utils/scenarioGeometry.ts`

## Audit Trail

- EXTRACTED: 193 (90%)
- INFERRED: 21 (10%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*