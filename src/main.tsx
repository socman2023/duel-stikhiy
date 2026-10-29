import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {initVkMiniApp} from './vk/bridge';
import './styles.css';

// Инициализация ВКонтакте не блокирует запуск автономной браузерной игры.
initVkMiniApp();
createRoot(document.getElementById('root')!).render(<App/>);
