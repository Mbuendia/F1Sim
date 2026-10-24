# Circuitos desde SVG

> 50 nodes

## Key Concepts

- **svgTrackParser.ts** (42 connections) — `utils/svgTrackParser.ts`
- **buildTrackFromSvg()** (15 connections) — `utils/svgTrackParser.ts`
- **circuitGeometry.ts** (14 connections) — `utils/circuitGeometry.ts`
- **PathReader** (8 connections) — `utils/svgPathSampler.ts`
- **flattenSvgPath()** (8 connections) — `utils/svgPathSampler.ts`
- **bakeAxis()** (8 connections) — `utils/svgTrackParser.ts`
- **lapReferences.ts** (7 connections) — `data/lapReferences.ts`
- **svgPathSampler.ts** (6 connections) — `utils/svgPathSampler.ts`
- **smoothClosed()** (5 connections) — `utils/circuitGeometry.ts`
- **.skip()** (5 connections) — `utils/svgPathSampler.ts`
- **AxisFrame** (4 connections) — `utils/circuitGeometry.ts`
- **closedFrames()** (4 connections) — `utils/circuitGeometry.ts`
- **closedLength()** (4 connections) — `utils/circuitGeometry.ts`
- **minimumCurvatureOffsets()** (4 connections) — `utils/circuitGeometry.ts`
- **resampleClosed()** (4 connections) — `utils/circuitGeometry.ts`
- **sampleSvgPath()** (4 connections) — `utils/svgPathSampler.ts`
- **AxisBake** (3 connections) — `utils/svgTrackParser.ts`
- **pitLaneClearance()** (3 connections) — `utils/pitLaneGeometry.ts`
- **.command()** (3 connections) — `utils/svgPathSampler.ts`
- **.done()** (3 connections) — `utils/svgPathSampler.ts`
- **.flag()** (3 connections) — `utils/svgPathSampler.ts`
- **.number()** (3 connections) — `utils/svgPathSampler.ts`
- **axisKey()** (3 connections) — `utils/svgTrackParser.ts`
- **cornerSpeedFactor()** (3 connections) — `utils/svgTrackParser.ts`
- **CornerMarker** (2 connections) — `data/barcelonaTrack.ts`
- *... and 25 more nodes in this community*

## Relationships

- [Geometría de pista](Geometría_de_pista.md) (17 shared connections)
- [Paddock y circuitos](Paddock_y_circuitos.md) (4 shared connections)
- [Simulación y Safety Car](Simulación_y_Safety_Car.md) (2 shared connections)
- [Avance de la simulación](Avance_de_la_simulación.md) (2 shared connections)
- [Reglamentos y energía](Reglamentos_y_energía.md) (1 shared connections)
- [Render de pista](Render_de_pista.md) (1 shared connections)
- [Panel lateral y compuestos](Panel_lateral_y_compuestos.md) (1 shared connections)

## Source Files

- `data/barcelonaTrack.ts`
- `data/lapReferences.ts`
- `utils/circuitGeometry.ts`
- `utils/pitLaneGeometry.ts`
- `utils/svgPathSampler.ts`
- `utils/svgTrackParser.ts`

## Audit Trail

- EXTRACTED: 112 (97%)
- INFERRED: 4 (3%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*