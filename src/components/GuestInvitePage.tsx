import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { EventDetails, TemplateSettings, Guest } from '../types';
import { drawCardToCanvas } from '../utils/canvasHelper';
import { useLanguage } from '../context/LanguageContext';

interface GuestInvitePageProps {
  guest: Guest;
  event: EventDetails;
  settings: TemplateSettings;
  onRsvpSubmit: (updatedGuest: Guest) => void;
}

export default function GuestInvitePage({ guest, event, settings, onRsvpSubmit }: GuestInvitePageProps) {
  const { language, setLanguage } = useLanguage();
  const isEn = language === 'en';
  const [rsvpStatus, setRsvpStatus] = useState(guest.rsvpStatus || 'Bado');
  const [rsvpGuestsCount, setRsvpGuestsCount] = useState(guest.rsvpGuestsCount || 1);
  const [rsvpComment, setRsvpComment] = useState(guest.rsvpComment || '');
  const [rsvpUpdating, setRsvpUpdating] = useState(false);
  const [rsvpFeedback, setRsvpFeedback] = useState<string | null>(null);
  const [cardImageUrl, setCardImageUrl] = useState<string>('');

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const scaleFactor = 3;
    canvas.width = (settings.orientation === 'landscape' ? 600 : 450) * scaleFactor;
    canvas.height = (settings.orientation === 'landscape' ? 450 : 600) * scaleFactor;
    
    drawCardToCanvas(
        canvas, 
        event, 
        settings, 
        guest.name.toUpperCase(), 
        guest.cardType, 
        guest.code ? `EVENTCARD-${guest.code}` : `EVENTCARD-${guest.id}`,
        () => {
            setCardImageUrl(canvas.toDataURL('image/jpeg', 0.95));
        }
    );
  }, [guest, event, settings]);

  const performRsvpUpdate = (status: string) => {
    setRsvpUpdating(true);
    setRsvpFeedback(null);

    fetch('/api/rsvp-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestId: guest.id,
        rsvpStatus: status,
        rsvpGuestsCount: 1,
        rsvpComment: ''
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("RSVP update failed");
      return res.json();
    })
    .then(() => {
      setRsvpStatus(status);
      onRsvpSubmit({
        ...guest,
        rsvpStatus: status as any,
        rsvpGuestsCount: 1,
        rsvpComment: ''
      });
      setRsvpFeedback(isEn ? "Thank you! Your response has been recorded." : "Ahsante sana! Usiliki wako umerekodiwa.");
      setTimeout(() => setRsvpFeedback(null), 4500);
    })
    .catch(err => {
      console.error(err);
      setRsvpFeedback(isEn ? "An error occurred. Please try again." : "Hitilafu imetokea. Tafadhali jaribu tena.");
    })
    .finally(() => setRsvpUpdating(false));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center py-8 px-4 font-sans relative pb-32">
      {/* Floating Language Switcher */}
      <div className="absolute top-4 right-4 z-50 flex gap-1 bg-white/5 border border-white/10 p-1 rounded-full backdrop-blur-md">
        <button
          type="button"
          onClick={() => setLanguage('sw')}
          className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all cursor-pointer ${!isEn ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md' : 'text-slate-450 hover:text-white'}`}
        >
          SW
        </button>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all cursor-pointer ${isEn ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md' : 'text-slate-455 hover:text-white'}`}
        >
          EN
        </button>
      </div>
      
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-[480px] space-y-6 z-10 relative">
        
        {/* Event Hero Image */}
        {event.eventImgUrl && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="w-full rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl aspect-[3/4] md:aspect-[4/5] relative mx-auto"
          >
            <img src={event.eventImgUrl} className="w-full h-full object-cover" alt="Event Cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent"></div>
          </motion.div>
        )}

        {cardImageUrl && (
          <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="text-center space-y-3">
            <img src={cardImageUrl} className="mx-auto rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5" alt={isEn ? "Invitation Card" : "Kadi ya Mwaliko"} />
          </motion.div>
        )}

        {/* Header */}
        <div className="text-center space-y-2 pb-1">
           <h1 className="text-2xl font-extrabold tracking-tight text-white uppercase">
             {isEn ? "INVITATION TO" : "MWALIKO WA"} {(event.name || (isEn ? "Event" : "Tukio")).toUpperCase()}
           </h1>
           <p className="text-sm text-neutral-400">
             {isEn ? "Welcome, dear" : "Karibu, mpendwa"} <span className="font-bold text-amber-400 uppercase">{guest.name}</span>
           </p>
        </div>

        <div className="space-y-6">
          <div className="bg-neutral-900/60 border border-white/5 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
            <div className="text-center mb-6 space-y-2">
              <p className="text-[12.5px] text-emerald-400 font-extrabold tracking-wider uppercase">
                {isEn ? "🎟️ RSVP - CHOOSE YOUR OPTION" : "🎟️ RSVP - THIBITISHA USHIRIKI"}
              </p>
              <p className="text-xs text-neutral-300">
                {isEn 
                  ? "Your options are already open below. Please click one to confirm your attendance:" 
                  : "Chaguo zako zipo wazi tayari hapa chini. Tafadhali bonyeza moja ili kuthibitisha ushiriki wako:"}
              </p>
            </div>

            <div className="space-y-3.5">
              <button 
                onClick={() => performRsvpUpdate('Atahudhuria')}
                disabled={rsvpUpdating}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition active:scale-95 disabled:opacity-50 text-[13px] cursor-pointer shadow-lg flex items-center justify-center gap-2"
              >
                 {rsvpStatus === 'Atahudhuria' ? (isEn ? '✅ Attending' : '✅ Umehudhuria') : (isEn ? 'Yes, I will attend' : 'Ndio, Nitahudhuria')}
              </button>
              
              <button 
                onClick={() => performRsvpUpdate('Hatahudhuria')}
                disabled={rsvpUpdating}
                className="w-full py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-extrabold rounded-xl transition active:scale-95 disabled:opacity-50 text-[13px] cursor-pointer flex items-center justify-center gap-2"
              >
                 {rsvpStatus === 'Hatahudhuria' ? (isEn ? '❌ Declined' : '❌ Umeghairi') : (isEn ? 'No, I cannot attend' : 'Hapana, Nina Udhuru')}
              </button>
              
              {event.mapsLink ? (
                  <a 
                    href={event.mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 font-extrabold rounded-xl transition active:scale-95 text-[13px] cursor-pointer flex items-center justify-center border border-rose-500/20 gap-2 shadow-sm"
                  >
                    📍 {isEn ? "VIEW LOCATION" : "ANGALIA RAMANI (LOCATION)"}
                  </a>
              ) : (
                <div className="w-full py-4 bg-white/5 text-neutral-500 font-extrabold rounded-xl text-[13px] flex items-center justify-center border border-white/5 cursor-not-allowed">
                  {isEn ? "LOCATION NOT AVAILABLE" : "LOCATION HAIJAPATIKANA"}
                </div>
              )}
            </div>
            
            {rsvpFeedback && (
                <motion.div initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-xl text-center mt-4">
                  {rsvpFeedback}
                </motion.div>
            )}
            
            {rsvpUpdating && (
                <div className="text-[11px] text-center text-neutral-500 mt-4">{isEn ? "Submitting..." : "Inatuma..."}</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
