# MathArena Multiplayer - Deploy Internet

This project runs a Node.js HTTP + raw WebSocket server. The browser automatically uses `wss://` when served over HTTPS.

## Railway
1. Put this folder in a GitHub repository.
2. Create a Railway project and choose Deploy from GitHub repo.
3. Select the repository.
4. Railway detects Node.js and runs `npm start`.
5. Generate a public domain in the service Networking settings.
6. Open the generated HTTPS URL on both devices.

## Render
1. Put this folder in a GitHub repository.
2. Create a Render Web Service from the repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Deploy and open the generated HTTPS URL.

The server uses `process.env.PORT`, so the platform can assign its own port.
