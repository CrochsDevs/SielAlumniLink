import { getSocket } from "./socket";
import api from "../utils/axios";

// New arrivals offer to the existing peers. Each pair has a single offerer.
export default class MeetingClient {
  constructor(eventId) {
    this.eventId = eventId;
    this.socket = getSocket();
    this.listeners = new Set();
    this.peers = new Map();
    this.local = new MediaStream();
    this.cameraTrack = null;
    this.screen = null;
    this.iceServers = [];
    this.active = true;
    this.joining = false;
    this.mediaOperations = new Set();
    this.mediaGeneration = 0;
    this.state = {
      joined: false,
      busy: false,
      self: null,
      peers: [],
      messages: [],
      stream: this.local,
      mic: false,
      camera: false,
      sharing: false,
      hand: false,
      error: "",
      notice: "",
    };
    this.handlers = {
      "meeting:peer-joined": (peer) =>
        this.update({
          peers: [
            ...this.state.peers.filter((item) => item.id !== peer.id),
            peer,
          ],
        }),
      "meeting:peer-updated": (peer) => {
        if (this.state.self?.id === peer.id) return;
        this.update({
          peers: this.state.peers.map((item) =>
            item.id === peer.id ? { ...item, ...peer } : item,
          ),
        });
      },
      "meeting:peer-left": ({ id }) => {
        this.peers.get(id)?.pc.close();
        this.peers.delete(id);
        this.update({
          peers: this.state.peers.filter((peer) => peer.id !== id),
        });
      },
      "meeting:signal": (signal) =>
        this.receive(signal).catch(() =>
          this.update({
            error:
              "A participant connection failed. Leave and rejoin to retry.",
          }),
        ),
      "meeting:chat": (message) =>
        this.update({
          messages: [...this.state.messages, message].slice(-100),
        }),
      "meeting:ended": ({ reason }) => {
        this.cleanupMedia();
        this.update({ joined: false, notice: reason, peers: [] });
      },
      disconnect: () => {
        if (this.state.joined || this.joining) {
          this.cleanupMedia();
          this.update({
            joined: false,
            peers: [],
            error:
              "Connection lost. Rejoin the meeting when your connection returns.",
          });
        }
      },
    };
  }
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  snapshot = () => this.state;
  update(patch) {
    if (!this.active) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  attach() {
    this.active = true;
    Object.entries(this.handlers).forEach(([event, handler]) =>
      this.socket.on(event, handler),
    );
    if (!this.socket.connected) this.socket.connect();
  }
  request(event, input = {}) {
    if (!this.socket.connected)
      return Promise.reject(
        new Error(
          "The meeting connection is offline. Please retry when connected.",
        ),
      );
    return new Promise((resolve, reject) =>
      this.socket.timeout(12000).emit(event, input, (error, response) => {
        if (error || !response?.success)
          reject(
            new Error(
              response?.message ||
                "Unable to reach the meeting server. Please retry.",
            ),
          );
        else resolve(response.data);
      }),
    );
  }
  status() {
    if (this.state.joined)
      this.socket.emit("meeting:status", {
        mic: this.state.mic,
        camera: this.state.camera,
        sharing: this.state.sharing,
        hand: this.state.hand,
      });
  }
  async join(host) {
    if (this.joining || this.state.joined) return;
    this.joining = true;
    this.update({ busy: true, error: "", notice: "" });
    try {
      if (!this.socket.connected)
        throw new Error(
          "Connecting to the meeting server. Please try again shortly.",
        );
      if (host) await api.post(`/meetings/${this.eventId}/start`);
      const response = await api.get("/meetings/config");
      this.iceServers = response.data.data.iceServers;
      const info = await this.request("meeting:join", {
        eventId: this.eventId,
      });
      if (!this.active) {
        this.socket.emit("meeting:leave");
        return;
      }
      this.update({
        joined: true,
        self: info.self,
        peers: info.peers,
        messages: info.messages,
      });
      this.status();
      await Promise.all(
        info.peers.map(async (peer) => {
          const connection = this.connection(peer.id);
          for (const kind of ["audio", "video"]) {
            const track =
              kind === "audio"
                ? this.local.getAudioTracks()[0]
                : this.screen?.getVideoTracks()[0] || this.cameraTrack;
            connection.pc.addTransceiver(track || kind, {
              direction: "sendrecv",
              streams: [this.local],
            });
          }
          await connection.pc.setLocalDescription(
            await connection.pc.createOffer(),
          );
          this.socket.emit("meeting:signal", {
            to: peer.id,
            description: connection.pc.localDescription,
          });
        }),
      );
    } catch (error) {
      this.update({ error: error.message });
    } finally {
      this.joining = false;
      this.update({ busy: false });
    }
  }
  connection(id) {
    if (this.peers.has(id)) return this.peers.get(id);
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const stream = new MediaStream();
    const connection = { pc, stream, pending: [] };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate)
        this.socket.emit("meeting:signal", {
          to: id,
          candidate: candidate.toJSON(),
        });
    };
    pc.ontrack = ({ track }) => {
      stream.addTrack(track);
      this.update({
        peers: this.state.peers.map((peer) =>
          peer.id === id ? { ...peer, stream } : peer,
        ),
      });
    };
    pc.onconnectionstatechange = () => {
      this.update({
        peers: this.state.peers.map((peer) =>
          peer.id === id ? { ...peer, connection: pc.connectionState } : peer,
        ),
      });
    };
    this.peers.set(id, connection);
    return connection;
  }
  async receive({ from, description, candidate }) {
    if (!this.active || !this.state.joined) return;
    const connection = this.connection(from),
      pc = connection.pc;
    if (description) {
      await pc.setRemoteDescription(description);
      for (const ice of connection.pending.splice(0))
        await pc.addIceCandidate(ice);
      if (description.type === "offer") {
        // The answering peer uses the transceivers created by the remote offer.
        // Pre-creating them here would leave extra, unassociated sending tracks.
        for (const transceiver of pc.getTransceivers()) {
          const kind = transceiver.receiver.track.kind;
          const track =
            kind === "audio"
              ? this.local.getAudioTracks()[0]
              : this.screen?.getVideoTracks()[0] || this.cameraTrack;
          transceiver.direction = "sendrecv";
          transceiver.sender.setStreams(this.local);
          await transceiver.sender.replaceTrack(track || null);
        }
        await pc.setLocalDescription(await pc.createAnswer());
        this.socket.emit("meeting:signal", {
          to: from,
          description: pc.localDescription,
        });
      }
    } else if (candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(candidate);
      else connection.pending.push(candidate);
    }
  }
  async replace(kind, track) {
    await Promise.all(
      [...this.peers.values()].map(({ pc }) =>
        pc
          .getTransceivers()
          .find((item) => item.receiver.track.kind === kind)
          ?.sender.replaceTrack(track),
      ),
    );
  }
  async toggle(kind) {
    if (this.mediaOperations.has(kind)) return;
    this.mediaOperations.add(kind);
    const generation = this.mediaGeneration;
    this.update({ error: "" });
    try {
      const key = kind === "audio" ? "mic" : "camera";
      let track =
        kind === "audio" ? this.local.getAudioTracks()[0] : this.cameraTrack;
      if (!track || track.readyState === "ended") {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Camera and microphone need HTTPS or localhost in a supported browser.",
          );
        const media = await navigator.mediaDevices.getUserMedia({
          [kind === "audio" ? "audio" : "video"]: true,
        });
        if (!this.active || generation !== this.mediaGeneration) {
          media.getTracks().forEach((item) => item.stop());
          return;
        }
        track = media.getTracks()[0];
        this.local.addTrack(track);
        if (kind === "video") this.cameraTrack = track;
        track.onended = () => {
          this.update({ [key]: false });
          this.status();
        };
        if (!(kind === "video" && this.screen)) await this.replace(kind, track);
        this.update({
          [key]: true,
          stream: new MediaStream(this.local.getTracks()),
        });
      } else {
        track.enabled = !this.state[key];
        this.update({ [key]: track.enabled });
      }
      this.status();
    } catch (error) {
      this.update({
        error: ["NotAllowedError", "PermissionDeniedError"].includes(error.name)
          ? "Device permission was denied. Allow access in your browser settings, or join with camera and mic off."
          : error.name === "NotFoundError"
            ? "No device was found. You can still join and listen."
            : error.message,
      });
    } finally {
      this.mediaOperations.delete(kind);
    }
  }
  async stopSharing() {
    const screen = this.screen;
    this.screen = null;
    screen?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    await this.replace("video", this.cameraTrack);
    this.update({
      sharing: false,
      stream: new MediaStream(this.local.getTracks()),
    });
    this.status();
  }
  async share() {
    if (this.mediaOperations.has("screen")) return;
    this.mediaOperations.add("screen");
    const generation = this.mediaGeneration;
    this.update({ error: "" });
    try {
      if (this.screen) {
        await this.stopSharing();
        return;
      }
      if (!navigator.mediaDevices?.getDisplayMedia)
        throw new Error("Screen sharing is unavailable in this browser.");
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      if (
        !this.active ||
        !this.state.joined ||
        generation !== this.mediaGeneration
      ) {
        screen.getTracks().forEach((track) => track.stop());
        return;
      }
      this.screen = screen;
      await this.replace("video", screen.getVideoTracks()[0]);
      screen.getVideoTracks()[0].onended = () =>
        this.stopSharing().catch(() =>
          this.update({
            error:
              "Screen sharing stopped. Rejoin if your video does not recover.",
          }),
        );
      this.update({
        sharing: true,
        stream: new MediaStream([
          ...this.local.getAudioTracks(),
          ...screen.getVideoTracks(),
        ]),
      });
      this.status();
    } catch (error) {
      if (this.screen && !this.state.sharing)
        await this.stopSharing().catch(() => {});
      if (error.name !== "NotAllowedError" && error.name !== "AbortError")
        this.update({ error: error.message });
    } finally {
      this.mediaOperations.delete("screen");
    }
  }
  hand() {
    this.update({ hand: !this.state.hand });
    this.status();
  }
  async chat(text) {
    try {
      await this.request("meeting:chat", { text });
      return true;
    } catch (error) {
      this.update({ error: error.message });
      return false;
    }
  }
  async remove(peerId) {
    try {
      await this.request("meeting:remove", { peerId });
    } catch (error) {
      this.update({ error: error.message });
    }
  }
  cleanupMedia() {
    this.mediaGeneration++;
    this.peers.forEach(({ pc }) => pc.close());
    this.peers.clear();
    this.local.getTracks().forEach((track) => track.stop());
    this.screen?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    this.local = new MediaStream();
    this.cameraTrack = null;
    this.screen = null;
    this.update({
      stream: this.local,
      mic: false,
      camera: false,
      sharing: false,
      hand: false,
    });
  }
  async leave() {
    this.update({ busy: true });
    try {
      await this.request("meeting:leave");
    } catch (error) {
      this.update({ error: error.message });
    }
    this.cleanupMedia();
    this.update({ joined: false, peers: [], busy: false });
  }
  destroy() {
    this.active = false;
    Object.entries(this.handlers).forEach(([event, handler]) =>
      this.socket.off(event, handler),
    );
    if (this.state.joined || this.joining) this.socket.emit("meeting:leave");
    this.cleanupMedia();
  }
}
