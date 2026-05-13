#!/usr/bin/env node
/**
 * Internal write smoke test for the Cronograma module.
 *
 * Required environment variables:
 *   SUPABASE_URL=https://<project-ref>.supabase.co
 *   SUPABASE_ANON_KEY=<publishable/anon key> (preferred for browser parity)
 * Optional fallback:
 *   SUPABASE_SERVICE_ROLE_KEY=<service role key>
 *
 * The test creates a temporary project and a linked project_schedules row, verifies
 * the relationship, and deletes the temporary project (cascade removes schedule).
 */

const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if(!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(2);
}

const restBase = `${supabaseUrl}/rest/v1`;
const headers = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
};

async function request(path, options = {}) {
  const requestHeaders = { ...headers, ...(options.headers || {}) };
  Object.keys(requestHeaders).forEach((key) => requestHeaders[key] === undefined && delete requestHeaders[key]);
  const response = await fetch(`${restBase}/${path}`, {
    ...options,
    headers: requestHeaders
  });
  const text = await response.text();
  if(!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed: ${text || response.status}`);
  return text ? JSON.parse(text) : [];
}

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const projectCode = `CODX-SCHEDULE-${stamp}`;
let projectId = '';
let scheduleId = '';

try {
  const [project] = await request('projects', {
    method: 'POST',
    body: JSON.stringify({
      name: `Codex smoke schedule ${stamp}`,
      code: projectCode,
      project_code: projectCode,
      status: 'active',
      description: 'Temporary project created by internal Cronograma smoke test.'
    })
  });
  projectId = project?.id;
  if(!projectId) throw new Error('Project insert did not return an id.');

  const [schedule] = await request('project_schedules', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      name: 'Cronograma Smoke Test',
      version: 'test',
      schedule_status: 'draft',
      health_status: 'not_evaluated',
      description: 'Temporary schedule linked to smoke-test project.'
    })
  });
  scheduleId = schedule?.id;
  if(!scheduleId) throw new Error('Schedule insert did not return an id.');
  if(schedule.project_id !== projectId) throw new Error('Schedule was not linked to the created project.');

  const rows = await request(`project_schedules?select=id,project_id,name&id=eq.${encodeURIComponent(scheduleId)}&project_id=eq.${encodeURIComponent(projectId)}`, {
    method: 'GET',
    headers: { Prefer: undefined }
  });
  if(!Array.isArray(rows) || rows.length !== 1) throw new Error('Linked schedule verification query returned no row.');

  console.log(JSON.stringify({ ok: true, projectId, scheduleId }, null, 2));
} finally {
  if(projectId) {
    await request(`projects?id=eq.${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' }
    });
  }
}
