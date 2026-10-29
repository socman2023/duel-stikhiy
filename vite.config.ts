import { defineConfig } from 'vite';

// Относительные пути подходят для локального запуска, GitHub Pages и будущего VK-хостинга.
export default defineConfig({ base: './', server: { host: '0.0.0.0' } });
