
# BEEP IM Web Frontend Client

A web-based frontend client for **BEEP IM**, focused on real-time messaging and collaboration.

---

## 🚀 Features

### 💬 Messaging
- One-to-one chat
- Group chat (rooms)
- Threaded replies
- Message editing & deletion
- Emoji reactions
- Message search
- Pinned messages

---

### 🏠 Rooms & Spaces
- Public and private rooms
- Room invites, kick, ban
- User roles (Admin / Moderator / Member)
- Spaces (room categorization)

---

### 👤 Presence & Status
- Online / Offline / Away indicators
- Typing indicators
- Read receipts
- Custom status message

---

### 📎 Media & File Sharing
- File uploads (documents, archives)
- Image sharing with preview
- Video sharing (playback only)
- Audio messages (record & send, no live calls)

---

### 🔒 Security & Privacy
- End-to-end encryption (E2EE)
- Multi-device synchronization
- User blocking & reporting

---

### 🔔 Notifications
- Browser notifications
- Per-room mute settings
- Mentions and keyword alerts

---

### 🎨 UI / UX (Element Web–like)
- Light / Dark mode
- Responsive design (Desktop & Mobile Web)
- Keyboard shortcuts
- Sidebar room navigation
- Room details panel (members, files, settings)

---

## 🛠️ Tech Stack (Example)
- Frontend: React / Vue / Svelte
- State Management: Redux / Zustand / Pinia
- Styling: CSS Modules / Tailwind
- Backend Protocol: BEEP IM
- Encryption: Custom / Standard E2EE libraries


## 💻 Installation & Setup

### Run Locally

To run the web application locally, execute the following commands:

```bash
npm install && npm run build && npx serve webapp
```

---

## 🚀 Production Deployment

To deploy the application in a production environment, follow these steps:

1. **Navigate to the deployment directory:**
   ```bash
   cd root/element-callcur/beep_im
   ```

2. **Update Public Assets:**
   Replace the contents of the `public` folder with the content of the `webapp` folder generated during the build process.

3. **Rebuild and Run Docker Container:**
   Execute the following commands to restart the service:
   ```bash
   docker compose down element-web
   docker compose build element-web
   docker compose up -d element-web
   ```





