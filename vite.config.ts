import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import {fileURLToPath,URL} from 'node:url';
export default defineConfig({
  plugins:[laravel({input:['resources/js/app.tsx'],refresh:true}),react()],
  resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url)),buffer:'buffer/'}},
  server:{host:'127.0.0.1'},
});
