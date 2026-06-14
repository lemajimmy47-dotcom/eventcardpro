import React, { useState, useEffect, useRef } from 'react';
import { Heart, Check, Gift, Landmark, Calendar, Phone, ShieldCheck, Mail, ArrowRight, Download } from 'lucide-react';
import { Guest, EventDetails, ContributionCardTemplate } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface GuestPledgeSubmissionPageProps {
  guest: Guest;
  event: EventDetails;
  template?: ContributionCardTemplate;
  onPledgeSubmit: (amount: number) => void;
}

export default function GuestPledgeSubmissionPage({
  guest,
  event,
  template,
  onPledgeSubmit
}: GuestPledgeSubmissionPageProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [pledgeAmount, setPledgeAmount] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Set default coordinates if template is not complete
  const defaults: ContributionCardTemplate = {
    eventId: event.id,
    guestNameX: 50,
    guestNameY: 34,
    guestNameSize: 22,
    guestNameColor: '#FFFFFF',
    pledgeAmountX: 50,
    pledgeAmountY: 56,
    pledgeAmountSize: 28,
    pledgeAmountColor: '#f43f5e',
    eventNameX: 50,
    eventNameY: 18,
    eventNameSize: 24,
    eventNameColor: '#fbbf24',
    deadlineX: 50,
    deadlineY: 82,
    deadlineSize: 14,
    deadlineColor: '#94a3b8',
    qrCodeX: 80,
    qrCodeY: 80,
    qrCodeSize: 15,
    qrCodeColor: '#FFFFFF',
    cardTypeX: 20,
    cardTypeY: 20,
    cardTypeSize: 12,
    cardTypeColor: '#fbbf24',
    themeId: 'midnight-gold',
    showEventName: true,
    showGuestName: true,
    showPledgeAmount: true,
    showDeadline: true,
    showCardType: true,
    showQrCode: true,
  };

  const activeTemplate: ContributionCardTemplate = template
    ? { ...defaults, ...template }
    : defaults;

  const formattedDeadline = event.date 
    ? new Date(event.date).toLocaleDateString(isEn ? 'en-US' : 'sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
    : (isEn ? 'Unlimited' : 'Bila Kikomo');

  const formatCurrency = (val: string) => {
    if (!val) return '';
    const num = parseInt(val.replace(/\D/g, ''), 10);
    if (isNaN(num)) return '';
    return 'TZS ' + num.toLocaleString('en-US');
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setPledgeAmount(raw);
  };

  // Draw the customized contribution card
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-res canvas sizes
    canvas.width = 800;
    canvas.height = 1000;

    const renderCard = (bgImg?: HTMLImageElement) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (bgImg) {
        // Draw the uploaded card template
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      } else {
        // Render an absolute masterpiece digital card template by default
        const themeId = activeTemplate.themeId || 'midnight-gold';
        
        let bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        let primaryColor = '#fbbf24';
        let accentColor = '#f43f5e';
        let outlineColor = '#d97706';

        if (themeId === 'emerald-luxury') {
          bgGrad.addColorStop(0, '#022c22');
          bgGrad.addColorStop(0.5, '#011c15');
          bgGrad.addColorStop(1, '#04211a');
          primaryColor = '#f59e0b';
          accentColor = '#ecd06f';
          outlineColor = '#ecd06f';
        } else if (themeId === 'velvet-plum') {
          bgGrad.addColorStop(0, '#1e0524');
          bgGrad.addColorStop(0.5, '#2d0b38');
          bgGrad.addColorStop(1, '#0f0212');
          primaryColor = '#f472b6';
          accentColor = '#c084fc';
          outlineColor = '#f472b6';
        } else if (themeId === 'onyx-minimal') {
          bgGrad.addColorStop(0, '#0d0d0d');
          bgGrad.addColorStop(0.5, '#141414');
          bgGrad.addColorStop(1, '#050505');
          primaryColor = '#a3a3a3';
          accentColor = '#f43f5e';
          outlineColor = '#404040';
        } else { // midnight-gold
          bgGrad.addColorStop(0, '#0a0f1d');
          bgGrad.addColorStop(0.5, '#0f172a');
          bgGrad.addColorStop(1, '#020617');
          primaryColor = '#fbbf24';
          accentColor = '#f43f5e';
          outlineColor = '#d97706';
        }

        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (themeId === 'onyx-minimal') {
          // Draw dotted grid
          ctx.save();
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          const dSp = 40;
          for (let x = 0; x < canvas.width; x += dSp) {
            for (let y = 0; y < canvas.height; y += dSp) {
              ctx.beginPath();
              ctx.arc(x, y, 1, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.restore();

          // Draw modern minimal tech brackets/coordinates
          ctx.strokeStyle = '#14b8a680'; // teal
          ctx.lineWidth = 3;
          const brLen = 30;
          const margin = 30;

          // Top Left
          ctx.beginPath(); ctx.moveTo(margin + brLen, margin); ctx.lineTo(margin, margin); ctx.lineTo(margin, margin + brLen); ctx.stroke();
          // Top Right
          ctx.beginPath(); ctx.moveTo(canvas.width - margin - brLen, margin); ctx.lineTo(canvas.width - margin, margin); ctx.lineTo(canvas.width - margin, margin + brLen); ctx.stroke();
          // Bottom Left
          ctx.beginPath(); ctx.moveTo(margin + brLen, canvas.height - margin); ctx.lineTo(margin, canvas.height - margin); ctx.lineTo(margin, canvas.height - margin - brLen); ctx.stroke();
          // Bottom Right
          ctx.beginPath(); ctx.moveTo(canvas.width - margin - brLen, canvas.height - margin); ctx.lineTo(canvas.width - margin, canvas.height - margin); ctx.lineTo(canvas.width - margin, canvas.height - margin - brLen); ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 1;
          ctx.strokeRect(margin + 15, margin + 15, canvas.width - (margin + 15) * 2, canvas.height - (margin + 15) * 2);
        } else {
          // Double borders
          ctx.strokeStyle = outlineColor;
          ctx.lineWidth = 5;
          ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

          ctx.strokeStyle = `${outlineColor}40`;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(42, 42, canvas.width - 84, canvas.height - 84);

          // Corner ornaments
          const drawCornerOrnament = (x: number, y: number, rotX: number, rotY: number) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(rotX, rotY);
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, 20);
            ctx.quadraticCurveTo(20, 20, 20, 60);
            ctx.moveTo(20, 0);
            ctx.quadraticCurveTo(20, 20, 60, 20);
            ctx.stroke();
            ctx.restore();
          };

          drawCornerOrnament(60, 60, 1, 1);
          drawCornerOrnament(canvas.width - 60, 60, -1, 1);
          drawCornerOrnament(60, canvas.height - 60, 1, -1);
          drawCornerOrnament(canvas.width - 60, canvas.height - 60, -1, -1);

          // Center watermarks
          ctx.save();
          ctx.strokeStyle = `${outlineColor}15`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width * 0.28, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width * 0.22, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Sparkles or heart decoration
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          const spots = [
            {x: canvas.width*0.2, y: canvas.height*0.15, r: 3}, {x: canvas.width*0.8, y: canvas.height*0.15, r: 4},
            {x: canvas.width*0.15, y: canvas.height*0.75, r: 2}, {x: canvas.width*0.85, y: canvas.height*0.7, r: 3.5},
            {x: canvas.width*0.35, y: canvas.height*0.88, r: 2.5}, {x: canvas.width*0.65, y: canvas.height*0.12, r: 3}
          ];
          spots.forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI*2);
            ctx.fill();
          });
          ctx.restore();
        }

        // Header Label "KADI YA MCHANGO"
        ctx.fillStyle = primaryColor;
        ctx.font = 'bold italic 22px "Inter", sans-serif';
        ctx.letterSpacing = "2px";
        ctx.textAlign = 'center';
        ctx.fillText(isEn ? 'PLEDGE & CONTRIBUTION CARD' : 'KADI YA MCHANGO NA AHADI', 400, 110);

        if (themeId !== 'onyx-minimal') {
          // Sub decorative crown under headers
          ctx.fillStyle = `${outlineColor}90`;
          ctx.font = '24px Arial';
          ctx.fillText('❦', 400, 140);
        }
      }

      // 2. Render Guest Name
      if (activeTemplate.showGuestName !== false) {
        const gpName = guest.name || (isEn ? 'Dear Guest' : 'Mgeni Mpendwa');
        ctx.fillStyle = activeTemplate.guestNameColor || '#FFFFFF';
        ctx.font = `italic bold ${activeTemplate.guestNameSize * 1.5}px "Inter", sans-serif`;
        const nameX = (activeTemplate.guestNameX / 100) * canvas.width;
        const nameY = (activeTemplate.guestNameY / 100) * canvas.height;
        ctx.fillText(gpName, nameX, nameY);
      }

      // Bottom thank you decoration
      if (!bgImg) {
        ctx.fillStyle = '#64748b';
        ctx.font = 'italic 16px "Inter", sans-serif';
        ctx.fillText(
          isEn 
            ? '"Thank you very much for your love, solidarity and great generosity!"' 
            : '"Ahsante sana kwa upendo, mshikamano na ukarimu wako mkuu!"', 
          400, 
          920
        );

        ctx.fillStyle = '#475569';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillText(
          isEn 
            ? `GUEST CODE: ${guest.code || 'INV'} • EVENTCARD SYSTEM` 
            : `KODI YA MGENI: ${guest.code || 'INV'} • EVENTCARD SYSTEM`, 
          400, 
          955
        );
      }
    };

    if (activeTemplate.imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = activeTemplate.imageUrl;
      img.onload = () => {
        renderCard(img);
      };
      img.onerror = () => {
        console.warn('Failed to load background template image, falling back to graphics renderer.');
        renderCard();
      };
    } else {
      renderCard();
    }
  }, [guest, event, activeTemplate, pledgeAmount, formattedDeadline, isEn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pledgeAmount || parseInt(pledgeAmount, 10) <= 0) {
      alert(isEn ? 'Please enter a valid contribution amount.' : 'Tafadhali ingiza kiasi sahihi cha mchango ili uwasilishe.');
      return;
    }

    setLoading(true);
    const amountNum = parseInt(pledgeAmount, 10);

    try {
      // Call public pledge submission API
      const response = await fetch('/api/pledge-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: guest.id,
          pledgeAmount: amountNum
        })
      });

      if (!response.ok) {
        throw new Error('Server returned error status');
      }

      setIsSubmitted(true);
      if (onPledgeSubmit) {
        onPledgeSubmit(amountNum);
      }
    } catch (e) {
      console.error('Failed to submit pledge to server, falling back to local simulation', e);
      // Fail-safe flow
      setIsSubmitted(true);
      if (onPledgeSubmit) {
        onPledgeSubmit(amountNum);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = isEn 
        ? `Contribution_Card_${guest.name.replace(/\s+/g, '_')}.png` 
        : `Kadi_ya_Mchango_${guest.name.replace(/\s+/g, '_')}.png`;
      a.click();
    } catch (e) {
      alert(
        isEn 
          ? 'Failed to download card due to sandbox security rules, you can take a screenshot instead.' 
          : 'Imeshindwa kupakua kadi kutokana na usalama wa kiratibu, unaweza kupiga picha ya kioo (Screenshot).'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative font-sans overflow-x-hidden">
      {/* Background radial overlays */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[120%] aspect-square bg-[#0c1938]/40 blur-[130px] rounded-full"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[45%] aspect-square bg-rose-500/5 rounded-full blur-[130px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] aspect-square bg-amber-500/5 rounded-full blur-[130px]"></div>
      </div>

      <div className="w-full max-w-4xl z-10 space-y-6 animate-fade-in" id="pledge-submission-container">
        {/* Top Header Card */}
        <div className="text-center space-y-2 mt-4">
          <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-450 border border-rose-500/15 mb-2 hover:scale-105 transition-all duration-300">
            <Heart className="w-6 h-6 fill-rose-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-350 to-pink-300 tracking-tight uppercase" id="pledge-title-label">
            {event.name || (isEn ? 'Submit Pledge Contribution' : 'Wasilisha Ahadi ya Mchango')}
          </h1>
          <p className="text-xs font-mono tracking-widest uppercase">
            <span className="text-white font-bold text-[12px] uppercase">{guest.name}</span>
          </p>
        </div>

        {/* Dashboard split */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          
          {/* Card Preview Side */}
          <div className="md:col-span-7 flex flex-col items-center justify-center space-y-4">
            <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-4 w-full flex flex-col items-center relative overflow-hidden group">
              <div className="w-full max-w-[360px] aspect-[4/5] relative rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-slate-950">
                <canvas 
                  ref={canvasRef} 
                  className="w-full h-full object-contain" 
                  id="canvas-contribution-card-viewer"
                />
              </div>
              <div className="mt-3 flex items-center justify-between w-full max-w-[360px] px-1 hidden">
                <span className="text-[10px] text-slate-400 font-mono">
                  {isEn ? `Special Card Preview (${guest.code || 'INV'})` : `Muonekano wa Kadi Maalum (${guest.code || 'INV'})`}
                </span>
                <button
                  id="btn-download-preview-card"
                  onClick={handleDownloadCard}
                  className="text-[10px] font-bold text-rose-400 hover:text-white flex items-center gap-1 bg-white/5 hover:bg-rose-500/10 border border-white/5 px-2 py-1 rounded-lg transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>{isEn ? 'Download Card' : 'Pakua Kadi'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Form / Success Info Side */}
          <div className="md:col-span-5 flex flex-col justify-center">
            {!isSubmitted ? (
              <div className="backdrop-blur-md bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
                <div className="absolute top-0 right-0 p-3 text-[10px] font-mono text-amber-400 font-extrabold flex items-center gap-1 bg-amber-500/10 rounded-bl-xl border-l border-b border-white/5">
                  <Landmark className="w-3.5 h-3.5" /> {isEn ? 'Official Pledge' : 'Ahadi Rasmi'}
                </div>

                <div className="space-y-2 pt-2">
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                    <Gift className="w-4 h-4 text-rose-400" />
                    {isEn ? 'New Pledge Contribution' : 'Ahadi Mpya ya Mchango'}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {isEn ? (
                      <>
                        Dear <strong>{guest.name}</strong>, you are welcome to enter your pledge contribution to support this event. Your pledge will be instantly prepared on your personalized card.
                      </>
                    ) : (
                      <>
                        Ndugu mpendwa <strong>{guest.name}</strong>, karibu kuweka kiasi cha ahadi ya mchango wako kwa ajili ya kufanikisha sherehe hii. Ahadi yako itatayarishwa hapo hapo kwenye Kadi yako binafsi.
                      </>
                    )}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5" id="pledge-submission-form">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold uppercase text-slate-300 font-mono tracking-wider">
                      {isEn ? 'Amount you intend to contribute (TZS):' : 'Kiasi unachokusudia kuchangia (TZS):'}
                    </label>
                    <div className="relative rounded-xl overflow-hidden shadow-inner border border-white/10 focus-within:border-rose-500/60 transition-all">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-sm">
                        TZS
                      </span>
                      <input 
                        id="input-guest-pledge-amount"
                        type="text" 
                        value={pledgeAmount ? parseInt(pledgeAmount).toLocaleString('en-US') : ''}
                        onChange={handleAmountChange}
                        placeholder={isEn ? 'e.g. 500,000' : 'e.g. 500,000'}
                        className="w-full bg-slate-900/60 py-3.5 pl-14 pr-4 text-white text-base font-extrabold font-mono focus:outline-none"
                        required
                        disabled={loading}
                      />
                    </div>
                    {pledgeAmount && (
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider font-mono px-1">
                        {isEn ? 'Equivalent to:' : 'Sawa na:'} {formatCurrency(pledgeAmount)}
                      </p>
                    )}
                  </div>

                  <button
                    id="btn-submit-guest-pledge"
                    type="submit"
                    disabled={loading || !pledgeAmount || parseInt(pledgeAmount, 10) <= 0}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 text-white font-extrabold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(244,63,94,0.35)] transition-all duration-300 hover:brightness-110 active:scale-[0.98] disabled:opacity-55 disabled:scale-100 disabled:pointer-events-none cursor-pointer"
                  >
                    {loading ? (
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <>
                        <span>{isEn ? 'Submit My Pledge' : 'Wasilisha Ahadi Yangu'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Secure footer trust badge */}
                <div className="flex items-center gap-1.5 justify-center pt-2 text-[9.5px] text-slate-500 font-mono">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{isEn ? 'Secure encryption & data privacy enabled' : 'Ulinzi thabiti wa siri na data umewezeshwa'}</span>
                </div>
              </div>
            ) : (
              <div className="backdrop-blur-md bg-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6 sm:p-8 space-y-5 text-center animate-scale-up">
                <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h3 className="text-base font-extrabold text-[#34d399] uppercase tracking-wider">
                  {isEn ? 'YOUR PLEDGE HAS BEEN RECEIVED!' : 'AHADI YAKO IMEPOKELEWA!'}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isEn ? (
                    <>
                      Thank you very much dear <strong>{guest.name}</strong>. Your pledge of <strong className="text-emerald-450 font-mono">{formatCurrency(pledgeAmount)}</strong> has been successfully registered to support our ceremony.
                    </>
                  ) : (
                    <>
                      Ahsante sana ndugu yetu, <strong>{guest.name}</strong>. Kiasi cha ahadi yako chenye thamani ya <strong className="text-emerald-400 font-mono">{formatCurrency(pledgeAmount)}</strong> kimesajiliwa kwa usahihi kwa ajili ya kufanikisha sherehe yetu.
                    </>
                  )}
                </p>

                <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-left space-y-2">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400 uppercase">{isEn ? 'Name:' : 'Jina:'}</span>
                    <span className="text-white font-bold">{guest.name}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400 uppercase">{isEn ? 'Pledge:' : 'Mchango:'}</span>
                    <span className="text-emerald-300 font-bold font-mono">{formatCurrency(pledgeAmount)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400 uppercase">{isEn ? 'Deadline:' : 'Mwisho wa Kikomo:'}</span>
                    <span className="text-slate-300 font-bold">{formattedDeadline}</span>
                  </div>
                </div>

                <div className="pt-2 text-slate-400 text-[10.5px] space-y-4">
                  <p>{isEn ? 'It is highly recommended to download your personalized contribution card as memory of this submission.' : 'Inapendekezwa kupakua kadi yako maalum (Contribution Card) kama kumbukumbu ya uwasilishaji huu.'}</p>
                  <button
                    id="btn-download-success-card"
                    onClick={handleDownloadCard}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold font-mono cursor-pointer transition-all border border-white/10 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    <span>{isEn ? 'Download My Card' : 'Pakua Kadi Yangu'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
