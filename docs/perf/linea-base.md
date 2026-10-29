# Línea base de rendimiento (PF1, Sprint 8)

Cifras de referencia para el resto del Sprint 8: PF2 a PF4 se comparan con ellas y PF8 fija el presupuesto a partir de aquí.

## Cómo se mide

1. Enciende el modo desarrollador (Ajustes → 7 toques en el número de versión).
2. Abre el juego con `?rendimiento=prueba`, por ejemplo `https://mbuendia.github.io/F1Sim/?rendimiento=prueba`.
3. Escribe el nombre del dispositivo, no toques la pantalla durante la prueba (5 s de calentamiento y 30 s de medida) y pulsa «Copiar».
4. Pega el resultado en el chat o rellena su fila de abajo.

La escena es siempre la misma: Barcelona, semilla 2026, cámara de persecución detrás del coche de la pole, motor de carrera en el Worker como en el juego. Para el tiempo hasta el menú, abre el juego normal con `?rendimiento` y mira la línea de carga del contador.

Una fila «pendiente» no cuenta como medida.

## Fotogramas, memoria y carga

| Dispositivo | Estado | Navegador | fps | ms medio | peor ms | p95 ms | gráfica ms | memoria MB | menú ms | primer fotograma ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PC del usuario | pendiente | — | — | — | — | — | — | — | — | — |
| Móvil del usuario | pendiente | — | — | — | — | — | — | — | — | — |
| Móvil modesto | pendiente | — | — | — | — | — | — | — | — | — |

«gráfica ms» solo sale en navegadores con el cronómetro de WebGL (Chrome de escritorio, casi nunca en móviles); «memoria MB» solo en Chrome. Sin ellos la cifra es «n/d».

## Peso de la descarga

Medido con `npm run perf:size` sobre `dist/` (gzip, nivel por defecto).

Medido el 29/10/2026 sobre la rama `sprint/8` con PF1 (1 KB = 1024 bytes; Vite cuenta en miles, por eso dice 620,9 kB):

- Paquete principal: 606,3 KB (lo que descarga el navegador antes de enseñar nada)
- Total de JS: 6.035 KB (el resto se carga aparte, cuando hace falta)
- CSS: 45,7 KB
- Modelos: 5.010 KB
- Texturas: 20.613 KB
- Audio: 124,8 KB
- Otros: 23.273 KB, casi todo WebAssembly de la voz y la IA de la radio (12,8 MB) y el vídeo de la portada (9,9 MB)

## Comprobación de la prueba (no es una medida)

El 29/10/2026 la prueba se corrió entera en Chrome sin ventana, que pinta con el procesador y va atado a 60 fps: sirve para ver que funciona (calienta, mide 30 s, da el resumen y el cronómetro de gráfica responde), no como cifra de ningún dispositivo. Por eso las tres filas siguen «pendiente».

## PF2 — Renderizado 3D más ligero

Medido el 29/10/2026 en Chrome sin ventana: las llamadas de dibujo y los triángulos son los mismos en cualquier dispositivo (los fotogramas no). «Antes» es la versión con PF1 (commit `ce6c84b`), compilada en una copia aparte; la persecución usa la prueba `?rendimiento=prueba` y la vista general `?revision=puente&circuito=barcelona&camara=vista&rendimiento`. Las cifras son las del último fotograma de cada medida.

| Escena | Llamadas antes | Llamadas después | Triángulos antes | Triángulos después |
| --- | --- | --- | --- | --- |
| Barcelona, persecución | 177 | 92 | 681.000 | 312.000 |
| Barcelona, vista general | 394 | 212 | 55.000 | 55.000 |

- La persecución de «antes» es la medida de PF1 (177 llamadas y 681.000 triángulos); repetida el mismo día dio 139 llamadas y 795.000 triángulos, porque depende de cuántos coches hay cerca en ese fotograma.
- Los triángulos bajan porque el modelo completo (127.000) solo sale cuando el coche mide 150 px o más en pantalla. Al entregar PF2 la persecución quedaba en 90 llamadas y 80.000 triángulos, con el coche seguido (unos 70 px) en ligero; el 29/10/2026 el usuario pide que con la cámara de persecución (y a bordo) el coche seguido y los que estén a menos de 80 m de él vayan completos (40 m en calidad media, nada en baja), y la medida pasa a 92 llamadas y 312.000 triángulos (el seguido y el que va pegado a él), dentro del objetivo.
- Las llamadas bajan por las instancias del escenario: en los 23 circuitos el escenario pasa de unas 250 llamadas de media a unas 134 en total, y menos en pantalla porque se descartan los trozos que no se ven.

## PF3 — Modelos comprimidos y carga diferida

Medido el 29/10/2026 con `npm run perf:size` (gzip) y `node scripts/compress-models.mjs`:

- Paquete principal: 606,3 KB → 447,4 KB (three.js sale de la portada: la rueda 3D se carga aparte).
- Modelos en la descarga: 5.010 KB → 2.885 KB.
- Coche: 3.187 KB → 1.181 KB; coche por piezas (menú): 2.091 → 712; coche ligero: 344 → 152; Safety Car: 1.871 → 890; monumentos (Red Bull, Torre Cota, Torre Eiffel, Biosfera, noria): 1.599 → 573.
- Misma geometría: mismos triángulos y vértices; posiciones exactas; normales y colores en 8 bits.
- Texturas: los modelos no llevan imágenes (las texturas del 3D se dibujan en el momento); las imágenes 2D sin uso se quitan en PF6.

## PF4 — Calidad según el dispositivo

Niveles (alto es lo que había): alto ×1,5 de resolución, sombras 2048 suaves, suavizado y coche completo desde 150 px; medio ×1,25, sombras 1024, coche completo desde 250 px; bajo ×1, sin sombras ni suavizado y siempre el coche ligero. Medido el 29/10/2026 en Chrome sin ventana con calidad baja: vista general 212 → 107 llamadas; persecución 88 llamadas y 51.000 triángulos; gráfica unos 1,9 ms frente a 3,5 ms en alta.

## PF6 — Limpieza

- Fuera `public/racecars2d` (216 archivos, 19,5 MB): el pack de sprites 2D de T28, que no usaba ningún código desde que la carrera es 3D. Las imágenes de la descarga bajan de 20.613 KB a 2.230 KB (gzip).
- Fuera tres archivos sin uso (`radio/model/classifierStore.ts`, `radio/classifier/vectorCache.ts` y el clasificador que los usaba) y 18 exportaciones que no usaba nadie.
- Todas las dependencias de `dependencies` las importa la aplicación.

## PF8 — Presupuesto

Los límites están en `docs/perf/presupuesto.json` y los vigila `tests/modules/budget-pf8.mjs`: paquete principal 490 KB (hoy 449), modelos 3.170 KB (hoy 2.885), escenario 250 llamadas en el peor circuito (hoy 229, Las Vegas), coche 135.000 triángulos (hoy 126.720), coche ligero 10.500 (hoy 9.583) y `RaceSimulation.ts` 1.900 líneas (hoy 1.733). Objetivos de fotogramas: 60 fps en el PC del usuario y 30 en un móvil medio, medidos con `?rendimiento=prueba`.

## PF7 — Suite de tests más rápida

Suite completa (`node test-suite.mjs --all`, 207 módulos y 7.598 aserciones) en el PC del usuario (12 núcleos), 29/10/2026:

- Antes: unos 25 min (la cifra del plan del sprint, de uno en uno; AGENTS.md hablaba de 12 en otra fase del proyecto).
- En paralelo con el vigilante de archivos de Vite aún encendido: 16,7 min (cada módulo gastaba unos 13 s de procesador recorriendo la carpeta del proyecto).
- Después: 5,5 min (330 s), en paralelo con 10 procesos y sin vigilante ni recarga en caliente en los tests. Sumando lo que tarda cada módulo salen 49 min de trabajo, frente a 157 antes del arreglo del vigilante.

## Core Web Vitals de la portada (29/10/2026)

Laboratorio con Chrome sin ventana sobre la versión de producción (servida con gzip como GitHub Pages), mediana de 3 pasadas; INP con un toque en «Jugar». Perfil móvil como Lighthouse: procesador 4× más lento y 4G lenta (150 ms, 1,6 Mb/s).

| Perfil | LCP | FCP | CLS | TBT | INP | TTFB | Descarga |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Escritorio | 0,94 s (bueno) | 0,92 s | 0,0001 (bueno) | 26 ms | 96 ms (bueno) | 6 ms | 838 KB |
| Móvil | 5,06 s (malo, > 4 s) | 5,01 s | 0,0005 (bueno) | 586 ms | 176 ms (bueno) | 94 ms | 838 KB |
| Escritorio (después) | 1,09 s (bueno) | 0,74 s | 0,0001 (bueno) | 199 ms | 96 ms (bueno) | 4 ms | 873 KB |
| Móvil (después) | 1,43 s (bueno) | 1,35 s | 0,0003 (bueno) | 536 ms | 184 ms (bueno) | 4 ms | 412 KB |
| Escritorio (portada nueva) | 0,65 s (bueno) | 0,55 s | 0,0003 (bueno) | 0 ms | 80 ms (bueno) | 7 ms | 805 KB |
| Móvil (portada nueva) | 1,66 s (bueno) | 1,39 s | 0,053 (bueno) | 0 ms | 144 ms (bueno) | 10 ms | 305 KB |

- El LCP es el logotipo (texto en Orbitron) y coincide con el FCP: no se pinta nada hasta que baja y se ejecuta el paquete principal (458 KB gzip, todo el juego: la portada solo usa una parte). Antes del primer pintado bloquean además el CSS de Google Fonts (otro dominio) y el CSS propio; la rueda 3D (three.js, 154 KB) se pide también al empezar.
- **Portada nueva (PF9, 29/10/2026):** sin la rueda 3D; escena de Blender en capas AVIF animadas con CSS: fondo, estelas, coche, primer plano y cuatro fotogramas de las ruedas para que giren (88 KB en escritorio, 56 KB en móvil). Desde esta medida el TBT se cuenta solo hasta el toque en «Jugar» (lo de después es el arranque del juego, no la carga de la portada; las filas anteriores lo incluían). La columna «Descarga» cuenta todo lo bajado hasta 1,5 s después del toque: en escritorio da tiempo a bajar el juego entero (unos 500 KB); en el móvil, con la red lenta, no. La portada sola son unos 280 KB en el móvil. El CLS de 0,053 en móvil viene de que el titular se pinta primero con la fuente de respaldo y se reajusta al llegar Orbitron.
- Reparto del paquete principal (sin comprimir, 1.359 KB): componentes de la interfaz 34 %, motor de carrera 19 %, React DOM 15 %, datos, utilidades y dibujo el resto.
- **Después (mejora del LCP pedida por el usuario el 29/10/2026):** `main.tsx` monta `Root`, que pinta la portada con React y su propio código (paquete inicial de 458 KB a 78 KB) y carga el juego (`App`) aparte, precargándolo con la primera señal de que se va a jugar (puntero, toque o tecla); el CSS de Google Fonts se pide sin bloquear el primer pintado; la rueda 3D se monta cuando la página termina de cargar. Precargar el juego en cuanto el navegador quedaba libre se probó y se descartó: subía el TBT en móvil a 1,6 s. El TBT de escritorio sube de 26 a 199 ms porque el trabajo de la rueda 3D pasa a contar después del primer pintado (antes ocurría antes); el LCP de escritorio sube de 0,94 a 1,09 s porque el logotipo se pinta primero con la fuente de respaldo y se vuelve a pintar al llegar Orbitron.
