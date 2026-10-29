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
