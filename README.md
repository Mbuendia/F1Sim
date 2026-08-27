# 🏎️ React F1 2026 Simulator

A deeply technical, physics-driven Formula 1 race simulator built with React 19, TypeScript, and Vite. This project models the granular details of F1 racing, including real aerodynamic downforce, tire thermodynamics, slipstream (tow), dynamic DRS, and authentic multi-sector circuit geometries generated from real SVG map data.

## 🏁 Latest Updates (v29.0)

We have recently completed a massive overhaul of the simulator to elevate its realism and data accuracy:

- **1:1 Authentic FIA Geometries**: All 23 circuits have been geometrically calibrated. The start/finish lines (`startOffsetT`) and pit lanes (`pitEntryT`, `pitExitT`) are now placed exactly on their real-world straights using curvature analysis, maintaining perfect geographical orientation (Clockwise or Anti-Clockwise).
- **StatsF1 Telemetry Integration**: Deep data integration for all 22 circuits. This includes historically accurate probability of Safety Car deployments, exact track elevation changes, official maps, and URLs.
- **Pirelli Asphalt & Weather Variables**: Circuits now feature precise Asphalt Abrasion ratings, Tire Stress Levels, and dynamic Wind Speed/Direction, altering the grip and degradation models.
- **Cinematic Zoom & Aerodynamics**: Completely revamped car renderers restoring the aerodynamic 4-wheel chassis with halo and glowing DRS visuals. A new cinematic camera smoothly follows active battles with predictive lookahead and parallel wheel-to-wheel overtaking logic.
- **Wider Tracks & UI Expansion**: Scaled up the simulation canvas (1900x1150) to prevent corner overlap on street circuits (like Miami or Monaco) and increased the track width to 24m. Features expanded symmetric driver attribute panels with integrated national flags (`🇪🇸`, `🇬🇧`, `🇧🇷`, etc.).

## 📊 Game Balance & Ecosystem

The simulation ecosystem is meticulously balanced around real-world F1 parameters, allowing for highly tactical races:

### Circuit Ecosystem
- **Abrasion & Tire Stress**: Tracks like **Suzuka (Japón)** and **Silverstone (Reino Unido)** are notoriously tough on tires (High Abrasion), forcing teams towards multi-stop strategies or harder compounds. Contrastingly, street circuits like **Mónaco** and **Las Vegas** offer Low Abrasion, rewarding soft tire longevity and track position.
- **Weather Variability**: Circuits like **Spa-Francorchamps** have high unpredictability, while desert tracks like **Bahrain** and **Lusail** offer guaranteed dry races.
- **Flow & Downforce**: High-speed temples (Monza) demand low drag setups, while technical tracks (Hungaroring) require maximum downforce and driver skill.

### Driver Performance Delta
- **Raw Pace & Skill**: Elite world champions anchor the top skill tiers, boasting the highest base pace and raw lap time potential.
- **Tire Whisperers**: Certain veteran drivers possess exceptional `Tire Management` stats. While they might lack single-lap qualifying pace, their delta over a 70-lap stint at abrasive tracks like Catalunya often yields strategic overcuts.
- **Aggression vs. Consistency**: High-aggression drivers excel at slipstreaming and late-braking overtakes but suffer higher incident risks and thermal degradation, creating dynamic battles with consistent, smooth drivers.

## 🛠️ Stack & Architecture

- **React 19 & TypeScript**: High-performance functional components and strict type safety for physics models.
- **Custom Game Loop**: `requestAnimationFrame` running at 60 FPS, decoupling UI state from physics simulations.
- **SVG Track Parser**: Proprietary parser (`svgTrackParser.ts`) that digests bezier curves from official track maps, computing normal vectors for optimal racing lines, braking zones, and sector definitions.
- **CSS Modules**: Fully scoped styles ensuring zero collision across a massive dashboard UI.

## 🚀 Running the App

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```