# Multijugador: puesta en marcha, prueba entre redes y consumo

Guía del Sprint 5 (N10). Explica cómo funciona la carrera compartida, cómo montar el proyecto de Firebase desde cero, cómo hacer la prueba con dos dispositivos en redes distintas y cuánto consume del plan gratuito.

## Cómo funciona, en una página

- **El anfitrión corre el motor.** Su navegador hace la carrera de verdad (en un Web Worker, como la partida de un jugador) y reparte lo que pasa a los demás. Si el anfitrión cierra la pestaña o pierde la conexión, la sala se borra y los invitados ven «El anfitrión ha cerrado la sala».
- **Firebase solo hace de punto de encuentro.** Guarda la sala (código, quién está, qué equipo lleva cada uno, circuito, formato y tiempo) y sirve de buzón para que los navegadores se presenten. No guarda partidas ni cuentas: cada jugador entra con una sesión anónima.
- **Conexión directa (WebRTC).** Una vez presentados, cada invitado habla directamente con el anfitrión. Es lo normal: no gasta cuota de Firebase.
- **Respaldo (Firebase).** Si la conexión directa no se abre en 5 s (algunas redes de empresa o de operador la bloquean) o se cae, el invitado sigue jugando a través de Firebase: recibe 2 fotos por segundo en vez de 15, así que la pista va menos fluida, y cada 10 s se vuelve a intentar la directa. Esto sí gasta cuota (ver más abajo).
- **Quién manda.** Cada jugador solo da órdenes a su equipo (boxes, ritmo, propuestas, órdenes de equipo). Pausar, cambiar la velocidad o salir a pista es del anfitrión; un invitado puede «Pedir pausa». Con invitados, la carrera no pasa de x4.
- **Si un jugador se cae**, su equipo pasa al estratega; si vuelve con la misma sesión (la misma ventana del navegador), lo recupera.

Código: `src/net/` (sala, transporte y carrera compartida), `src/components/RoomFlow.tsx`, `RoomScreens.tsx` y `ClientRace.tsx` (pantallas), y `database.rules.json` (reglas de acceso).

## Montar el proyecto de Firebase desde cero

El proyecto actual es `f1sim-d5085` y ya está montado. Esto sirve para recrearlo o para un proyecto de pruebas.

1. En [console.firebase.google.com](https://console.firebase.google.com), **crear un proyecto** (sin Google Analytics; no hace falta).
2. **Realtime Database** → Crear base de datos → región de Europa (`europe-west1`) → empezar en modo bloqueado.
3. **Authentication** → Método de acceso → activar **Anónimo**.
4. **Configuración del proyecto** → Tus apps → añadir una **app web**. Copiar su configuración en `src/net/firebaseConfig.ts`. Esa configuración es pública por diseño: lo que protege los datos son las reglas.
5. En un terminal, dentro del repositorio: `npx firebase login` y `npx firebase use --add` (elegir el proyecto).
6. **Publicar las reglas:** `npx firebase deploy --only database`. Hay que repetirlo cada vez que cambie `database.rules.json`.
7. **Publicar el juego:** lo hace solo el flujo `.github/workflows/firebase-hosting.yml` (N11): al fusionar en `main` se publica en `https://<proyecto>.web.app`, y cada pull request se publica en una dirección de vista previa propia, que el flujo deja como comentario en el PR.

Comprobar las reglas sin tocar el proyecto real: `node test-suite.mjs --module rooms-rules-n4,rules-n10`. Arranca el emulador de Firebase solo; necesita **Java 21 o superior**.

## Probar en casa (una sola red)

1. `npm run dev` y abrir `http://localhost:3000/F1Sim/`.
2. Ventana normal: **Crear sala**. Ventana de **incógnito** (u otro navegador): abrir el enlace de la sala o **Unirse a una sala** con el código.
   - Dos pestañas de la misma ventana comparten la sesión anónima: el invitado sería el anfitrión con otro nombre, y el juego lo avisa en vez de dejarle entrar.
3. Anfitrión: elegir circuito, formato (GP directo o con clasificación) y tiempo → **Elegir equipos** → cada uno coge su equipo → **Empezar**.

Sin Firebase (por ejemplo, para revisar pantallas): `?revision=sala&pantalla=vivo` en el servidor de desarrollo pone anfitrión e invitado lado a lado con una base y una red simuladas.

## Prueba entre dos redes (tarea 8 de la lista del usuario)

Se hace con la dirección de la vista previa del pull request (o con `f1sim-d5085.web.app` una vez fusionado). Añadir `?medir` a la dirección enseña el medidor de consumo en una esquina.

1. **Ordenador** en la wifi de casa: abrir `https://…/?medir` y **Crear sala**.
2. **Móvil con la wifi apagada, usando datos**: abrir el enlace de la sala (o escribir el código), poner un nombre, elegir un equipo.
3. Empezar y, desde el móvil, pedir una parada con **BOX** en el muro: el coche debe parar.
4. En el ordenador, cambiar a otra pestaña durante un minuto: en el móvil la carrera debe seguir.
5. **Respaldo forzado:** repetir desde el móvil añadiendo `&respaldo` al enlace de la sala (por ejemplo `…/?sala=ABC234&respaldo`). Esa pantalla nunca abre la conexión directa: a los 5 s el indicador pasa a **Respaldo** y se debe poder seguir jugando, con la pista menos fluida.
6. Anotar, en cada caso: lo que dice el indicador del enlace en el móvil (Directo, Respaldo, Conectando, Caído) y en la lista del anfitrión, y las cifras del medidor al acabar.

## Consumo y plan gratuito

**Plan gratuito (Spark) de Realtime Database:** 100 conexiones simultáneas, 1 GB guardado y **10 GB de descarga al mes**. Lo que cuenta es lo que **descargan** los navegadores desde Firebase.

Medido el 19/10/2026 con 20 coches (fotos en JSON, sin la sobrecarga del protocolo, que añade algo más):

| Qué viaja a cada invitado | Vuelta 5 | Vuelta 55 |
|---|---|---|
| Foto rápida (posiciones) | 0,8 KB | 0,8 KB |
| Foto lenta (tiempos, clima, banderas) | 26 KB | 32 KB |
| Vista de su equipo (muro) | 12 KB | 12 KB |

- **En directo** no se gasta cuota de Firebase: solo la sala (unos pocos KB al entrar y al cambiar algo). El móvil del invitado sí recibe unos **50–56 KB/s, unos 200 MB por hora** de sus datos móviles (15 fotos rápidas, 1 lenta y 1 de equipo por segundo).
- **Por el respaldo**, cada invitado descarga de Firebase unos **40–45 KB/s, unos 150–160 MB por hora**. Con 10 GB al mes: unas **60 horas de juego por el respaldo** (repartidas entre todos los invitados que lo usen).
- Antes de recortar las fotos (N10) el respaldo costaba más de 1 GB por hora y por invitado: a los invitados ahora les llega el historial de vueltas recortado a las 3 últimas y, por el respaldo, la foto lenta va aparte y solo cuando cambia. La pantalla del anfitrión sigue teniendo el historial entero.

**Vigilarlo** (tarea 9 de la lista del usuario):

- Consola de Firebase → **Realtime Database → Uso**: descargas del mes y conexiones simultáneas. Si las descargas se acercan a 8 GB, avisar al agente.
- En partida, `?medir` en la dirección: lo que esa pantalla ha recibido y enviado y su ritmo por hora. Es aproximado (tamaño de los datos sin la sobrecarga del protocolo).

## Tests del multijugador

| Módulo | Qué prueba |
|---|---|
| `rooms-n4` | Sala: código, entrar, presencia, cierre |
| `rooms-rules-n4`, `rules-n10` | Reglas de acceso contra el emulador (Java 21) |
| `transport-n5` | Conexión directa y respaldo, órdenes sin duplicar |
| `owners-n6` | Equipos con dueño y permisos |
| `lobby-n7` | Sala y elección de equipos |
| `client-race-n8` | Carrera del invitado, órdenes, pedir pausa, suavizado |
| `room-end-n9` | Clasificación, final, otra carrera, sala cerrada, caídas |
| `light-views-n10` | Foto ligera para los invitados |

`node test-suite.mjs --sprint 5` los ejecuta todos.
