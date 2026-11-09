# Análisis de F1MapEditor como herramienta de circuitos (CR9)

Fecha: 05/11/2026. Repositorio analizado: <https://github.com/sticktor/F1MapEditor> (rama `main`, último cambio
04/11/2026, 13 estrellas). Solo se ha leído el repositorio en GitHub (README, `Mapeditor/docs/architektur.md`, el ejemplo
`teststrecke.json` y las cabeceras de los módulos de `ego-werkzeuge/strecke/`). No se ha descargado ni ejecutado nada.

**Para qué:** decidir si sus ideas sirven para una herramienta interna que genere circuitos con menos iteraciones, quizá
como MCP para que Claude los genere. La herramienta no es para el jugador.

## En una frase

Es un editor de escritorio en Python (PySide6 + NumPy) que diseña circuitos para el juego F1 25 y los empaqueta como mod.
Copiar su código no es viable: tiene licencia GPL-3.0 y está atado al formato de ese juego. Sus ideas sí sirven, y lo que
más ahorraría iteraciones es su forma de describir un circuito y comprobarlo con reglas antes de verlo.

## Cómo funciona

Tiene dos partes:

- **Mapeditor** (`Mapeditor/src/mapeditor/`): la ventana del editor. Tiene un mapa para dibujar, un perfil de alturas y
  peralte, y una sección transversal. Guarda el proyecto en `projekt.json` + `definition.json` y tiene deshacer.
- **Caja de herramientas** (`ego-werkzeuge/`): todo el cálculo, sin interfaz.
  - `strecke/` genera el circuito.
  - `ego/` lee y escribe los archivos del motor del juego (ERP, TRN, PVS, texturas…).
  - El editor la llama como proceso aparte (`adapter.py`), con una línea de comandos que devuelve eventos JSON.

### Cómo genera un circuito

1. **Definición en JSON** (`strecke/definition.py`). Solo es obligatoria la línea central (`mittellinie`); el resto tiene
   valores por defecto. La línea central admite tres formas:
   - **Segmentos:** un punto de salida y una lista de `gerade` (recta, con su longitud), `bogen` (curva, con radio,
     ángulo y sentido) y `klothoide` (curva de transición). Cada tramo puede llevar su nombre, su ancho y la altura al
     final. El error de cierre se reparte por toda la vuelta, así que el circuito cierra exacto.
   - **Puntos de control:** una spline cúbica cerrada pasa por ellos.
   - **CSV:** puntos con altura y anchos a izquierda y derecha.
2. **Línea central muestreada** (`mittellinie.py`).
   - Usa una spline periódica C2 y la muestrea cada metro desde la meta.
   - De cada punto saca dirección, normal, curvatura, altura, pendiente, peralte y anchos.
   - Comprueba que los bordes no se pliegan ni se cruzan y cuánto sitio libre queda junto a la pista.
3. **Perfil transversal** (`querprofil.py`). A cada lado y en cada punto hay cinco bandas: cuña verde, carril de boxes,
   piano, hierba y escapatoria (grava, hierba o asfalto, con la barrera al final). Se pueden cambiar por tramos. La
   barrera se acerca sola cuando otra parte del circuito o el interior de una curva cerrada no dejan sitio.
4. **Malla** (`geometrie.py`). Una franja de triángulos por cada banda, con su tipo de superficie (asfalto, piano,
   grava, muro…), UV y normales. Exporta OBJ, NPZ y JSON.
5. **Terreno** (`gelaende.py`). Triangulación de Delaunay con restricciones, que se une sin huecos al borde de la
   pista: fina cerca y más gruesa lejos (quadtree). Las alturas se interpolan con Laplace entre el borde de la pista y
   el borde del terreno.
6. **Trazada y velocidades** (`rennlinie.py`).
   - **Trazada:** de curvatura mínima, planteada como un problema cuadrático con límites, que es el método de Heilmeier
     et al. (2020).
   - **Velocidades:** un modelo de masa puntual con carga aerodinámica y resistencia, o un modelo g-g-v. Se resuelve
     hacia delante y hacia atrás hasta que converge, y de ahí salen las frenadas.
7. **Zonas** (`zonen.py`). Coloca DRS y Straight Mode en las rectas más largas, o donde diga la definición. Los valores
   por defecto salen de medir los 28 circuitos del juego.
8. **Reglas de comprobación** (`pruefregeln.py`, 82 KB).
   - Recogen en un solo sitio lo que el autor aprendió de los circuitos originales: frenadas dentro de las curvas, zonas
     respecto a la meta, cinco reglas del carril de boxes (R1–R5), el tamaño máximo de ±1024 m, peralte máximo FIA de
     5,7°…
   - Cada aviso tiene un identificador fijo, una gravedad (error, aviso o nota) y valores real/esperado.
   - Hay seis niveles, de la definición sola al paquete final. El editor pasa el primero en vivo, 400 ms después de
     cada cambio.
9. **Propuesta aleatoria** (`vorschlag.py`, «Vorschlag erzeugen»).
   - Toma una nube de puntos en una elipse, saca su envolvente convexa y le añade entrantes.
   - La suaviza con un filtro gaussiano hasta llegar al radio mínimo y la escala a la longitud pedida.
   - La da por buena solo si pasa las reglas sin errores ni avisos.
   - Con la misma semilla sale siempre el mismo circuito.
10. **Importación** (`importe.py`, `nachzeichnen.py`).
    - Lee CSV de la base de datos de circuitos de la TUM, trazas GPS (GPX) y circuitos del propio juego.
    - También calca un circuito desde una imagen: el usuario hace unos clics y el editor busca la carretera entre ellos
      con A* sobre una máscara de asfalto.
11. **Construcción del mod** (`spiel_*.py`, `streckencode.py`). Parte de un mod de Portimão como base, sustituye la
    geometría, la física de superficies, la IA, las cámaras y el minimapa, y renombra el código del circuito. Esta parte
    es exclusiva de F1 25.

Tiene unos 33 archivos de tests con pytest.

## Licencia

- **GPL-3.0** (`LICENSE`, «Copyright (C) 2026 The Mapeditor authors»). Si copiamos o adaptamos su código, F1Sim entero
  tendría que publicarse con GPL-3.0 y su código fuente. Por eso **no se copia código** (ni traducido a TypeScript
  línea a línea).
- Las **ideas, los algoritmos y los formatos de datos** no están protegidos por la licencia. Se pueden reimplementar
  desde cero, sobre todo cuando vienen de fuentes públicas: la trazada de curvatura mínima es de Heilmeier et al. 2020,
  y Delaunay, Laplace y A* son métodos clásicos.
- Las licencias de terceros (NumPy, Pillow, zstandard, LGPL) están en `Mapeditor/packaging/lizenzen/`. No nos afectan,
  porque no usaríamos nada suyo.
- **Datos externos que cita:**
  - Base de datos de circuitos de la TUM: si se quiere usar como fuente de formas, hay que revisar su licencia por
    separado. No la he comprobado en esta tarea.
  - Archivos de F1 25: no se pueden usar.

## Qué se puede aprovechar

De más a menos útil para F1Sim, y siempre como idea reimplementada:

1. **Describir un circuito con segmentos con nombre** (recta de N m, curva de radio R y ángulo A a la derecha, altura al
   final), cerrando la vuelta con el error repartido.
   - Hoy nuestros circuitos son puntos dibujados en `src/data/` (por ejemplo, `barcelonaTrack.ts`) y referencias SVG.
     Ajustarlos cuesta iteraciones de prueba y captura.
   - Una descripción así es justo lo que Claude puede escribir y razonar bien, y se convierte sola en `points`.
2. **Reglas de comprobación con identificador y real/esperado**, que pasen antes de mirar nada en el navegador. Para
   nosotros serían:
   - que la vuelta cierre y mida lo que dice `lapLengthMeters`;
   - que los bordes no se crucen;
   - que haya distancia mínima entre partes alejadas del trazado;
   - el radio mínimo;
   - que el carril de boxes no pise la pista;
   - que los muros y el escenario no queden dentro de la escapatoria.

   Varias ya existen como tests sueltos (`track-width`, `scenery-3d-3/-4`, `relief-ck5`). La idea es reunirlas en una
   sola función que devuelva una lista de avisos, sin pasar por el navegador.
3. **Perfil transversal por bandas y por tramos** (piano, hierba, escapatoria, barrera, con la barrera ajustada al sitio
   libre). Encaja con nuestro kit de circuitos (CK1–CK5) y con lo que pide `scenery-3d-3` (vallas a 3 m o más).
4. **Importar formas**: CSV con anchos o GPX. Pasar de una fuente con escala real a puntos ahorra calcar a mano.
5. **Trazada de curvatura mínima y perfil de velocidad**. Sirve para calibrar `corners`, `apexSpeedKmh` y las frenadas
   a partir de la forma, en lugar de ajustarlos a mano con `calibrate-laps.mjs`. Es la idea de más valor para la
   simulación, pero también la más cara.
6. **Propuesta aleatoria con semilla**. Para circuitos ficticios o de prueba; hoy no la necesitamos.

**No sirve:** la construcción del mod (ERP, TRN, PVS, Portimão), el renombrado del código de circuito ni el terreno por
Delaunay. Nosotros ya tenemos `relief.ts`, con sus reglas acordadas en CK5.

## Cómo encajaría como MCP

Un servidor MCP local y propio, en Node/TypeScript para reutilizar `src/utils/spline.ts` y los tipos de
`TrackDefinition`. Herramientas propuestas:

| Herramienta | Entrada | Salida |
|---|---|---|
| `circuito_desde_segmentos` | JSON de segmentos (recta, curva, clotoide; nombre, ancho, altura) | `points`, longitud, error de cierre |
| `comprobar_circuito` | definición o `TrackDefinition` | lista de avisos `{id, gravedad, real, esperado, t}` |
| `vista_previa` | definición | PNG en planta con bordes, boxes y avisos marcados |
| `importar_forma` | CSV/GPX (archivo local que da el usuario) | definición por puntos de control |
| `trazada_y_velocidades` (fase 2) | definición | trazada, curvas detectadas, velocidad en vértice |

Con esto, Claude escribiría la definición y la comprobaría, y la corregiría hasta que no quedaran errores. Solo entonces
pasaría a capturas en el navegador para la parte visual, que sigue necesitando tu aprobación.

Otra opción más barata: las mismas funciones como script `node scripts/circuito.mjs <definición>`, sin MCP. Claude ya
puede ejecutarlo. El MCP solo añade comodidad y una interfaz estable.

## Viabilidad

- **Usar F1MapEditor tal cual o copiar su código: no viable.** Hay tres motivos:
  - La GPL-3.0 obligaría a liberar F1Sim.
  - Está en Python y escritorio.
  - Su salida es un mod de F1 25, no nuestro formato.
- **Herramienta propia inspirada en sus ideas: viable**, con este coste aproximado para un solo desarrollador con
  Claude:

| Pieza | Coste aproximado |
|---|---|
| Definición por segmentos → `points`, con cierre repartido | 1–2 días |
| Reglas de comprobación reunidas en una función (reutilizando los tests actuales) | 2–3 días |
| Vista previa en PNG (canvas en Node o SVG) | 1 día |
| Envolver en MCP local (o script) y documentarlo | 1 día |
| Importar CSV/GPX | 1 día |
| **Fase 1 (sin trazada)** | **6–8 días, unas 1,5 semanas** |
| Fase 2: trazada de curvatura mínima + perfil de velocidad, calibrado contra `lapReferences` | 1–2 semanas más |

No hace falta cuenta, descarga ni servicio de pago: todo es local y de código propio.

## Recomendación

1. **No copiar código** de F1MapEditor, por la GPL-3.0. Citarlo como inspiración en la documentación de la herramienta.
2. Si se quiere menos iteración al crear o corregir circuitos, abrir una tarea nueva para la **fase 1**:
   - definición por segmentos;
   - reglas reunidas;
   - vista previa en PNG;
   - empezar como script de `scripts/` y convertirlo en MCP solo si se usa a menudo.

   Su contrato de tests habría que acordarlo antes, como siempre.
3. Dejar la **fase 2** (trazada y velocidades) para cuando haya que calibrar circuitos nuevos. Hoy los 23 circuitos ya
   están calibrados.
4. Probarla primero rehaciendo un circuito conocido (por ejemplo, Barcelona) y comparar el resultado con los puntos
   actuales. Si no ahorra iteraciones ahí, no vale la pena seguir.
