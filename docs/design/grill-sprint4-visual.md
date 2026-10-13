# Sprint 4 — diseño visual de la gestión: entrevista y decisiones

Fecha: 09/10/2026. Referencia revisada: rama `sprint/4`, sobre main 7f3a9ac.

Estado: cinco rondas aceptadas por el usuario. Definición de páginas, navegación y composición acordadas; maqueta, contratos de tests e implementación pendientes. Complementa la entrevista del rediseño de escritorio ([grill-redesign.md](./grill-redesign.md)), cuya identidad visual sigue vigente, y la planificación funcional del Sprint 4 (`DASHBOARD.md`, sección 7.2).

Los esquemas son orientativos: fijan qué hay en cada página y cómo se reparte, no medidas ni textos finales. Nombres, cifras y equipos de los esquemas son ejemplos.

## Punto de partida

La aplicación tiene hoy tres vistas (`currentView` en `App.tsx`): portada, paddock y carrera. El paddock es una página larga con secciones plegables (temporada, historial, partidas, campeonato, desarrollo, componentes, setup), la selección de piloto y circuito y el botón de entrar a pista. El equipo del jugador se deduce del piloto elegido.

## Recorrido acordado

```
Portada
  └─ Menú de partidas ──┬─ Continuar ───────────────┐
                        ├─ Nueva carrera profesional ─ Elegir equipo ─┤
                        ├─ Cargar partida ──────────┤
                        └─ Carrera libre (modo aparte: piloto, circuito, formato y tiempo)
                                                    │
        Centro de gestión: Inicio · Carrera · Equipo · Fábrica · Finanzas · Temporada
                                                    │
        Fin de semana (libres → clasificación → carrera) → Podio → Informe de la ronda → Inicio
                                                    │
        Tras la ronda 24: Invierno (cinco pasos) → Temporada siguiente
```

## Primera ronda — páginas entre la portada y la pista

1. **Menú de partidas** (página nueva tras la portada): «Continuar» destacado con la última partida (equipo, temporada, ronda, puesto en constructores y saldo), «Nueva carrera profesional», «Cargar partida» y «Carrera libre». La rueda 3D sigue al fondo. El guardado deja de ser un panel del paddock.

```
+--------------------------------------------------+
|  F1 RACE MANAGER                                 |
|  [ CONTINUAR ]  Aston Martin - Temporada 2       |
|                 Ronda 7 de 24 - Mónaco           |
|                 P5 constructores - saldo 12 M    |
|  Nueva carrera profesional                       |
|  Cargar partida            (3 guardadas)         |
|  Carrera libre                                   |
|                          rueda 3D al fondo  ->   |
+--------------------------------------------------+
```

2. **Partida nueva: elegir equipo en una página.** Los diez equipos como tarjetas con coche 3D, sus dos pilotos, saldo inicial, objetivo de la junta y dificultad; nombre de la partida y «Empezar». Se elige equipo, no piloto.

```
+--------------------------------------------------+
| ELIGE TU EQUIPO                                  |
| +----------+ +----------+ +----------+ +-------+ |
| | McLaren  | | Ferrari  | | Mercedes | | ...   | |
| | [coche]  | | [coche]  | | [coche]  | |       | |
| | NOR  PIA | | LEC  HAM | | RUS  ANT | |       | |
| | Saldo 40 | | Saldo 38 | | Saldo 36 | |       | |
| | Obj: 1º  | | Obj: 2º  | | Obj: 3º  | |       | |
| | Dif: baja| | Dif: baja| | Dif: med | |       | |
| +----------+ +----------+ +----------+ +-------+ |
| Nombre de la partida: [__________]   [EMPEZAR]   |
+--------------------------------------------------+
```

3. **Carrera libre como modo aparte**, desde el menú: su propia página, que es en esencia el paddock de hoy (piloto, circuito, formato y tiempo). No toca ninguna partida. Dentro de la carrera profesional solo se corre la ronda que toca.

4. **Centro de gestión con pestaña «Inicio»** delante de las otras cinco: la ronda que toca con su botón rojo, la lista de pendientes y cuatro tarjetas de estado (campeonato, finanzas, junta, fábrica) que llevan a su pestaña. La cabecera lleva equipo, temporada y ronda, saldo y confianza de la junta.

```
+--------------------------------------------------+
| ASTON MARTIN  T2 - R7/24   Saldo 12 M  Junta 64  |
| Inicio | Carrera | Equipo | Fábrica | Finanzas | T|
+--------------------------------------------------+
| SIGUIENTE: GP DE MÓNACO     | PENDIENTE (2)      |
| Lluvia 20% - Sprint: no     | - Mejora lista     |
| [ PREPARAR CARRERA ]        | - Contrato de STR  |
+-----------------------------+--------------------+
| Campeonato | Finanzas  | Junta     | Fábrica     |
| P5  88 pts | +3,1 M/r  | 64 estable| Suelo: 2 r. |
+--------------------------------------------------+
```

## Segunda ronda — guardado, color y cierre de la ronda

1. **Cargar partida: tarjetas con el estado.** Una tarjeta por partida con el color del equipo, nombre, temporada y ronda, puesto y saldo, fecha y, si la hay, la carrera en curso. Cargar, exportar y borrar en cada tarjeta; importar arriba; el autoguardado, identificado.

```
+--------------------------------------------------+
| PARTIDAS                          [Importar]     |
| +----------------------+ +---------------------+  |
| |# Aston Martin        | |# Williams           |  |
| | "Mi carrera"         | | "Prueba lluvia"     |  |
| | T2 - Ronda 7 de 24   | | T1 - Ronda 3 de 24  |  |
| | P5 const. - 12 M     | | P8 const. - 4 M     |  |
| | EN CARRERA: vuelta 16| | hace 3 días         |  |
| | [CARGAR] Exp. Borrar | | [CARGAR] Exp. Borrar|  |
| +----------------------+ +---------------------+  |
| Autoguardado: hace 2 min                         |
+--------------------------------------------------+
```

2. **Guardar: autoguardado visible y menú «Partida».** La cabecera dice siempre «Guardado hace X». Un menú «Partida» en la cabecera, en la gestión y en la carrera, con Guardar, Guardar como, Exportar y Salir al menú. Se guarda sola tras cada decisión y cada carrera (hoy: cada 30 s en carrera, al volver al paddock y al cerrar la página).

3. **Informe de la ronda** tras el podio y antes de volver a Inicio: resultado de los dos coches, puntos y campeonato, dinero ingresado y gastado con sus conceptos, movimiento de la junta con su motivo, objetivos de patrocinio y mejora de los pilotos.

```
+--------------------------------------------------+
| INFORME - RONDA 7 - GP DE MÓNACO                 |
| ALO P6 (+8 pts)     STR P11                      |
+------------------------+-------------------------+
| DINERO                 | JUNTA                   |
| + 2,4 M  ronda         | 64 -> 67  (+3)          |
| + 0,8 M  puntos        | "Por encima de lo       |
| - 1,1 M  sueldos       |  esperado"              |
| - 0,6 M  daños STR     +-------------------------+
| = + 1,5 M              | PATROCINIO  1 de 2      |
+------------------------+ PILOTOS  ALO +1 lluvia  |
|                              [ CONTINUAR ]       |
+--------------------------------------------------+
```

4. **Color: acento de equipo y acción en rojo.** Base grafito y marfil del rediseño; el color del equipo marca la cabecera, la pestaña activa y los dos pilotos propios; el rojo queda para la acción principal. En los equipos rojos el acento usa su color secundario.

## Tercera ronda — temporada, invierno, dinero y personas

1. **Temporada: franja de 24 rondas y detalle.** Franja horizontal con bandera, resultado propio o ganador, marca de sprint y la ronda actual resaltada; debajo, el detalle de la ronda elegida (con «Saltar ronda») y las dos clasificaciones. El historial de temporadas, en una subpestaña.

```
+--------------------------------------------------+
| TEMPORADA 2            [Calendario] [Historial]  |
| 1  2  3  4  5  6 [7] 8  9  10 11 12 ... 24       |
| AU CN JP BH SA MI MC ES CA AT GB BE              |
| P4 P6 -- P9 P5 P3  > .  .  .  .  .               |
|    S           S                                 |
+------------------------+-------------------------+
| RONDA 7 - MÓNACO       | PILOTOS    | CONSTRUCT. |
| 78 vueltas - lluvia 20%| 1 NOR 142  | 1 MCL 251  |
| [Saltar ronda]         | 7 ALO  52  | 5 AMR  88  |
+--------------------------------------------------+
```

2. **Invierno: secuencia de cinco páginas a pantalla completa** con barra de progreso: (1) cierre: campeones y premios; (2) junta: balance, o destitución y oferta de otro equipo; (3) mercado: contratos que vencen y libres; (4) parrilla: retiradas y cantera; (5) coche nuevo y objetivo. Se puede volver atrás hasta confirmar.

```
+--------------------------------------------------+
| INVIERNO  T2 -> T3                               |
| (1)Cierre (2)Junta (3)Mercado (4)Parrilla (5)Coche|
| ===========o-----------------------------------  |
|  CONTRATOS QUE VENCEN                            |
|  STR   pide 4 M/año    [Renovar] [Dejar libre]   |
|  Jefe de aero          [Renovar] [Dejar libre]   |
|  LIBRES EN EL MERCADO                            |
|  PIA 91   SAI 88   joven: "L. Ferrer" 74 (pot 90)|
|                       [Atrás]   [Siguiente]      |
+--------------------------------------------------+
```

3. **Finanzas: cifra, gráfica y libro.** Saldo o deuda con su límite y previsión de la ronda siguiente; gráfica del saldo ronda a ronda; ingresos y gastos por concepto; patrocinio y junta en la misma pestaña; el libro completo debajo.

```
+--------------------------------------------------+
| SALDO  12,4 M      Próxima ronda: +1,2 M         |
| Deuda: 0  (límite 20 M)                          |
|        ___/\___/\__/\_____        saldo/ronda    |
+------------------------+-------------------------+
| INGRESOS    | GASTOS   | PATROCINIO | JUNTA 64   |
| Ronda   2,4 | Sueldos  | Volt  0,4/r| Obj: 5º    |
| Puntos  0,8 | Obras    | [oferta]   | =======--  |
+------------------------+-------------------------+
| LIBRO  R7 +2,4 ronda | R7 -0,6 daños STR | ...   |
+--------------------------------------------------+
```

4. **Retratos: casco para los pilotos e insignia para el personal.** Casco en SVG con los colores y el dorsal de cada piloto (también los de la cantera); el personal, con una insignia de su puesto y sus iniciales. Sin fotos ni parecidos a personas reales.

## Cuarta ronda — fábrica, fin de semana, muro y movimiento

1. **Fábrica: coche en el centro y columnas a los lados.** El coche 3D con las mejoras montadas marcadas; a la izquierda, los proyectos como línea de tiempo en rondas; a la derecha, las cuatro instalaciones con su nivel y su obra; debajo, los componentes de los dos coches.

```
+--------------------------------------------------+
| DESARROLLO       |    COCHE      | INSTALACIONES |
| Suelo            |               | Túnel   ##### |
| [====>...] 2 r.  |   [ coche 3D  | Simul.  ###-- |
| Alerones         |    con las    |  obra: 3 r.   |
| [=>......] 4 r.  |    mejoras ]  | Producc.##--- |
| + Nuevo  (3,0 M) |               | Banco   ###-- |
+------------------+---------------+---------------+
| COMPONENTES  ALO: motor 2/4  caja 1/4  ERS 2/3   |
|              STR: motor 3/4! caja 2/4  ERS 1/3   |
+--------------------------------------------------+
```

2. **Carrera: las sesiones como pasos.** El fin de semana como una fila de sesiones (libres, clasificación, carrera; con sprint, las suyas) y el paso actual abierto debajo: programa de libres, setup de los dos coches con el recomendado, juegos de neumáticos y previsión. Un solo botón rojo: la sesión siguiente.

```
+--------------------------------------------------+
| GP DE MÓNACO - RONDA 7        Lluvia: 20%        |
| (Libres)--->(Clasificación)--->(Carrera)         |
|  hecho         AHORA                             |
+------------------------+-------------------------+
| ALO  setup             | STR  setup              |
| Carga    [-|-|o|-|-]   | Carga    [-|o|-|-|-]    |
| Recomendado: +1 / 0    | Recomendado: +1 / -1    |
| Juegos: 2D 3M 5B       | Juegos: 2D 3M 4B        |
+------------------------+-------------------------+
|                       [ IR A CLASIFICACIÓN ]     |
+--------------------------------------------------+
```

3. **Muro en carrera.** Las órdenes de equipo, en una franja estrecha entre las dos tarjetas (son de los dos coches a la vez). La ventana de parada, una línea en la tarjeta de cada piloto («si paras: P9, a 2,1 s de HUL»). La altura del muro no crece.

```
+----------------------+---+-----------------------+
| ALO  P6  M 14v       |   | STR  P7  M 14v        |
| Si paras: P9         |<->| Si paras: P12         |
|  a 2,1 s de HUL      |   |  en tráfico           |
| [BOX v] [Stay out]   |   | [BOX v] [Stay out]    |
+----------------------+---+-----------------------+
        franja central: libre / mantener / cambiar
```

4. **Movimiento sobrio, con momentos señalados.** Fundido breve al cambiar de pestaña o de página; animación solo en el informe de la ronda (cifras que cuentan), los campeones, la destitución y la presentación del coche nuevo. Se respeta la preferencia de movimiento reducido.

## Quinta ronda — equipo y encaje en el plan

1. **Equipo: pilotos arriba, personal y boxes debajo.** Dos tarjetas grandes para los titulares (casco, edad, contrato, sueldo, atributos, ingeniero) y una estrecha para el reserva con su botón de sustitución; debajo, una fila con el personal técnico y otra con el equipo de boxes y su plan de la semana.

```
+--------------------------------------------------+
| +---------------+ +---------------+ +----------+  |
| | (14) ALONSO   | | (18) STROLL   | | RESERVA  |  |
| | 44 a - T3     | | 27 a - T2 !   | | L.Ferrer |  |
| | RIT 92 LLU 95 | | RIT 80 LLU 78 | | 74 (p90) |  |
| | Ing: R. Vidal | | Ing: A. Sato  | | [Subir   |  |
| | [Renovar]     | | [Renovar]     | |  por STR]|  |
| +---------------+ +---------------+ +----------+  |
| PERSONAL  [TD] Okafor n4  [AE] Brandt n3  [ES] ..|
| BOXES  nivel 3 - fatiga 20%                      |
|        Plan: (velocidad) (seguridad) (descanso)  |
+--------------------------------------------------+
```

2. **Maqueta navegable antes de implementar:** una maqueta HTML con todas las páginas nuevas y datos de ejemplo, a 1280 y 1920 px, que el usuario revisa y corrige antes de escribir código de la aplicación.
3. **Encaje en el plan:** tres tareas nuevas de estructura al principio del sprint (T4.18 maqueta y sistema visual; T4.19 menú de partidas, partida nueva y carrera libre; T4.20 informe de la ronda). T4.3 pasa a ser el armazón de pestañas con Inicio y cada tarea de gestión rellena su pestaña.
4. **Tamaños:** escritorio, validado a 1280×720, 1366×768 y 1920×1080. En móvil no se garantiza nada nuevo.

## Síntesis: páginas y tarea que las trae

| Página | Qué se ve primero | Tarea |
| --- | --- | --- |
| Menú de partidas | Continuar con el estado de la última partida | T4.19 |
| Cargar partida | Tarjetas por partida con color de equipo | T4.19 |
| Elegir equipo | Diez tarjetas con coche, pilotos, saldo, objetivo y dificultad | T4.19 |
| Carrera libre | Piloto, circuito, formato y tiempo (el paddock de hoy) | T4.19 |
| Cabecera y pestañas, Inicio | Siguiente carrera, pendientes y cuatro tarjetas de estado | T4.3 |
| Carrera | Sesiones como pasos y setup de los dos coches | T4.3; libres en T4.13 |
| Equipo | Titulares, reserva, personal y boxes | T4.5 a T4.8 |
| Fábrica | Coche, proyectos, instalaciones y componentes | T4.2 y T4.4 |
| Finanzas | Saldo, gráfica, conceptos, patrocinio, junta y libro | T4.1, T4.9 y T4.10 |
| Temporada | Franja de 24 rondas, detalle y clasificaciones | T4.3 |
| Informe de la ronda | Resultado, dinero, junta, patrocinio y pilotos | T4.20 |
| Invierno | Cinco pasos a pantalla completa | T4.11 |
| Muro en carrera | Franja de órdenes de equipo y ventana de parada | T4.14 y T4.15 |

## Consecuencias que conviene tener presentes

- La carrera libre sale de la carrera profesional: desaparece el caso de R51 «elegir otro circuito es una carrera libre que no cuenta» dentro de una partida. Sus tests habrá que revisarlos con autorización.
- Se elige equipo y no piloto: el muro ya lleva los dos coches del equipo; el «piloto elegido» del paddock queda solo para la carrera libre. Las partidas anteriores se abren con el equipo del piloto que tenían elegido.
- El panel «Partidas» del paddock (R48) se sustituye por la página de partidas y el menú «Partida»; sus acciones no cambian.
- El «paddock» deja de existir como página única: lo que contiene se reparte entre la carrera libre y las pestañas.
- El coche 3D aparece en más sitios (elegir equipo, Fábrica): diez visores a la vez en «Elegir equipo» pueden pesar; la maqueta debe decidir si son imágenes fijas del modelo, como los coches de pista de R56.

## Revisión de la maqueta (09/10/2026)

El usuario da por buena la maqueta (`maqueta-sprint4.html`) con dos cambios para la implementación:

1. **Iconos:** faltan. Se usan los de `lucide-react`, que ya usa el juego, en las pestañas, los títulos de tarjeta y las acciones.
2. **Coches en 3D:** con el modelo de R55, no como dibujo ni como imagen fija. En «Elegir equipo», los diez coches se pintan con el modelo 3D y la librea de cada equipo, quietos; pueden ir de lateral (decisión del usuario: «quietos o incluso de lateral, pero 3D»).

El paddock ya tiene, desde ese día, un menú de secciones con «Correr» la última (arreglo pedido por el usuario); el orden definitivo de las pestañas del centro de gestión se decide al implementar T4.3.

## Alcance de esta fase

Entrevista y definición del diseño. Sin cambios en la aplicación, el motor ni los tests. La maqueta (T4.18) es la siguiente pieza visual; el contrato de tests de cada tarea se acuerda antes de implementarla, conforme a AGENTS.md.
