import { defineConfig } from 'vite';
import restart from 'vite-plugin-restart';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        restart({ restart: [ 'public/**', ] })
    ],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            'three': resolve(__dirname, 'node_modules/three')
        },
    },
    build: {
        sourcemap: true,
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
