# ♟️ Nova Chess

> AI-powered voice-controlled multiplayer chess platform built with React, TypeScript, and Supabase Realtime.

![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-green)
![Cloudflare](https://img.shields.io/badge/Deploy-Cloudflare-orange)

---

## ✨ Features

* 🎙️ Voice-controlled chess moves using the Web Speech API
* ♟️ AI opponent powered by Minimax + Alpha-Beta Pruning
* 🌐 Real-time multiplayer with Supabase Realtime
* 🔄 Optimistic state synchronization with PGN recovery
* 📜 Full chess-rule validation and move history
* 📱 Responsive modern UI for desktop and mobile
* ☁️ Production deployment on Cloudflare Workers

---

## 🧠 Architecture Highlights

### Voice Command Engine

Custom NLP parser converts natural speech into valid SAN chess notation with:

* homophone handling
* NATO phonetics support
* contextual move disambiguation

### Chess AI

* Minimax search
* Alpha-Beta Pruning
* Positional evaluation using piece-square tables
* Multiple difficulty levels

### Multiplayer System

* Supabase Postgres Realtime subscriptions
* Optimistic local updates
* PGN-based synchronization
* Reconnect-safe game state recovery

---

## 🛠️ Tech Stack

| Layer        | Technologies                   |
| ------------ | ------------------------------ |
| Frontend     | React 19, TypeScript, Vite     |
| Styling      | Tailwind CSS v4, Framer Motion |
| Backend      | Supabase Realtime + Postgres   |
| Chess Engine | chess.js                       |
| Deployment   | Cloudflare Workers             |

---

## 🚀 Local Setup

```bash
git clone https://github.com/Muzammil-msk/Nova-chess
cd Nova-chess
npm install
```

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
```

Run the development server:

```bash
npm run dev
```

---

## ☁️ Deployment

```bash
npm run build
npx wrangler deploy
```

---

## 📄 License

MIT
