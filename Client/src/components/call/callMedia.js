export function attachCallMedia(element, stream) {
  if (!element) return;
  element.srcObject = stream || null;
  if (stream) void element.play()?.catch(() => {});
}

export function setCallTrackEnabled(stream, kind, enabled) {
  const tracks = kind === 'audio' ? stream?.getAudioTracks() : stream?.getVideoTracks();
  for (const track of tracks || []) {
    if (track.readyState !== 'ended') track.enabled = enabled;
  }
}

export function stopCallStream(stream) {
  stream?.getTracks().forEach(track => track.stop());
}

export function callMediaError(error) {
  if (['NotAllowedError', 'SecurityError'].includes(error?.name)) return 'Allow microphone and camera access in your browser to make this call.';
  if (error?.name === 'NotFoundError') return 'No microphone or camera was found. Connect a device and try again.';
  if (error?.name === 'NotReadableError') return 'Your microphone or camera is unavailable or being used by another app.';
  return 'The call could not connect. Please try again.';
}
