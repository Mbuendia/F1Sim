# 🏎️ F1 Grand Prix Simulator — Web Racing Experience

Un simulador web interactivo y dinámico de carreras de **Fórmula 1** en tiempo real, desarrollado con **React 19**, **TypeScript** y **HTML5 Canvas 2D**, diseñado con una arquitectura modular y escalable para albergar múltiples trazados y circuitos del automovilismo mundial.

---

## 🛠️ Tecnologías Utilizadas

- **⚡ React 19**: Arquitectura reactiva basada en componentes modulares y hooks de alto rendimiento (`useMemo`, `useCallback`, `useEffect`).
- **🛡️ TypeScript**: Tipado estático estricto para modelos de telemetría, físicas cinemáticas, consumo de combustible, desgaste de neumáticos y estados de carrera.
- **🎨 HTML5 Canvas 2D (60 FPS Engine)**: Motor gráfico optimizado por hardware mediante `requestAnimationFrame`, cámara cinematográfica con seguimiento dinámico (*follow car*) y zoom interactivo.
- **✨ CSS Modules**: Estilos encapsulados con diseño de retransmisión televisiva profesional (*Broadcast Style*), adaptados para máxima visibilidad y accesibilidad visual.
- **⚡ Vite 6**: Entorno de desarrollo ultrarrápido con Hot Module Replacement (HMR) y compilación optimizada.
- **Icons**: [Lucide React](https://lucide.dev/) para instrumentación, telemetría y banderas.

---

## 🏁 ¿Cómo Funciona la Simulación?

### 🏎️ 1. Rendimiento de los Monoplazas y Parrilla Equilibrada
El simulador recrea los **10 equipos y 20 pilotos** de la parrilla de monoplazas:
- **Equilibrio Competitivo**: Las diferencias de rendimiento entre monoplazas están calibradas a nivel de **centésimas y décimas de segundo por vuelta**, propiciando batallas cerradas, rebufos y trenecitos DRS naturales.
- **Modo PUSH Autónomo (*Undercut / Overcut*)**: Si el monoplaza precedente entra a boxes y el perseguidor continúa en pista, este activa automáticamente el modo de motor **Push** y máxima agresividad para tirar al límite y ganar la posición antes de su propia parada.

---

### 👨‍🚀 2. Sistema de Pilotos: Talento, Palmarés y Factor de Suerte
Cada piloto cuenta con atributos individuales inspirados en su trayectoria:
- **Talento Puro & Racecraft**: Habilidad para marcar ritmo de carrera y ejecutar adelantamientos limpios.
- **Gestión de Neumáticos (*Tire Management*)**: Capacidad de cuidar la degradación y alargar la vida útil de los compuestos.
- **Factor de Suerte Dinámica por Gran Premio**: En cada evento o reinicio se genera una variación aleatoria de forma y suerte de fin de semana. **Los resultados son dinámicos e impredecibles**: cualquier piloto de la zona alta o media puede brillar con una gran estrategia o salida.

---

### ⛽ 3. Sin Repostajes y Paradas en Boxes (Reglamento Moderno)
- **Sin repostajes de combustible**: Los monoplazas inician con carga completa (~110 kg) que se consume gradualmente, volviendo al coche más ligero y rápido vuelta a vuelta.
- **Paradas Rápidas en Boxes (1.5s - 4.0s)**:
  - Al alcanzar un nivel crítico de desgaste (1% - 5% de vida restante), el coche ingresa automáticamente al pit lane.
  - Velocidad controlada a **80 km/h** por el carril de boxes.
  - Cambio de neumáticos con tiempos aleatorios (1.5s a 4.0s) simulando paradas perfectas o posibles fallos mecánicos.
  - Salida continua hacia la recta principal con aceleración progresiva y sin teletransportes.
  - **Adelantamientos en Boxes**: Posibilidad de ganar posiciones en el pit lane si el equipo realiza una parada más veloz.

---

### 🛞 4. Rendimiento y Compuestos de Neumáticos
Simulación de tres compuestos de neumáticos para pista seca:
- 🔴 **Blandos (Soft)**: Máximo agarre y aceleración instantánea, con mayor degradación térmica.
- 🟡 **Medios (Medium)**: Balance óptimo entre agarre y durabilidad.
- ⚪ **Duros (Hard)**: Menor agarre punta, pero máxima consistencia y resistencia para tandas largas.

---

### 📐 5. Físicas de Pista, Trazados y Banderas Azules
- **Diseño de Circuitos Inspirados en Trazados Oficiales**:
  - Actualmente cuenta con un trazado de alta exigencia técnica inspirado en circuitos clásicos de Fórmula 1 (grandes curvas peraltadas, horquillas lentas, contrarrectas y chicanes enlazadas), preparado para incorporar futuros circuitos del calendario mundial.
- **Sistema Anti-Solapamiento & Adelantamientos en Paralelo (*Side-by-Side*)**:
  - Distancia de seguridad longitudinal para evitar que los coches se superpongan visualmente.
  - En sectores revirados y lentos, los monoplazas esperan en fila limpia.
  - En rectas y frenadas autorizadas, el atacante se desplaza lateralmente rodando emparejado en paralelo *side-by-side*.
- **🟦 Gestión Oficial de Banderas Azules (*Blue Flags*)**:
  - Los coches que van a ser doblados reciben bandera azul, apartándose hacia el exterior y levantando suavemente el pie para permitir el paso limpio de los líderes sin bloquear la carrera.

---

### 🚦 6. Vuelta de Formación y Ceremonia del Podio
- **Vuelta de Formación (*Formation Lap*)**: Procedimiento de salida con calentamiento orgánico de neumáticos y frenos en trenecito. En cuanto el último clasificado ocupa su cajón en la parrilla, se activa la secuencia del semáforo.
- **🏆 Ceremonia del Podio**: Al completarse la distancia total de carrera, se despliega la pantalla oficial de celebración con los 3 primeros clasificados en sus respectivos escalones, tiempos, monoplazas y trofeos.

---

## 🖥️ Interfaz Broadcast (3 Paneles de Alta Visibilidad)

1. **Panel Izquierdo (*Timing Tower*)**: Clasificación en vivo P1-P20, compuestos, paradas y deltas (*Gaps* o *+1 LAP*).
2. **Área Central Panorámica**: Vista amplia del circuito con selector de velocidades (**1x, 2x, 4x, 8x, 16x, 32x**) y dock inferior de telemetría (velocidad, marcha, RPM, salud de 4 ruedas, DRS y coche de delante/detrás).
3. **Panel Derecho (*Sectores & Estrategia*)**: Cronometraje de los 3 sectores con colores oficiales (🟣 Púrpura para récord, 🟢 Verde para marca personal, 🟡 Amarillo), previsión de neumáticos, cronómetro de pit stop en vivo y telemetría térmica.

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

Abre tu navegador en `http://localhost:3000` para iniciar la simulación.

---

## ⌨️ Atajos de Teclado

- **`Espacio`**: Pausar / Reanudar la carrera.
- **`1` a `6`**: Cambiar velocidad de simulación (1x, 2x, 4x, 8x, 16x, 32x).
- **`Escape`**: Deseleccionar coche y volver a la vista general.
- **`Clic en un coche o en la tabla`**: Enfocar y seguir la cámara en ese piloto.

---

Desarrollado con ❤️ para los apasionados del automovilismo y la simulación deportiva. 🏎️💨
