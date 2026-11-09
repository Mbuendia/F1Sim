# Kit de piezas sacado del modelo de Montreal (CR3)

Tarea CR3 del Sprint 10.5 (contrato acordado el 07/11/2026). Modelo del usuario
`circuit_gilles_villeneuve_montreal_2019_layout.glb` (52 MB): Dave Love, «Circuit Gilles Villeneuve Montreal 2019
layout», CC BY 4.0. Se trabajó sobre una copia en `scratch/cr3/`; el original no se toca.

## Revisión de las 23 texturas (antes de usar nada)

Cada textura se sacó del archivo y se miró entera. Solo una lleva marcas reales.

| Textura | Qué es | Marca | Decisión |
|---|---|---|---|
| `00-groove_01` | Huella de goma oscura sobre el asfalto (1024 px) | no | No se usa en el kit |
| `01-sin-material` | Gris liso, sin material que la use (1024 px) | no | No se usa |
| `02-Glass_Black-EnvironmentMat` | Atlas de edificios y vallas: cristal, hormigón, chapa y logotipos de patrocinadores reales (Allianz, Rolex, Assetto Corsa, Fly Emirates, UBS, Shell V-Power y Pirelli) | sí | No se usa; de ella solo sale un recorte de chapa naranja y blanca sin marcas (128 × 256 px) para el atlas de la grada |
| `03-GitterMat` | Rejilla de la valla de malla, con transparencia (64 px) | no | Se usa: `montreal-valla.webp` (valla alta) |
| `04-KerbMat` | Bloques de piano rojos y blancos (512 px) | no | Se usa, reducida a 256: `montreal-pianos.webp` |
| `05-GuardrailMat` | Guardarraíl metálico con banda roja (512 × 1024 px) | no | Se usa, reducida a 128 × 256: `montreal-guardarrail.webp` |
| `06-GravelMat` | Grava (512 px) | no | Se usa, reducida a 256: `montreal-grava.webp` |
| `07-RunoffgreenMat` | Escapatoria pintada de verde (512 px) | no | Se usa, reducida a 256: `montreal-escapatoria.webp` |
| `08-RunoffredMat` | Escapatoria pintada de rojo (512 px) | no | No se usa (basta la verde) |
| `09-WallMat` | Muro de hormigón (512 px) | no | No se usa en esta tarea |
| `10-EmptyMat` | Marco rojo de ayuda del autor (16 px) | no | No se usa |
| `11-TiresMat` | Neumáticos rojos y blancos apilados (512 px) | no | Se usa, reducida a 256: `montreal-neumaticos.webp` (muro de neumáticos) |
| `12-GrassMat` | Césped (1024 px) | no | No se usa |
| `13-GrassbetonredMat` | Adoquín con césped, rojo (512 px) | no | No se usa |
| `14-GrassbetonMat` | Adoquín con césped, verde (512 px) | no | No se usa |
| `15-Asphalt02Mat` | Asfalto (1024 px) | no | No se usa |
| `16-GradientMat` | Borde de césped con tierra (1024 px) | no | No se usa |
| `17-Asphalt03Mat-AsphaltMat` | Asfalto con línea blanca (1024 px) | no | No se usa |
| `18-ZinkMat` | Chapa metálica (512 px) | no | Se usa, reducida a 128 px, en el atlas de la grada |
| `19-trees_02` | Árboles recortados, con transparencia (1024 px) | no | Se usa, reducida a 256: `montreal-arboles.webp` |
| `20-trees_01` | Más árboles recortados (1024 px) | no | No se usa (la otra trae los árboles en planos cruzados) |
| `21-MarksMat` | Líneas pintadas blancas y amarillas (1024 px) | no | Se usa, reducida a 256: `montreal-marcas.webp` |
| `22-grass_straws_01` | Matas de hierba recortadas (1024 px) | no | No se usa |

## Piezas

Cada pieza se recortó con planos de corte de un tramo recto del modelo, con sus coordenadas de textura originales, y se
dejó en metros con el origen en el centro de la base y el largo en X. En el juego van con su propia textura (repetida,
porque sus coordenadas pasan de 0–1) en vez del atlas común de CK2.

| Pieza (`id`) | Papel | Medidas (m) | Triángulos | Textura | Sustituye a |
|---|---|---|---|---|---|
| `guardarrail` | guardarraíl | 8 × 0,15 × 1,11 | 160 | `montreal-guardarrail.webp` (128 × 256) | guardarraíl de CK2 |
| `valla_alta` | valla de malla | 8 × 0,79 × 3,65 | 168 | `montreal-valla.webp` (64) | valla alta de CK2 |
| `muro_neumaticos` | muro de neumáticos | 10 × 1,4 × 1,17 | 58 | `montreal-neumaticos.webp` (256) | muro de neumáticos de CK2 |
| `grada_comun` | grada | 33,1 × 29 × 17,1 | 876 | `montreal-grada.webp` (256, atlas) | grada común de CK2 |
| `arbol_a`, `arbol_b`, `arbol_c` | árbol | hasta 14,4 × 14,7 × 18 | 4 cada uno | `montreal-arboles.webp` (256) | los tres árboles de CK2 |
| `pianos` | piano | 2,18 × 0,74 × 0,05 | 64 | `montreal-pianos.webp` (256) | nueva (antes, solo pintura) |
| `grava` | grava | 10 × 10 | 2 | `montreal-grava.webp` (256) | nueva (antes, color liso) |
| `escapatoria` | escapatoria | 10 × 2,61 | 10 | `montreal-escapatoria.webp` (256) | nueva (antes, color liso) |
| `marcas_suelo` | marcas en el suelo | 10 × 0,6 | 10 | `montreal-marcas.webp` (256) | nueva |

**La grada:** el módulo recortado tenía 6.027 triángulos y pesaba 102 KB comprimido; con él los modelos pasaban del
presupuesto de PF8 (3.170 KB). Se dejó en 876 triángulos (26 KB): de cerca se notan algunos escalones irregulares,
pero de lejos se lee como la grada de tubo de Montreal. Sus tres materiales (chapa, rejilla y el recorte de chapa
pintada) van en un solo atlas de 256 px, para que sea una sola llamada de dibujo.

**Las texturas:** el contrato permite 512 px; se dejaron en 256 px (87 KB en total) porque a 512 lo que baja el juego
al instalarse pasaba del presupuesto de OF1 (8.121 KB frente a 7.900); a 256 queda en 7.855 KB.

## Dónde van en el juego

- Guardarraíl, valla, muro de neumáticos, grada y árboles: en los mismos sitios que las de CK2, porque toman su nombre
  y las coloca la misma regla del kit.
- Pianos: un bloque cada 2,18 m a lo largo de cada piano pintado, separado 0,3 m del asfalto como el resto del kit, y
  nunca junto al pit lane, en el agua ni dentro de un monumento.
- Marcas: una línea en el borde entre el asfalto y la grava de las escapatorias (CK3 no deja piezas junto al pit lane).
- Grava y escapatoria: su material pinta las franjas de grava de las escapatorias y el asfalto pintado de verde del estadio.
