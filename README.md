# ♛ Nova Chess 🎤♟️

**Nova Chess** is a voice-controlled chess platform where players can command moves using natural speech, compete against an AI opponent, or play real-time multiplayer matches.

Built as an interactive system combining **speech recognition, algorithmic decision-making, and real-time communication**, Nova Chess demonstrates the integration of modern frontend engineering with core computer science concepts.

---

## 🚀 Key Highlights

* 🎙️ Voice-controlled gameplay using Web Speech API
* 🤖 AI opponent powered by **Minimax + Alpha-Beta pruning**
* 🌐 Real-time multiplayer using WebSockets
* ♟️ Full chess rules implemented via `chess.js`
* 🎨 Modern responsive UI with React + Tailwind

---

## ✨ Features

### 🎤 Voice Control

* Play using natural commands:

  * `"e2 to e4"`
  * `"knight f3"`
  * `"castle kingside"`
* Flexible speech parsing
* Manual fallback input for reliability

---

### 🤖 AI Opponent

* Difficulty levels:

  * **Easy** → random + shallow moves
  * **Medium** → tactical play
  * **Hard** → deeper strategic search
* Uses **Minimax with Alpha-Beta pruning**

---

### 👥 Multiplayer Mode

* Join rooms via **Room ID**
* Real-time synchronized gameplay
* Automatic role assignment (White / Black)

---

### ♟️ Game Engine

* Complete chess rules:

  * Castling
  * En passant
  * Promotion
  * Check / Checkmate / Draw

---

### 🎨 UI & UX

* Dark neon-themed interface
* Smooth board interactions
* Move history & captured pieces
* Voice + manual hybrid control

---

## 🎤 Voice Commands

| Command                  | Action       |
| ------------------------ | ------------ |
| `e2 to e4`               | Move piece   |
| `knight to f3`           | Knight move  |
| `queen takes d5`         | Capture      |
| `castle kingside`        | Short castle |
| `castle queenside`       | Long castle  |
| `e7 to e8 promote queen` | Promotion    |

Supports:

* Piece names (king, queen, knight, pawn, etc.)
* NATO phonetics (alpha, bravo, charlie…)
* Number words (one, two, three…)

---

## 🧠 Algorithms & DSA Concepts

Nova Chess integrates core algorithmic techniques for intelligent gameplay:

* **Minimax Algorithm**
  Recursively explores possible game states to determine optimal moves.

* **Alpha-Beta Pruning**
  Eliminates unnecessary branches in the search tree, improving performance.

* **Game State Evaluation**
  Uses heuristic scoring based on material balance and positional advantage.

* **State Transition Modeling**
  Represents chess as a dynamic system evolving through legal moves.

These concepts demonstrate practical use of **recursion, tree traversal, and optimization techniques**.

---

## 🛠️ Tech Stack

* **Frontend:** React 19, Vite 7, Tailwind CSS
* **Routing:** TanStack Router
* **Chess Logic:** chess.js
* **Board UI:** react-chessboard
* **Voice Recognition:** Web Speech API
* **Backend:** WebSockets (real-time multiplayer)
* **Deployment:** Cloudflare Workers

---

## ⚙️ Setup & Installation

### 1️⃣ Clone the repository

```bash
git clone https://github.com/Muzammil-msk/Nova-chess.git
cd Nova-chess
```

### 2️⃣ Install dependencies

```bash
npm install
```

### 3️⃣ Run the project

```bash
npm run dev
```

👉 Open in browser:

```
http://localhost:8080/
```

---

## 🧠 AI Implementation

The AI engine is based on:

* **Minimax Algorithm**
* **Alpha-Beta Pruning**

Evaluation considers:

* Material balance
* Positional advantage
* Game-ending conditions

| Difficulty | Depth | Behavior       |
| ---------- | ----- | -------------- |
| Easy       | 1     | Random + basic |
| Medium     | 2     | Tactical       |
| Hard       | 3     | Strategic      |

---

## 🎙️ Voice System Notes

* Built using `webkitSpeechRecognition`
* Continuous listening with controlled restart
* Handles:

  * network errors
  * permission issues
* Provides manual input fallback

> ⚠️ Works best in Chrome / Edge
> May not function in embedded previews (iframes)

---

## 📁 Project Structure

```
src/
├── components/
│   ├── ChessGame.tsx
│   ├── MultiplayerGame.tsx
│   ├── VoicePanel.tsx
│   ├── MoveHistory.tsx
│   └── CapturedPieces.tsx
├── hooks/
│   └── use-speech-recognition.ts
├── lib/
│   ├── chess-ai.ts
│   └── voice-parser.ts
└── routes/
    ├── index.tsx
    ├── lobby.tsx
    └── play.$roomId.tsx
```

---

## 🔐 Security

* Voice processing runs entirely in-browser
* No audio data is transmitted externally
* Multiplayer state handled securely via backend

---

## 👨‍💻 Author

**Muzammil Shaik (MSK)**
Focused on building **real-time, AI-driven web applications**

---

## 📌 Project Status

🚧 Actively improving — working on AI enhancements, voice stability, and UI refinements

---

## ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub!
