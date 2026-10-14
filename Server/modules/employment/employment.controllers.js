import UserModel from '../users/users.models.js';
import { EmploymentModel } from './employment.models.js';
import { employmentState, updateEmployment, addPastEmployment, employmentReport } from './employment.policy.js';

async function ownProfile(req) {
  const profile = await UserModel.findByAuthId(req.user._id);
  if (!profile) throw Object.assign(new Error('Profile not found'), { status: 404 });
  return profile;
}
const handle = task => async (req, res) => {
  try { res.status(200).json({ success: true, data: await task(req) }); }
  catch (error) { res.status(error.status || 500).json({ success: false, message: error.message }); }
};
export const getEmployment = handle(async req => employmentState(await ownProfile(req)));
export const saveEmployment = handle(async req => {
  const profile = await ownProfile(req);
  return employmentState(await EmploymentModel.updateProfile(profile, updateEmployment(profile, req.body)));
});
export const addExperience = handle(async req => {
  const profile = await ownProfile(req);
  return employmentState(await EmploymentModel.updateProfile(profile, addPastEmployment(profile, req.body)));
});
export const removeExperience = handle(async req => {
  const profile = await ownProfile(req);
  const state = employmentState(profile);
  const history = state.employmentHistory;
  // A history fingerprint also detects edits made from the general profile page.
  const index = Number(req.params.index);
  if (!Number.isInteger(index) || index < 0 || index >= history.length) throw Object.assign(new Error('Experience not found'), { status: 404 });
  if (req.body.revision !== state.historyRevision) {
    throw Object.assign(new Error('Your employment history changed. Refresh and try again.'), { status: 409 });
  }
  if (history[index].current) throw Object.assign(new Error('Update your current employment before removing a current role.'), { status: 400 });
  return employmentState(await EmploymentModel.updateProfile(profile, { employmentHistory: history.filter((_, i) => i !== index), employmentUpdatedAt: new Date() }));
});
export const getReport = handle(async req => {
  for (const key of ['batch', 'program']) {
    if (req.query[key] !== undefined && (typeof req.query[key] !== 'string' || req.query[key].length > 200)) {
      throw Object.assign(new Error(`Invalid ${key} filter`), { status: 400 });
    }
  }
  return employmentReport(await EmploymentModel.alumniProfiles(), req.query);
});
