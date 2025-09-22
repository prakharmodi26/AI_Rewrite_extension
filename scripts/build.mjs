import { build, context } from 'esbuild';
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';

const root = path.resolve(process.cwd());
const outdir = path.join(root, 'dist');
const jsOutDir = path.join(outdir, 'src');
const srcdir = path.join(root, 'extension', 'src');
const extdir = path.join(root, 'extension');

async function copyStatic() {
  await fs.mkdir(outdir, { recursive: true });
  // Copy manifest and static assets
  const manifestSrc = path.join(extdir, 'manifest.json');
  const manifestDest = path.join(outdir, 'manifest.json');
  await fs.copyFile(manifestSrc, manifestDest);

  // Copy options.html, popup.html and overlay.css
  await fs.mkdir(path.join(outdir, 'src'), { recursive: true });
  for (const f of ['options.html', 'popup.html', 'overlay.css']) {
    const src = path.join(srcdir, f);
    const dest = path.join(outdir, 'src', f);
    await fs.copyFile(src, dest);
  }

  // Copy icons
  const iconsSrcDir = path.join(srcdir, 'icons');
  try {
    const entries = await fs.readdir(iconsSrcDir, { withFileTypes: true });
    await fs.mkdir(path.join(outdir, 'src', 'icons'), { recursive: true });
    for (const e of entries) {
      if (e.isFile()) {
        await fs.copyFile(path.join(iconsSrcDir, e.name), path.join(outdir, 'src', 'icons', e.name));
      }
    }

    // Generate PNGs from SVG if not present
    const svgPath = path.join(iconsSrcDir, 'pencil.svg');
    const targets = [16, 32, 48, 128];
    for (const size of targets) {
      const outPng = path.join(outdir, 'src', 'icons', `icon-${size}.png`);
      await sharp(svgPath).resize(size, size).png().toFile(outPng);
    }
  } catch {}
}

async function run({ watch } = { watch: false }) {
  await copyStatic();
  const common = {
    bundle: true,
    sourcemap: true,
    target: 'chrome120',
    format: 'esm',
    outdir: jsOutDir,
    logLevel: 'info',
    loader: { '.css': 'copy' },
  };

  const entryPoints = [
    path.join(srcdir, 'background.ts'),
    path.join(srcdir, 'content.ts'),
    path.join(srcdir, 'options.ts'),
    path.join(srcdir, 'popup.ts'),
  ];

  if (watch) {
    const ctx = await context({ ...common, entryPoints });
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await build({ ...common, entryPoints });
  }
}

const watch = process.argv.includes('--watch');
run({ watch }).catch((e) => {
  console.error(e);
  process.exit(1);
});
