# Análisis del circuito de Shanghái: boxes, escapatorias, vallas y piezas (29/10/2026)

**Para qué:** sacar del modelo de Shanghái (del usuario, CC BY de Dave Love; CA1) cómo están hechos los boxes, las escapatorias y las barreras de un circuito permanente, y llevarlo a los circuitos que no son urbanos (CK2 y CK3). Medido en Blender sobre el modelo, con la pista (`Object_39`) como referencia. Las distancias son al borde del asfalto de carrera, en metros.

**Cómo se ha medido:** cortes transversales desde el edificio de boxes; 39 perfiles hacia fuera desde cada piano (rayo vertical sobre las mallas de suelo para saber la superficie, cada metro, hasta tocar una barrera); y para cada tipo de barrera, su distancia al asfalto y qué superficie hay entre las dos. Las longitudes son aproximadas (rejilla de 2 m).

## 1. Boxes y pit lane

Corte desde la fachada de los garajes hacia la recta de meta (tres cortes, iguales):

| Tramo | Ancho | En el modelo | Hoy en el juego (`pitLaneGeometry.ts`) |
|---|---|---|---|
| Zona de trabajo delante de los garajes (hormigón con marcas de neumáticos) | 12,5 m | `Object_40` | `SERVICE_WIDTH` 7 m |
| Línea pintada de los puestos (franja roja con publicidad) | 1,5 m | `Object_41` | no existe |
| Carril rápido (asfalto, con línea blanca) | 4,5 m | `Object_39` | `FAST_LANE_WIDTH` 5 m |
| Muro del pit con los puestos de los equipos encima | 1 m de muro + 2–3 m de puestos | `Object_71`/`72` (muro), `Object_95` (puestos), `Object_100` (93 módulos de 3,2 × 1,6 × 2,6 m) | muro de 0,6 m, sin puestos |
| Recta de meta | ~16 m | `Object_39` + `Object_89` | ancho del circuito |
| Hierba hasta la tribuna principal | 8 m | `Object_106` | — |

- **Largo:** el edificio de boxes mide unos 330 m; la zona de trabajo y el muro, unos 375 m (empiezan y acaban algo antes y después que el edificio).
- **Puestos:** los marcadores azules de cada equipo van cada ~10 m en la fachada.
- **Detrás del edificio:** calle de servicio y paddock con los pabellones cuadrados de los equipos (`carpa`, `pabellon`), camiones y furgonetas.
- **Sobre la recta:** un puente une los boxes con la tribuna principal (ya existe en el juego: el puente sobre la meta de Shanghái).

**Solo como referencia:** el trazado y la geometría del pit lane del juego no se tocan (29/10/2026, el usuario: este análisis es para las vallas y las escapatorias). Lo que sí se aprovecha de aquí son piezas para vestir el pit lane que ya existe: el muro con módulos de puesto encima y la línea pintada de los puestos.

## 2. Escapatorias

Perfiles hacia fuera desde el piano (lo que se cruza, en orden, y dónde está la barrera):

| Tipo de curva | Perfil típico (de la pista hacia fuera) | Barrera | Ejemplos medidos |
|---|---|---|---|
| Frenada fuerte (curva 1, horquilla de la 14, curva 6) | piano → asfalto 21–49 m → grava 15–65 m → hierba 3 m | muro de neumáticos a 48–120 m | asfalto 26 + grava 34 → neumáticos a 71 m; asfalto 49 + grava 65 → a 120 m; asfalto 21 + grava 18 → a 48 m |
| Curva media | piano → asfalto 3–12 m → grava 7–15 m | neumáticos a 27–34 m | asfalto 9 + grava 15 → a 34 m; asfalto 10 + grava 12 → a 33 m |
| Curva rápida o corta | piano → grava 12–14 m | neumáticos a 17–25 m | grava 13 → a 17 m; grava 14 → a 18 m |
| Interior de curva | piano → hierba 5–19 m | guardarraíl a 6–20 m | hierba 5 → a 6 m; hierba 14 → a 15 m |

- **Patrón:** por fuera, el asfalto va primero y la grava al final, delante del muro de neumáticos (lo contrario de la escapatoria «mixta» del juego, que pone la grava a la entrada y el asfalto a la salida). Cuanto más fuerte es la frenada, más ancho es todo.
- **Hoy en el juego:** `RUNOFF_BASE_M` 18 m por un factor de zona y 12 m de verde en los permanentes. La mediana medida por fuera es 22 m y el máximo 120 m: la base vale para curvas medias y se queda corta en las frenadas fuertes.

## 3. Barreras y vallas

| Barrera | Longitud aprox. | Distancia al asfalto (p10 / mediana / p90) | Qué hay delante | Pieza del kit |
|---|---|---|---|---|
| Muro de neumáticos (dos filas, tramos rectos de ~11,6 m) | la barrera dominante, varios km | 7,6 / 22 / 59 m | hierba 35 %, grava 33 %, asfalto 30 % | `muro_neumaticos` |
| Guardarraíl de tres bandas | ~3 km | 4,7 / 10 / 25 m | hierba 75 % (interiores de curva y rectas) | `guardarrail` (8 m) |
| Valla alta (paneles de malla de 7,2 × 6,1 m) | ~2 km | 7,4 / 14 / 55 m | hierba 58 %, asfalto 22 %, grava 20 % | `valla_alta` |
| Bloques de hormigón | ~0,5 km | 7 / 18 / 49 m | hierba, en accesos y zonas de servicio | `bloque_hormigon` (2 m) |
| Muro de hormigón | ~0,3 km | 11 / 18 / 32 m | hierba | — |
| Vallas publicitarias del borde | ~2 km | 1,2 / 8,6 / 21 m | pegadas al piano o sobre la escapatoria | `valla_publi` (10 m), `pancarta` (suelo) |

- **Reglas que salen:** el muro de neumáticos va al final de cada escapatoria de curva, con la valla alta detrás donde hay público. El guardarraíl va en los interiores de curva y en las rectas, a unos 10 m. La publicidad va pegada al borde o pintada en el suelo de la escapatoria.
- **Hoy en el juego:** `SceneBarrier` tiene `armco`, `concrete` y `tecpro`. Faltan el muro de neumáticos (que es la barrera principal de Shanghái) y la valla alta.

## 4. Elementos de alrededor

| Elemento | Cuántos | Distancia al asfalto | Pieza del kit |
|---|---|---|---|
| Grada común (estructura de celosía, asientos en escalones, 4 escaleras) | 7 | 22–100 m | `grada_comun` (66 × 40 × 19 m, 734 triángulos) |
| Farolas | 64 | 17–68 m (sobre todo en el paddock y los viales) | `farola` (11 m, 352 triángulos) |
| Torre de posiciones (vuelta, tiempo, diez primeros) | 6 | 24–35 m | `torre_posiciones` (23 m) |
| Grúa móvil (pluma de ~34 m) | varias (10 grupos con su textura, también puestos) | 22–117 m | `grua` (943 triángulos) |
| Postes de luz, árboles, vehículos y puestos de comisarios | — | — | `poste_luz`, `arbol_a/b/c`, `coche_medico`, `coche_aparcado`, `camion`, `refugio_comisarios` |

**Únicos de Shanghái (para CK4, no para el kit común):** edificio de boxes, tribuna principal con sus «alas», torre de control, pabellones y carpas del paddock, garajes, techo de la tribuna, pórtico y escaleras.

## 5. Qué se propone llevar a los circuitos no urbanos

El trazado de cada circuito y su pit lane se quedan como están: esto es solo para las vallas, las escapatorias y lo que se coloca alrededor.

1. **Escapatorias según la frenada de cada curva:** fuerte, asfalto de 20–50 m y luego grava de 15–60 m; media, asfalto de 5–10 m y grava de 10–15 m; rápida, solo grava de 12–15 m. Es un tipo nuevo, «asfalto y grava», además de los de `runoff.ts`.
2. **Barreras nuevas:** muro de neumáticos al final de cada escapatoria de curva y valla alta detrás donde haya gradas; el guardarraíl en interiores y rectas, a ~10 m; la publicidad pegada al borde o pintada en el suelo de la escapatoria.
3. **Alrededor:** gradas comunes por fuera de las frenadas fuertes, detrás de la valla alta; torres de posiciones en las rectas; grúas detrás de los muros de neumáticos de las curvas de frenada; farolas en el paddock y los viales.

Todo esto toca CK2 (piezas), CK3 (colocarlas en los 23 circuitos) y el escenario 3D (`scenery.ts` y `runoff.ts`; la geometría de la pista y del pit lane no cambia). Cada cambio necesita su contrato de tests y la autorización del usuario antes de implementarse.
