import React from 'react';
import ReactDOM from 'react-dom/client';
import '@mantine/core/styles.css';
import App from './app/App';
import ExternalFileApp from './app/ExternalFileApp';
import './shared/editor/knowledgeBaseEditorStyles.css';
import './styles/globals.css';

const searchParams = new URLSearchParams(window.location.search);
const RootApp = searchParams.get('view') === 'external-file' ? ExternalFileApp : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
);
