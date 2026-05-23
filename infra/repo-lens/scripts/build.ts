import fs from 'fs';
import path from 'path';

import { rollup } from 'rollup';
import rollupConfig from '../rollup.config.cjs';

function cleanDist() {
  const libDir = path.resolve(__dirname, '../lib');
  if (fs.existsSync(libDir)) {
    fs.rmSync(libDir, { recursive: true, force: true });
  }
  fs.mkdirSync(libDir, { recursive: true });
}

function copyBinFiles() {
  const binDir = path.resolve(__dirname, '../bin');
  fs.mkdirSync(binDir, { recursive: true });

  const binContent = '#!/usr/bin/env node\nrequire(\'../lib/cli.js\');\n';
  fs.writeFileSync(path.join(binDir, 'main'), binContent);
  fs.chmodSync(path.join(binDir, 'main'), '755');
}

async function main() {
  cleanDist();

  const bundle = await rollup(rollupConfig);
  await bundle.write(rollupConfig.output[0]);

  copyBinFiles();
}

main().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
