// Server-owned call lifecycle: one history entry, regardless of which peer hangs up.
export function createCallService({ authorize, record, emit, now = Date.now, schedule = setTimeout, cancel = clearTimeout, onError = console.error }) {
  const calls = new Map();
  const finishedIds = new Set();
  const finish = async (call, status) => {
    if (call.finished) return;
    call.finished = true;
    cancel(call.timer);
    calls.delete(call.id);
    finishedIds.add(call.id);
    if (finishedIds.size > 2000) finishedIds.delete(finishedIds.values().next().value);
    for (const [to, from] of [[call.caller, call.recipient], [call.recipient, call.caller]])
      emit(to._id, 'call:signal', { fromAuthId: String(from._id), kind: 'end', data: { callId: call.id } });
    try {
      await record({
        ...call,
        status,
        duration: call.acceptedAt == null ? 0 : Math.max(0, Math.floor((now() - call.acceptedAt) / 1000)),
      });
    } catch (error) {
      onError('Unable to save call history', error);
    }
  };
  return {
    async signal(socket, { toAuthId, kind, data } = {}) {
      const id = data?.callId;
      if (typeof id !== 'string' || id.length > 100 || !id || !toAuthId) return;
      const sender = String(socket.user._id);
      let call = calls.get(id);
      if (kind === 'invite') {
        if (call || finishedIds.has(id) || sender === String(toAuthId)) return;
        // Reserve before the async permission lookup to prevent duplicate invites.
        call = { id, caller: socket.user, callerSocket: socket.id, recipientId: String(toAuthId), kind: data.callKind === 'video' ? 'video' : 'voice' };
        calls.set(id, call);
        try {
          call.recipient = await authorize(socket.user, toAuthId);
          if (call.finished) return;
          if (!call.recipient) throw new Error('Calling this account is not allowed');
          if (socket.disconnected) {
            await finish(call, 'missed');
            return;
          }
          call.timer = schedule(() => { void finish(call, 'missed'); }, 45000);
          call.timer?.unref?.();
        } catch {
          if (call.finished) return;
          calls.delete(id);
          emit(sender, 'call:signal', { fromAuthId: String(toAuthId), kind: 'decline', data: { callId: id } });
          return;
        }
      } else {
        if (!call?.recipient || call.finished) return;
        const caller = String(call.caller._id);
        const recipient = String(call.recipient._id);
        if (!((sender === caller && String(toAuthId) === recipient) || (sender === recipient && String(toAuthId) === caller))) return;
        if (kind === 'accept') {
          if (sender !== recipient || call.acceptedAt != null) return;
          call.acceptedAt = now();
          call.recipientSocket = socket.id;
          cancel(call.timer);
        } else if (kind === 'decline' || kind === 'end') {
          if (kind === 'decline' && (sender !== recipient || call.acceptedAt != null)) return;
          await finish(call, call.acceptedAt != null ? 'completed' : kind === 'decline' ? 'declined' : 'missed');
          return;
        } else if (kind !== 'signal') return;
      }
      emit(toAuthId, 'call:signal', { fromAuthId: sender, fromEmail: socket.user.email, kind, data });
    },
    async endBetween(a, b) {
      const pair = [String(a), String(b)].sort().join('|');
      await Promise.all([...calls.values()].filter(call =>
        [String(call.caller._id), String(call.recipient?._id || call.recipientId)].sort().join('|') === pair
      ).map(async call => {
        if (call.recipient) return finish(call, call.acceptedAt != null ? 'completed' : 'missed');
        call.finished = true;
        calls.delete(call.id);
        finishedIds.add(call.id);
        if (finishedIds.size > 2000) finishedIds.delete(finishedIds.values().next().value);
        emit(call.caller._id, 'call:signal', { fromAuthId: call.recipientId, kind: 'decline', data: { callId: call.id } });
      }));
    },
    disconnect(socket) {
      for (const call of calls.values()) {
        if (call.recipient && (call.callerSocket === socket.id || call.recipientSocket === socket.id))
          void finish(call, call.acceptedAt != null ? 'completed' : 'missed');
      }
    },
  };
}
