import esbuild from 'esbuild';

const ENTRY = 'src/otel/otel-initializer.ts';
const OUT_FILE = 'dist/otel/otel-initializer.bundle.js';

await esbuild.build({
    entryPoints: [ENTRY],
    outfile: OUT_FILE,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    sourcemap: true,
    minify: true,
    // Ensures globals are on window/globalThis
    globalName: '__mcpOtelBundle',
});

console.log('Built OTEL initializer bundle:', OUT_FILE);
