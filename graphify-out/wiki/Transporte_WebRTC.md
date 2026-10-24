# Transporte WebRTC

> 60 nodes

## Key Concepts

- **Transport.ts** (42 connections) — `net/transport/Transport.ts`
- **HostTransport** (23 connections) — `net/transport/Transport.ts`
- **RoomDb** (23 connections) — `net/RoomService.ts`
- **webrtc.ts** (16 connections) — `net/transport/webrtc.ts`
- **DirectChannel** (8 connections) — `net/transport/Transport.ts`
- **OrderInbox** (7 connections) — `net/transport/orders.ts`
- **.flushFallback()** (7 connections) — `net/transport/Transport.ts`
- **.fromGuest()** (7 connections) — `net/transport/Transport.ts`
- **ignore()** (7 connections) — `net/transport/Transport.ts`
- **DirectConnector** (6 connections) — `net/transport/Transport.ts`
- **DirectListener** (6 connections) — `net/transport/Transport.ts`
- **.attach()** (6 connections) — `net/transport/Transport.ts`
- **.session()** (6 connections) — `net/transport/Transport.ts`
- **roomPaths** (6 connections) — `net/RoomService.ts`
- **HostStart** (5 connections) — `components/RoomFlow.tsx`
- **RoomBackend** (5 connections) — `components/RoomFlow.tsx`
- **.addGuest()** (5 connections) — `net/transport/Transport.ts`
- **LinkMachine.ts** (5 connections) — `net/transport/LinkMachine.ts`
- **.ack()** (4 connections) — `net/transport/Transport.ts`
- **LinkAction** (3 connections) — `net/transport/LinkMachine.ts`
- **GuestTransportOptions** (3 connections) — `net/transport/Transport.ts`
- **acksPath()** (3 connections) — `net/transport/Transport.ts`
- **.removeGuest()** (3 connections) — `net/transport/Transport.ts`
- **.tick()** (3 connections) — `net/transport/Transport.ts`
- **ordersPath()** (3 connections) — `net/transport/Transport.ts`
- *... and 35 more nodes in this community*

## Relationships

- [Enlace del invitado](Enlace_del_invitado.md) (18 shared connections)
- [Sesión de carrera compartida](Sesión_de_carrera_compartida.md) (17 shared connections)
- [Salas multijugador](Salas_multijugador.md) (14 shared connections)
- [Pantallas de sala](Pantallas_de_sala.md) (11 shared connections)
- [Medidor de consumo](Medidor_de_consumo.md) (5 shared connections)
- [Carrera del anfitrión](Carrera_del_anfitrión.md) (3 shared connections)
- [App y temporada](App_y_temporada.md) (1 shared connections)
- [Firebase](Firebase.md) (1 shared connections)

## Source Files

- `components/RoomFlow.tsx`
- `net/RoomService.ts`
- `net/transport/LinkMachine.ts`
- `net/transport/Transport.ts`
- `net/transport/orders.ts`
- `net/transport/webrtc.ts`

## Audit Trail

- EXTRACTED: 155 (93%)
- INFERRED: 11 (7%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*