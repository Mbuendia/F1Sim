# Trazado y pit lane fieles: resto de CR2

Tarea CR2 del Sprint 10.5 (contrato acordado el 07/11/2026, `tests/modules/track-fidelity-cr2.mjs`). Parte de los 9
puntos que CR1 le dejó (`docs/design/referencias-circuitos.md`). Fuentes: el trazado real es el GeoJSON de
bacinger/f1-circuits (MIT), ya encajado sobre el juego en CR1, y las huellas de © OpenStreetMap contributors (ODbL), en
`docs/design/cr1/<id>.json`.

## Resumen

| Punto de CR1 | Qué se vio | Qué se hizo |
|---|---|---|
| Shanghái: vallas cruzando la entrada del pit lane | Hoy ya no hay ninguna (lo arregló el kit del Sprint 10, CK3 y CK4) | Nada en el juego; el test comprueba metro a metro que ninguna pieza ni barrera pisa el carril |
| Suzuka y Baréin: edificio de boxes al otro lado | Falsa alarma de la regla automática de CR1 | Nada; ver abajo |
| Yas Marina: pit lane hasta 55,2 m del real | Fallo de medida de CR1: el tramo bajo la pista va en OpenStreetMap como túnel y no se contaba | Nada; con ese tramo, 8,5 m como mucho y la parada en 19,44 s (ficha: 22,6 s) |
| La Source (Spa): 58 km/h frente a 83 | El radio del juego ya era casi el real (14 m frente a 15,5 m) | Abierta, por decisión del usuario: 74 km/h |
| Horquilla de Suzuka: 64 km/h frente a 77 | Igual (18,8 m frente a 19,9 m) | Abierta, por decisión del usuario: 73 km/h |
| Spa: dos tramos a 17,8 y 15,8 m del real | Bajada a Eau Rouge y tramo del 77–78 % | Acercados al real: 14 m como mucho en toda la vuelta |
| Bakú: un tramo a 16,1 m del real | La curva del 67,9 %, más cerrada en el real | Acercado: 11,6 m como mucho |

## Edificio de boxes

CR1 marcó «edificio de boxes al otro lado de la pista» en Suzuka y Baréin. Su regla automática toma como edificio de boxes
el edificio largo más cercano al pit lane real, y en estos dos circuitos acertó con otra cosa. Comprobado con las
huellas de OpenStreetMap:

- **Suzuka:** el pit lane del juego va del mismo lado que los dos tramos de pit lane de OpenStreetMap (`way/120917578` y
  `way/411295350`). El edificio que OpenStreetMap llama «ピットビル» (edificio de boxes, `way/184422099`) está de ese mismo
  lado, igual que el del juego. CR1 había tomado la grada A1 (`way/184120096`), que está enfrente.
- **Baréin:** el pit lane del juego va del mismo lado que el de OpenStreetMap (`way/187123422`), y el edificio de boxes
  del juego, junto a él. OpenStreetMap no tiene dibujado el edificio de boxes; lo que CR1 tomó por él
  (`relation/20311525`, 138 m de largo, a 73 m del pit lane al otro lado de la pista) es la tribuna principal.

No se mueve nada.

## Pit lane de Yas Marina

El tramo del pit lane que pasa bajo la pista va en OpenStreetMap como túnel (`way/176695255`, «Pit Lane»), no como pit
lane, y CR1 lo contaba entre los túneles. Por eso salían 55,2 m: del 600 al 715 m del carril no tenía con qué
compararlo. Con ese tramo, el carril del juego se aparta 8,5 m como mucho. La parada cuesta 19,44 s, a −14 % de los
22,6 s de la ficha (dentro del ±15 %). No se toca.

## Correcciones del eje

Van como datos en `src/data/axisCorrections.json` y las aplica `src/utils/axisCorrections.ts` justo después de calcular
el eje. Cada una toca solo los puntos de su tramo: el resto del eje y los otros 20 circuitos quedan idénticos (el test lo
comprueba con una huella de cada circuito tomada antes de CR2).

| Circuito | Tramo (vuelta) | Corrección |
|---|---|---|
| `spa` | 3,4–6,4 % | La Source: el vértice se empuja hacia fuera hasta 12 m, con entrada y salida suaves |
| `spa` | 6,4–10 % | Bajada a Eau Rouge: el eje se acerca un 40 % al trazado real |
| `spa` | 75,8–79,7 % | El eje se acerca un 45 % al trazado real |
| `suzuka` | 48–52,6 % | Horquilla: el vértice se empuja hacia fuera hasta 5 m |
| `baku` | 66,8–69 % | El eje se acerca un 30 % al trazado real |

**Por qué no se acercan del todo al real:** llevar el tramo de Bakú entero al real cerraba más la curva y la vuelta
crecía 1,4 s. Basta acercarlos lo justo para bajar de 15 m.

**Por qué empujar y no alisar:** alisar la horquilla de Suzuka la cerraba en los extremos (bajaba a 40 km/h y se
apartaba 21,6 m del real). Empujar el vértice hacia fuera la abre sin codos.

**Vuelta de referencia (R47):** con las curvas abiertas, la ganancia de curva se recalibró para que la vuelta del motor siga
a ±1 % de la de 2025: Spa de 7,47 a 8,0 (104,72 s frente a 104,861), Suzuka de 9,06 a 9,6 (90,68 frente a 90,965) y Bakú
de 17,17 a 15,3 (103,40 frente a 103,388). En Spa y Suzuka la vuelta da un salto de casi 1 s un poco por encima de esos
valores (8,2 y 9,7), así que se dejaron con margen.

**La trazada se recalcula entera:** cualquier cambio en el eje de un circuito mueve un poco la trazada ideal en toda su
vuelta, así que en Spa, Suzuka y Bakú cambian algo las velocidades de otras curvas. Los demás circuitos no cambian.

## Lo que queda para CR7

En 7 circuitos OpenStreetMap no tiene marcado el pit lane, así que no hay con qué compararlos: Mónaco, Spielberg,
Melbourne, Shanghái, Yeda, Hungaroring y Montreal (los que CR1 deja «sin marcar»). Quedan para la revisión a mano del
usuario. (Al proponer el contrato se dijo 9 por error.)
