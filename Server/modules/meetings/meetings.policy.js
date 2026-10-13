import { fail } from '../development/development.policy.js';

export const MEETING_EARLY_ACCESS_MINUTES = 15;

export function meetingAccessWindow(event, meeting, now = Date.now()) {
  const start = new Date(event.startAt).getTime();
  const opensAt = new Date(start - MEETING_EARLY_ACCESS_MINUTES * 60000);
  const end = new Date(event.endAt || event.startAt).getTime();
  const state = now < opensAt.getTime() ? 'upcoming'
    : meeting?.state === 'ended' || (now >= end && meeting?.state !== 'active') ? 'ended' : 'open';
  return { state, opensAt, earlyAccessMinutes: MEETING_EARLY_ACCESS_MINUTES };
}

export function requireMeetingAccess(user, event, meeting, now) {
  if (user.role === 'admin') return;
  const access = meetingAccessWindow(event, meeting, now);
  if (access.state === 'upcoming') fail(403, `Meeting access opens ${access.opensAt.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })} (15 minutes before the scheduled start)`);
  if (access.state === 'ended') fail(410, 'This meeting has ended. View your participation records and certificates from your portfolio.');
}
