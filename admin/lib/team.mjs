/* The public "Our teachers" section, editable from the backend.

   Kept apart from the tutor registry on purpose: that table holds phone
   numbers, rates and private notes, none of which belong on a web page. */
import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { TEAM_FILE, DEFAULT_TEAM_DATA } from '../../src/data/team.mjs';

export const liveTeam = () => {
  let saved = null;
  try { saved = JSON.parse(readFileSync(TEAM_FILE, 'utf8')); } catch { /* nothing saved yet */ }
  const members = Array.isArray(saved?.members) && saved.members.length ? saved.members : DEFAULT_TEAM_DATA.members;
  return {
    ...DEFAULT_TEAM_DATA,
    ...(saved || {}),
    members: members.map((m) => ({ initial: '', name: '', role: '', bio: '', ...m })),
    custom: !!saved,
    updated_at: saved?.updated_at || null,
  };
};

export const saveTeam = (team) => {
  mkdirSync(dirname(TEAM_FILE), { recursive: true });
  writeFileSync(TEAM_FILE, JSON.stringify({ ...team, updated_at: new Date().toISOString() }, null, 2));
};

export const clearTeam = () => { if (existsSync(TEAM_FILE)) rmSync(TEAM_FILE); };
export const hasTeamOverride = () => existsSync(TEAM_FILE);
