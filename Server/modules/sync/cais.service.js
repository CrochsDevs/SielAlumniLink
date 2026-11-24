// CAIS live-pull service.
// Reads connection settings from env (nothing hardcoded):
//   CAIS_API_URL            - students endpoint (JSON array)
//   CAIS_GRADUATES_URL      - graduates endpoint (JSON array, optional)
//   CAIS_API_KEY            - bearer token for both (optional)
//
// CAIS already filters the data: students API = enrolled students,
// graduates API = graduates. Graduates are auto-tagged alumni so the
// sync itself performs the Student -> Alumni conversion.
//
// CAIS fields pulled:
//   Student ID, Full Name, Program/Course, Year Level,
//   Section, Academic Status, Email, Contact Number

import { mapSyncedUser } from './user-schema.js';

export const fetchFromCAIS = async () => {
  const studentsUrl = process.env.CAIS_API_URL;
  const graduatesUrl = process.env.CAIS_GRADUATES_URL;
  const key = process.env.CAIS_API_KEY;

  if (!studentsUrl && !graduatesUrl) {
    throw new Error('CAIS_API_URL is not configured in Server/.env');
  }

  const students = studentsUrl ? await fetchList(studentsUrl, key) : [];
  const graduates = graduatesUrl ? await fetchList(graduatesUrl, key) : [];

  return {
    users: [
      ...students.map((entry) => mapSyncedUser(entry, 'student')),
      ...graduates.map((entry) => mapSyncedUser(entry, 'alumni')),
    ],
    meta: { students: students.length, graduates: graduates.length },
  };
};

const fetchList = async (url, key) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`CAIS request failed (${response.status}) for ${url}`);
  }

  const payload = await response.json();
  // Accept a bare array or { users: [...] } / { data: [...] } envelopes.
  const list = Array.isArray(payload)
    ? payload
    : payload.users || payload.data || payload.students || [];

  if (!Array.isArray(list)) {
    throw new Error('CAIS returned an unexpected format (expected an array)');
  }
  return list;
};

export default { fetchFromCAIS };
