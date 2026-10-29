# UX11 — Prueba en dispositivos reales

Lista para recorrer el Sprint 7 en tres dispositivos: un **Android con Chrome**, un **iPhone con Safari** y una
**tableta** (iPad o Android). Tiempo aproximado: 30–40 minutos por dispositivo.

## Antes de empezar

- **Qué versión probar.** Lo publicado (`https://f1sim-d5085.web.app/`) solo tiene lo que se ha fusionado en `main`. Para
  probar todo el Sprint 7, primero hay que publicarlo (fusionar la rama `sprint/7`). Si se prueba antes en casa, en la
  misma wifi: `npm run dev -- --host` en el ordenador y abrir en el móvil la dirección «Network» que escribe
  (`http://192.168.x.x:3010/F1Sim/`).
- **Cómo apuntar.** Marca cada casilla en la columna del dispositivo: `[x]` si va bien; si algo falla, déjala vacía y
  escribe al lado qué pasó (pantalla, qué tocaste, qué esperabas). Una captura ayuda mucho.
- **Lo que falle vuelve como tarea.** Cada fallo apuntado se convierte en una tarea nueva del Sprint 7 (UX16, UX17…) con
  su contrato de tests, como el resto; no se arregla sin pasar por ahí.

Dispositivos usados (modelo y sistema):

- Android: ………………………………
- iPhone: ………………………………
- Tableta: ………………………………

## 1. Inicio y menú — UX1

Qué mirar: la portada solo tiene «Jugar»; el menú cabe sin desplazar de lado; tocar una tarjeta la elige y un segundo
toque entra.

| Punto | Android | iPhone | Tableta |
| --- | --- | --- | --- |
| La portada carga y solo tiene el botón «Jugar» | - [ ] | - [ ] | - [ ] |
| En el menú, tocar una tarjeta la marca (sin entrar) y la franja crece por la diagonal | - [ ] | - [ ] | - [ ] |
| Las cuatro tarjetas miden lo mismo y nada se sale por los lados | - [ ] | - [ ] | - [ ] |

## 2. Ajustes — UX2 y UX3

Qué mirar: las secciones se leen sin zoom; el modo desarrollador se enciende con siete toques en la versión.

| Punto | Android | iPhone | Tableta |
| --- | --- | --- | --- |
| UX2: Ajustes abre con Radio, Sonido, Gráficos y Controles, y se cambia de sección tocando | - [ ] | - [ ] | - [ ] |
| UX2: cambiar Gráficos a 2D y entrar a una carrera la enseña en 2D | - [ ] | - [ ] | - [ ] |
| UX3: siete toques seguidos en la versión encienden el modo desarrollador (y otros siete lo apagan) | - [ ] | - [ ] | - [ ] |
| UX3: sin el modo, en la carrera libre no se elige el tiempo | - [ ] | - [ ] | - [ ] |

## 3. Descargas de la radio — UX4

Qué mirar: la descarga del modelo avanza, se puede pausar, aguanta un cambio de pestaña y no se repite.

| Punto | Android | iPhone | Tableta |
| --- | --- | --- | --- |
| UX4: la descarga enseña su progreso y se puede pausar y seguir | - [ ] | - [ ] | - [ ] |
| UX4: al salir de la pestaña y volver, sigue donde estaba (no empieza de cero) | - [ ] | - [ ] | - [ ] |
| UX4: con la descarga terminada, al volver a entrar no se descarga otra vez | - [ ] | - [ ] | - [ ] |

## 4. Una carrera — UX5, UX6, UX7, UX8, UX13 y UX14

Qué mirar: en el móvil cada pestaña ocupa la pantalla; la franja de la vuelta se lee; las cámaras funcionan con el dedo;
el velocímetro no da saltos; la radio suena solo cuando se habla.

| Punto | Android | iPhone | Tableta |
| --- | --- | --- | --- |
| UX5: Pista, Tiempos, Muro y Detalle ocupan la pantalla entera, sin la pista partida debajo | - [ ] | - [ ] | - [ ] |
| UX5: la franja de la vuelta se ve siempre arriba, con tus dos coches y su posición | - [ ] | - [ ] | - [ ] |
| UX6: el botón de cámara recorre solo las del dispositivo (en el móvil, 5; sin «Libre» sin ratón) | - [ ] | - [ ] | - [ ] |
| UX6: todas las cámaras ofrecidas se ven bien y la carrera sigue fluida | - [ ] | - [ ] | - [ ] |
| UX7: el velocímetro del muro sube y baja suave, sin números negativos ni saltos al salir de boxes | - [ ] | - [ ] | - [ ] |
| UX8: el icono de la IA de la radio se ve en la barra y, al tocarlo, dice en qué estado está | - [ ] | - [ ] | - [ ] |
| UX13: tras hablar con un piloto, la radio se calla (no queda ruido de fondo) | - [ ] | - [ ] | - [ ] |
| UX14: la voz suena a radio, con chasquido al abrir y cerrar y el motor de fondo | - [ ] | - [ ] | - [ ] |

## 5. La temporada — UX9 y UX10

Qué mirar: cada pestaña dice qué se decide; las tarjetas llevan a decidir; las imágenes cargan y el 3D no se arrastra.

| Punto | Android | iPhone | Tableta |
| --- | --- | --- | --- |
| UX9: las pestañas son Inicio, Coche, Equipo, Sede y dinero y Fin de semana, y cada una dice qué se decide | - [ ] | - [ ] | - [ ] |
| UX9: Inicio enseña hasta 3 tarjetas de decisión y «Decidir» lleva a su pestaña | - [ ] | - [ ] | - [ ] |
| UX9: desde Fin de semana se entra a pista | - [ ] | - [ ] | - [ ] |
| UX10: las imágenes de la sede y de las instalaciones cargan en las tarjetas | - [ ] | - [ ] | - [ ] |
| UX10: «Ver la pieza» carga el coche en 3D con la pieza resaltada, se puede girar con el dedo y no va a tirones | - [ ] | - [ ] | - [ ] |

## 6. Carrera libre por pasos — UX12

| Punto | Android | iPhone | Tableta |
| --- | --- | --- | --- |
| UX12: se elige equipo, circuito y se entra a pista sin desplazar de lado | - [ ] | - [ ] | - [ ] |
| UX12: la ficha del piloto y el detalle del circuito se abren a pantalla completa y Atrás vuelve | - [ ] | - [ ] | - [ ] |
| UX12: el pie con lo elegido no tapa nada | - [ ] | - [ ] | - [ ] |

## Resultado

- Fallos encontrados (cada uno vuelve como tarea nueva):
  1. ………………………………
  2. ………………………………
- Fecha de la prueba: ………………
