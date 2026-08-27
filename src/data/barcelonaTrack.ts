import { computeTrackSpline, SplinePoint, Point2D } from '../utils/spline';

export interface CornerMarker {
  number: number;
  name: string;
  t: number;
  gear: number;
  apexSpeedKmh: number;
}

export interface TrackDefinition {
  name: string;
  fullName: string;
  location: string;
  country: string;
  totalLaps: number;
  lapLengthMeters: number;
  trackWidthMeters: number;
  corners: CornerMarker[];
  points: SplinePoint[];
  pitLanePoints: Point2D[];
  pitEntryT: number;
  pitExitT: number;
  pitBoxT: number;
  sector1EndT: number;
  sector2EndT: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

// ── PUNTOS EXACTOS DEL CIRCUIT DE BARCELONA-CATALUNYA SEGÚN MAPA OFICIAL FIA ──
const BARCELONA_FIA_EXACT_POINTS: { x: number; y: number; speedLimit?: number; corner?: string }[] = [
  // ── 1. RECTA PRINCIPAL (Inferior: Derecha -> Izquierda) ──
  { x: 950, y: 720, speedLimit: 1.0, corner: 'START / FINISH' },
  { x: 800, y: 720, speedLimit: 1.0 },
  { x: 650, y: 720, speedLimit: 1.0 },
  { x: 500, y: 720, speedLimit: 1.0 },
  { x: 380, y: 720, speedLimit: 0.95 },
  { x: 260, y: 720, speedLimit: 0.65 },

  // ── 2. SECTOR 1 (Rojo): T1 Elf, T2, T3 (Gran arco peraltado exterior), T4 Repsol ──
  { x: 190, y: 700, speedLimit: 0.45, corner: 'T1 - Elf' },
  { x: 160, y: 640, speedLimit: 0.50 },
  { x: 180, y: 580, speedLimit: 0.55, corner: 'T2' },
  { x: 160, y: 530, speedLimit: 0.65 },
  { x: 110, y: 470, speedLimit: 0.75, corner: 'T3 - Renault' },
  { x: 80, y: 390, speedLimit: 0.82 },
  { x: 75, y: 310, speedLimit: 0.86 },
  { x: 100, y: 230, speedLimit: 0.88 },
  { x: 150, y: 170, speedLimit: 0.88 },
  { x: 240, y: 135, speedLimit: 0.88 },
  { x: 360, y: 125, speedLimit: 0.88 },
  { x: 490, y: 125, speedLimit: 0.86 },
  { x: 590, y: 130, speedLimit: 0.82 },
  { x: 670, y: 150, speedLimit: 0.58, corner: 'T4 - Repsol' },
  { x: 700, y: 210, speedLimit: 0.48 },
  { x: 680, y: 270, speedLimit: 0.52 },
  { x: 620, y: 300, speedLimit: 0.60 },
  { x: 530, y: 310, speedLimit: 0.70 },

  // ── 3. SECTOR 2 (Azul): T5 Seat, T6, T7-T8, T9 Campsa ──
  { x: 430, y: 310, speedLimit: 0.42, corner: 'T5 - Seat' },
  { x: 340, y: 320, speedLimit: 0.38 },
  { x: 270, y: 350, speedLimit: 0.45 },
  { x: 250, y: 410, speedLimit: 0.52 },
  { x: 270, y: 460, speedLimit: 0.58 },
  { x: 330, y: 490, speedLimit: 0.65 },
  { x: 430, y: 520, speedLimit: 0.74, corner: 'T6' },
  { x: 540, y: 535, speedLimit: 0.80 },
  { x: 650, y: 540, speedLimit: 0.75 },
  { x: 710, y: 520, speedLimit: 0.60, corner: 'T7' },
  { x: 720, y: 450, speedLimit: 0.65, corner: 'T8' },
  { x: 740, y: 370, speedLimit: 0.75 },
  { x: 780, y: 290, speedLimit: 0.82 },
  { x: 840, y: 220, speedLimit: 0.86 },
  { x: 900, y: 170, speedLimit: 0.82, corner: 'T9 - Campsa' },
  { x: 960, y: 170, speedLimit: 0.88 },
  { x: 1010, y: 190, speedLimit: 0.95 },

  // ── 4. SECTOR 3 (Amarillo): CONTRARRECTA DIAGONAL Y ESTADIO REAL ──
  { x: 1070, y: 250, speedLimit: 1.0 },
  { x: 1120, y: 320, speedLimit: 1.0 },
  { x: 1160, y: 400, speedLimit: 0.90 },
  { x: 1180, y: 490, speedLimit: 0.70 },
  { x: 1190, y: 570, speedLimit: 0.45 },
  { x: 1210, y: 640, speedLimit: 0.40, corner: 'T10 - La Caixa' },
  { x: 1250, y: 660, speedLimit: 0.45 },
  { x: 1290, y: 630, speedLimit: 0.52 },
  { x: 1300, y: 560, speedLimit: 0.60 },
  { x: 1310, y: 480, speedLimit: 0.68, corner: 'T11' },
  { x: 1330, y: 390, speedLimit: 0.72 },
  { x: 1360, y: 300, speedLimit: 0.68, corner: 'T12 - Banc Sabadell' },
  { x: 1410, y: 240, speedLimit: 0.70 },
  { x: 1480, y: 240, speedLimit: 0.70, corner: 'T13' },
  { x: 1540, y: 290, speedLimit: 0.65 },
  { x: 1550, y: 370, speedLimit: 0.65 },
  { x: 1540, y: 430, speedLimit: 0.55 },
  { x: 1490, y: 450, speedLimit: 0.40, corner: 'T14 - Chicane RACC' },
  { x: 1490, y: 500, speedLimit: 0.45 },
  { x: 1540, y: 520, speedLimit: 0.55, corner: 'T15' },
  { x: 1550, y: 600, speedLimit: 0.75 },
  { x: 1530, y: 670, speedLimit: 0.88, corner: 'T16 - Catalunya' },
  { x: 1470, y: 720, speedLimit: 0.95 },
  { x: 1380, y: 720, speedLimit: 1.0 },
  { x: 1200, y: 720, speedLimit: 1.0 },
  { x: 1050, y: 720, speedLimit: 1.0 }
];

const points = computeTrackSpline(BARCELONA_FIA_EXACT_POINTS, 22);

// ── PIT LANE CONECTADO SUAVEMENTE DESDE EL ASFALTO DE T16 HASTA ANTES DE T1 ──
const pitLanePoints: Point2D[] = [
  { x: 1460, y: 718 }, // Nace directamente del asfalto a la salida de T16
  { x: 1410, y: 692 }, // Bifurcación suave hacia el carril de boxes
  { x: 1350, y: 680 },
  { x: 1180, y: 680 },
  { x: 950, y: 680 },  // Zona de Box / Garajes
  { x: 700, y: 680 },
  { x: 480, y: 680 },
  { x: 330, y: 680 },
  { x: 280, y: 695 },  // Reincorporación suave
  { x: 240, y: 718 }   // Entra directamente en el asfalto de la recta JUSTO ANTES de T1
];

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const p of points) {
  if (p.x < minX) minX = p.x;
  if (p.x > maxX) maxX = p.x;
  if (p.y < minY) minY = p.y;
  if (p.y > maxY) maxY = p.y;
}

export const BARCELONA_CIRCUIT: TrackDefinition = {
  name: 'Circuit de Barcelona-Catalunya',
  fullName: 'Gran Premio de España - Barcelona',
  location: 'Montmeló, Barcelona, Cataluña',
  country: 'España',
  totalLaps: 66,
  lapLengthMeters: 4657,
  trackWidthMeters: 13,
  corners: [
    { number: 1, name: 'Elf', t: 0.08, gear: 3, apexSpeedKmh: 145 },
    { number: 2, name: 'Curva 2', t: 0.11, gear: 3, apexSpeedKmh: 160 },
    { number: 3, name: 'Renault', t: 0.18, gear: 5, apexSpeedKmh: 240 },
    { number: 4, name: 'Repsol', t: 0.26, gear: 3, apexSpeedKmh: 135 },
    { number: 5, name: 'Seat', t: 0.34, gear: 2, apexSpeedKmh: 85 },
    { number: 6, name: 'Curva 6', t: 0.42, gear: 4, apexSpeedKmh: 190 },
    { number: 7, name: 'Curva 7', t: 0.47, gear: 3, apexSpeedKmh: 150 },
    { number: 8, name: 'Würth', t: 0.50, gear: 4, apexSpeedKmh: 175 },
    { number: 9, name: 'Campsa', t: 0.56, gear: 6, apexSpeedKmh: 260 },
    { number: 10, name: 'La Caixa', t: 0.67, gear: 3, apexSpeedKmh: 110 },
    { number: 11, name: 'Curva 11', t: 0.73, gear: 4, apexSpeedKmh: 175 },
    { number: 12, name: 'Banc Sabadell', t: 0.78, gear: 3, apexSpeedKmh: 140 },
    { number: 13, name: 'Curva 13', t: 0.83, gear: 4, apexSpeedKmh: 155 },
    { number: 14, name: 'Chicane RACC', t: 0.87, gear: 2, apexSpeedKmh: 95 },
    { number: 15, name: 'Curva 15', t: 0.91, gear: 4, apexSpeedKmh: 180 },
    { number: 16, name: 'Catalunya', t: 0.96, gear: 7, apexSpeedKmh: 280 }
  ],
  points,
  pitLanePoints,
  pitEntryT: 0.96,
  pitExitT: 0.05,
  pitBoxT: 0.00,
  sector1EndT: 0.28,
  sector2EndT: 0.56,
  bounds: { minX, maxX, minY, maxY }
};
