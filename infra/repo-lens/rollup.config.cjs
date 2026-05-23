//  Copyright (c) 2025 coze-dev
//  SPDX-License-Identifier: MIT
require('sucrase/register/ts');
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');

module.exports = {
  input: 'src/index.ts',
  output: [
    {
      file: 'lib/cli.js',
      format: 'cjs',
      sourcemap: false,
    },
  ],
  external: (id) => id !== 'src/index.ts' && !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0'),
  plugins: [
    resolve.default({ preferBuiltins: true }),
    commonjs.default(),
    typescript.default({
      tsconfig: './tsconfig.build.json',
      declaration: false,
      composite: false,
      incremental: false,
      outDir: 'lib',
    }),
  ],
};
