// Lazy-loaded PDF.js with its worker served from the app's own files.
let p: Promise<any> | null = null;

export function getPdfjs(): Promise<any> {
  if (!p) {
    p = (async () => {
      if (!(Promise as any).withResolvers) {
        (Promise as any).withResolvers = function () {
          let resolve: any, reject: any;
          const promise = new Promise((a, b) => { resolve = a; reject = b; });
          return { promise, resolve, reject };
        };
      }
      const pdfjs: any = await import('pdfjs-dist');
      const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      try {
        pdfjs.GlobalWorkerOptions.workerPort = new Worker(workerUrl, { type: 'module' });
      } catch (e) {
        console.warn('PDF worker unavailable, using main thread', e);
      }
      return pdfjs;
    })();
  }
  return p;
}

/** Options that let PDF.js draw fonts a PDF does not carry itself (common in Arabic books made in Word). */
export function pdfDocOptions(data: Uint8Array) {
  const base = (p: string) => new URL(p, document.baseURI).href;
  return {
    data,
    isEvalSupported: false,
    cMapUrl: base('./pdfjs/cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: base('./pdfjs/standard_fonts/'),
    useSystemFonts: true,
  };
}
