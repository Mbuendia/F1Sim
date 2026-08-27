export interface CircuitSpec {
  id: string;
  name: string;
  officialGpName: string;
  location: string;
  country: string;
  countryFlag: string;
  lapLengthMeters: number;
  totalLaps: number;
  turns: number;
  drsZones: number;
  spectators: number;
  pitLaneTimeLossSec: number;
  rainProbabilityPercent: number;
  windSpeedKmh: number;
  windDirection: string;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
  svgPath: string;
  viewBox: string;
}

export const OFFICIAL_CIRCUITS: Record<string, CircuitSpec> = {
  barcelona: {
    id: 'barcelona',
    name: 'Circuit de Barcelona-Catalunya',
    officialGpName: 'Gran Premio de España',
    location: 'Montmeló, Barcelona',
    country: 'España',
    countryFlag: '🇪🇸',
    lapLengthMeters: 4657,
    totalLaps: 66,
    turns: 16,
    drsZones: 2,
    spectators: 140000,
    pitLaneTimeLossSec: 22.4,
    rainProbabilityPercent: 12,
    windSpeedKmh: 14,
    windDirection: 'NO (Noroeste)',
    latitude: 41.5700,
    longitude: 2.2611,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=41.5700,2.2611',
    svgPath: 'M 240,718 L 480,718 L 560,718 C 580,718 600,705 605,685 L 630,590 C 638,565 620,535 590,535 L 530,535 C 500,535 480,510 490,480 C 505,435 550,390 620,380 L 800,380 C 830,380 850,360 855,335 C 865,295 845,260 810,260 L 680,260 C 650,260 635,240 645,215 C 660,180 700,160 750,160 L 980,160 C 1020,160 1055,185 1065,225 L 1100,380 C 1110,420 1090,460 1050,470 L 920,490 C 890,495 880,525 900,545 L 980,620 C 1005,645 1045,640 1065,610 L 1130,510 C 1150,480 1190,475 1220,500 L 1320,580 C 1350,605 1360,645 1340,680 L 1300,740 C 1275,775 1230,790 1190,775 L 1110,745 C 1080,735 1055,755 1060,785 C 1070,835 1120,860 1170,850 L 1350,810 C 1410,795 1460,745 1460,685 L 1460,718 Z',
    viewBox: '0 0 1600 950'
  },
  monza: {
    id: 'monza',
    name: 'Autodromo Nazionale Monza',
    officialGpName: 'Gran Premio d\'Italia',
    location: 'Monza, Milán',
    country: 'Italia',
    countryFlag: '🇮🇹',
    lapLengthMeters: 5793,
    totalLaps: 53,
    turns: 11,
    drsZones: 2,
    spectators: 155000,
    pitLaneTimeLossSec: 24.1,
    rainProbabilityPercent: 8,
    windSpeedKmh: 10,
    windDirection: 'NE (Nordeste)',
    latitude: 45.6190,
    longitude: 9.2811,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=45.6190,9.2811',
    svgPath: 'M 200,800 L 750,800 C 780,800 800,780 790,750 L 760,690 C 750,670 770,645 795,650 L 860,660 C 890,665 920,645 930,615 L 980,480 C 995,435 970,390 925,380 L 780,350 C 750,345 730,320 740,290 L 765,220 C 780,180 825,160 870,175 L 1250,310 C 1300,330 1330,380 1320,435 L 1280,680 C 1270,740 1215,790 1150,795 L 950,805 Z',
    viewBox: '0 0 1600 950'
  },
  silverstone: {
    id: 'silverstone',
    name: 'Silverstone Circuit',
    officialGpName: 'British Grand Prix',
    location: 'Silverstone, Northamptonshire',
    country: 'Reino Unido',
    countryFlag: '🇬🇧',
    lapLengthMeters: 5891,
    totalLaps: 52,
    turns: 18,
    drsZones: 2,
    spectators: 160000,
    pitLaneTimeLossSec: 20.5,
    rainProbabilityPercent: 45,
    windSpeedKmh: 24,
    windDirection: 'SO (Suroeste)',
    latitude: 52.0786,
    longitude: -1.0169,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=52.0786,-1.0169',
    svgPath: 'M 350,750 L 600,750 C 640,750 670,720 660,680 L 630,580 C 620,540 650,500 690,500 L 850,500 C 890,500 920,465 910,425 L 880,310 C 870,270 900,230 945,230 L 1150,230 C 1200,230 1240,270 1235,320 L 1210,540 C 1200,590 1155,630 1100,630 L 980,630 C 940,630 910,665 920,705 L 960,820 C 970,860 935,900 890,900 L 500,900 C 420,900 350,830 350,750 Z',
    viewBox: '0 0 1600 950'
  },
  spa: {
    id: 'spa',
    name: 'Circuit de Spa-Francorchamps',
    officialGpName: 'Belgian Grand Prix',
    location: 'Stavelot, Lieja',
    country: 'Bélgica',
    countryFlag: '🇧🇪',
    lapLengthMeters: 7004,
    totalLaps: 44,
    turns: 19,
    drsZones: 2,
    spectators: 130000,
    pitLaneTimeLossSec: 21.8,
    rainProbabilityPercent: 60,
    windSpeedKmh: 18,
    windDirection: 'O (Oeste)',
    latitude: 50.4372,
    longitude: 5.9714,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=50.4372,5.9714',
    svgPath: 'M 300,820 L 520,820 C 550,820 575,795 565,765 L 530,660 C 520,625 550,590 590,590 L 760,590 C 800,590 835,560 840,520 L 870,280 C 880,210 950,160 1020,180 L 1280,250 C 1340,270 1370,335 1345,395 L 1260,580 C 1235,635 1175,670 1115,660 L 960,630 C 920,620 885,650 890,690 L 920,830 C 930,880 890,920 840,920 L 450,920 Z',
    viewBox: '0 0 1600 950'
  },
  monaco: {
    id: 'monaco',
    name: 'Circuit de Monaco',
    officialGpName: 'Grand Prix de Monaco',
    location: 'Monte Carlo',
    country: 'Mónaco',
    countryFlag: '🇲🇨',
    lapLengthMeters: 3337,
    totalLaps: 78,
    turns: 19,
    drsZones: 1,
    spectators: 110000,
    pitLaneTimeLossSec: 25.6,
    rainProbabilityPercent: 10,
    windSpeedKmh: 8,
    windDirection: 'S (Sur / Marítimo)',
    latitude: 43.7347,
    longitude: 7.4206,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=43.7347,7.4206',
    svgPath: 'M 400,780 L 680,780 C 720,780 750,750 740,710 L 710,590 C 700,550 730,510 770,510 L 950,510 C 990,510 1020,470 1005,430 L 960,320 C 940,270 980,210 1040,220 L 1180,240 C 1240,250 1275,310 1250,365 L 1180,510 C 1155,560 1100,590 1045,580 L 900,560 C 860,550 830,585 840,625 L 870,760 C 885,820 840,880 780,880 L 480,880 Z',
    viewBox: '0 0 1600 950'
  },
  redbullring: {
    id: 'redbullring',
    name: 'Red Bull Ring',
    officialGpName: 'Großer Preis von Österreich',
    location: 'Spielberg, Estiria',
    country: 'Austria',
    countryFlag: '🇦🇹',
    lapLengthMeters: 4318,
    totalLaps: 71,
    turns: 10,
    drsZones: 3,
    spectators: 125000,
    pitLaneTimeLossSec: 20.1,
    rainProbabilityPercent: 25,
    windSpeedKmh: 12,
    windDirection: 'N (Norte Alpino)',
    latitude: 47.2197,
    longitude: 14.7647,
    googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=47.2197,14.7647',
    svgPath: 'M 300,750 L 700,750 C 740,750 770,715 760,675 L 720,520 C 710,480 740,440 785,440 L 1050,440 C 1100,440 1140,400 1130,350 L 1100,230 C 1090,180 1040,150 990,165 L 680,260 C 620,280 570,335 565,400 L 540,650 C 535,710 480,750 420,750 Z',
    viewBox: '0 0 1600 950'
  }
};
