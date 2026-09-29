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

const pick = (obj, keys) => {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
      return String(obj[key]).trim();
    }
  }
  return '';
};

const mapRole = (rawStatus, rawRole) => {
  const fromRole = String(rawRole || '').toLowerCase();
  if (fromRole.includes('alum')) return 'alumni';
  if (fromRole.includes('stud')) return 'student';
  // Fallback: derive from Academic Status (Graduated -> alumni).
  const status = String(rawStatus || '').toLowerCase();
  if (status.includes('graduat') || status.includes('alum')) return 'alumni';
  return 'student';
};

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
      ...students.map((entry) => mapEntry(entry, 'student')),
      ...graduates.map((entry) => mapEntry(entry, 'alumni')),
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

// source: 'student' (students API) or 'alumni' (graduates API).
// Graduates are forced to alumni — this IS the automatic conversion:
// a synced student that appears in the graduates API becomes alumni.
const mapEntry = (entry, source) => {
  const first = pick(entry, ['first_name', 'firstname', 'given_name']);
  const last = pick(entry, ['last_name', 'lastname', 'surname', 'family_name']);
  const middle = pick(entry, ['middle_name', 'middlename']);
  const composed = `${first} ${middle ? `${middle.charAt(0)}.` : ''} ${last}`.replace(/\s+/g, ' ').trim();
  const academicStatus = pick(entry, ['academic_status', 'academicstatus', 'status', 'enrollment_status']);

  return {
    studentId: pick(entry, ['student_id', 'studentid', 'student_no', 'id_number', 'id']),
    name: pick(entry, ['full_name', 'fullname', 'complete_name', 'name']) || composed,
    email: pick(entry, ['email', 'email_address', 'school_email', 'emailaddress']),
    program: pick(entry, ['program', 'course', 'program_course', 'degree']),
    yearLevel: pick(entry, ['year_level', 'yearlevel', 'year', 'level']),
    section: pick(entry, ['section', 'class_section', 'block']),
    academicStatus: academicStatus || (source === 'alumni' ? 'Graduated' : ''),
    contactNumber: pick(entry, ['contact_number', 'contactnumber', 'contact_no', 'mobile', 'phone', 'cp_number']),
    role: source === 'alumni' ? 'alumni' : mapRole(academicStatus, pick(entry, ['role', 'user_type', 'usertype', 'account_type', 'type'])),
  };
};

export default { fetchFromCAIS };
