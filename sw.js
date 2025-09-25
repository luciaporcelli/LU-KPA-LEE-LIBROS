let state = {
  title: '',
  coverUrl: null,
  isSpeaking: false,
  currentChapterIndex: 0,
};

function postToClient(message) {
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
    if (clients && clients.length) {
      clients.forEach(client => client.postMessage(message));
    }
  });
}

function updateMediaSession() {
    if (!('mediaSession' in navigator) || !state.title) return;

    const artwork = state.coverUrl ? [{ src: state.coverUrl, sizes: '512x512', type: 'image/jpeg' }] : [];

    navigator.mediaSession.metadata = new MediaMetadata({
        title: `Cap. ${state.currentChapterIndex + 1}: ${state.title}`,
        artist: 'LUKPALEELIBROS',
        album: state.title,
        artwork
    });
    
    navigator.mediaSession.playbackState = state.isSpeaking ? 'playing' : 'paused';
}

self.oninstall = () => {
  self.skipWaiting();
};

self.onactivate = (event) => {
  event.waitUntil(self.clients.claim());
};

self.onmessage = (event) => {
  const { command, payload } = event.data;

  if (command === 'updateState') {
    state = { ...state, ...payload };
    updateMediaSession();
  }
};

if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => postToClient({ command: 'resume' }));
    navigator.mediaSession.setActionHandler('pause', () => postToClient({ command: 'pause' }));
    navigator.mediaSession.setActionHandler('nexttrack', () => postToClient({ command: 'nextChapter' }));
    navigator.mediaSession.setActionHandler('previoustrack', () => postToClient({ command: 'prevChapter' }));
    navigator.mediaSession.setActionHandler('seekforward', () => postToClient({ command: 'skip', payload: { seconds: 15 } }));
    navigator.mediaSession.setActionHandler('seekbackward', () => postToClient({ command: 'skip', payload: { seconds: -15 } }));
}
