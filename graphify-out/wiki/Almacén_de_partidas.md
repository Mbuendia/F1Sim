# Almacén de partidas

> 11 nodes

## Key Concepts

- **SaveStore** (9 connections) — `simulation/SaveGame.ts`
- **.save()** (6 connections) — `simulation/SaveGame.ts`
- **StorageLike** (4 connections) — `simulation/SaveGame.ts`
- **.getItem()** (4 connections) — `simulation/SaveGame.ts`
- **.list()** (3 connections) — `simulation/SaveGame.ts`
- **.load()** (3 connections) — `simulation/SaveGame.ts`
- **.remove()** (3 connections) — `simulation/SaveGame.ts`
- **.slotId()** (3 connections) — `simulation/SaveGame.ts`
- **.removeItem()** (3 connections) — `simulation/SaveGame.ts`
- **.setItem()** (3 connections) — `simulation/SaveGame.ts`
- **.constructor()** (1 connections) — `simulation/SaveGame.ts`

## Relationships

- [App y temporada](App_y_temporada.md) (5 shared connections)
- [Partida guardada y carrera](Partida_guardada_y_carrera.md) (2 shared connections)
- [Instantáneas](Instantáneas.md) (1 shared connections)

## Source Files

- `simulation/SaveGame.ts`

## Audit Trail

- EXTRACTED: 18 (72%)
- INFERRED: 7 (28%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*