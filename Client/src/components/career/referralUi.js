import { Award, BriefcaseBusiness, GraduationCap } from 'lucide-react';

export const REFERRAL_TYPES = [
  { key: 'job', label: 'Jobs', singular: 'Job', icon: BriefcaseBusiness, description: 'Take the next step in your career.', style: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300', accent: 'bg-emerald-500' },
  { key: 'internship', label: 'Internships', singular: 'Internship', icon: GraduationCap, description: 'Build experience and learn on the job.', style: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300', accent: 'bg-blue-500' },
  { key: 'scholarship', label: 'Scholarships', singular: 'Scholarship', icon: Award, description: 'Find support for your education.', style: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', accent: 'bg-amber-500' },
];
export const APPLICATION_STATUSES = [
  { key: 'pending', label: 'Pending review', style: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  { key: 'reviewed', label: 'Reviewed', style: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  { key: 'accepted', label: 'Accepted', style: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
  { key: 'declined', label: 'Declined', style: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300' },
];
export const referralType = type => REFERRAL_TYPES.find(item => item.key === type) || REFERRAL_TYPES[0];
export const applicationStatus = status => APPLICATION_STATUSES.find(item => item.key === status) || APPLICATION_STATUSES[0];
export const referralDate = value => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }) : '';
export const referralLink = value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
};
export const panel = 'rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900';
export const fieldStyle = 'mt-2 h-11 w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-[#009639] focus:ring-2 focus:ring-[#009639]/10 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:[color-scheme:dark]';
export const primaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#009639] px-4 text-xs font-semibold text-white transition hover:bg-[#007a2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009639] disabled:cursor-not-allowed disabled:opacity-50';
export const secondaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800';
