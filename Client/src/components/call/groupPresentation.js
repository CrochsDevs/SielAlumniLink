export function groupPresentation(state, user, connections) {
  const self = { ...state.self, id: state.self?.id || 'self', local: true,
    name: user?.name || state.self?.name || 'You', profilePicture: user?.profilePicture || state.self?.profilePicture,
    mic: state.mic, camera: state.camera, sharing: state.sharing, stream: state.stream };
  const participants = [self, ...state.peers.map(peer => ({ ...peer, stream: peer.stream || connections.get(peer.id)?.stream }))];
  const presenters = participants.filter(peer => peer.sharing);
  const presenter = presenters[0] || null;
  return { participants, presenters, presenter };
}
