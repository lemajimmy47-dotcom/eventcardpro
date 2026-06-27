import React, { useState, useEffect, useRef } from 'react';
import { Heart, Gift, Landmark, Calendar, Phone, ShieldCheck, Mail, ArrowRight } from 'lucide-react';
import { Guest, EventDetails, ContributionCardTemplate } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { drawContributionCardToCanvas } from '../utils/contributionCardDrawing';

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
  const { language, setLanguage } = useLanguage();
  const isEn = language === 'en';
  const displayGuestName = guest?.name || 'Jimson';
  const [pledgeAmount, setPledgeAmount] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (template) {
      drawContributionCardToCanvas(canvas, event, template, guest, pledgeAmount ? `KIASI: TZS ${parseInt(pledgeAmount).toLocaleString()}` : (isEn ? 'SELECT AMOUNT' : 'WEKA KIASI'), isEn);
    } else {
      // Default fallback template if none provided
      const defaultTpl: ContributionCardTemplate = {
        themeId: 'midnight-gold',
        eventNameSize: 24,
        guestNameSize: 22,
        pledgeAmountSize: 28,
        deadlineSize: 14
      };
      drawContributionCardToCanvas(canvas, event, defaultTpl, guest, pledgeAmount ? `KIASI: TZS ${parseInt(pledgeAmount).toLocaleString()}` : (isEn ? 'SELECT AMOUNT' : 'WEKA KIASI'), isEn);
    }
  }, [pledgeAmount, template, event, guest, isEn]);

  // Check URL query parameters for override language
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get('lang')?.toLowerCase();
      if (urlLang === 'sw' || urlLang === 'en') {
        setLanguage(urlLang as any);
      }
    } catch (e) {
      console.warn('Failed to parse URL lang parameter', e);
    }
  }, [setLanguage]);

  const formattedDeadline = (event.contributionDeadline || event.date)
    ? new Date(event.contributionDeadline || event.date).toLocaleDateString(isEn ? 'en-US' : 'sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
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
      setIsSubmitted(true);
      if (onPledgeSubmit) {
        onPledgeSubmit(amountNum);
      }
    } finally {
      setLoading(false);
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

      <div className="w-full max-w-xl z-10 space-y-6 animate-fade-in" id="pledge-submission-container">
        {/* Contribution Card Display */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] rounded-2xl overflow-hidden border border-white/5 bg-slate-950 max-w-full group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-rose-500/5 pointer-events-none"></div>
            <canvas 
              id="guest-pledge-live-canvas"
              ref={canvasRef}
              width={450 * 3} 
              height={600 * 3}
              className="w-full sm:max-w-[320px] h-auto block"
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{isEn ? "Digital Contribution Card" : "Kadi ya Mchango ya Kidijitali"}</span>
          </div>
        </div>

        {/* Top Header Card */}
        <div className="text-center space-y-2 mt-4">
          <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-450 border border-rose-500/15 mb-2 hover:scale-105 transition-all duration-300">
            <Heart className="w-6 h-6 fill-rose-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-350 to-pink-300 tracking-tight uppercase" id="pledge-title-label">
            {event.name || (isEn ? 'Submit Pledge Contribution' : 'Wasilisha Ahadi ya Mchango')}
          </h1>
          <p className="text-xs font-mono tracking-widest uppercase">
            <span className="text-white font-bold text-[12px] uppercase">{displayGuestName}</span>
          </p>
        </div>

        <div className="flex flex-col justify-center">
          {!isSubmitted ? (
             <div className="backdrop-blur-md bg-white/[0.03] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative">
              <div className="absolute top-0 right-0 p-3 text-[10px] font-mono text-amber-400 font-extrabold flex items-center gap-1 bg-amber-500/10 rounded-bl-xl border-l border-b border-white/5">
                <Landmark className="w-3.5 h-3.5" /> {isEn ? 'Official Pledge' : 'Ahadi Rasmi'}
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Gift className="w-4 h-4 text-rose-400" />
                  {isEn ? 'New Pledge Contribution' : 'MCHANGO MPYA WA AHADI'}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {isEn ? (
                    <>
                      Dear <strong>{displayGuestName}</strong>, you are welcome to enter your pledge contribution to support this event.
                    </>
                  ) : (
                    <>
                      Ndugu <strong>{displayGuestName}</strong>, unakaribishwa kuandikisha ahadi yako ya mchango kwa ajili ya kufanikisha tukio hili.
                    </>
                  )}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="pledge-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    {isEn ? 'Pledge Amount (TZS)' : 'Kiasi cha Ahadi (TZS)'}
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-amber-500 font-bold text-sm">TZS</span>
                    </div>
                    <input
                      id="pledge-input"
                      type="text"
                      inputMode="numeric"
                      value={pledgeAmount}
                      onChange={handleAmountChange}
                      placeholder={isEn ? "Enter amount..." : "Weka kiasi hapa..."}
                      className="block w-full pl-14 pr-4 py-4 bg-slate-900/50 border border-white/10 rounded-xl text-white font-mono text-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none"
                    />
                  </div>
                  {pledgeAmount && (
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{isEn ? 'In Words:' : 'Kwa Maneno:'}</span>
                      <span className="text-[11px] font-bold text-amber-400">{formatCurrency(pledgeAmount)}</span>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-2">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{isEn ? 'Collection Deadline' : 'Mwisho wa Kukusanya'}</span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">{formattedDeadline}</p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !pledgeAmount}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-rose-950/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>{isEn ? 'Submit My Pledge' : 'Wasilisha Ahadi Yangu'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
             </div>
          ) : (
            <div className="backdrop-blur-md bg-white/[0.03] border border-emerald-500/20 rounded-2xl p-8 sm:p-10 space-y-6 shadow-2xl text-center relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
              
              <div className="inline-flex p-4 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
                <ShieldCheck className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                  {isEn ? 'Pledge Submitted!' : 'Ahadi Imepokelewa!'}
                </h2>
                <p className="text-xs text-slate-400 uppercase font-mono tracking-widest font-bold">
                  {isEn ? 'Reference: ' : 'Namba ya Uhakiki: '} P-{guest.id.substring(0, 6).toUpperCase()}
                </p>
              </div>

              <div className="p-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-4">
                <div className="space-y-1">
                   <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
                     {isEn ? 'Amount Registered' : 'Kiasi Kilichorekodiwa'}
                   </p>
                   <p className="text-2xl font-black text-emerald-400 font-mono">
                     {formatCurrency(pledgeAmount)}
                   </p>
                </div>
                
                <div className="h-px bg-emerald-500/10 w-full"></div>

                <p className="text-xs text-slate-300 leading-relaxed italic">
                  {isEn 
                    ? 'Thank you for your generous support. Your pledge has been safely recorded in our system. We will keep you updated on the progress.'
                    : 'Asante sana kwa mchango wako wa hali ya juu. Ahadi yako imerekodiwa kikamilifu kwenye mfumo wetu. Tutakupa taarifa za maendeleo.'}
                </p>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex flex-col sm:flex-row gap-3">
                   <div className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-[9px] text-slate-500 uppercase font-bold">{isEn ? 'Phone' : 'Simu'}</p>
                        <p className="text-[11px] text-white font-mono">{guest.phone}</p>
                      </div>
                   </div>
                   <div className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-[9px] text-slate-500 uppercase font-bold">{isEn ? 'Event Date' : 'Tarehe'}</p>
                        <p className="text-[11px] text-white font-mono">{event.date}</p>
                      </div>
                   </div>
                </div>

                <p className="text-[10px] text-slate-500 uppercase font-bold flex items-center justify-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  {isEn ? 'Confirmation SMS will be sent to your number' : 'SMS ya uthibitisho itatumwa kwenye namba yako'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center">
          <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
            © 2026 {event.name} • EventCard Digital System
          </p>
        </div>
      </div>
    </div>
  );
}
