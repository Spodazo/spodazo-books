# Spodazo Books

Flipbook library for children and adults. Public site has no login. `/admin` is password-protected so you can add books from PDFs, AI prompts, covers, and site colors.

Railway URL: https://spodazo-books-production.up.railway.app

The ChatGPT preview at books.spodazo.com stays as-is until DNS is cut over.

## Local

```bash
cp .env.example .env
# set ADMIN_PASSWORD and SESSION_SECRET
npm install
npm run dev
```

Opens on port 3001. Catalog is stored in `.books-data/catalog.json` until `DATABASE_URL` is set.

## Admin

1. Open `/admin`
2. Sign in with `ADMIN_PASSWORD`
3. Site Setup: logo, favicon, app name, colors
4. Add a book from PDF, or **Create AI book** from a prompt
5. For AI books: choose Children or Adults, optionally upload photos or caricatures, review the wording, then save (starts hidden)

Willow-style PDFs (art left, story text right) become illustration + overlay. Other layouts flip as full pages.

AI books need `OPENAI_API_KEY`. GPT writes the story; GPT Image draws caricatures and pages. GPT Image often requires OpenAI organization verification. Optional: `OPENAI_STORY_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY`.

## Railway

Create a **new** Railway project named **Spodazo Books**.

1. Deploy from the GitHub repo.
2. Add a **Postgres** plugin.
3. Add a **volume** mounted at `/data`.
4. Set variables:

```
ADMIN_PASSWORD=...
SESSION_SECRET=...
DATABASE_URL=${{Postgres.DATABASE_URL}}
BOOKS_DATA_DIR=/data/books
OPENAI_API_KEY=...
# OPENAI_STORY_MODEL=gpt-4o
# OPENAI_IMAGE_MODEL=gpt-image-1.5
# OPENAI_IMAGE_QUALITY=medium
```

5. Health check: `GET /api/version`
6. Custom domain: `books.spodazo.com` — add Railway’s CNAME + TXT on the **spodazo.com** zone (SiteGround today). Do not put this record on the spodazomusic.com Cloudflare zone.

## Stack

Express + React + Vite + Drizzle. PDF import uses Mozilla PDF.js. Postgres on Railway; JSON catalog locally.
