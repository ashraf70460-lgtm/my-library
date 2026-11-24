# My Library — مكتبتي

A bilingual (Arabic / English) personal digital library and e-book reader: import EPUB, PDF, TXT, FB2, HTML and Markdown books, organise them by author, country and genre, read with a distraction-free reader, and keep highlights, notes, a reading journal and daily reading statistics.

Built with React, TypeScript, Tailwind CSS, PDF.js and IndexedDB.

## Develop
```bash
npm install
npm run dev
```

## Deploy
The repository is ready for Vercel: `vercel.json` sets the Vite build (`npm run build`, output `dist`). Every push to `main` deploys automatically once the repo is linked to a Vercel project.

## Where data lives
Books and reading data are stored in the browser (IndexedDB) on each device. Use **Settings → Backup & export** regularly. On your own domain the app can also reach Telegram (with your own bot token), direct book links and Open Library.
Claude-powered features (drafted profiles, recommendations) and account sync only work when the app runs inside Claude.
