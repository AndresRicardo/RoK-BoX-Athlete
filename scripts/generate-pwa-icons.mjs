import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const BG = '#000000';
const FG = '#FFC815';

const buildSvg = (size, { maskable = false } = {}) => {
  const safeInset = maskable ? size * 0.10 : 0;
  const contentSize = size - safeInset * 2;
  const textSize = Math.round(contentSize * 0.42);
  const textY = size / 2 + textSize * 0.34;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <text
    x="50%"
    y="${textY}"
    text-anchor="middle"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
    font-weight="900"
    font-size="${textSize}"
    fill="${FG}"
    letter-spacing="-${Math.round(textSize * 0.02)}"
  >RöK</text>
</svg>`;
};

const targets = [
  { file: 'pwa-192x192.png', size: 192, maskable: false },
  { file: 'pwa-512x512.png', size: 512, maskable: false },
  { file: 'pwa-512x512-maskable.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
];

async function main() {
  await fs.mkdir(publicDir, { recursive: true });

  for (const { file, size, maskable } of targets) {
    const svg = buildSvg(size, { maskable });
    const out = join(publicDir, file);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(out);
    console.log(`  ${file} (${size}x${size}${maskable ? ', maskable' : ''})`);
  }

  console.log('Iconos PWA generados en public/');
}

main().catch((err) => {
  console.error('Error generando iconos:', err);
  process.exit(1);
});
