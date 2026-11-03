import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const rootDir = join(__dirname, '..');
const svgPath = join(rootDir, 'isotipo limpio.svg');

const BG = '#0A0A0C';

// El relleno es la fracción libre en cada lado. En `maskable` el logo debe caber en el círculo
// seguro del 80 %: con esta proporción, 0.20 deja las esquinas del logo dentro del círculo.
const targets = [
  { file: 'favicon-16x16.png', size: 16, padding: 0.04 },
  { file: 'favicon-32x32.png', size: 32, padding: 0.04 },
  { file: 'favicon.png', size: 64, padding: 0.06 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0.12 },
  { file: 'pwa-192x192.png', size: 192, padding: 0.12 },
  { file: 'pwa-192x192-maskable.png', size: 192, padding: 0.20 },
  { file: 'pwa-512x512.png', size: 512, padding: 0.12 },
  { file: 'pwa-512x512-maskable.png', size: 512, padding: 0.20 },
];

async function main() {
  await fs.mkdir(publicDir, { recursive: true });

  // El SVG trae un rectángulo negro de fondo: se quita para que el logo quede sobre BG sin recuadro.
  const svgContent = (await fs.readFile(svgPath, 'utf8')).replace(/<rect[^>]*id="rect7297"[^>]*\/>/, '');
  const logoBuffer = await sharp(Buffer.from(svgContent)).trim({ threshold: 1 }).png().toBuffer();

  for (const { file, size, padding } of targets) {
    const innerSize = Math.round(size * (1 - padding * 2));

    const resizedLogoBuffer = await sharp(logoBuffer)
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Sin canal alfa: iOS pinta de negro lo transparente y las máscaras de Android esperan un fondo lleno.
    const composed = await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BG,
      },
    })
      .composite([
        {
          input: resizedLogoBuffer,
          gravity: 'center',
        },
      ])
      .png()
      .toBuffer();

    await sharp(composed).removeAlpha().png().toFile(join(publicDir, file));

    console.log(`Generated: ${file} (${size}x${size})`);
  }

  console.log('All PWA icons generated successfully in public/');
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
