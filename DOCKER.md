# Free GST Billing Software — Docker Infrastructure Guide

Run the Free GST Billing Software anywhere with Docker & Docker Compose with a single command. No need to install Node.js, npm, or local build dependencies on your host operating system.

---

## Quick Start (One Command)

From the project root, simply run:

```bash
docker compose up -d --build
```

Once started, open your web browser and navigate to:
👉 **[http://localhost:47371](http://localhost:47371)**

---

## 1-Click Launch on Windows

If you are on Windows, you can double-click either:
- **`Docker FreeGSTBill.bat`** — Starts the Docker stack in the background and opens your browser directly to `http://localhost:47371`.
- **`Stop Docker FreeGSTBill.bat`** — Stops the container cleanly.

---

## Key Features & Architecture

- **Multi-Stage Build**:
  - Compiles the React + Vite frontend and bundles offline Tesseract assets in the builder stage.
  - Generates a minimal, hardened `node:20-alpine` production image.
- **Security Hardened**:
  - Runs as an unprivileged `node` non-root user.
  - Keeps all network connections contained.
  - Strict CORS validation with optional `.env` override.
- **Persistent Data**:
  - Automatically mounts `./data` on the host to `/app/data` in the container.
  - All invoices (`data/bills`), profiles (`data/profiles`), clients (`data/clients`), templates, recurring bills, and automated daily backups (`data/backups`) remain on your computer and survive container restarts or image updates.
- **Built-in Healthcheck**:
  - Automatically monitors `/api/health` every 30 seconds.

---

## Managing the Container

### View Logs
```bash
docker compose logs -f
```

### Check Container Status
```bash
docker compose ps
```

### Stop the Application
```bash
docker compose down
```

### Restart the Application
```bash
docker compose restart
```

---

## Configuration (`.env`)

You can customize the deployment by creating a `.env` file from the provided `.env.example`:

```bash
cp .env.example .env
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `47371` | Port on the host machine to access the web app. |
| `ALLOWED_ORIGINS` | *(empty)* | Optional regex for allowed origins if accessing via LAN IP or custom domain. E.g., `*` or `^https?://192\.168\..*`. |

---

## Data Backup & Migration

Because your data is stored in the host `./data` directory:
- **To Back Up**: Simply copy or zip the `./data` folder on your computer.
- **To Migrate**: Copy the `./data` folder to your new computer and run `docker compose up -d`. All your invoices and settings will be loaded immediately.
