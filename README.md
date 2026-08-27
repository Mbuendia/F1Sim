# 🏎️ F1 Grand Prix Simulator — Circuit de Barcelona-Catalunya

Un simulador web interactivo y dinámico de carreras de **Fórmula 1** en tiempo real, desarrollado con **React 19**, **TypeScript** y **HTML5 Canvas 2D**, recreando fielmente el **Gran Premio de España en el Circuit de Barcelona-Catalunya**.

---

## 🛠️ Tecnologías Utilizadas

- **⚡ React 19**: Biblioteca base para la gestión reactiva del estado, hooks de alto rendimiento (`useMemo`, `useCallback`, `useEffect`) y componentes modulares.
- **🛡️ TypeScript**: Tipado estático estricto para modelos de telemetría, estados de carrera, gestión de neumáticos y trazados.
- **🎨 HTML5 Canvas 2D (60 FPS Engine)**: Renderizado gráfico optimizado por hardware mediante `requestAnimationFrame`, cámara cinematográfica con seguimiento dinámico (*follow car*) y zoom interactivo.
- **✨ CSS Modules**: Estilos encapsulados con temática oscura inspirada en la retransmisión oficial de la *F1 TV*, adaptados para máxima visibilidad y accesibilidad.
- **⚡ Vite 6**: Herramienta de compilación ultrarrápida y Hot Module Replacement (HMR).
- **Icons**: [Lucide React](https://lucide.dev/) para indicadores de telemetría, banderas y trofeos.

---

## 🏁 ¿Cómo Funciona la Simulación?

### 🏎️ 1. Rendimiento de los Monoplazas y Parrilla Nivelada
El simulador cuenta con los **10 equipos oficiales de la parrilla moderna de F1** (McLaren, Red Bull, Ferrari, Mercedes, Aston Martin, Williams, Racing Bulls, Haas, Alpine y Kick Sauber) y **20 pilotos**.
- **Equilibrio de Alto Nivel**: Las diferencias entre monoplazas están calibradas a nivel de **centésimas y décimas de segundo por vuelta**, evitando escapadas irreales y generando carreras apasionantes con batallas rueda a rueda y trenecitos DRS naturales.
- **Modo PUSH Autónomo (*Undercut / Overcut*)**: Si el coche precedente entra a boxes y el perseguidor continúa en pista, este último activa automáticamente el modo de motor **Push** y máxima agresividad para tirar a fondo e intentar ganar la posición, volviendo al modo estándar en cuanto consolida el adelantamiento.

---

### 👨‍🚀 2. Sistema de Pilotos: Talento, Palmarés y Factor de Suerte
Cada piloto cuenta con atributos individuales inspirados en su trayectoria y habilidades reales:
- **Talento Puro & Racecraft**: Habilidad para extraer el máximo ritmo y ejecutar adelantamientos limpios.
- **Gestión de Neumáticos (*Tire Management*)**: Pilotos como Alonso, Hamilton o Verstappen alargan la vida útil de las gomas cuidando el desgaste en frenadas.
- **Factor de Suerte Dinámica por Gran Premio**: En cada carrera o reinicio, se genera una pequeña variación de forma y suerte de fin de semana para cada piloto. **¡No siempre gana el mismo piloto!** En una carrera puede triunfar Norris o Verstappen, en otra Leclerc o Hamilton, o Alonso aprovechar una gran salida y ritmo.

---

### ⛽ 3. Sin Repostajes y Paradas en Boxes (F1 Moderna)
Siguiendo el reglamento de la Fórmula 1 moderna:
- **No hay repostajes de combustible**: Los monoplazas inician con una carga completa de ~110 kg de combustible. A medida que pasan las vueltas, el monoplaza se vuelve más ligero y veloz.
- **Paradas Rápidas en Boxes (1.5s - 4.0s)**:
  - Al llegar a un desgaste crítico (1% - 5% de vida del neumático), el coche entra de forma autónoma a boxes.
  - Nada más cruzar la línea blanca de entrada al pit lane (tras la curva 16), el coche reduce estrictamente a **80 km/h** sin DRS.
  - La parada en el cajón de boxes dura entre **1.5 y 4.0 segundos** de forma aleatoria (simulando paradas récord o posibles complicaciones en el cambio de tuerca).
  - Al salir, avanza por el carril de boxes a 80 km/h y **se reincorpora suavemente a la recta principal antes de la Curva 1**, acelerando progresivamente hacia la Curva 2 sin ningún tipo de teletransporte.
  - **Adelantamientos en Boxes**: Si dos coches coinciden en el pit lane, pueden adelantarse legítimamente si uno completa una parada más rápida.

---

### 🛞 4. Rendimiento y Compuestos de Neumáticos
La simulación integra tres compuestos oficiales de neumáticos para seco:
- 🔴 **Blandos (Soft)**: Máximo agarre y velocidad instantánea, pero con una degradación más pronunciada.
- 🟡 **Medios (Medium)**: Equilibrio óptimo entre agarre inicial y durabilidad en carrera.
- ⚪ **Duros (Hard)**: Menor agarre punta, pero extraordinaria durabilidad y resistencia al desgaste térmico.

Al entrar en boxes, el equipo sustituye automáticamente el juego gastado por un nuevo compuesto aleatorio (Duros, Medios o Blandos) con el 100% de vida.

---

### 📐 5. Físicas y Trazado Oficial de Barcelona
- **Geometría Oficial FIA (Sentido Horario)**:
  - Recta principal inferior con la meta en la derecha (de derecha a izquierda).
  - Curva 1 (Elf), Curva 2 y el **gran arco peraltado exterior de la Curva 3 (Renault)**.
  - Horquilla superior de la Curva 4 (Repsol) y Curva 5 (Seat).
  - Subida por Curva 7-8 hacia la cumbre de la Curva 9 (Campsa).
  - **Gran Contrarrecta diagonal** limpia hacia la frenada de la Curva 10 (La Caixa).
  - Complejo del estadio (T11-T13) con la **Chicane RACC oficial (T14-T15)** y Curva 16 (Catalunya).
- **Sistema Anti-Solapamiento & Adelantamientos en Paralelo (*Side-by-Side*)**:
  - Los monoplazas guardan una distancia mínima de seguridad longitudinal (~15 metros) para **evitar que se monten unos encima de otros**.
  - En sucesiones de curvas lentas, los coches van en fila limpia esperando la llegada de una recta.
  - Al adelantar en rectas o frenadas autorizadas, el coche atacante se desplaza lateralmente hacia el interior o exterior, rodando emparejado en paralelo *side-by-side*.
- **🟦 Gestión Oficial de Banderas Azules (*Blue Flags*)**:
  - Cuando el líder o pilotos con vuelta de ventaja alcanzan a un coche doblado, este recibe bandera azul, **se aparta al exterior y levanta el pie** para dejar pasar limpiamente sin bloquear jamás.

---

### 🚦 6. Vuelta de Formación y Podio de Celebración
- **Vuelta de Formación (*Formation Lap*)**: Al iniciar el procedimiento, los 20 monoplazas completan una vuelta de calentamiento agrupados en trenecito con efecto orgánico de goma elástica y zig-zag para calentar gomas y frenos. Al llegar a la recta principal, cada monoplaza ocupa su cajón. En cuanto el último coche (P20) se detiene, se disparan las 5 luces rojas del semáforo.
- **🏆 Ceremonia del Podio**: Al completar las 66 vueltas del Gran Premio, se despliega el podio oficial con los 3 primeros clasificados en sus respectivos escalones (1º Oro, 2º Plata, 3º Bronce), sus monoplazas, tiempos y trofeos.

---

## 🖥️ Interfaz Broadcast (3 Paneles de Alta Visibilidad)

1. **Panel Izquierdo (*Timing Tower*)**: Clasificación en vivo P1-P20, compuestos de gomas, número de paradas realizadas y diferencias de tiempo (*Gaps* o *+1 LAP*).
2. **Área Central Panorámica**: Circuito en alta resolución con controles de velocidad (**1x, 2x, 4x, 8x, 16x, 32x**) y el dock inferior con la telemetría del monoplaza seleccionado (velocidad en km/h, marcha, RPM, salud de las 4 ruedas, DRS y coche de delante/detrás).
3. **Panel Derecho (*Sectores & Estrategia*)**: Tiempos de los 3 sectores de la FIA con colores oficiales (🟣 Púrpura para récord, 🟢 Verde para marca personal, 🟡 Amarillo), previsión de durabilidad de neumáticos (¿Llega a meta?), estado de boxes con cronómetro en tiempo real y temperaturas de frenos y motor.

---

## 🚀 Instalación y Ejecución en Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/Mbuendia/F1Sim.git
cd F1Sim

# 2. Instalar dependencias
npm install

# 3. Iniciar el servidor de desarrollo
npm run dev
```

Abre tu navegador en `http://localhost:3000` para disfrutar de la simulación.

---

## ⌨️ Atajos de Teclado

- **`Espacio`**: Pausar / Reanudar la carrera.
- **`1` a `6`**: Cambiar velocidad de simulación (1x, 2x, 4x, 8x, 16x, 32x).
- **`Escape`**: Deseleccionar coche y volver a la vista general de la pista.
- **`Clic en un coche o en la tabla`**: Enfocar y seguir la cámara en ese piloto.

---

Desarrollado con ❤️ para los apasionados del automovilismo y la Fórmula 1. 🏎️💨
