const fs = require('fs');
const { svgPathProperties } = require('svg-path-properties');

const svgPaths = JSON.parse(fs.readFileSync('src/data/svgTrackPaths.json', 'utf8'));

const circuits = [
    { id: 'catalunya', file: 'catalunya-6.svg' },
    { id: 'monza', file: 'monza-2.svg' },
    { id: 'silverstone', file: 'silverstone-3.svg' },
    { id: 'spa', file: 'spa-francorchamps-3.svg' },
    { id: 'monaco', file: 'monaco-6.svg' },
    { id: 'red_bull_ring', file: 'red-bull-ring-2.svg' },
    { id: 'suzuka', file: 'suzuka-2.svg' },
    { id: 'zandvoort', file: 'zandvoort-1.svg' },
    { id: 'bahrain', file: 'bahrain-4.svg' },
    { id: 'melbourne', file: 'melbourne-1.svg' },
    { id: 'shanghai', file: 'shanghai-1.svg' },
    { id: 'losail', file: 'losail-1.svg' },
    { id: 'hungaroring', file: 'hungaroring-1.svg' },
    { id: 'mexico', file: 'mexico-1.svg' },
    { id: 'montreal', file: 'montreal-3.svg' },
    { id: 'austin', file: 'austin-1.svg' },
    { id: 'yas_marina', file: 'yas-marina-2.svg' },
    { id: 'jeddah', file: 'jeddah-1.svg' },
    { id: 'singapore', file: 'singapore-3.svg' },
    { id: 'baku', file: 'baku-1.svg' },
    { id: 'miami', file: 'miami-1.svg' },
    { id: 'las_vegas', file: 'las-vegas-1.svg' }
];

for (const c of circuits) {
    const d = svgPaths[c.file];
    if (!d) {
        console.log(`\n--- ${c.id} (MISSING SVG) ---`);
        continue;
    }
    
    const props = new svgPathProperties(d);
    const len = props.getTotalLength();
    
    const points = [];
    const samples = 1000;
    
    for (let i = 0; i < samples; i++) {
        points.push(props.getPointAtLength((i / samples) * len));
    }
    
    // Instead of curvature, let's just dump 10 points (every 10%) so I can visually map them.
    console.log(`\n--- ${c.id} ---`);
    for (let i = 0; i < 10; i++) {
        const pt = points[i * 100];
        console.log(`t=${(i/10).toFixed(1)}: x=${Math.round(pt.x)}, y=${Math.round(pt.y)}`);
    }
}