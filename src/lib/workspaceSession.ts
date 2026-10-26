import type { Session, SupabaseClient } from '@supabase/supabase-js';
const pending = new WeakMap<SupabaseClient, Promise<Session>>();
/** Guest identity isolates saved research without imposing a login or payment flow. */
export async function workspaceSession(client: SupabaseClient): Promise<Session> {
  let operation = pending.get(client);
  if (!operation) {
    operation = (async () => {
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error('Workspace session is unavailable. Please retry.');
      if (data.session) return data.session;
      const guest = await client.auth.signInAnonymously();
      if (guest.error || !guest.data.session) throw new Error('Guest access is unavailable. Enable anonymous sign-ins in Supabase Auth.');
      return guest.data.session;
    })();
    pending.set(client, operation);
    const active = operation;
    void active.finally(() => { if (pending.get(client) === active) pending.delete(client); }).catch(() => {});
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Workspace session timed out. Please retry.')), 15000);
    })]);
  } finally { clearTimeout(timer); }
}
