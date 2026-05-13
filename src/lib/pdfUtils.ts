import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker using unpkg for better compatibility with modern pdfjs-dist versions (v4+)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface PdfData {
  text: string;
  firstPageImage?: string; // base64
}

export async function extractPdfData(file: File): Promise<PdfData> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  // 1. Try to extract text
  const maxTextPages = Math.min(pdf.numPages, 5);
  for (let i = 1; i <= maxTextPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  // 2. If text is very short (likely a scan), render first page to image
  let firstPageImage: string | undefined;
  if (fullText.trim().length < 50 && pdf.numPages > 0) {
    try {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        firstPageImage = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // extract base64 part
      }
    } catch (err) {
      console.warn("Failed to render PDF page for vision fallback:", err);
    }
  }

  return { 
    text: fullText, 
    firstPageImage 
  };
}
