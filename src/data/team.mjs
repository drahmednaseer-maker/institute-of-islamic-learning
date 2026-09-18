import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/* The "Our teachers" section of the about page — the only place the public
   meets the tutors. It is deliberately separate from the tutor registry in the
   backend, which holds phone numbers, rates and private notes that must never
   reach a web page. Like the courses, the admin panel writes an override next
   to the database; what follows are the defaults that ship with the repo. */
const here = dirname(fileURLToPath(import.meta.url));
export const TEAM_FILE = process.env.IIL_TEAM_FILE
  || join(process.env.IIL_DATA_DIR || join(here, '..', '..', 'admin', 'data'), 'team.json');

const DEFAULT_TEAM = {
  eyebrow: 'Our teachers',
  heading: 'Specialists, matched to your goal',
  lead: 'Every tutor holds a formal qualification and passes a recitation audition, a teaching demonstration and a background check before their first class.',
  cta: 'Meet your tutor free',
  members: [
    {
      initial: 'ق', name: 'Qari Abdullah', role: 'Tajweed & Ijazah',
      bio: 'Ijazah in Hafs ’an ’Asim with a connected sanad. Twelve years teaching adult beginners in the UK and USA.',
    },
    {
      initial: 'أ', name: 'Ustadha Ayesha', role: 'Kids & Noorani Qaida',
      bio: 'Specialist in teaching four to nine-year-olds. Trained in phonics-based Arabic instruction for non-native speakers.',
    },
    {
      initial: 'ح', name: 'Hafiz Usman', role: 'Hifz & Revision',
      bio: 'Hafiz at fourteen; now supervises long-term memorisation plans and the sabqi–manzil revision cycle.',
    },
    {
      initial: 'ف', name: 'Ustadha Fatimah', role: 'Arabic & Tafsir',
      bio: 'MA in Arabic Linguistics, Al-Azhar. Teaches grammar and Tafsir to adult students in English and Arabic.',
    },
  ],
};

export const DEFAULT_TEAM_DATA = DEFAULT_TEAM;

let saved = null;
try { saved = JSON.parse(readFileSync(TEAM_FILE, 'utf8')); } catch { /* nothing saved yet */ }

export const TEAM = {
  ...DEFAULT_TEAM,
  ...(saved || {}),
  members: (Array.isArray(saved?.members) && saved.members.length ? saved.members : DEFAULT_TEAM.members)
    .map((m) => ({ initial: '', name: '', role: '', bio: '', ...m }))
    .map((m) => ({ ...m, initial: m.initial || (m.name || '?').trim()[0] })),
};
export const TEAM_CUSTOM = !!saved;
export const TEAM_UPDATED_AT = saved?.updated_at || null;
