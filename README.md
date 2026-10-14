# F1 Race Manager

A Formula 1 strategy and team-management simulator that runs entirely in the browser. You do not drive: you run the pit wall for your two cars (stops, compounds, pace, team orders) and, in career mode, the whole team between races (money, factory, staff, drivers, sponsors, board).

Built with React 19, TypeScript and Vite. The race engine is deterministic and physics-driven; the track is painted with WebGL (PixiJS) with a Canvas fallback. The game interface is in Spanish.

**Play:** https://f1sim-d5085.web.app/ · **Presentation page:** https://mbuendia.github.io/F1Sim/

---

## What is in the game

### Race

- **Pit wall for two cars.** Pace (save / normal / attack), stop with any of the five compounds, cancel a stop, and delegate either car to the strategist. Tyre, battery and fuel are shown as gauges; the strategist's proposals arrive as cards you accept or discard.
- **Team orders.** Free racing, hold positions, or let one driver through: the car ahead lifts in the next overtaking zone and the swap comes from speed, never from repositioning. Rival teams use them too, under a simple observable rule.
- **Strategy at a glance.** A stint timeline with the current lap and the expected stop window, gaps to the cars ahead and behind, and rival tyre life as bars.
- **Race control.** Local yellow flags, Virtual Safety Car, Safety Car with lapped cars and restart, red flag with suspension and resumption, stewards and penalties, blue flags, DRS detection and zones per circuit.
- **Weather.** Rain cells that cross the circuit, a radar with a forecast, standing water, intermediate and wet tyres, aquaplaning, spray and a drying line.
- **Physics.** Corner speed from real radius, minimum-curvature racing line, aerodynamic drag and dirty air, slipstream, four-wheel tyre temperature and wear, fuel mass, 2025-style energy recovery and deployment, component wear and failures.
- **23 circuits at real scale** (1 unit = 1 metre), rebuilt from official lap lengths, with the finish line aligned to real lap data, pit lanes outside the track, and lap times calibrated against the 2025 season.
- **Cameras.** Overview, follow, cinematic, onboard and helicopter, plus free zoom and rotation.

### Weekend

- **Free practice** (optional, resolved off-track): each driver runs a programme — find the setup, long run, or qualifying simulation. Rivals practise too and tune their own setup.
- **Qualifying shown live.** Q1, Q2 and Q3 with the cars as dots on the circuit, the timing table with the elimination zone, and a comment at the end of each session. It can be skipped.
- **Sprint weekends**, car setup (wing, stiffness, gearing) and parc fermé with pit-lane starts.
- **Setup spy.** After practice you can pay for a report on a rival team's setup, with a risk of being caught and fined.

### Career

- **Team management between races:** finances, development projects, factory facilities, technical staff (five roles, a seeded market each season), pit crew, driver contracts and market, reserve driver and academy, sponsors, board objectives and a five-step winter between seasons.
- **Power unit components** with season allocations (including exhausts), grid penalties and a per-driver dossier.
- **Simulate a Grand Prix** instead of skipping it: the same engine runs the race without drawing it, with the strategist in charge of your cars, and it counts like any other round.
- **Saved games** with named slots, autosave, export and import.

### Interface

- **Responsive:** desktop, tablet, and phone (track on top; timing, wall and car detail in bottom tabs).
- No native dropdowns: segmented controls, gauges and chips; vector icons; controls of at least 44 px; visible focus and reduced-motion support.
- **Audio** (off by default, volume in the race menu) for the start lights, radio, flags and Safety Car, pit gun and chequered flag. The sounds are provisional synthesised tones for now.

---

## Controls

| Key | Action |
|---|---|
| `Space` | Pause / resume |
| `C` | Cycle camera modes |
| `1` – `6` | Simulation speed (1x, 2x, 4x, 8x, 16x, 32x) |
| `Esc` | Back to the full-track view |
| Click on a timing row | Follow that car and open its detail |
| Drag / right-drag / wheel / double-click | Rotate / pan / zoom / reset the track view |

---

## Stack and architecture

- **React 19 + TypeScript + Vite**, CSS Modules, `lucide-react` icons, Anime.js for interface motion, Three.js for the 3D car and wheel viewers.
- **`src/simulation/`** — the engine. `RaceSimulation` advances the race in fixed steps with seeded random streams, so a race can be saved, loaded and replayed. Around it: tyres, aero, energy, fuel, weather, race control, stewards, strategist, pit stops, qualifying, practice, and the management models (finance, development, staff, contracts, sponsors, board, season).
- **`src/renderer/`** — static track layers uploaded once to WebGL through PixiJS, with cars, Safety Car and spray on a second scene; a 2D Canvas path is kept as fallback. `?canvas` in the URL forces the fallback.
- **`src/utils/`** — circuit geometry: SVG path → axis scaled to the official length → smoothing and resampling → racing line, pit lane, kerbs and grid.
- **`src/components/`** — the interface; `src/components/ui/` holds the shared pieces (segmented control, gauge, chip, tile).
- **`assets3d/circuits/`** — the 23 circuits exported as `.glb` meshes (not yet used by the game).

---

## Running it

```bash
npm install
npm run dev      # development server
npm run build    # production build
```

### Tests

Each module in `tests/catalog.mjs` runs in its own process against the real engine code.

```bash
node test-suite.mjs --module team-orders-t414   # one module (comma-separated for several)
node test-suite.mjs --all                       # full suite, about 25 minutes
```

The last full run, on 13 October 2026, was 5605 passed / 0 failed across 150 modules.

### Project scripts

```bash
npm run sync:tasks                   # task index in index.html from DASHBOARD.md
npm run dashboard                    # regenerates dashboard_visual.html
node scripts/capture-screens.mjs     # review screenshots with headless Chrome (dev server running)
node scripts/calibrate-laps.mjs      # lap-time calibration against the 2025 reference laps
```

---

## Project status

`DASHBOARD.md` is the source of truth for scope and status, in Spanish; `dashboard_visual.html` is its visual summary. Everything through Sprint 4.5 and Sprint 3.7 is delivered and merged.

**Next: Sprint 5 (planned, not started).**

- **Shared race.** The desktop browser hosts a free-race room and friends join from their own devices over WebRTC, each running one team from the pit wall. The engine moves to a Web Worker, state goes through Zustand stores, and Firebase Realtime Database handles rooms, signalling and a slower fallback when a direct connection is not possible.
- **Hosting.** The game moves to Firebase Hosting; GitHub Pages becomes a presentation landing page.

Parked for later: licensed audio recordings, and playable on-track sessions (directed qualifying).

---

## Deployment

Pushing to `main` builds the project and publishes it to GitHub Pages through `.github/workflows/deploy.yml`.

## Credits

Third-party 3D models are credited next to where they appear in the game, under their Creative Commons licences. Track widths come from the TUMFTM racetrack database, and finish-line alignment uses real lap geometry from the MultiViewer API.
