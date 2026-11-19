import { EventEmitter } from 'node:events';
export const communityEvents = new EventEmitter();
communityEvents.setMaxListeners(0);
