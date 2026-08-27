const fs = require('fs');
let tsCode = fs.readFileSync('src/data/circuits.ts', 'utf8');

if (!tsCode.includes('flag?: string;')) {
    tsCode = tsCode.replace('country: string;', 'country: string;\n  flag?: string;');
}

const updateData = JSON.parse(fs.readFileSync('update.json', 'utf8'));

const nameMap = {
    'Circuit de Barcelona-Catalunya': 'catalunya',
    'Autodromo Nazionale Monza': 'monza',
    'Silverstone Circuit': 'silverstone',
    'Circuit de Spa-Francorchamps': 'spa',
    'Circuit de Monaco': 'monaco',
    'Red Bull Ring': 'red_bull_ring',
    'Suzuka International': 'suzuka',
    'Circuit Zandvoort': 'zandvoort',
    'Bahrain International Circuit': 'bahrain',
    'Albert Park Circuit': 'melbourne',
    'Shanghai International': 'shanghai',
    'Lusail International Circuit': 'losail',
    'Hungaroring': 'hungaroring',
    'Autódromo Hermanos Rodríguez': 'mexico',
    'Circuit Gilles Villeneuve': 'montreal',
    'Circuit of the Americas (COTA)': 'austin',
    'Yas Marina Circuit': 'yas_marina',
    'Jeddah Corniche Circuit': 'jeddah',
    'Marina Bay Street Circuit': 'singapore',
    'Baku City Circuit': 'baku',
    'Miami International Autodrome': 'miami',
    'Las Vegas Strip Circuit': 'las_vegas'
};

const rainMap = {
    'Baja': 10,
    'Muy Baja': 5,
    'Media': 40,
    'Alta': 70,
    'Baja/Media': 25,
    'Media/Alta': 60
};

updateData.forEach(item => {
    const key = nameMap[item.circuito];
    if (!key) return;

    const dir = item.sentido.toLowerCase().includes('anti') ? 'anti-clockwise' : 'clockwise';
    const pitSide = item.boxes.ubicacion.toLowerCase().includes('izquierd') ? -38 : 38;
    const rain = rainMap[item.clima.probabilidad_lluvia] || 20;
    const abrasion = item.neumaticos.abrasion;
    const flag = item.pais;

    const blockRegex = new RegExp(key + ': CircuitSpec = \\{([\\s\\S]*?)\\n\\};', 'm');
    const match = tsCode.match(blockRegex);
    if (match) {
        let block = match[1];

        // Replace direction
        block = block.replace(/direction: '[^']+'/, "direction: '" + dir + "'");

        const toAdd = "flag: '" + flag + "',\n    pitOffset: " + pitSide + ",\n    asphaltAbrasion: '" + abrasion + "',\n    rainProbabilityPercent: " + rain + ",";
        
        if (!block.includes('flag:')) {
            block = block.replace(/(officialGpName:)/, toAdd + "\n    $1");
        } else {
            block = block.replace(/flag: '[^']+',/, "flag: '" + flag + "',");
            block = block.replace(/pitOffset: -?\d+,/, "pitOffset: " + pitSide + ",");
            block = block.replace(/asphaltAbrasion: '[^']+',/, "asphaltAbrasion: '" + abrasion + "',");
            block = block.replace(/rainProbabilityPercent: \d+,/, "rainProbabilityPercent: " + rain + ",");
        }

        tsCode = tsCode.replace(match[0], key + ": CircuitSpec = {" + block + "\n};");
    }
});

if (!tsCode.includes("flag: '🇧🇷'")) {
    tsCode = tsCode.replace("country: 'Brasil',", "country: 'Brasil',\n    flag: '🇧🇷',");
}

fs.writeFileSync('src/data/circuits.ts', tsCode, 'utf8');
console.log('Done modifying circuits.ts');