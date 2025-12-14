export const environment = {
  production: true,
  apiBaseUrl: "https://tritrackit-api.vercel.app/api/v1",
  idleTimeoutMinutes: 30,
  pusher: {
    key: "525752a480ad973116be",
    cluster: "ap1",
  },
  socketIo: {
    url: "https://tritrackit-api.vercel.app", // Socket.io server URL (same as API base)
    options: {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    }
  }
};
