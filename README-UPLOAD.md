# BUGOUT Split Upload

Upload this whole folder to the GitHub repo root, replacing the old single `index.html`.

Required files/folders:

- `index.html`
- `assets/css/styles.css`
- `assets/js/app.js`
- `api/groq.js`
- `supabase-arena-schema.sql` is not deployed by Vercel, but keep it in the repo as setup documentation.
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

## Supabase AI Teacher SQL

Run `supabase-teacher-schema.sql` once in Supabase SQL Editor so AI Teacher can save lesson scores and progress.
