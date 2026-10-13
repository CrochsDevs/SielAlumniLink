import { fail, text } from '../development/development.policy.js';
export function validateRegistrationWindow(event) {
  if (!event.registrationLimited) return;
  if (!event.registrationClosesAt) fail(400, 'Set a registration closing date and time');
  if (event.registrationOpensAt && new Date(event.registrationOpensAt) >= new Date(event.registrationClosesAt)) fail(400, 'Registration must open before it closes');
  if (new Date(event.registrationClosesAt) > new Date(event.endAt || event.startAt)) fail(400, 'Registration must close no later than the activity ends');
}
export function validateEvent(input, partial = false) {
  const result = {};
  for (const [key, max, required] of [['title', 300, true], ['description', 5000, false], ['location', 300, false], ['organizer', 200, false]]) {
    if (!partial || input[key] !== undefined) result[key] = text(input[key], key, max, required);
  }
  for (const [key, values, fallback] of [['activityType', ['event', 'training', 'seminar'], 'event'], ['deliveryMode', ['onsite', 'online'], 'onsite']]) {
    if (!partial || input[key] !== undefined) {
      result[key] = input[key] || fallback;
      if (!values.includes(result[key])) fail(400, `Choose a valid ${key}`);
    }
  }
  for (const key of ['startAt', 'endAt']) {
    if (!partial || input[key] !== undefined) {
      if (key === 'endAt' && !input[key]) { result[key] = null; continue; }
      if (typeof input[key] !== 'string' || !Number.isFinite(new Date(input[key]).getTime())) fail(400, 'Enter valid start and end times');
      result[key] = input[key];
    }
  }
  if (result.endAt && result.startAt && new Date(result.endAt) <= new Date(result.startAt)) fail(400, 'The end time must be after the start time');
  if (!partial && result.deliveryMode === 'online' && !result.endAt) fail(400, 'Online activities require an end time');
  if (!partial || input.registrationLimited !== undefined) {
    if (input.registrationLimited !== undefined && typeof input.registrationLimited !== 'boolean') fail(400, 'Registration time limit must be a boolean');
    result.registrationLimited = input.registrationLimited === true;
  }
  for (const key of ['registrationOpensAt', 'registrationClosesAt']) {
    if (!partial || input[key] !== undefined) {
      if (!input[key]) result[key] = null;
      else {
        if (typeof input[key] !== 'string' || !Number.isFinite(new Date(input[key]).getTime())) fail(400, 'Enter valid registration dates and times');
        result[key] = input[key];
      }
    }
  }
  if (result.registrationLimited === false) { result.registrationOpensAt = null; result.registrationClosesAt = null; }
  if (!partial) validateRegistrationWindow(result);
  if (!partial || input.isActive !== undefined) {
    if (input.isActive !== undefined && typeof input.isActive !== 'boolean') fail(400, 'Publish status must be a boolean');
    result.isActive = input.isActive !== false;
  }
  return result;
}
