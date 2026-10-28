import { EventEmitter } from 'node:events';
export const sessionEvents = new EventEmitter();
export const sessionsRevoked = authId => sessionEvents.emit('revoked', String(authId));
