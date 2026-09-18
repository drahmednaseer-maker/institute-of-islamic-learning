/* The courses the backend can edit.

   src/data/courses.mjs reads the override once, at import — right for the
   build, wrong for a server that has just saved a change. So this reads the
   file afresh and falls back to the courses that ship with the repo. */
import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { COURSES_FILE, DEFAULT_COURSE_LIST, ICON_NAMES } from '../../src/data/courses.mjs';

export { ICON_NAMES };

export const liveCourses = () => {
  let saved = null;
  try { saved = JSON.parse(readFileSync(COURSES_FILE, 'utf8')); } catch { /* nothing saved yet */ }
  const list = Array.isArray(saved?.courses) && saved.courses.length ? saved.courses : DEFAULT_COURSE_LIST;
  return {
    courses: list.map((c) => ({
      id: '', icon: 'book', name: '', arabic: '', short: '', menuBlurb: '', summary: '', intro: '',
      covers: [], tags: [], cta: 'Start free trial', formLabel: '', seo: '', onHome: true, inFooter: true, ...c,
    })),
    icons: ICON_NAMES,
    custom: !!saved,
    updated_at: saved?.updated_at || null,
  };
};

export const saveCourses = (courses) => {
  mkdirSync(dirname(COURSES_FILE), { recursive: true });
  writeFileSync(COURSES_FILE, JSON.stringify({ courses, updated_at: new Date().toISOString() }, null, 2));
};

export const clearCourses = () => { if (existsSync(COURSES_FILE)) rmSync(COURSES_FILE); };
export const hasCoursesOverride = () => existsSync(COURSES_FILE);
