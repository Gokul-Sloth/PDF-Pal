# PDF Pal 🦥

<div align="center">

**A fast, secure, and privacy-first web app for all your PDF needs.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/gokulkrish29/pdf-pal)

*Just the four essentials. Zero nonsense. Built for PDFs. Designed for you.*

</div>

---

## Preview

| Dark Mode | Light Mode |
|---|---|
| ![PDF Pal Dark Mode](./assets/Screenshot2.png) | ![PDF Pal Light Mode](./assets/Screenshot_.png) |

---

## Overview

**PDF Pal** runs entirely in your browser — no servers, no uploads, no tracking. It leverages WebAssembly (Ghostscript) and modern JavaScript libraries to give you powerful document tools with complete privacy.

## Features

-  **Compress PDF** — Drastically reduce file sizes while maintaining reading quality. Upload and compress multiple PDFs in one go.
-  **Merge PDFs** — Combine multiple documents into a single PDF with drag-and-drop reordering to arrange pages exactly how you want.
-  **Split PDF** — Extract specific page ranges from larger documents in seconds.
-  **Convert**
  - *PDF → Images*: Extract every page into high-quality PNGs or JPEGs.
  - *Images → PDF*: Combine multiple images into a unified, standardized PDF with drag-and-drop reordering before conversion.
-  **Dark Mode** — Respects your system preferences automatically.

##  Security & Privacy First

Your documents are your business.

| Guarantee | Details |
|---|---|
| **Zero Uploads** | Everything runs 100% locally on your device. No cloud, no servers, no data collection. |
| **Strict Validation** | Enforces 200MB size limits and uses magic-byte validation (`%PDF-`) to reject corrupted or malicious files. |
| **Orphaned Thread Protection** | Web Workers are explicitly garbage-collected after every operation to keep your browser running fast. |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- npm or yarn

### Run Locally

```bash
git clone https://github.com/Gokul-Sloth/PDF-Pal.git
cd PDF-Pal
npm install
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

---

##  Docker

Run PDF Pal in a container — no Node.js required on the host. The Docker image supports **multi-architecture** (`linux/amd64` and `linux/arm64`) out of the box, meaning it runs natively on standard x86 servers, Apple Silicon (M1/M2/M3), and AWS Graviton without any changes!

### Quick Start

```bash
# Pull and run from Docker Hub (automatically fetches your system's architecture)
docker pull gokulkrish29/pdf-pal:latest
docker run -d -p 5173:80 --name pdf-pal gokulkrish29/pdf-pal:latest
```

Open **http://localhost:5173** in your browser.

### Build from Source

If you want to build the single-architecture image for your local environment:
```bash
# Build the image
docker build -t pdf-pal .

# Run the container
docker run -d -p 5173:80 --name pdf-pal pdf-pal
```

### Multi-Architecture Build (ARM64 & x86_64)

To build and push a multi-architecture image (like the one hosted on Docker Hub) for multiple platforms simultaneously, use `docker buildx`:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t your-username/pdf-pal:latest --push .
```

### Docker Compose

```bash
# Start
docker compose up -d

# Stop
docker compose down
```
##  Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS |
| **PDF Manipulation** | `pdf-lib` — document properties & generation |
| **Rendering** | `pdfjs-dist` (PDF.js) — canvas rendering & image extraction |
| **Compression / Merge / Split** | Ghostscript WebAssembly (`gs-worker.wasm`) — native-grade processing in the browser |
| **Production Serving** | Nginx (Alpine) via Docker |

## Project Structure

```
PDF-Pal/
├── public/                   # Static assets (favicons, manifest)
├── src/
│   ├── components/           # Reusable UI components
│   ├── lib/
│   │   ├── background-worker.js
│   │   ├── gs-worker.js      # Ghostscript Emscripten module
│   │   ├── gs-worker.wasm    # Ghostscript WebAssembly binary
│   │   ├── pdfjs-to-images.js
│   │   └── worker-init.js
│   ├── utils/                # Utility functions
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── Dockerfile                # Multi-stage build (Node → Nginx)
├── docker-compose.yml        # Production compose config
├── nginx.conf                # Nginx config (SPA, WASM, caching)
├── .dockerignore
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## Deployment Notes

The `base` path in `vite.config.js` is configurable via the `VITE_BASE_PATH` environment variable:

| Target | Base Path | How |
|---|---|---|
| **Docker** (default) | `/` | No env var needed |
| **GitHub Pages** | `/PDF-Pal/` | `VITE_BASE_PATH=/PDF-Pal/ npm run build` |

## Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

##  License

Code licensed under **AGPLv3** (2026).

This project is licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) — see the [LICENSE](LICENSE) file for details.

Ghostscript is released by Artifex under AGPLv3. Learn more at [ghostscript.com](https://www.ghostscript.com/).

