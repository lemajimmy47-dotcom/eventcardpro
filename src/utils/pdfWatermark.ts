export async function addPdfWatermarks(doc: any, logoBase64Input?: string) {
  let logoB64 = logoBase64Input;
  let dims = { w: 200, h: 200 };

  if (!logoB64) {
    try {
      const data = await new Promise<{ b64: string; dims: { w: number; h: number } }>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 200;
          canvas.height = img.naturalHeight || 200;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve({ b64: canvas.toDataURL('image/png'), dims: { w: canvas.width, h: canvas.height } });
          } else {
            resolve({ b64: '', dims: { w: 200, h: 200 } });
          }
        };
        img.onerror = () => resolve({ b64: '', dims: { w: 200, h: 200 } });
        img.src = '/logo.png';
      });
      logoB64 = data.b64;
      dims = data.dims;
    } catch (e) {
      console.warn("Could not load logo for watermark:", e);
    }
  }

  if (!logoB64) return;

  const pageCount = typeof doc.internal.getNumberOfPages === 'function' 
    ? doc.internal.getNumberOfPages() 
    : (doc as any).internal.pages?.length - 1 || 1;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const aspect = dims.h > 0 ? dims.w / dims.h : 1;
  const cornerW = Math.min(24, pageWidth * 0.12); // mm
  const cornerH = cornerW / aspect;

  const centerW = Math.min(55, pageWidth * 0.28); // mm
  const centerH = centerW / aspect;

  const marginX = 10;
  const marginY = 10;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    if (typeof doc.saveGraphicsState === 'function') doc.saveGraphicsState();
    if (typeof doc.setGState === 'function') {
      try {
        const GState = (doc as any).GState;
        if (GState) {
          doc.setGState(new GState({ opacity: 0.06 }));
        } else {
          doc.setGState({ opacity: 0.06 } as any);
        }
      } catch (e) {}
    }

    try {
      // 1. Top Left
      doc.addImage(logoB64, 'PNG', marginX, marginY, cornerW, cornerH);
      // 2. Top Right
      doc.addImage(logoB64, 'PNG', pageWidth - marginX - cornerW, marginY, cornerW, cornerH);
      // 3. Bottom Left
      doc.addImage(logoB64, 'PNG', marginX, pageHeight - marginY - cornerH, cornerW, cornerH);
      // 4. Bottom Right
      doc.addImage(logoB64, 'PNG', pageWidth - marginX - cornerW, pageHeight - marginY - cornerH, cornerW, cornerH);
      // 5. Center
      doc.addImage(logoB64, 'PNG', (pageWidth - centerW) / 2, (pageHeight - centerH) / 2, centerW, centerH);
    } catch (err) {
      console.warn("Could not draw watermark on PDF page", i, err);
    }

    if (typeof doc.restoreGraphicsState === 'function') doc.restoreGraphicsState();
  }
}
