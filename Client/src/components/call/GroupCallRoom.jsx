import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Maximize, Minimize, Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, VolumeX, MonitorUp, MonitorOff } from 'lucide-react';
import ChatAvatar from '../chat/ChatAvatar';
import GroupCallDialog from './GroupCallDialog';
import { attachCallMedia } from './callMedia';
import { groupPresentation } from './groupPresentation';

function PeerTile({ peer, stream, local = false, speakerMuted, presentation = false, preview = false }) {
  const video = useRef(null);
  useEffect(() => {
    const element = video.current;
    attachCallMedia(element, stream);
    return () => { element.pause(); element.srcObject = null; };
  }, [stream]);
  const visible = !preview && (peer.camera || peer.sharing);
  return <div className={`group-call-peer${presentation ? ' group-call-peer--presentation' : ''}${peer.sharing ? ' group-call-peer--sharing' : ''}`} data-group-call-peer={peer.id || 'self'}>
    <video ref={video} autoPlay playsInline muted={local || speakerMuted || preview} className={visible ? '' : 'group-call-camera-off'} style={local && !peer.sharing ? { transform: 'scaleX(-1)' } : undefined} />
    {!visible && <span className="group-call-avatar"><ChatAvatar convo={{ name: peer.name, profilePicture: peer.profilePicture }} /></span>}
    <div className="group-call-peer-label"><span>{local ? 'You' : peer.name || 'Member'}{peer.sharing && <span className="group-call-presenting-label"><MonitorUp size={12} /> Presenting</span>}</span>
      <span className={peer.mic ? '' : 'group-call-peer-muted'} title={peer.mic ? 'Microphone on' : 'Microphone muted'}>
        {peer.mic ? <Mic size={14} /> : <MicOff size={14} />}
      </span>
    </div>
  </div>;
}

export default function GroupCallRoom({ session, onClose, user, ringing = false, speakerMuted = false, onSpeakerChange }) {
  const { client, conversation } = session;
  const state = useSyncExternalStore(client.subscribe, client.snapshot, client.snapshot);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenOwner = useRef(null);
  const participantCount = state.peers.length + 1;
  const { participants, presenter } = groupPresentation(state, user, client.peers);
  useEffect(() => {
    const update = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      if (fullscreenOwner.current && document.fullscreenElement === fullscreenOwner.current) void document.exitFullscreen().catch(() => {});
    };
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        const target = document.documentElement;
        fullscreenOwner.current = target;
        await target.requestFullscreen();
      }
    } catch { /* The full-window call remains usable when fullscreen is unavailable. */ }
  };
  const rejoin = async () => {
    await client.join(false);
    if (!client.state.joined) return;
    await client.toggle('audio');
    if (session.kind === 'video') await client.toggle('video');
  };
  return <GroupCallDialog title={conversation.name || 'Group call'} room onClose={onClose}
    subtitle={state.joined ? `${session.kind === 'video' ? 'Video' : 'Voice'} call · ${participantCount} of 8 participants` : state.busy ? 'Connecting to group call...' : 'Group call ended'}>
    {state.error && <p role="alert" className="group-call-error">{state.error}</p>}
    {state.notice && <p role="status" className="group-call-error">{state.notice}</p>}
    <div className={`group-call-stage${presenter ? ' group-call-stage--presenting' : ''}`}>
      {presenter ? <>
        <div className="group-call-presentation"><PeerTile key={presenter.id} peer={presenter} stream={presenter.stream} local={presenter.local} speakerMuted={speakerMuted} presentation /></div>
        <div className="group-call-participant-strip" aria-label="Call participants">
          {participants.map(peer => <PeerTile key={peer.id} peer={peer} stream={peer.id === presenter.id ? null : peer.stream} local={peer.local} speakerMuted={speakerMuted} preview={peer.id === presenter.id} />)}
        </div>
      </> : <div className="group-call-grid" data-count={participantCount}>
        {participants.map(peer => <PeerTile key={peer.id} peer={peer} stream={peer.stream} local={peer.local} speakerMuted={speakerMuted} />)}
      </div>}
    </div>
    <footer className="group-call-footer">
      <p className="group-call-waiting">{state.busy ? 'Connecting...' : ringing ? 'Ringing...' : state.joined && !state.peers.length ? 'Waiting for others to join' : state.joined ? 'Group call in progress' : 'You are no longer in this call'}</p>
      <div className="group-call-controls">
        {state.joined ? <>
          <button type="button" onClick={() => client.toggle('audio')} aria-label={state.mic ? 'Mute microphone' : 'Turn on microphone'} title={state.mic ? 'Mute microphone' : 'Turn on microphone'} aria-pressed={state.mic}>{state.mic ? <Mic size={20} /> : <MicOff size={20} />}</button>
          <button type="button" onClick={() => client.toggle('video')} aria-label={state.camera ? 'Turn off camera' : 'Turn on camera'} title={state.camera ? 'Turn off camera' : 'Turn on camera'} aria-pressed={state.camera}>{state.camera ? <Video size={20} /> : <VideoOff size={20} />}</button>
          <button type="button" onClick={onSpeakerChange} aria-label={speakerMuted ? 'Unmute speaker' : 'Mute speaker'} title={speakerMuted ? 'Unmute speaker' : 'Mute speaker'} aria-pressed={!speakerMuted}>{speakerMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>
          <button type="button" onClick={() => client.share()} className="group-call-present" aria-label={state.sharing ? 'Stop presenting' : 'Present screen'}
            title={state.sharing ? 'Stop presenting' : navigator.mediaDevices?.getDisplayMedia ? 'Share a screen, window, or browser tab' : 'Screen sharing is unavailable in this browser'}
            disabled={!state.sharing && !navigator.mediaDevices?.getDisplayMedia} aria-pressed={state.sharing}>
            {state.sharing ? <MonitorOff size={20} /> : <MonitorUp size={20} />}<span>{state.sharing ? 'Stop sharing' : 'Present'}</span>
          </button>
        </> : !state.busy && <button type="button" onClick={rejoin} className="group-call-retry">Rejoin call</button>}
        {document.fullscreenEnabled && <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>{fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>}
        <button type="button" onClick={onClose} className="group-call-leave" aria-label="Leave group call" title="Leave call"><PhoneOff size={21} /></button>
      </div>
    </footer>
  </GroupCallDialog>;
}
