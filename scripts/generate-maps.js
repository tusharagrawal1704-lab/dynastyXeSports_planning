import fs from 'fs';
import path from 'path';

const mapsDir = path.resolve('public/maps');
if (!fs.existsSync(mapsDir)) {
  fs.mkdirSync(mapsDir, { recursive: true });
}

function getErangelSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <defs>
    <radialGradient id="waterGrad" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#0f2b48" />
      <stop offset="100%" stop-color="#081726" />
    </radialGradient>
    <linearGradient id="islandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2d5a3f" />
      <stop offset="50%" stop-color="#234732" />
      <stop offset="100%" stop-color="#1b3626" />
    </linearGradient>
    <linearGradient id="militaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3d493a" />
      <stop offset="100%" stop-color="#283325" />
    </linearGradient>
  </defs>

  <rect width="1000" height="1000" fill="url(#waterGrad)" />
  
  <g stroke="rgba(255,255,255,0.12)" stroke-width="1">
    ${Array.from({ length: 11 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="1000" />`).join('')}
    ${Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${i * 100}" x2="1000" y2="${i * 100}" />`).join('')}
  </g>
  
  <g fill="rgba(255,255,255,0.5)" font-size="14" font-family="sans-serif" font-weight="bold">
    ${['A','B','C','D','E','F','G','H','I','J'].map((char, i) => `<text x="${i * 100 + 45}" y="25">${char}</text>`).join('')}
    ${Array.from({ length: 10 }, (_, i) => `<text x="10" y="${i * 100 + 55}">${i + 1}</text>`).join('')}
  </g>

  <path d="M 200,180 Q 350,120 600,150 T 850,280 Q 900,450 820,650 T 550,720 Q 300,750 180,600 T 150,350 Z" fill="url(#islandGrad)" stroke="#3e7a56" stroke-width="4" />
  <path d="M 320,780 Q 500,760 700,790 T 720,900 Q 520,950 300,910 Z" fill="url(#militaryGrad)" stroke="#4a5747" stroke-width="4" />
  
  <line x1="380" y1="720" x2="390" y2="780" stroke="#f59e0b" stroke-width="6" />
  <line x1="620" y1="710" x2="630" y2="785" stroke="#f59e0b" stroke-width="6" />

  <path d="M 200,350 Q 350,300 500,380 T 800,400" stroke="#fbbf24" stroke-width="4" fill="none" opacity="0.8" />
  <path d="M 500,180 Q 480,400 480,680 T 390,750" stroke="#fbbf24" stroke-width="4" fill="none" opacity="0.8" />

  <g transform="translate(450,480)">
    <rect x="-35" y="-35" width="70" height="70" fill="#dc2626" opacity="0.7" rx="8" />
    <circle r="14" fill="#ef4444" stroke="#ffffff" stroke-width="2" />
    <text x="0" y="50" text-anchor="middle" fill="#ffffff" font-size="16" font-weight="bold">Pochinki</text>
  </g>

  <g transform="translate(560,400)">
    <rect x="-30" y="-25" width="60" height="50" fill="#3b82f6" opacity="0.7" rx="6" />
    <text x="0" y="40" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="bold">School</text>
  </g>

  <g transform="translate(240,280)">
    <rect x="-45" y="-35" width="90" height="70" fill="#dc2626" opacity="0.7" rx="8" />
    <text x="0" y="50" text-anchor="middle" fill="#ffffff" font-size="15" font-weight="bold">Georgopol</text>
  </g>

  <g transform="translate(520,840)">
    <rect x="-60" y="-35" width="120" height="70" fill="#eab308" opacity="0.7" rx="8" />
    <text x="0" y="52" text-anchor="middle" fill="#ffffff" font-size="15" font-weight="bold">Military Base</text>
  </g>

  <g transform="translate(670,840)">
    <rect x="-35" y="-30" width="70" height="60" fill="#dc2626" opacity="0.7" rx="8" />
    <text x="0" y="45" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="bold">Novorepnoye</text>
  </g>

  <g transform="translate(480,320)">
    <circle r="22" fill="#f97316" opacity="0.8" />
    <text x="0" y="36" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="bold">Rozhok</text>
  </g>

  <g transform="translate(700,300)">
    <rect x="-40" y="-40" width="80" height="80" fill="#dc2626" opacity="0.7" rx="8" />
    <text x="0" y="55" text-anchor="middle" fill="#ffffff" font-size="15" font-weight="bold">Yasnaya Polyana</text>
  </g>

  <rect x="20" y="930" width="340" height="50" fill="rgba(0,0,0,0.8)" rx="10" stroke="rgba(255,255,255,0.2)" />
  <text x="35" y="962" fill="#38bdf8" font-size="22" font-family="sans-serif" font-weight="bold">ERANGEL <tspan fill="#ffffff" font-size="16">8x8 km Tactical</tspan></text>
</svg>`;
}

function getMiramarSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <defs>
    <radialGradient id="desertWater" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#0e3a59" />
      <stop offset="100%" stop-color="#061a29" />
    </radialGradient>
    <linearGradient id="desertGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8c5828" />
      <stop offset="50%" stop-color="#6e411b" />
      <stop offset="100%" stop-color="#522f12" />
    </linearGradient>
  </defs>

  <rect width="1000" height="1000" fill="url(#desertWater)" />

  <g stroke="rgba(255,255,255,0.12)" stroke-width="1">
    ${Array.from({ length: 11 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="1000" />`).join('')}
    ${Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${i * 100}" x2="1000" y2="${i * 100}" />`).join('')}
  </g>
  <g fill="rgba(255,255,255,0.5)" font-size="14" font-family="sans-serif" font-weight="bold">
    ${['A','B','C','D','E','F','G','H','I','J'].map((char, i) => `<text x="${i * 100 + 45}" y="25">${char}</text>`).join('')}
    ${Array.from({ length: 10 }, (_, i) => `<text x="10" y="${i * 100 + 55}">${i + 1}</text>`).join('')}
  </g>

  <path d="M 80,100 L 920,100 L 920,800 Q 700,920 400,850 T 80,750 Z" fill="url(#desertGrad)" stroke="#a66e38" stroke-width="4" />

  <g transform="translate(480,500)">
    <rect x="-40" y="-40" width="80" height="80" fill="#ef4444" opacity="0.8" rx="8" />
    <circle r="16" fill="#fbbf24" stroke="#ffffff" stroke-width="2" />
    <text x="0" y="55" text-anchor="middle" fill="#ffffff" font-size="16" font-weight="bold">Pecado</text>
  </g>

  <g transform="translate(720,680)">
    <rect x="-55" y="-45" width="110" height="90" fill="#dc2626" opacity="0.8" rx="8" />
    <text x="0" y="60" text-anchor="middle" fill="#ffffff" font-size="16" font-weight="bold">Los Leones</text>
  </g>

  <g transform="translate(250,350)">
    <rect x="-45" y="-35" width="90" height="70" fill="#f97316" opacity="0.8" rx="8" />
    <text x="0" y="50" text-anchor="middle" fill="#ffffff" font-size="15" font-weight="bold">El Pozo</text>
  </g>

  <g transform="translate(560,380)">
    <rect x="-30" y="-25" width="60" height="50" fill="#eab308" opacity="0.8" rx="8" />
    <text x="0" y="40" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="bold">Hacienda</text>
  </g>

  <rect x="20" y="930" width="340" height="50" fill="rgba(0,0,0,0.8)" rx="10" stroke="rgba(255,255,255,0.2)" />
  <text x="35" y="962" fill="#fbbf24" font-size="22" font-family="sans-serif" font-weight="bold">MIRAMAR <tspan fill="#ffffff" font-size="16">8x8 km Tactical</tspan></text>
</svg>`;
}

function getRondoSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <defs>
    <linearGradient id="rondoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="50%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
  </defs>

  <rect width="1000" height="1000" fill="#030712" />

  <g stroke="rgba(99,102,241,0.2)" stroke-width="1">
    ${Array.from({ length: 11 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="1000" />`).join('')}
    ${Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${i * 100}" x2="1000" y2="${i * 100}" />`).join('')}
  </g>

  <path d="M 120,120 Q 500,80 880,140 T 900,860 Q 480,920 100,840 Z" fill="url(#rondoGrad)" stroke="#6366f1" stroke-width="4" />

  <g transform="translate(500,500)">
    <rect x="-70" y="-70" width="140" height="140" fill="#6366f1" opacity="0.6" rx="12" />
    <circle r="30" fill="#818cf8" stroke="#ffffff" stroke-width="3" />
    <text x="0" y="95" text-anchor="middle" fill="#ffffff" font-size="18" font-weight="bold">Jadhavpur / Meyran</text>
  </g>

  <g transform="translate(250,300)">
    <circle r="40" fill="#10b981" opacity="0.7" />
    <text x="0" y="58" text-anchor="middle" fill="#ffffff" font-size="15" font-weight="bold">Bamboo Forest</text>
  </g>

  <rect x="20" y="930" width="340" height="50" fill="rgba(0,0,0,0.8)" rx="10" stroke="rgba(255,255,255,0.2)" />
  <text x="35" y="962" fill="#818cf8" font-size="22" font-family="sans-serif" font-weight="bold">RONDO <tspan fill="#ffffff" font-size="16">8x8 km Tactical</tspan></text>
</svg>`;
}

// Write both .svg files AND SVG Data URL helper JS
fs.writeFileSync(path.join(mapsDir, 'erangel.svg'), getErangelSVG());
fs.writeFileSync(path.join(mapsDir, 'erangel.jpg'), getErangelSVG());
fs.writeFileSync(path.join(mapsDir, 'miramar.svg'), getMiramarSVG());
fs.writeFileSync(path.join(mapsDir, 'miramar.jpg'), getMiramarSVG());
fs.writeFileSync(path.join(mapsDir, 'rondo.svg'), getRondoSVG());
fs.writeFileSync(path.join(mapsDir, 'rondo.jpg'), getRondoSVG());

console.log('Regenerated SVG map assets!');
