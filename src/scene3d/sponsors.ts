/**
 * Patrocinadores ficticios de las barreras TecPro y los paneles (22/10/2026): parodias de los oficiales, ninguno real.
 * Cada uno con su color de fondo y de letra.
 */
export const SPONSORS = [
  'Rolax', 'DHLento', 'Aramcorto', 'Heinekeso 0,0', 'Lenobo', 'Kripto.con', 'Etihaz', 'Emirratos', 'Salesfuerza',
  'AWSome Nube', 'Pirulí', 'Qatar Aerovías', 'Luis Vitón', 'TAG Hoyer', 'Paramoint+', 'Santandreu', 'Mastercarta', 'Allianza',
  // [CK2] Ocho más (29/10/2026, el usuario pide más patrocinadores de parodia).
  'Monstruo', 'Shellfish', 'Gulpf', 'Visaje', 'Castrolo', 'Uberto', 'Bosé', 'Tommy Hilfígaro',
] as const;

export type Sponsor = typeof SPONSORS[number];

export const SPONSOR_COLORS: Record<Sponsor, { bg: string; fg: string }> = {
  Rolax: { bg: '#0b5d3b', fg: '#e8c76a' }, DHLento: { bg: '#ffcc00', fg: '#d40511' }, Aramcorto: { bg: '#00843d', fg: '#ffffff' },
  'Heinekeso 0,0': { bg: '#00813d', fg: '#ffffff' }, Lenobo: { bg: '#e2231a', fg: '#ffffff' }, 'Kripto.con': { bg: '#0a1a3f', fg: '#ffffff' },
  Etihaz: { bg: '#bd8b13', fg: '#ffffff' }, Emirratos: { bg: '#d71921', fg: '#ffffff' }, Salesfuerza: { bg: '#00a1e0', fg: '#ffffff' },
  'AWSome Nube': { bg: '#232f3e', fg: '#ff9900' }, 'Pirulí': { bg: '#000000', fg: '#ffd400' }, 'Qatar Aerovías': { bg: '#5c0632', fg: '#ffffff' },
  'Luis Vitón': { bg: '#4b2e1e', fg: '#e8d4a2' }, 'TAG Hoyer': { bg: '#000000', fg: '#e30613' }, 'Paramoint+': { bg: '#0064ff', fg: '#ffffff' },
  Santandreu: { bg: '#ec0000', fg: '#ffffff' }, Mastercarta: { bg: '#1a1a1a', fg: '#f79e1b' }, Allianza: { bg: '#003781', fg: '#ffffff' },
  Monstruo: { bg: '#0d0d0d', fg: '#7ad000' }, Shellfish: { bg: '#ffd500', fg: '#dd1d21' }, Gulpf: { bg: '#8fd3f4', fg: '#f26b21' },
  Visaje: { bg: '#1a1f71', fg: '#f7b600' }, Castrolo: { bg: '#007a3d', fg: '#ffffff' }, Uberto: { bg: '#000000', fg: '#ffffff' },
  'Bosé': { bg: '#222222', fg: '#ffffff' }, 'Tommy Hilfígaro': { bg: '#0b2a5b', fg: '#ffffff' },
};
