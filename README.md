
# BEEP IM Web Frontend Client

A web-based frontend client for **BEEP IM**, focused on real-time messaging and collaboration.

---

## Release Notes

### v4.3
   add toggle to enable and disable the encryption for Secure Video Conference.
   fixed the issue of room leave disapearing and live location sharing.
   name character limit is 50 now
- Initial release

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





