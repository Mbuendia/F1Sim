# Enlace con worker

> 5 nodes

## Key Concepts

- **WorkerLink** (8 connections) — `engine/LocalLink.ts`
- **.close()** (1 connections) — `engine/LocalLink.ts`
- **.constructor()** (1 connections) — `engine/LocalLink.ts`
- **.onMessage()** (1 connections) — `engine/LocalLink.ts`
- **.post()** (1 connections) — `engine/LocalLink.ts`

## Relationships

- [App y temporada](App_y_temporada.md) (2 shared connections)
- [Sesión de carrera compartida](Sesión_de_carrera_compartida.md) (1 shared connections)
- [Motor en worker](Motor_en_worker.md) (1 shared connections)

## Source Files

- `engine/LocalLink.ts`

## Audit Trail

- EXTRACTED: 8 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*