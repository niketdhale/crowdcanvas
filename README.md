# CrowdCanvas V1 — GitHub Pages + Supabase

## Stack
Vite + React + TypeScript, managed with **bun** (do not use npm). Supabase for storage and data.

## Development
```
bun install
bun run dev        # local dev server
bun run lint
bun run test:run
bun run build      # tsc -b && vite build -> dist/
bun run preview
```

Environment variables (optional; copy to `.env.local`). Defaults to the project's public values if unset:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (public anon/publishable key only, never `service_role`)

## 1. Create Supabase project
1. Create a project at https://supabase.com/dashboard.
2. Open SQL Editor -> New query.
3. Paste all of `supabase-setup.sql` and run it.
4. Go to Project Settings -> API (or Connect, depending on dashboard layout).
5. Copy the Project URL and the publishable/anon public key. Never use `service_role` or secret keys in browser code.

## 2. Configure the website
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` for local work. For deployment, add them as repository variables (Settings -> Secrets and variables -> Actions -> Variables); the workflow passes them to the build. Do not add a service-role key.

## 3. Deploy on GitHub Pages
1. Push to `main`; `.github/workflows/deploy.yml` builds with bun and deploys `dist/`.
2. Repository -> Settings -> Pages -> Build and deployment -> Source: **GitHub Actions** (not "Deploy from a branch").
3. `public/CNAME` is copied into `dist/` so the custom domain persists.

## 4. Connect crowdcanvas.workslab.in
1. In the repository Settings -> Pages, set Custom domain to `crowdcanvas.workslab.in` and save.
2. In your DNS provider for `workslab.in`, create a CNAME:
   - Type: `CNAME`
   - Host/Name: `crowdcanvas`
   - Target/Value: `YOUR-GITHUB-USERNAME.github.io` (replace with your actual GitHub Pages hostname; do not include `/crowdcanvas`).
3. Wait for DNS propagation. Then enable Enforce HTTPS in GitHub Pages when it becomes available.

## 5. Enable clickable poster links
1. In Supabase Dashboard -> SQL Editor, run `supabase-migration-poster-links.sql` to add the optional `target_url` column. Existing posters remain valid and their links stay blank.
2. The upload form now accepts an optional destination URL. Use a full `https://` or `http://` URL. Posters with a URL open the destination in a new tab when clicked; posters without one remain non-clickable.
3. The website only accepts HTTP(S) destinations and opens them with `rel="noopener noreferrer"` for safer new-tab behavior.

## 6. Enable moderation, reports and upload limits
1. In Supabase SQL Editor, run `supabase-migration-moderation.sql` (rewrites the `posters` policies: new uploads are `pending`, only `approved` posters are public; 3 reports auto-hide a poster; 5 uploads per IP per hour).
2. Supabase -> Authentication -> Users -> Add user (email + password). Copy its UUID and run `insert into public.admins values ('<uuid>');`.
3. Visit `/#admin`, sign in, then Approve / Hide / Delete queued and reported posters.

## 7. Test
- Open the deployed site in a private/incognito window.
- Upload a small JPG/PNG/WebP with a title.
- Refresh the page and open the URL on another device/browser. The poster should appear in the shared gallery.
- If uploads fail, check the browser console and Supabase Storage/Table policies.

## Important limits and security
- Uploads are moderated (section 6) and rate-limited per IP, but there is no CAPTCHA. Rejected uploads that hit the limit leave an orphaned image in storage.
- The displayed gallery currently fetches the latest 100 posters. The counter is therefore the number loaded (up to 100), not a reliable lifetime/global visitor count. Add a database count endpoint or RPC for an accurate count.
- Public uploads are not the same as secure monetization. Do not add payments until you have moderation, clear terms, and a reliable way to enforce the first-1,000 free slots.
- Never put Supabase `service_role` or secret keys in frontend JavaScript.
