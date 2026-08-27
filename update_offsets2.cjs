const fs = require('fs');

const offsets = {
    'barcelona': { start: 0.12, entry: 0.90, exit: 0.15 },
    'monza': { start: 0.76, entry: 0.90, exit: 0.12 },
    'silverstone': { start: 0.42, entry: 0.90, exit: 0.10 },
    'spa': { start: 0.05, entry: 0.92, exit: 0.10 },
    'monaco': { start: 0.60, entry: 0.92, exit: 0.10 },
    'spielberg': { start: 0.86, entry: 0.90, exit: 0.10 },
    'suzuka': { start: 0.62, entry: 0.90, exit: 0.10 },
    'zandvoort': { start: 0.75, entry: 0.90, exit: 0.10 },
    'bahrain': { start: 0.88, entry: 0.90, exit: 0.10 },
    'melbourne': { start: 0.64, entry: 0.92, exit: 0.10 },
    'shanghai': { start: 0.28, entry: 0.90, exit: 0.10 },
    'lusail': { start: 0.04, entry: 0.90, exit: 0.10 },
    'hungaroring': { start: 0.22, entry: 0.90, exit: 0.10 },
    'mexico-city': { start: 0.14, entry: 0.90, exit: 0.10 },
    'montreal': { start: 0.18, entry: 0.92, exit: 0.10 },
    'austin': { start: 0.96, entry: 0.90, exit: 0.10 },
    'yas-marina': { start: 0.05, entry: 0.90, exit: 0.10 },
    'jeddah': { start: 0.07, entry: 0.90, exit: 0.10 },
    'marina-bay': { start: 0.05, entry: 0.90, exit: 0.10 },
    'baku': { start: 0.88, entry: 0.90, exit: 0.10 },
    'miami': { start: 0.75, entry: 0.90, exit: 0.10 },
    'las-vegas': { start: 0.42, entry: 0.90, exit: 0.10 }
};

let tsCode = fs.readFileSync('src/data/circuits.ts', 'utf8');

for (const [key, data] of Object.entries(offsets)) {
    const blockRegex = new RegExp("'" + key + "':\\s*\\{([\\s\\S]*?)\\n\\s*\\},?", 'm');
    let match = tsCode.match(blockRegex);
    if (!match) {
        // try without quotes
        const regex2 = new RegExp(key + ':\\s*\\{([\\s\\S]*?)\\n\\s*\\},?', 'm');
        match = tsCode.match(regex2);
    }
    
    if (match) {
        let block = match[1];
        
        block = block.replace(/\n\s*pitEntryT: [\d\.]+,?/g, '');
        block = block.replace(/\n\s*pitExitT: [\d\.]+,?/g, '');
        block = block.replace(/\n\s*startOffsetT: [\d\.]+,?/g, '');
        
        const toAdd = `\n      pitEntryT: ${data.entry},\n      pitExitT: ${data.exit},\n      startOffsetT: ${data.start},`;
        
        block = block.replace(/(officialGpName:)/, toAdd.trimStart() + '\n      $1');
        
        const replacement = match[0].startsWith("'") ? `'${key}': {${block}\n    },` : `${key}: {${block}\n    },`;
        tsCode = tsCode.replace(match[0], replacement);
    } else {
        console.log('Missed', key);
    }
}

fs.writeFileSync('src/data/circuits.ts', tsCode, 'utf8');
console.log('Updated startOffsetT and pit variables for all tracks');