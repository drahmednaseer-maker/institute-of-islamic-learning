import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Every course the site offers, in the order they appear. build.mjs turns this
   into the courses page, the home grid, both menus, the footer column, the
   booking form, the fee calculator and the search-engine listing — so a course
   is described once and shows up everywhere.

   Like the fee plans, the admin panel writes an override next to the database;
   the figures here are the defaults that ship with the repo. */
const here = dirname(fileURLToPath(import.meta.url));
export const COURSES_FILE = process.env.IIL_COURSES_FILE
  || join(process.env.IIL_DATA_DIR || join(here, '..', '..', 'admin', 'data'), 'courses.json');

/* A fixed set of line icons — the admin panel picks one by name, since an SVG
   path is not something anyone should have to type. */
export const ICONS = {
  book: 'M21 5c-1.9-.9-4-1.4-6-1.4S11 4.1 9 5v14c2-.9 4-1.4 6-1.4s4.1.5 6 1.4zM3 5v14c1.9-.9 3-1.4 5-1.4V3.6C6 3.6 4.9 4.1 3 5',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3m7 9a7 7 0 0 1-6 6.9V22h-2v-3.1A7 7 0 0 1 5 12h2a5 5 0 0 0 10 0z',
  shield: 'M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6zm3.5 7.6-4.3 4.3a1 1 0 0 1-1.4 0L7.6 11.7 9 10.3l1.5 1.5 3.6-3.6z',
  cube: 'M12 2 3 7v10l9 5 9-5V7zm0 4.2 5.2 2.9L12 12l-5.2-2.9zM5 9.8l6 3.4v5.9l-6-3.3zm8 9.3v-5.9l6-3.4v6z',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M4.3 13h3.2c.1 1.9.5 3.7 1.1 5.2A8 8 0 0 1 4.3 13m3.2-2H4.3a8 8 0 0 1 4.3-5.2c-.6 1.5-1 3.3-1.1 5.2m8.9 0c-.1-1.9-.5-3.7-1.1-5.2A8 8 0 0 1 19.7 11zm-2 0H9.6c.1-2.1.6-4 1.4-5.3.3-.5.7-.7 1-.7s.7.2 1 .7c.8 1.3 1.3 3.2 1.4 5.3m0 2c-.1 2.1-.6 4-1.4 5.3-.3.5-.7.7-1 .7s-.7-.2-1-.7c-.8-1.3-1.3-3.2-1.4-5.3zm2 0h3.3a8 8 0 0 1-4.4 5.2c.6-1.5 1-3.3 1.1-5.2',
  chat: 'M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-4 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m3 4v2h10V8zm0 4v2h7v-2z',
  star: 'M12 2 9.5 8.5 3 9.6l4.8 4.4-1.3 6.6L12 17.4l5.5 3.2-1.3-6.6L21 9.6l-6.5-1.1z',
  badge: 'M12 2 4 5.5v5.9c0 4.6 3.4 8.9 8 10.1 4.6-1.2 8-5.5 8-10.1V5.5zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6m0 8c2.2 0 4 1.1 4 2.4V18H8v-1.6c0-1.3 1.8-2.4 4-2.4',
  pen: 'M3 17.2V21h3.8L17.8 10 14 6.2zm17.7-10.5a1 1 0 0 0 0-1.4l-2-2a1 1 0 0 0-1.4 0l-1.8 1.8L19.3 8.9z',
  heart: 'M12 21s-7.5-4.6-9.3-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.3 12c-1.8 4.4-9.3 9-9.3 9',
};
export const ICON_NAMES = Object.keys(ICONS);

const DEFAULT_COURSES = [
  {
    id: 'qaida', icon: 'book', name: 'Noorani Qaida', arabic: 'القاعدة النورانية', short: 'Noorani Qaida',
    menuBlurb: 'Letters, sounds & the first steps',
    summary: 'The proper foundation: Arabic letters, their shapes, sounds and joins — taught slowly until each one is effortless.',
    intro: 'The classical starting point. Students learn every Arabic letter in isolation and in its joined forms, then move through harakat, sukoon, tanween, madd and the first short surahs.',
    covers: ['Letter recognition, articulation points and joining', 'Vowels, tanween, sukoon, shaddah and madd', 'First surahs read independently by the end'],
    tags: ['Complete beginners', 'Ages 4+', '3–6 months'],
    cta: 'Start free trial', formLabel: 'Noorani Qaida (Beginners)',
    seo: 'Arabic letters, their shapes, sounds and joins, through to reading the first short surahs.',
    onHome: true, inFooter: true,
  },
  {
    id: 'reading', icon: 'mic', name: 'Quran Reading (Nazra)', arabic: 'ناظرة القرآن', short: 'Quran Reading',
    menuBlurb: 'Fluent, accurate recitation',
    summary: 'Read from the Mushaf with confidence and accuracy, moving from short surahs to fluent reading of any page.',
    intro: 'Read directly from the Mushaf with accuracy and flow. Daily guided recitation with immediate correction builds the confidence to open any page and read it well.',
    covers: ['Guided recitation with live correction every class', 'Fluency drills, waqf signs and pacing', 'Complete Nazra of the whole Quran'],
    tags: ['All ages', 'Core course', 'Ongoing'],
    cta: 'Start free trial', formLabel: 'Quran Reading (Nazra)',
    seo: 'Fluent, accurate reading directly from the Mushaf with live correction.',
    onHome: true, inFooter: true,
  },
  {
    id: 'tajweed', icon: 'shield', name: 'Tajweed Mastery', arabic: 'أحكام التجويد', short: 'Tajweed',
    menuBlurb: 'Rules, makharij & practice',
    summary: 'Makharij, sifaat, ghunnah, madd and the stopping rules — explained clearly, then drilled until they become habit.',
    intro: 'The science of reciting as it was revealed. Rules are taught with theory and then drilled in your own recitation until they become automatic rather than remembered.',
    covers: ['Makharij al-huroof and sifaat', 'Noon & meem sakinah, ghunnah, qalqalah, madd', 'Rules of waqf, ibtida and lahn correction'],
    tags: ['Intermediate', 'Teens & adults', '6–12 months'],
    cta: 'Start free trial', formLabel: 'Tajweed Mastery',
    seo: 'Makharij, sifaat, ghunnah, madd and the rules of stopping, drilled into practice.',
    onHome: true, inFooter: true,
  },
  {
    id: 'hifz', icon: 'cube', name: 'Hifz & Memorisation', arabic: 'حفظ القرآن الكريم', short: 'Hifz',
    menuBlurb: 'Structured plan with revision',
    summary: 'A realistic daily portion, a disciplined revision cycle, and a teacher who tests you properly. Juz Amma to the full Quran.',
    intro: 'Memorisation that lasts. A daily sabaq portion, a sabqi cycle for recent pages and a manzil cycle for older ones — tested honestly by a teacher who will not let weak pages pass.',
    covers: ['Realistic daily portion set to the student’s capacity', 'Structured sabqi and manzil revision cycles', 'Juz Amma, selected surahs, or the complete Quran'],
    tags: ['Committed students', 'Daily classes', 'Long-term'],
    cta: 'Start free trial', formLabel: 'Hifz & Memorisation',
    seo: 'Structured daily memorisation with sabqi and manzil revision cycles.',
    onHome: true, inFooter: true,
  },
  {
    id: 'translation', icon: 'globe', name: 'Translation & Tafsir', arabic: 'الترجمة والتفسير', short: 'Translation',
    menuBlurb: 'Understand what you recite',
    summary: 'Word-by-word meaning and the context of revelation, so recitation becomes reflection rather than repetition.',
    intro: 'Move from reciting to understanding. Word-by-word translation paired with the context of revelation, classical commentary and the lessons each passage carries.',
    covers: ['Word-by-word meaning and root vocabulary', 'Asbab al-nuzul and thematic links between surahs', 'Practical reflection you can apply the same week'],
    tags: ['Adults', 'Weekly', 'English or Urdu'],
    cta: 'Start free trial', formLabel: 'Translation & Tafsir',
    seo: 'Word-by-word meaning, context of revelation and classical commentary.',
    onHome: true, inFooter: false,
  },
  {
    id: 'arabic', icon: 'chat', name: 'Arabic Language', arabic: 'اللغة العربية', short: 'Arabic',
    menuBlurb: 'Read, write and speak',
    summary: 'Modern Standard and Quranic Arabic — reading, writing, grammar and conversation, built up week by week.',
    intro: 'Classical and Modern Standard Arabic taught together, so students can read the Quran’s language and hold a conversation in it.',
    covers: ['Reading, handwriting and core vocabulary', 'Nahw and sarf explained without jargon', 'Weekly speaking practice with a native tutor'],
    tags: ['Kids & adults', 'Speaking practice', 'Beginner to advanced'],
    cta: 'Start free trial', formLabel: 'Arabic Language',
    seo: 'Reading, writing, grammar and conversation in Classical and Modern Standard Arabic.',
    onHome: true, inFooter: true,
  },
  {
    id: 'islamic-studies', icon: 'star', name: 'Islamic Studies for Kids', arabic: 'الدراسات الإسلامية', short: 'Islamic Studies',
    menuBlurb: 'Duas, Seerah, Fiqh basics',
    summary: 'How to pray, the daily duas, the life of the Prophet ﷺ and the manners that sit at the heart of the deen.',
    intro: 'The essentials every child should grow up with — how to pray, the daily duas, the life of the Prophet ﷺ, and the manners that sit at the heart of the deen.',
    covers: ['Wudu, salah and the pillars, taught step by step', 'Everyday duas, Seerah stories and akhlaq', 'Age-appropriate Aqeedah and Fiqh basics'],
    tags: ['Ages 5–14', 'Engaging format', 'Weekly'],
    cta: 'Start free trial', formLabel: 'Islamic Studies for Kids',
    seo: 'Salah, daily duas, Seerah and akhlaq taught for ages five to fourteen.',
    onHome: false, inFooter: false,
  },
  {
    id: 'ijazah', icon: 'badge', name: 'Ijazah Programme', arabic: 'الإجازة بالسند', short: 'Ijazah',
    menuBlurb: 'Certified sanad with isnad',
    summary: 'Full recitation to a certified sheikh, leading to an Ijazah with an unbroken chain of narration.',
    intro: 'For students who have completed Hifz and mastered Tajweed: full recitation to a certified sheikh, leading to an Ijazah with an unbroken chain of narration back to the Prophet ﷺ.',
    covers: ['Hafs ’an ’Asim, with other qira’at on request', 'Full recitation from memory to a certified sheikh', 'Written sanad issued on completion'],
    tags: ['Advanced', 'By assessment', 'Certified sanad'],
    cta: 'Request assessment', formLabel: 'Ijazah Programme',
    seo: 'Full Quran recitation to a certified sheikh, leading to an Ijazah with a connected chain.',
    onHome: false, inFooter: true,
  },
];

export const DEFAULT_COURSE_LIST = DEFAULT_COURSES;

let saved = null;
try { saved = JSON.parse(readFileSync(COURSES_FILE, 'utf8')); } catch { /* nothing saved yet */ }

const normalise = (c) => ({
  id: 'course', icon: 'book', name: '', arabic: '', short: '', menuBlurb: '', summary: '', intro: '',
  covers: [], tags: [], cta: 'Start free trial', formLabel: '', seo: '', onHome: true, inFooter: true,
  ...c,
  short: c.short || c.name,
  formLabel: c.formLabel || c.name,
});

export const COURSES = (Array.isArray(saved?.courses) && saved.courses.length ? saved.courses : DEFAULT_COURSES).map(normalise);
export const COURSES_CUSTOM = !!saved;
export const COURSES_UPDATED_AT = saved?.updated_at || null;
export const iconPath = (name) => ICONS[name] || ICONS.book;
