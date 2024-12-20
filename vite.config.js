import { defineConfig } from 'vite';
import { resolve } from 'path';
import restart from 'vite-plugin-restart';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        restart({ restart: [ 'public/**', ] })
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            'three': resolve(__dirname, 'node_modules/three'),
            'three-stdlib': resolve(__dirname, 'node_modules/three-stdlib')
        },
    },
    build: {
        sourcemap: true,
        outDir: 'build',
        emptyOutDir: true,
    },
    server: {
        port: 5200,
        hmr: {
            clientPort: 5200,
        }
    },
    base: "/"
});
