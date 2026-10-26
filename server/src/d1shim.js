// A just-enough D1 look-alike over node:sqlite (Node 22.13+), for the local dev server and the tests. Only the calls
// handler.js / summary.js use: prepare(sql).bind(...).run() / .all() / .first(). Numbered parameters (?1, ?2) are native.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

export function openDb(file = ':memory:') {
    const db = new DatabaseSync(file);
    db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
    return {
        raw: db,
        prepare(sql) {
            const st = db.prepare(sql);
            const make = (args) => ({
                bind: (...a) => make(a),
                run: async () => { const r = st.run(...args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
                all: async () => ({ results: st.all(...args).map((r) => ({ ...r })), success: true }),
                first: async () => { const r = st.get(...args); return r ? { ...r } : null; }
            });
            return make([]);
        }
    };
}
