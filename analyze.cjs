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
    if (!d) continue;
    
    const props = new svgPathProperties(d);
    const len = props.getTotalLength();
    
    const points = [];
    const samples = 1000;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    for (let i = 0; i < samples; i++) {
        const pt = props.getPointAtLength((i / samples) * len);
        points.push(pt);
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // Find straight sections (curvature near 0)
    const curvatures = [];
    for (let i = 0; i < samples; i++) {
        const curr = points[i];
        const next = points[(i + 1) % samples];
        const prev = points[(i - 1 + samples) % samples];
        
        const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
        const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
        let da = Math.abs(a2 - a1);
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        curvatures.push(Math.abs(da));
    }
    
    const straights = [];
    let inStraight = false;
    let startIdx = 0;
    for (let i = 0; i < samples; i++) {
        if (curvatures[i] < 0.05) {
            if (!inStraight) {
                inStraight = true;
                startIdx = i;
            }
        } else {
            if (inStraight) {
                inStraight = false;
                const length = i - startIdx;
                if (length > 20) { // minimum straight length
                    const mid = startIdx + Math.floor(length / 2);
                    const midPt = points[mid];
                    
                    // Determine position relative to bounding box
                    const relX = (midPt.x - minX) / width;
                    const relY = (midPt.y - minY) / height;
                    let posStr = '';
                    if (relY < 0.25) posStr += 'TOP ';
                    else if (relY > 0.75) posStr += 'BOTTOM ';
                    else posStr += 'MID-Y ';
                    
                    if (relX < 0.25) posStr += 'LEFT';
                    else if (relX > 0.75) posStr += 'RIGHT';
                    else posStr += 'MID-X';
                    
                    const p1 = points[startIdx];
                    const p2 = points[i-1];
                    const dirAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                    
                    straights.push({
                        tStart: (startIdx / samples).toFixed(3),
                        tEnd: (i / samples).toFixed(3),
                        tMid: (mid / samples).toFixed(3),
                        len: length,
                        pos: posStr,
                        angle: dirAngle
                    });
                }
            }
        }
    }
    
    // Check if straight wraps around array boundary
    
    straights.sort((a, b) => b.len - a.len);
    console.log(`\n--- ${c.id} ---`);
    straights.slice(0, 3).forEach((s, idx) => {
        let dir = 'RIGHT';
        if (s.angle < -Math.PI/4 && s.angle > -3*Math.PI/4) dir = 'UP';
        else if (s.angle > Math.PI/4 && s.angle < 3*Math.PI/4) dir = 'DOWN';
        else if (Math.abs(s.angle) > 3*Math.PI/4) dir = 'LEFT';
        
        console.log(`Straight ${idx+1}: len=${s.len}, pos=${s.pos}, dir=${dir}, tMid=${s.tMid}, tRange=[${s.tStart}, ${s.tEnd}]`);
    });
}