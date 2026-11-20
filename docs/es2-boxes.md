# ES2 — Pérdida en boxes calibrada con la realidad

*Sprint 16 · 20/11/2026*

## Qué había

El motor calcula lo que cuesta parar (`RejoinModel.pitLossSec`): un coche entra en boxes, se para el servicio medio
(unos 3 s) y sale; otro igual sigue en pista; la pérdida es lo que el primero llega por detrás. Esa cuenta usaba siempre
las líneas del limitador a 60 m de cada punta del carril, con 80 km/h en todos los circuitos, y el coche frenaba al
límite nada más entrar en el carril. Con carriles largos (de la entrada a la salida, siguiendo la pista) salía mucho más
que la realidad, y con carriles cortos, menos:

| Circuito | Carril | Antes | Real (ficha) |
|---|---|---|---|
| Barcelona | 1059 m | 35,9 s | 22,4 s |
| Silverstone | 1318 m | 39,6 s | 20,5 s |
| Interlagos | 1425 m | 43,4 s | 23,5 s |
| Mónaco | 386 m | 12,0 s | 22 s |
| Las Vegas | 517 m | 16,0 s | 21,5 s |

## Qué cambia

1. **Líneas del limitador propias de cada circuito** (`pitLimitLineM` en la pista, de `src/data/pitLaneCalibration.json`).
   El motor, la cuenta de la pérdida y el dibujo de la zona de trabajo salen de la misma función (`pitLaneZones`).
   Cuando las líneas quedan más adentro que la zona de trabajo de siempre (carriles con vía de entrada y de salida
   largas, como Barcelona o Silverstone), la zona de trabajo y los cajones se meten dentro del tramo limitado, en las
   mismas proporciones.
2. **La vía de entrada se hace como la de salida**: antes de la primera línea el coche puede acelerar (sin pasar del
   VSC o del Safety Car) y frena a tiempo para cruzarla al límite (`PitStopModel.approachSpeed`), con una frenada de 30 m/s² que el coche puede seguir también en la pista, antes de la entrada.
3. **60 km/h donde la realidad lo pone**: Mónaco y Marina Bay (`PitStopModel.speedLimit`).
4. **Una sola cifra**: la ficha del circuito, la pantalla de inicio y la carrera libre enseñan la pérdida que mide el
   motor (`src/data/pitLoss.ts`); el muro la calcula en carrera con el mismo modelo. La cifra real de la ficha
   (`pitLaneTimeLossSec`) queda solo como objetivo de la calibración.

Con VSC (160 km/h) y Safety Car (120 km/h) no se ajusta nada aparte: la pérdida sale del mismo cálculo.

## Resultado

| Circuito | Líneas a | Verde | Real | VSC | SC |
|---|---|---|---|---|---|
| Barcelona | 278 m | 22,4 s | 22,4 s | 15,8 s | 11,8 s |
| Silverstone | 367 m | 20,5 s | 20,5 s | 16,1 s | 12,5 s |
| Interlagos | 382 m | 23,5 s | 23,5 s | 17,8 s | 13,7 s |
| Monza | 104 m | 24,1 s | 24,1 s | 16,5 s | 12,3 s |
| Spa | 33 m | 21,8 s | 21,8 s | 18,1 s | 13,7 s |
| Marina Bay (60 km/h) | 124 m | 29,5 s | 29,5 s | 26,1 s | 22 s |
| Mónaco (60 km/h) | 0 m | 21 s | 22 s | 18,2 s | 15,6 s |
| Las Vegas | 0 m | 21 s | 21,5 s | 15,6 s | 11,9 s |
| Yas Marina (túnel) | 0 m | 21 s | 22,6 s | 17,9 s | 13,5 s |

22 de los 23 circuitos quedan a menos de 1 s de la cifra real (20 a menos de 0,2 s). Yas Marina se queda 1,6 s corto aun con
todo el carril limitado (la salida por el túnel se hace a fondo): queda como excepción documentada (el usuario, 20/11/2026);
el test le pide quedar a menos de 2 s por debajo de la real. Mónaco y Las Vegas llegan justo, con todo el carril limitado.

## Cómo volver a calibrar

```
node scripts/calibrate-pit-lane.mjs [circuito…]
```

Busca en cada circuito (por bisección) la distancia de las líneas que hace que la pérdida en verde cuadre con la real, y
guarda las líneas y las pérdidas en verde, VSC y Safety Car. Hay que lanzarlo si cambia el modelo de boxes; el test
`pit-loss-es2` vuelve a medir y avisa si no coincide.
