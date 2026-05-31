# Performance HQ

Media Buyer Dashboard — Next.js + Supabase.

## Deployment

1. Push this repo to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase publishable key (anon)
4. Deploy

## Local development

```bash
npm install
cp .env.example .env.local
# fill in the env vars
npm run dev
```
