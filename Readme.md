# PDF Pal 🦥

**PDF Pal** is a fast, secure, and privacy-first web application for all your PDF needs. Running directly in your browser, it leverages WebAssembly (Ghostscript) and modern JavaScript libraries to give you powerful document tools without ever sending your files to a server.

*Just the four essentials. Zero nonsense. Built for PDFs. Designed for you.*

## Features

- ** Compress PDF**: Drastically reduce your file sizes while maintaining reading quality.
- ** Merge PDFs**: Easily combine multiple documents or images into a single PDF with beautiful drag-and-drop file reordering.
- ** Split PDF**: Extract specific page ranges out of larger documents in seconds.
- ** Convert**: 
  - *PDF to Images*: Extract every page of your document into high-quality PNGs or JPEGs.
  - *Images to PDF*: Combine multiple scattered images into a unified, standardized PDF document.
- ** Dark Mode**: Beautiful UI that perfectly respects your system preferences.

##  Security & Privacy First

We believe your documents are your business.
- **Zero Uploads**: Everything happens 100% locally on your device. No cloud storage, no servers, no data collection.
- **Strict File Validation**: Enforces strict 200MB size limits and uses magic-byte validation (`%PDF-`) to prevent corrupted or malicious uploads.
- **Orphaned Thread Protection**: Web Workers are explicitly garbage-collected and destroyed after every operation to keep your browser running fast.

## Getting Started

To run the project locally:

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

##  Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **PDF Processing**: 
  - `pdf-lib` for document properties and generation.
  - `pdfjs-dist` (PDF.js) for canvas rendering and image extraction.
  - **Ghostscript WebAssembly** (`pdf-compress.wasm`) for native-grade compression, merging, and splitting directly in the browser.

##  License

Code licensed under **AGPLv3** (2026).

This project is licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html) – see the [LICENSE](LICENSE) file for details.

Ghostscript is released by Artifex under AGPLv3 and can be found [here](https://www.ghostscript.com/).
