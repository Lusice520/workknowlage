import React from 'react';
import ReactDOM from 'react-dom/client';
import '@mantine/core/styles.css';
import App from './app/App';
import './shared/editor/knowledgeBaseEditorStyles.css';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
