# TL7 · Dónde llevan los rótulos los coches de 2023 y 2024

Fecha: 16/11/2026. Petición del usuario: «Aprende de las marcas y patrocinadores de donde están puestos para el resto de
equipos y lo mismo para el w14». Estudio hecho en Blender con los dos modelos que aporta el usuario
(`mercedes_f1_w14_free.glb`, 232 k triángulos, y `amr24.glb`, modelo propio del usuario, 275 k triángulos). Solo se mira el
**sitio** de cada rótulo; ninguna marca pasa al juego.

Las posiciones van de 0 (punta del morro) a 1 (alerón trasero) a lo largo del coche, y de 0 (suelo) a 1 (lo más alto) en
altura.

## Lo que llevan los dos coches

| Sitio | W14 (2023) | AMR24 (2024) | Uso en el juego |
|---|---|---|---|
| Plano superior del alerón trasero (0,96, arriba) | patrocinador principal, a todo lo ancho | patrocinador principal, a todo lo ancho | patrocinador principal |
| Placas laterales del alerón trasero (0,94) | segundo patrocinador, a los dos lados | (en el atlas de rótulos) | cuarto patrocinador |
| Laterales de la tapa motor (0,58-0,63, altos) | patrocinador grande a los dos lados | rótulo grande a los dos lados | segundo patrocinador |
| Laterales del pontón (0,54-0,64, a media altura) | patrocinador principal, enorme | rótulo grande (atlas) | patrocinador principal |
| Aleta de la tapa motor (0,8, arriba) | — | dorsal | dorsal |
| Halo (0,45, lo más alto del habitáculo) | patrocinador pequeño a los dos lados | rótulo del halo | cuarto patrocinador |
| Morro, por arriba (0,19-0,31) | dorsal y logo del equipo | dorsal | dorsal y tercer patrocinador |
| Morro, por los lados (0,33) | logo del fabricante a los dos lados | — | tercer patrocinador |
| Alerón delantero, flaps (0,04-0,11, abajo) | patrocinador a los dos lados | rótulo a lo ancho | cuarto patrocinador |
| Retrovisores (0,60) | logo pequeño | — | (sin rótulo: demasiado pequeño) |
| Neumáticos | marca del neumático | marca del neumático | Pirulí (ya lo hace el juego) |

## Reparto de los cuatro patrocinadores de cada librea (TL3), revisado el 16/11/2026

Tras la revisión del usuario («he visto en el alerón delantero un patrocinio mal puesto y con una letra pequeña, no parece
una marca») se midió cada superficie en Blender y se rehicieron las que estaban mal:

| Superficie | Medida | Lleva |
|---|---|---|
| Costado del pontón (nueva) | 49 × 13 cm | patrocinador principal |
| Parte de arriba del pontón | 51 × 22 cm | patrocinador principal |
| Plano del alerón trasero | 80 × 18 cm | patrocinador principal (antes salía en espejo) |
| Laterales de la tapa motor | 51 × 14 cm | segundo patrocinador |
| Lateral del monocasco, delante del pontón | 57 × 12 cm | tercer patrocinador |
| Cara de fuera de las placas del alerón delantero | 32 × 9 cm | cuarto patrocinador (antes, sobre los flaps: quedaba partido y diminuto) |
| Placas del alerón trasero | 26 × 16 cm | cuarto patrocinador |
| Morro y lo alto de la tapa motor | 28 × 14 y 34 × 16 cm | dorsal |

El halo se descarta: el tubo es tan fino que el rótulo se deformaba. Cada rótulo se dibuja con la proporción real de su
superficie (antes el del morro se dibujaba como si fuera alto y el del alerón trasero, como la mitad de ancho, y el texto
salía estirado o aplastado).

## Aspecto de marca

Cada patrocinador tiene su estilo en `src/data/brands.ts`: tipo de letra (condensada, con remate, redonda o ancha),
cursiva, colores, recuadro y un símbolo sencillo (círculo, ala, rombo, estrella, barras o gota). Los que también salen en
las vallas usan sus mismos colores. Los que no tienen estilo anotado (los patrocinadores firmados de la partida y los de
reserva) reciben uno estable sacado de su nombre. Las marcas sin recuadro llevan un borde fino del color contrario para
leerse sobre cualquier franja de la pintura.

## Patrocinadores del juego

- **Libreas por año (TL3):** cuatro por equipo y año, más seis de reserva por equipo para los años sin fin.
- **Librea de siempre** (carrera libre): tres por equipo (Nuvora, Zentia…), sin cambios de nombre; ahora también con aspecto de marca.
- **Patrocinadores firmados** (T4.9): dieciocho nombres inventados; estilo sacado de su nombre.
- **Vallas y paneles:** veintiséis parodias con sus colores. Para que el mundo sea coherente, las libreas usan los mismos
  nombres que las vallas cuando existe la misma parodia (TAG Hoyer, Salesfuerza), y se cambian los dos nombres más flojos
  (Estéfanos pasa a Sofistica y Pinturas Ma a Musgo Oil).
