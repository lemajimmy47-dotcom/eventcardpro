export async function addPdfWatermarks(doc: any, logoBase64Input?: string) {
  let logoB64 = logoBase64Input;
  let dims = { w: 200, h: 200 };

  if (!logoB64) {
    try {
      const res = await fetch('/logo.png');
      const blob = await res.blob();
      logoB64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });

      if (logoB64) {
        dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth || 200, h: img.naturalHeight || 200 });
          img.onerror = () => resolve({ w: 200, h: 200 });
          img.src = logoB64!;
        });
      }
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

  const centerW = Math.min(65, pageWidth * 0.32); // mm
  const centerH = centerW / aspect;

  const marginX = 10;
  const marginY = 10;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    if (typeof doc.saveGraphicsState === 'function') doc.saveGraphicsState();
    if (typeof doc.setGState === 'function') {
      try {
        const GStateClass = (doc.constructor as any)?.GState || (doc as any)?.GState;
        const stateObj = { opacity: 0.18, 'fill-opacity': 0.18, 'stroke-opacity': 0.18 };
        if (GStateClass) {
          doc.setGState(new GStateClass(stateObj));
        } else {
          doc.setGState(stateObj as any);
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
