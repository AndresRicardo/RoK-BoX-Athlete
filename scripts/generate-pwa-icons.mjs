import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const rootDir = join(__dirname, '..');
const svgPath = join(rootDir, 'isotipo limpio.svg');

const BG = '#0A0A0C';

const targets = [
  { file: 'pwa-192x192.png', size: 192, maskable: false },
  { file: 'pwa-512x512.png', size: 512, maskable: false },
  { file: 'pwa-512x512-maskable.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
];

async function main() {
  await fs.mkdir(publicDir, { recursive: true });

  const svgContent = await fs.readFile(svgPath, 'utf8');

  for (const { file, size, maskable } of targets) {
    const paddingFactor = maskable ? 0.20 : 0.12;
    const innerSize = Math.round(size * (1 - paddingFactor * 2));

    const resizedLogoBuffer = await sharp(Buffer.from(svgContent))
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const out = join(publicDir, file);
    await sharp({
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
      .toFile(out);

    console.log(`Generated: ${file} (${size}x${size}${maskable ? ', maskable' : ''})`);
  }

  console.log('All PWA icons generated successfully in public/');
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
