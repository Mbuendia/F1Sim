# 🏎️ React F1 2026 Grand Prix Simulator

A deeply technical, physics-driven Formula 1 race simulator built with React 19, TypeScript, Vite, and Anime.js. This project models the granular details of F1 racing, including real aerodynamic downforce, tire thermodynamics, slipstream (tow), dynamic DRS, and authentic multi-sector circuit geometries generated from real SVG map data.

---

## 🏁 Latest Updates (v30.0)

We have recently completed a massive upgrade covering UI/UX, race mechanics, camera systems, and telemetry:

- **🎬 Anime.js Cinematic Landing Page**: Immersive entry screen featuring a stylized Pirelli F1 tire with an elastic spin-in animation, continuous ambient rotation, and dynamic particle background.
- **🚦 Official Formation Lap Flow**: True-to-life pre-race procedure with tire warming weaves in formation, automatic grid parking, and mandatory user confirmation (**"🏁 Confirmar Inicio de Carrera"**) before initiating the 5 red lights sequence.
- **📹 Multi-Camera System (5 Perspectives)**:
  - `OVERVIEW`: Full-track satellite view.
  - `FOLLOW`: Dynamic tracking locked onto active battles.
  - `CINEMATIC`: Wide sweep with 60m kinematic lookahead.
  - `ONBOARD`: Cockpit-tight camera with high zoom (4.5x).
  - `HELICOPTER`: High-altitude aerial broadcast angle.
  - *Accessible via HUD badge or pressing the **`C`** key.*
- **🏎️ Aerodynamic Car Redesign & Scaled Capacity**: Slimmer chassis with front wing details and circuit-dependent parallel capacity (**2 cars** on tight street circuits like Monaco or Baku; **3 cars** on wide permanent circuits like Silverstone or Spa).
- **🛠️ Realistic Pit Lane Physics & Stop Variability**: 80 km/h speed-limited transit (~6-7s per phase) with real-world pit stop time distributions (20% perfect 1.9s stops, 55% standard, 15% slow, and 10% mechanical cross-thread delays up to 8s).
- **📊 Extended HomeScreen Sub-Toggles**:
  - **Drivers**: Toggle between *Atributos & Ficha*, *Estrategia & Estilo* (degradation rates, overcut window, rain adaptability, incident risk), and *Rendimiento 2026*.
  - **Circuits**: Toggle between *Trazado & Ficha*, *Zonas DRS & Estrategia* (individual DRS breakdown, pit loss, tire strategy), and *Meteorología & Asfalto*.
- **↔️ Collapsible Sidebars & Layer Hierarchy**: Independent retractable toggles for the *Timing Tower* and *Right Telemetry Dock* with corrected z-index layering.

---

## 📊 Game Balance & Ecosystem

The simulation ecosystem is meticulously balanced around real-world F1 parameters, allowing for highly tactical races:

### Circuit Ecosystem
- **Abrasion & Tire Stress**: Tracks like **Suzuka (Japón)** and **Silverstone (Reino Unido)** are notoriously tough on tires (High Abrasion), forcing teams towards multi-stop strategies or harder compounds. Contrastingly, street circuits like **Mónaco** and **Las Vegas** offer Low Abrasion, rewarding soft tire longevity and track position.
- **Weather & Safety Car**: Circuits like **Spa-Francorchamps** feature high weather unpredictability, while desert tracks like **Bahrain** and **Lusail** offer guaranteed dry races. Safety Car probability scales dynamically per track profile.
- **Flow & Downforce**: High-speed temples (**Monza**) demand low drag setups, while technical tracks (**Hungaroring**) require maximum downforce and driver skill.

### Driver Performance Delta
- **Raw Pace & Skill**: Elite world champions anchor the top skill tiers, boasting the highest base pace and raw lap time potential.
- **Tire Whisperers**: Veteran drivers possess exceptional `Tire Management` stats. While they might lack single-lap qualifying pace, their delta over a long stint at abrasive tracks often yields strategic overcuts.
- **Aggression vs. Consistency**: High-aggression drivers excel at slipstreaming and late-braking overtakes but suffer higher incident risks and thermal degradation, creating dynamic battles with consistent, smooth drivers.

---

## ⌨️ Controls & Shortcuts

| Key | Action |
|---|---|
| **`Space`** | Pausar / Reanudar la carrera |
| **`C`** | Alternar modos de cámara (`OVERVIEW` ➔ `FOLLOW` ➔ `CINEMATIC` ➔ `ONBOARD` ➔ `HELICOPTER`) |
| **`1` - `6`** | Multiplicador de velocidad de simulación (1x, 2x, 4x, 8x, 16x, 32x) |
| **`Esc`** | Deseleccionar piloto enfocado (volver a vista general) |
| **`Click en Fila`** | Enfocar cámara y telemetría en cualquier piloto de la Timing Tower |

---

## 🛠️ Stack & Architecture

- **React 19 & TypeScript**: High-performance functional components with strict typing.
- **Vite**: Ultra-fast build tool and development server.
- **Anime.js**: Physics-based UI transitions and landing animations.
- **Canvas 2D Dual-Loop Engine**: `requestAnimationFrame` running at 60 FPS for interpolation and camera lerping, decoupled from 15 FPS React UI polling.
- **SVG Track Parser**: Proprietary parser (`svgTrackParser.ts`) that digests bezier curves from official track maps, computing normal vectors for optimal racing lines, braking zones, and sector definitions.
- **CSS Modules**: Fully scoped styles ensuring zero collision across a massive dashboard UI.

---

## 🚀 Running the App

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

---

## 🌐 Automated GitHub Pages Deployment

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys the latest version to GitHub Pages upon pushing to `main`.