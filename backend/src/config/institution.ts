import fs from 'node:fs';
import path from 'node:path';

/**
 * Institution profile (white-label configuration).
 *
 * Everything that used to be hardcoded for "B.Tech engineering colleges" now lives here, so one
 * codebase can be deployed for a university, a school, a polytechnic, or an open community.
 *
 * Choose a preset with INSTITUTION_PRESET=engineering|university (default: engineering),
 * and/or override individual fields with a JSON file at INSTITUTION_CONFIG_PATH.
 * EMAIL_POLICY=edu|domains|open and ALLOWED_EMAIL_DOMAINS=a.edu,b.ac.in override the email rules.
 */

export type EmailPolicy = 'edu' | 'domains' | 'open';

export interface InstitutionProgram {
  name: string;
  code: string;
}

export interface InstitutionConfig {
  appName: string;
  networkLabel: string;
  tagline: string;
  programLabel: string;
  programs: InstitutionProgram[];
  years: string[];
  sections: string[];
  emailPolicy: EmailPolicy;
  allowedEmailDomains: string[];
  emailPlaceholder: string;
  emailHint: string;
  emailError: string;
}

const ENGINEERING: InstitutionConfig = {
  appName: 'Quad',
  networkLabel: 'Engineering Campus Network',
  tagline: 'Connect with verified peers across your engineering department and batch.',
  programLabel: 'Department',
  programs: [
    { name: 'Information Technology', code: 'IT' },
    { name: 'Computer Science & Engineering - Computer Science', code: 'CSE' },
    { name: 'Computer Science & Engineering - Data Science', code: 'DS' },
    {
      name: 'Computer Science & Engineering - Artificial Intelligence & Machine Learning',
      code: 'AI/ML',
    },
    { name: 'Computer Science & Engineering - Internet of Things', code: 'IoT' },
    { name: 'Civil Engineering', code: 'CE' },
    { name: 'Mechanical Engineering', code: 'ME' },
    { name: 'Electrical & Electronics Engineering', code: 'EEE' },
    { name: 'Electronics & Communication Engineering', code: 'ECE' },
  ],
  years: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
  sections: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  emailPolicy: 'edu',
  allowedEmailDomains: [],
  emailPlaceholder: 'student@btech.college.edu.in',
  emailHint:
    'Strictly verified college email (.edu or campus domain). Never displayed to peers on feeds or profiles.',
  emailError: 'A valid college email (.edu, .edu.in, .ac.in) is required to join Quad.',
};

const UNIVERSITY: InstitutionConfig = {
  ...ENGINEERING,
  networkLabel: 'University Campus Network',
  tagline: 'Connect with verified peers across your faculty, program, and year.',
  programLabel: 'Program',
  programs: [
    { name: 'Arts & Humanities', code: 'ARTS' },
    { name: 'Science', code: 'SCI' },
    { name: 'Commerce & Business', code: 'COM' },
    { name: 'Management (MBA)', code: 'MBA' },
    { name: 'Law', code: 'LAW' },
    { name: 'Medicine & Health Sciences', code: 'MED' },
    { name: 'Engineering & Technology', code: 'ENG' },
    { name: 'Education', code: 'EDU' },
    { name: 'Design & Architecture', code: 'DES' },
    { name: 'Other or undeclared', code: 'OTH' },
  ],
  years: ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Postgraduate'],
  sections: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
  emailPlaceholder: 'name@university.edu',
};

const PRESETS: Readonly<Record<string, InstitutionConfig>> = {
  engineering: ENGINEERING,
  university: UNIVERSITY,
};

function fail(message: string): never {
  throw new Error(`Invalid institution configuration: ${message}`);
}

function cleanString(value: unknown, field: string, max: number): string {
  const text = String(value ?? '').trim();
  if (!text) fail(`"${field}" must not be empty.`);
  if (text.length > max) fail(`"${field}" must be at most ${max} characters.`);
  return text;
}

function cleanList(value: unknown, field: string, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value) || value.length === 0) fail(`"${field}" must be a non-empty array.`);
  if (value.length > maxItems) fail(`"${field}" can have at most ${maxItems} entries.`);
  const out = value.map((v) => cleanString(v, field, maxLen));
  if (new Set(out).size !== out.length) fail(`"${field}" contains duplicate entries.`);
  return out;
}

export function validateInstitutionConfig(raw: Partial<InstitutionConfig>): InstitutionConfig {
  const base = { ...ENGINEERING, ...raw } as InstitutionConfig;

  const programsRaw = base.programs as unknown;
  if (!Array.isArray(programsRaw) || programsRaw.length === 0) {
    fail('"programs" must be a non-empty array of { name, code }.');
  }
  if (programsRaw.length > 60) fail('"programs" can have at most 60 entries.');
  const programs = programsRaw.map((p: unknown) => {
    const item = (p || {}) as Partial<InstitutionProgram>;
    return {
      name: cleanString(item.name, 'programs[].name', 90),
      code: cleanString(item.code, 'programs[].code', 12),
    };
  });
  if (new Set(programs.map((p) => p.name)).size !== programs.length) {
    fail('"programs" contains duplicate names.');
  }

  const emailPolicy = String(base.emailPolicy) as EmailPolicy;
  if (!['edu', 'domains', 'open'].includes(emailPolicy)) {
    fail('"emailPolicy" must be one of edu, domains, open.');
  }
  const allowedEmailDomains = (Array.isArray(base.allowedEmailDomains) ? base.allowedEmailDomains : [])
    .map((d) => String(d).trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  if (emailPolicy === 'domains' && allowedEmailDomains.length === 0) {
    fail('"allowedEmailDomains" is required when emailPolicy is "domains".');
  }

  return {
    appName: cleanString(base.appName, 'appName', 40),
    networkLabel: cleanString(base.networkLabel, 'networkLabel', 60),
    tagline: cleanString(base.tagline, 'tagline', 160),
    programLabel: cleanString(base.programLabel, 'programLabel', 30),
    programs,
    years: cleanList(base.years, 'years', 12, 30),
    sections: cleanList(base.sections, 'sections', 26, 6).map((s) => s.toUpperCase()),
    emailPolicy,
    allowedEmailDomains,
    emailPlaceholder: cleanString(base.emailPlaceholder, 'emailPlaceholder', 80),
    emailHint: cleanString(base.emailHint, 'emailHint', 200),
    emailError: cleanString(base.emailError, 'emailError', 200),
  };
}

export function loadInstitutionConfig(env: NodeJS.ProcessEnv = process.env): InstitutionConfig {
  const presetName = String(env.INSTITUTION_PRESET || 'engineering').trim().toLowerCase();
  const preset = PRESETS[presetName];
  if (!preset) {
    fail(`unknown INSTITUTION_PRESET "${presetName}" (use ${Object.keys(PRESETS).join(' or ')}).`);
  }

  let merged: Partial<InstitutionConfig> = { ...preset };
  let fileOverrides: Partial<InstitutionConfig> = {};

  const filePath = String(env.INSTITUTION_CONFIG_PATH || '').trim();
  if (filePath) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) fail(`INSTITUTION_CONFIG_PATH "${resolved}" does not exist.`);
    try {
      fileOverrides = JSON.parse(fs.readFileSync(resolved, 'utf8')) as Partial<InstitutionConfig>;
    } catch (err) {
      fail(`could not parse ${resolved}: ${(err as Error).message}`);
    }
    merged = { ...merged, ...fileOverrides };
  }

  const policyEnv = String(env.EMAIL_POLICY || '').trim().toLowerCase();
  if (policyEnv) merged.emailPolicy = policyEnv as EmailPolicy;
  const domainsEnv = String(env.ALLOWED_EMAIL_DOMAINS || '').trim();
  if (domainsEnv) {
    merged.allowedEmailDomains = domainsEnv.split(',');
    if (!policyEnv && merged.emailPolicy === 'edu') merged.emailPolicy = 'domains';
  }
  if (merged.emailPolicy === 'open') {
    if (!fileOverrides.emailPlaceholder) merged.emailPlaceholder = 'you@example.com';
    if (!fileOverrides.emailHint) {
      merged.emailHint = 'Use an email address you can access. It is never shown to other members.';
    }
    if (!fileOverrides.emailError) merged.emailError = 'Enter a valid email address.';
  }

  return validateInstitutionConfig(merged);
}

const EDU_EMAIL_REGEX =
  /^[a-z0-9._%+-]+@[a-z0-9.-]+\.(edu(\.[a-z]{2})?|ac\.[a-z]{2}|college\.[a-z.]+)$/i;
const OPEN_EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

export function isEmailAllowed(email: string, config: InstitutionConfig): boolean {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean || clean.length > 254) return false;
  if (config.emailPolicy === 'open') return OPEN_EMAIL_REGEX.test(clean);
  if (config.emailPolicy === 'domains') {
    if (!OPEN_EMAIL_REGEX.test(clean)) return false;
    const domain = clean.slice(clean.lastIndexOf('@') + 1);
    return config.allowedEmailDomains.some((d) => domain === d || domain.endsWith(`.${d}`));
  }
  return EDU_EMAIL_REGEX.test(clean);
}

export function publicInstitutionConfig(config: InstitutionConfig) {
  return {
    appName: config.appName,
    networkLabel: config.networkLabel,
    tagline: config.tagline,
    programLabel: config.programLabel,
    programs: config.programs.map((p) => p.name),
    years: config.years,
    sections: config.sections,
    emailPolicy: config.emailPolicy,
    emailPlaceholder: config.emailPlaceholder,
    emailHint: config.emailHint,
  };
}
