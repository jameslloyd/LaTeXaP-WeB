import { createApp } from './app.js';

const { app, config, storageProvider } = createApp();

app.listen(config.port, () => {
  console.log(
    `[LaTeXaP-WeB] Server listening on http://localhost:${config.port} (storage=${storageProvider.driver}, devAuth=${config.devAuthEnabled})`
  );
});
