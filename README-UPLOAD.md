# BUGOUT Split Upload

Upload this whole folder to the GitHub repo root, replacing the old single `index.html`.

Required files/folders:

- `index.html`
- `assets/css/styles.css`
- `assets/js/app.js`
- `api/groq.js`
- `supabase-arena-schema.sql` is not deployed by Vercel, but keep it in the repo as setup documentation.
- `supabase-admin-schema.sql` is not deployed by Vercel, but run it once to enable admin roles.
- `supabase-missions-schema.sql` is not deployed by Vercel, but run it once to enable BUGOUT Missions.
- `supabase-teacher-schema.sql` is not deployed by Vercel, but run it once for AI Teacher progress.

## Vercel Environment Variable

Add this in Vercel:

```text
GROQ_API_KEY=your_groq_api_key_here
```

Then redeploy the project.

The browser no longer contains the Groq secret key. All AI calls go through `/api/groq`.

## Supabase Arena SQL

Run `supabase-arena-schema.sql` once in Supabase SQL Editor if Coding Arena tables/columns are missing.

## Supabase Admin SQL

Run `supabase-admin-schema.sql` once in Supabase SQL Editor. Before running, replace `YOUR_EMAIL_HERE` with the email of the account that should become admin.

## Supabase Missions SQL

Run `supabase-missions-schema.sql` once in Supabase SQL Editor so BUGOUT Missions can save missions, teams, task progress, judged submissions, votes, and certificates.

## Supabase AI Teacher SQL

Run `supabase-teacher-schema.sql` once in Supabase SQL Editor so AI Teacher can save lesson scores and progress.

AI Teacher now also works in guest mode with browser-local progress. Signed-in users get Supabase memory, progress, sessions, RAG document metadata, achievements, and classroom tables. Full live AI streaming requires deploying through Vercel or another serverless runtime where `/api/groq` is available and `GROQ_API_KEY` is configured.
