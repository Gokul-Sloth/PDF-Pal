import * as pdfjsLib from 'pdfjs-dist';

// Use a stable CDN for the worker that precisely matches the version we just installed
// This ensures Vite doesn't struggle to resolve standard WebWorkers without custom roll-up options
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export async function convertPdfToImages(file, format = 'png', progressCallback = null) {
  const images = [];
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Load the document using the Uint8Array
    const loadingTask = pdfjsLib.getDocument(new Uint8Array(arrayBuffer));
    const pdfDocument = await loadingTask.promise;
    
    const numPages = pdfDocument.numPages;
    if (progressCallback) progressCallback(0, numPages);
    
    // Process 1 page at a time to prevent RAM overload
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      
      // Standard scale
      const scale = 2.0; // 2x scale (approx 144 DPI) for high quality
      const viewport = page.getViewport({ scale: scale });
      
      // Prepare canvas using PDF page dimensions
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Custom background color to prevent transparent PNGs from rendering black
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height); // PDF elements implicitly stack on top
      
      // Render PDF page into canvas context
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        background: 'white' // some versions of pdfjs support this background property
      };
      
      await page.render(renderContext).promise;
      
      // Extract to Blob
      const blob = await new Promise(resolve => {
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        canvas.toBlob(resolve, mimeType, 0.95);
      });
      
      images.push({
        filename: `page-${pageNum.toString().padStart(3, '0')}.${format === 'jpeg' ? 'jpg' : 'png'}`,
        data: blob
      });
      
      if (progressCallback) progressCallback(pageNum, numPages);
    }
    
    // Explicitly destroy the document to free up memory and web worker threads
    try {
      if (pdfDocument.cleanup) pdfDocument.cleanup();
      if (pdfDocument.destroy) await pdfDocument.destroy();
    } catch (cleanupErr) {
      console.warn("Non-fatal error during PDF cleanup:", cleanupErr);
    }
    
    return images;
  } catch (error) {
    console.error("PDF.js Extraction Error:", error);
    throw new Error('Failed to extract images: ' + error.message);
  }
}
