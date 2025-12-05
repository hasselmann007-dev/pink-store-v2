import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App.jsx';
import './index.css';

// Cria o ponto de entrada da aplicação e rende o componente App dentro da div#root
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
