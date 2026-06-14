import { EventDetails, TemplateSettings } from '../types';
import QRCode from 'qrcode';

const imageCache = new Map<string, HTMLImageElement>();

export function drawCardToCanvas(
  canvas: HTMLCanvasElement,
  event: EventDetails,
  settings: TemplateSettings,
  guestName: string,
  cardType: string,
  qrCodeText: string = 'EVENTCARD-' + event.id,
  onImageLoaded?: () => void
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // Render overlay items (Guest Name only)
  const renderOverlays = () => {
    // 8. Draw Dynamic Guest Name at relative percentage
    ctx.save();
    const nameX = (settings.guestNameX / 100) * w;
    const nameY = (settings.guestNameY / 100) * h;
    ctx.fillStyle = settings.guestNameColor || settings.textColor;
    ctx.font = `bold ${settings.guestNameSize}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(guestName || 'MGENI WA HESHIMA / GUEST NAME', nameX, nameY);
    ctx.restore();
  };

  // Check if image is a custom Base64 uploaded or dynamic web image URL
  const isWebImage = settings.imageUrl && (
    settings.imageUrl.startsWith('data:') || 
    settings.imageUrl.startsWith('http://') || 
    settings.imageUrl.startsWith('https://') || 
    settings.imageUrl.startsWith('/')
  );

  if (isWebImage) {
    const src = settings.imageUrl!;
    const cachedImg = imageCache.get(src);
    
    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      // Draw synchronously immediately! This prevents flickering and lag
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(cachedImg, 0, 0, w, h);
      renderOverlays();
      if (onImageLoaded) onImageLoaded();
    } else {
      const img = cachedImg || new Image();
      if (!cachedImg) {
        img.crossOrigin = 'anonymous';
        imageCache.set(src, img);
      }
      
      img.onload = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        renderOverlays();
        if (onImageLoaded) onImageLoaded();
      };
      img.onerror = () => {
        // Background color design fallback
        ctx.fillStyle = '#FAF8F5';
        ctx.fillRect(0, 0, w, h);
        renderOverlays();
        if (onImageLoaded) onImageLoaded();
      };
      
      if (!cachedImg) {
        img.src = src;
      }
    }
  } else {
    // 1. Clear & draw background color
    ctx.fillStyle = settings.imageUrl || '#FAF8F5';
    ctx.fillRect(0, 0, w, h);

    // 2. Draw aesthetic borders & frame
    ctx.strokeStyle = settings.textColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(15, 15, w - 30, h - 30);
    
    ctx.strokeStyle = settings.textColor + '40'; // semi-transparent
    ctx.lineWidth = 1;
    ctx.strokeRect(25, 25, w - 50, h - 50);
    
    // 3. Draw simple decorative background shapes depending on event type
    ctx.fillStyle = settings.textColor + '08';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 4. Draw Header/Header Quote
    ctx.fillStyle = settings.textColor;
    ctx.textAlign = 'center';
    ctx.font = `italic 300 ${h * 0.024}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillText("Mwaliko wa Kipekee", w / 2, h * 0.07);

    // 5. Draw Sender ID & Title
    ctx.font = `bold ${h * 0.052}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillText(event.senderId || 'SEND OFF', w / 2, h * 0.15);

    // Decorator line
    ctx.strokeStyle = settings.textColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 60, h * 0.18);
    ctx.lineTo(w / 2 + 60, h * 0.18);
    ctx.stroke();

    // 6. Draw Content & Host Name
    ctx.font = `500 ${h * 0.026}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillText("Familia ya", w / 2, h * 0.23);
    
    ctx.font = `bold ${h * 0.038}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    const hostWords = (event.hostName || "Ndugu, Jamaa na Marafiki").split(' ');
    if (hostWords.length > 3) {
      const half = Math.ceil(hostWords.length / 2);
      ctx.fillText(hostWords.slice(0, half).join(' '), w / 2, h * 0.28);
      ctx.fillText(hostWords.slice(half).join(' '), w / 2, h * 0.33);
    } else {
      ctx.fillText(event.hostName || "Ndugu, Jamaa na Marafiki", w / 2, h * 0.29);
    }

    ctx.font = `500 ${h * 0.024}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillText("Inakukaribisha katika sherehe ya", w / 2, h * 0.38);

    ctx.font = `bold italic ${h * 0.046}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillText(event.name || "Harusi Yamu na Mwenza", w / 2, h * 0.44);

    // 7. Event Meta Info Panel (Time, Date, Place)
    ctx.font = `bold ${h * 0.024}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillStyle = settings.textColor;
    ctx.fillText(`TAREHE: ${event.date || '26/11/2026'}`, w / 2, h * 0.52);
    ctx.fillText(`SAA: ${event.time || '12:00'} ${event.period || 'Jioni'}`, w / 2, h * 0.56);
    ctx.fillText(`UKUMBI: ${event.eventHallName || 'Isamuhyo Hall, Mbezi'}`, w / 2, h * 0.60);
    
    if (event.dressCode) {
      ctx.font = `italic ${h * 0.022}px "${settings.fontFamily || 'Inter'}", sans-serif`;
      ctx.fillText(`Mavazi (Dress Code): ${event.dressCode}`, w / 2, h * 0.64);
    }

    renderOverlays();

    // 11. Core Footer
    ctx.fillStyle = settings.textColor + 'C0';
    ctx.font = `${h * 0.018}px "${settings.fontFamily || 'Inter'}", sans-serif`;
    ctx.fillText("Mwasiliano ya Maswali au RSVPs:", w / 2, h * 0.94);
    const contactText = [event.contact1, event.contact2].filter(Boolean).join('  /  ');
    ctx.fillText(contactText || "0755 000 111 / 0713 222 333", w / 2, h * 0.975);

    if (onImageLoaded) onImageLoaded();
  }
}

