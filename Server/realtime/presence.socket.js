const room = id => `presence:${id}`;

export function attachPresence(socket, { io, store, saveStatus, canWatch, onChange = () => {} }) {
  const authId = String(socket.user._id);
  let revision = 0;
  let watched = [];
  store.markOnline(authId, socket.id, socket.user.presenceStatus);
  const publish = () => {
    io.to(room(authId)).emit('presence:changed', store.contact(authId));
    io.to(`user:${authId}`).emit('presence:self', { status: store.getStatus(authId) });
    onChange();
  };
  publish();

  socket.on('presence:watch', async (input) => {
    const version = ++revision;
    if (!Array.isArray(input) || input.length > 200) return;
    const ids = [...new Set(input.filter(id => typeof id === 'string' && id.length <= 100))];
    try {
      const allowed = await canWatch(socket.user, ids);
      if (socket.disconnected || version !== revision) return;
      for (const id of watched) socket.leave(room(id));
      watched = ids.filter(id => allowed.includes(id));
      for (const id of watched) socket.join(room(id));
      socket.emit('presence:contacts', watched.map(id => store.contact(id)));
      socket.emit('presence:self', { status: store.getStatus(authId) });
    } catch { /* Presence lookup must not disrupt messaging. */ }
  });

  socket.on('presence:set', async (input, acknowledge) => {
    const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
    if (!['active', 'busy'].includes(input?.status)) {
      reply({ success: false, message: 'Choose Active or Busy.' });
      return;
    }
    try {
      await saveStatus(authId, input.status);
      store.setStatus(authId, input.status);
      publish();
      reply({ success: true, status: store.getStatus(authId) });
    } catch {
      reply({ success: false, message: 'Unable to update your status. Please try again.' });
    }
  });

  socket.on('disconnect', () => {
    ++revision;
    store.markOffline(authId, socket.id);
    publish();
  });
}
