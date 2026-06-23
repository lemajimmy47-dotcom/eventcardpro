import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Eye, RefreshCw, CheckCircle, MessageCircle, AlertCircle, PlayCircle, ArrowRight, X, Clipboard, Check, ExternalLink, Settings, Key, HelpCircle } from 'lucide-react';
import { EventDetails, Guest, TemplateSettings } from '../types';
import { drawCardToCanvas } from '../utils/canvasHelper';
import { safeLocalStorage } from '../utils/storage';

interface SendMessagesProps {
  event: EventDetails;
  settings: TemplateSettings;
  guests: Guest[];
  language: string;
  onUpdateEvent: (event: EventDetails) => void;
  onUpdateGuests: (guests: Guest[]) => void;
  onNext: () => void;
}

const PortalModal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return createPortal(children, document.body);
};

export default function SendMessages({ event, settings, guests, language, onUpdateEvent, onUpdateGuests, onNext }: SendMessagesProps) {
  const isEn = language === 'en';
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const [currentSendingIndex, setCurrentSendingIndex] = useState(-1);
  const [sendLogs, setSendLogs] = useState<string[]>([]);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [messageType, setMessageType] = useState<'invitation' | 'reminder' | 'contribution'>('invitation');

  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');

  const [activeSendTarget, setActiveSendTarget] = useState<{ guest: Guest, channel: 'sms' | 'whatsapp' } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [modalCardUrl, setModalCardUrl] = useState<string>('');
  const [modalImageLoaded, setModalImageLoaded] = useState<boolean>(false);
  const [copyImageSuccess, setCopyImageSuccess] = useState(false);

  useEffect(() => {
    if (!activeSendTarget) {
      setModalCardUrl('');
      setModalImageLoaded(false);
      return;
    }
    const guest = activeSendTarget.guest;
    const canvas = document.createElement('canvas');
    
    canvas.width = settings.orientation === 'landscape' ? 600 : 450;
    canvas.height = settings.orientation === 'landscape' ? 450 : 600;
    setModalImageLoaded(false);
    drawCardToCanvas(
      canvas, 
      event, 
      settings, 
      guest.name.toUpperCase(), 
      guest.cardType, 
      guest.code ? `EVENTCARD-${guest.code}` : `EVENTCARD-${guest.id}`,
      () => {
        setModalCardUrl(canvas.toDataURL('image/jpeg', 0.85));
        setModalImageLoaded(true);
      }
    );
  }, [activeSendTarget, messageType, event, settings]);

  const handleCopyImageToClipboard = async () => {
    if (!modalCardUrl) return;
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
        alert('Mfumo wa kivinjari chako hauruhusu kunakili picha moja kwa moja. Tafadhali bonyeza kitufe cha "Pakua Picha ya Kadi" hapo chini ili kuipakua na kuituma kwa WhatsApp.');
        return;
      }
      const response = await fetch(modalCardUrl);
      const blob = await response.blob();
      
      let finalBlob = blob;
      if (blob.type !== 'image/png') {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            canvas.toBlob((pngBlob) => {
              if (pngBlob) {
                finalBlob = pngBlob;
                resolve();
              } else {
                reject(new Error('PNG conversion failed'));
              }
            }, 'image/png');
          };
          img.onerror = reject;
          img.src = modalCardUrl;
        });
      }

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': finalBlob })
      ]);
      setCopyImageSuccess(true);
      setTimeout(() => setCopyImageSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to copy image to clipboard:', err);
      alert('Imeshindwa kunakili picha kiotomatiki. Tafadhali bonyeza kitufe cha "Pakua Picha ya Kadi" chini kuipakua kwenye simu yako kisha uitume kwa WhatsApp.');
    }
  };

  // SMS & WhatsApp Gateway Config states
  const [gatewaySettings, setGatewaySettings] = useState({
    provider: 'simulation',
    url: '',
    apiKey: '',
    apiSecret: '',
    senderId: '',
    senderIdStatus: 'approved' as 'pending' | 'approved' | 'rejected',
    whatsappUrl: '',
    customHeaders: '{}',
    customBody: '{\n  "to": "{to}",\n  "message": "{message}"\n}'
  });
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);
  const [isSavingGateway, setIsSavingGateway] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Editing individual guest states
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [editGuestName, setEditGuestName] = useState('');
  const [editGuestPhone, setEditGuestPhone] = useState('');
  const [editGuestType, setEditGuestType] = useState('DOUBLE');
  const [editCustomCategoryInput, setEditCustomCategoryInput] = useState('');

  // Toggle for sending physical link in SMS (Default: false inline with visitor's preference to conserve balance)
  const [sendSmsLink, setSendSmsLink] = useState<boolean>(() => {
    const saved = safeLocalStorage.getItem('send_sms_link');
    return saved === 'true'; // Default is false because 'saved' is null/undefined initially
  });

  useEffect(() => {
    safeLocalStorage.setItem('send_sms_link', String(sendSmsLink));
  }, [sendSmsLink]);

  // Template Editing states
  const [invitationTemplateSw, setInvitationTemplateSw] = useState<string>(() => {
    const key = event?.id ? `kadi_message_template_${event.id}_sw` : 'kadi_message_template_sw';
    const saved = safeLocalStorage.getItem(key) || safeLocalStorage.getItem('kadi_message_template_sw') || safeLocalStorage.getItem('kadi_message_template');
    if (saved && (saved.includes('Habari') || saved.includes('Familia'))) {
      return saved;
    }
    return `🌸 SAVE THE DATE 🌸

Habari {name},

Tafadhali hifadhi tarehe hii muhimu kwa ajili ya tukio letu la {event_name} litakalofanyika siku ya {date}.

Unaweza kuona kadi yetu ya mwaliko, ramani ya ukumbi, na taarifa zote rasmi kupitia kiungo hiki cha kipekee:
{kiungo}

Tunafurahia sana ushiriki wako. Karibu sana!`;
  });

  const [invitationTemplateEn, setInvitationTemplateEn] = useState<string>(() => {
    const key = event?.id ? `kadi_message_template_${event.id}_en` : 'kadi_message_template_en';
    const saved = safeLocalStorage.getItem(key) || safeLocalStorage.getItem('kadi_message_template_en');
    if (saved && (saved.includes('Hello') || saved.includes('Dear') || saved.includes('Welcome'))) {
      return saved;
    }
    return `🌸 SAVE THE DATE 🌸

Hello {name},

Please save this important date for our {event_name} event which will be held on {date}.

You can view our invitation card, venue map, and all official details via this unique link:
{kiungo}

We are very excited to have you join us. You are warmly welcome!`;
  });

  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);

  // Sync state when event.id changes
  useEffect(() => {
    if (event?.id) {
      const savedSw = safeLocalStorage.getItem(`kadi_message_template_${event.id}_sw`) || safeLocalStorage.getItem('kadi_message_template_sw') || safeLocalStorage.getItem('kadi_message_template');
      if (savedSw && (savedSw.includes('Habari') || savedSw.includes('Familia'))) {
        setInvitationTemplateSw(savedSw);
      } else {
        setInvitationTemplateSw(`🌸 SAVE THE DATE 🌸

Habari {name},

Tafadhali hifadhi tarehe hii muhimu kwa ajili ya tukio letu la {event_name} litakalofanyika siku ya {date}.

Unaweza kuona kadi yetu ya mwaliko, ramani ya ukumbi, na taarifa zote rasmi kupitia kiungo hiki cha kipekee:
{kiungo}

Tunafurahia sana ushiriki wako. Karibu sana!`);
      }

      const savedEn = safeLocalStorage.getItem(`kadi_message_template_${event.id}_en`) || safeLocalStorage.getItem('kadi_message_template_en');
      if (savedEn && (savedEn.includes('Hello') || savedEn.includes('Dear') || savedEn.includes('Welcome'))) {
        setInvitationTemplateEn(savedEn);
      } else {
        setInvitationTemplateEn(`🌸 SAVE THE DATE 🌸

Hello {name},

Please save this important date for our {event_name} event which will be held on {date}.

You can view our invitation card, venue map, and all official details via this unique link:
{kiungo}

We are very excited to have you join us. You are warmly welcome!`);
      }
    }
  }, [event?.id]);

  useEffect(() => {
    if (event?.id) {
      safeLocalStorage.setItem(`kadi_message_template_${event.id}_sw`, invitationTemplateSw);
    }
    safeLocalStorage.setItem('kadi_message_template_sw', invitationTemplateSw);
  }, [invitationTemplateSw, event?.id]);

  useEffect(() => {
    if (event?.id) {
      safeLocalStorage.setItem(`kadi_message_template_${event.id}_en`, invitationTemplateEn);
    }
    safeLocalStorage.setItem('kadi_message_template_en', invitationTemplateEn);
  }, [invitationTemplateEn, event?.id]);

  const activeTemplateValue = language === 'en' ? invitationTemplateEn : invitationTemplateSw;
  const setActiveTemplateValue = (val: string) => {
    if (language === 'en') {
      setInvitationTemplateEn(val);
    } else {
      setInvitationTemplateSw(val);
    }
  };

  // Load gateway configurations from API
  useEffect(() => {
    fetch('/api/sms-settings')
      .then(res => {
        if (!res.ok) throw new Error("Hairuhusu kusoma");
        return res.json();
      })
      .then(data => {
        if (data && data.provider) {
          setGatewaySettings(prev => ({ ...prev, ...data }));
        }
      })
      .catch(err => console.error("Error fetching SMS/WA gateway settings:", err));
  }, []);

  const insertPlaceholder = (tag: string) => {
    const textarea = document.getElementById('message-template-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      const updated = before + tag + after;
      setActiveTemplateValue(updated);
      
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
      }, 50);
    } else {
      setActiveTemplateValue(activeTemplateValue + tag);
    }
  };

  const handleResetTemplate = () => {
    setShowResetConfirm(true);
  };

   const executeResetTemplate = () => {
    if (language === 'en') {
      setInvitationTemplateEn(`Hello {name},
The family of {host_name} in collaboration with the Organizing Committee, are pleased to welcome you to participate in {event_name}.

EVENT DETAILS

Date: {date}
Venue: {venue}
Time: {time}
Card No: {card_number}
Card Type: {card_type}

Your presence is highly valued and will contribute to making this day joyous and memorable.

If this number is on WhatsApp, your invitation card has been sent there as well.

Contact:
{contact_1_name} - {contact_1_phone}
{contact_2_name} - {contact_2_phone}

You are warmly welcome.`);
    } else {
      setInvitationTemplateSw(`Habari {name},
Familia ya {host_name} kwa kushirikiana na Kamati ya Maandalizi, wanayo furaha kubwa kukukaribisha kushiriki katika {event_name}.

TAARIFA ZA SHEREHE

Tarehe: {date}
Ukumbi: {venue}
Muda: {time}
Kadi Na: {card_number}
Aina ya Kadi: {card_type}

Uwepo wako ni wa thamani kubwa kwetu na utachangia kuifanya siku hii kuwa ya furaha na kumbukumbu nzuri.

Ikiwa namba hii ipo WhatsApp, kadi yako ya mwaliko imetumwa huko pia.

Mawasiliano:
{contact_1_name} - {contact_1_phone}
{contact_2_name} - {contact_2_phone}

Karibu sana.`);
    }
  };

  // Get unique categories list dynamically for edit select category input dropdown
  const availableCategories = Array.from(new Set(guests.map(g => g.cardType).filter(Boolean)));

  const handleResetSingleGuest = (guestId: string) => {
    const updated = guests.map(g => {
      if (g.id === guestId) {
        return {
          ...g,
          smsStatus: 'Sijatuma' as const,
          whatsappStatus: 'Sijatuma' as const,
          smsCount: 0,
          whatsappCount: 0
        };
      }
      return g;
    });
    onUpdateGuests(updated);
    
    const target = guests.find(g => g.id === guestId);
    if (target) {
      setSendLogs(prev => [
        `[${new Date().toLocaleTimeString()}] ↺ Hali ya kutuma imefutwa (Reset) kwa mgeni mmoja: ${target.name}`,
        ...prev
      ]);
    }
  };

  const handleStartEdit = (guest: Guest) => {
    setEditingGuest(guest);
    setEditGuestName(guest.name);
    setEditGuestPhone(guest.phone);
    setEditGuestType(['SINGLE', 'DOUBLE'].includes(guest.cardType) ? guest.cardType : 'UNCLASSIFIED');
  };

  const handleSaveEditGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuest) return;

    const finalType = ['SINGLE', 'DOUBLE'].includes(editGuestType) ? editGuestType : 'UNCLASSIFIED';
    const rsvpCount = finalType === 'DOUBLE' ? 2 : 1;

    const updatedGuest: Guest = {
      ...editingGuest,
      name: editGuestName.trim(),
      phone: editGuestPhone.trim(),
      cardType: finalType,
      rsvpGuestsCount: rsvpCount,
    };

    // Update guests list
    const updatedList = guests.map(g => g.id === editingGuest.id ? updatedGuest : g);
    onUpdateGuests(updatedList);

    setEditingGuest(null);
  };

  // Filtered guests based on message type - Memoized for performance
  const filteredGuests = React.useMemo(() => {
    return guests.filter(g => {
      if (messageType === 'save_the_date') {
        return g.rsvpStatus === 'Atahudhuria';
      }
      return true;
    });
  }, [guests, messageType]);

  // Status Metrics - Memoized
  const { countSmsSent, countWhatsappSent, countPending } = React.useMemo(() => {
    const sms = filteredGuests.filter(g => g.smsStatus === 'Imetumia').length;
    const wa = filteredGuests.filter(g => g.whatsappStatus === 'Imetumia').length;
    const pending = filteredGuests.filter(g => g.smsStatus !== 'Imetumia' || g.whatsappStatus !== 'Imetumia').length;
    return { countSmsSent: sms, countWhatsappSent: wa, countPending: pending };
  }, [filteredGuests]);

  const getGuestMessageText = (g: Guest, isSms: boolean = false, forceAppendLink: boolean = false) => {
    const currentOrigin = typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.origin.includes('run.app') 
      ? window.location.origin 
      : 'https://eventcard.co.tz';
    const appUrl = `${currentOrigin}/?invite=${g.code || g.id}&std=true&eventId=${event.id}&lang=${language}`;

    let text = language === 'en' ? invitationTemplateEn : invitationTemplateSw;
    const contacts = [event.contact1, event.contact2, event.contact3].filter(Boolean).join('\n');

    const replacements: { [key: string]: string } = {
      '{mgeni}': g.name,
      '{name}': g.name,
      '{guestName}': g.name,
      '{jina_la_mgeni}': g.name,
      '(jina_la_mgeni)': g.name,
      '{mwenyeji}': event.hostName || "[Mwenyeji]",
      '{hostName}': event.hostName || "[Mwenyeji]",
      '{host_name}': event.hostName || "[Mwenyeji]",
      '{sherehe}': event.name || "[Sherehe]",
      '{event_name}': event.name || "[Sherehe]",
      '{eventName}': event.name || "[Sherehe]",
      '{tarehe}': event.date || "26/11/2026",
      '{date}': event.date || "26/11/2026",
      '{eventDate}': event.date || "26/11/2026",
      '{muda}': `${event.time || "12:00"} ${event.period || "Mchana"}`,
      '{time}': `${event.time || "12:00"} ${event.period || "Mchana"}`,
      '{eventTime}': `${event.time || "12:00"} ${event.period || "Mchana"}`,
      '{ukumbi}': event.eventHallName || "[Ukumbi]",
      '{venue}': event.eventHallName || "[Ukumbi]",
      '{eventHall}': event.eventHallName || "[Ukumbi]",
      '{vazi}': event.dressCode || "[Vazi]",
      '{dressCode}': event.dressCode || "[Dress Code]",
      '{kiungo}': (isSms && !sendSmsLink) ? "" : appUrl,
      '{inviteUrl}': (isSms && !sendSmsLink) ? "" : appUrl,
      '{namba_mwaliko}': g.code || "[Code]",
      '{card_number}': g.code || "[Code]",
      '{inviteCode}': g.code || "[Code]",
      '{aina}': g.cardType || "DOUBLE",
      '{card_type}': g.cardType || "DOUBLE",
      '{mwasiliano}': contacts,
      '{contact_1_name}': event.contact1Name || "",
      '{contact_1_phone}': event.contact1 || "",
      '{contact_2_name}': event.contact2Name || "",
      '{contact_2_phone}': event.contact2 || ""
    };

    Object.keys(replacements).forEach(key => {
      text = text.split(key).join(replacements[key]);
    });

    text = text.trim();

    if ((isSms && !sendSmsLink && !text.includes(appUrl)) || (forceAppendLink && !text.includes(appUrl))) {
      text += `\n\n${language === 'en' ? 'Link:' : 'Kiungo:'}\n${appUrl}`;
    }

    return text;
  };

  const cleanPhoneForWhatsapp = (phoneStr: string) => {
    if (!phoneStr) return "";
    let cleaned = phoneStr.replace(/\s+/g, '').replace(/[+\-]/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '255' + cleaned.substring(1);
    }
    if (!cleaned.startsWith('255') && cleaned.length === 9) {
      cleaned = '255' + cleaned;
    }
    return cleaned;
  };

  const [isDispatching, setIsDispatching] = useState(false);

  const handleSendSingle = (guestId: string, channel: 'sms' | 'whatsapp') => {
    console.log(`[Diagnostic] Single send triggered: guestId=${guestId}, channel=${channel}`);
    const target = guests.find(g => g.id === guestId);
    if (target) {
      setActiveSendTarget({ guest: target, channel });
      setCopySuccess(false);
    } else {
      console.warn(`[Diagnostic] Guest not found for ID: ${guestId}`);
    }
  };

  const handleConfirmSent = async (guestId: string, channel: 'sms' | 'whatsapp') => {
    if (isDispatching) {
      console.log("[Diagnostic] Already dispatching, ignoring click.");
      return;
    }
    
    const target = guests.find(g => g.id === guestId);
    if (!target) {
      console.warn(`[Diagnostic] Target guest for confirmation not found: ${guestId}`);
      return;
    }

    console.log(`[Diagnostic] Confirm Sent: id=${guestId}, channel=${channel}`);
    setIsDispatching(true);
    
    try {
      const mainText = getGuestMessageText(target, channel === 'sms');
      const formattedScheduleTime = isScheduling && scheduleTime ? scheduleTime.replace('T', ' ') + ':00' : undefined;

      // Extract template params dynamically for official Meta WhatsApp template matching
      let templateParams: string[] | undefined = undefined;
      if (channel === 'whatsapp') {
        const rawTemplate = language === 'en' ? invitationTemplateEn : invitationTemplateSw;
        const currentOrigin = typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.origin.includes('run.app') 
          ? window.location.origin 
          : 'https://eventcard.co.tz';
        const appUrl = `${currentOrigin}/?invite=${target.code || target.id}&std=true&eventId=${event.id}&lang=${language}`;
        const contacts = [event.contact1, event.contact2, event.contact3].filter(Boolean).join('\n');

        const replacements: { [key: string]: string } = {
          '{mgeni}': target.name,
          '{name}': target.name,
          '{guestName}': target.name,
          '{jina_la_mgeni}': target.name,
          '(jina_la_mgeni)': target.name,
          '{mwenyeji}': event.hostName || "[Mwenyeji]",
          '{hostName}': event.hostName || "[Mwenyeji]",
          '{host_name}': event.hostName || "[Mwenyeji]",
          '{sherehe}': event.name || "[Sherehe]",
          '{event_name}': event.name || "[Sherehe]",
          '{eventName}': event.name || "[Sherehe]",
          '{tarehe}': event.date || "26/11/2026",
          '{date}': event.date || "26/11/2026",
          '{eventDate}': event.date || "26/11/2026",
          '{muda}': `${event.time || "12:00"} ${event.period || "Mchana"}`,
          '{time}': `${event.time || "12:00"} ${event.period || "Mchana"}`,
          '{eventTime}': `${event.time || "12:00"} ${event.period || "Mchana"}`,
          '{ukumbi}': event.eventHallName || "[Ukumbi]",
          '{venue}': event.eventHallName || "[Ukumbi]",
          '{eventHall}': event.eventHallName || "[Ukumbi]",
          '{vazi}': event.dressCode || "[Vazi]",
          '{dressCode}': event.dressCode || "[Dress Code]",
          '{kiungo}': appUrl,
          '{inviteUrl}': appUrl,
          '{namba_mwaliko}': target.code || "[Code]",
          '{card_number}': target.code || "[Code]",
          '{inviteCode}': target.code || "[Code]",
          '{aina}': target.cardType || "DOUBLE",
          '{card_type}': target.cardType || "DOUBLE",
          '{mwasiliano}': contacts,
          '{contact_1_name}': event.contact1Name || "",
          '{contact_1_phone}': event.contact1 || "",
          '{contact_2_name}': event.contact2Name || "",
          '{contact_2_phone}': event.contact2 || ""
        };

        const regex = /\{[a-zA-Z0-9_\-Hh]+\}/g;
        const matches = rawTemplate.match(regex) || [];
        templateParams = matches.map(match => {
          const val = replacements[match];
          return val !== undefined ? val : match;
        });
      }
      
      // Use the simulation or Gateway API
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId,
          phone: target.phone,
          text: mainText,
          channel,
          scheduleTime: formattedScheduleTime,
          templateParams
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Utumaji kupitia gateway umeshindwa.");

      // If it was SMS, also send the link separately if enabled
      if (channel === 'sms' && sendSmsLink) {
        const currentOrigin = typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.origin.includes('run.app') 
          ? window.location.origin 
          : 'https://eventcard.co.tz';
        const appUrl = `${currentOrigin}/?invite=${target.code || target.id}&std=true&eventId=${event.id}&lang=${language}`;
        // Short delay between messages
        await new Promise(resolve => setTimeout(resolve, 500));
        await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: target.phone,
            text: `Pata kadi yako hapa: ${appUrl}`,
            channel: 'sms',
            scheduleTime: formattedScheduleTime
          })
        });
      }
      
      console.log(`[Diagnostic] API Success:`, data);

      // Update state
      const updated = guests.map(g => {
        if (g.id === guestId) {
          const currentSmsCount = typeof g.smsCount === 'number' ? g.smsCount : (g.smsStatus === 'Imetumia' ? 1 : 0);
          const currentWhatsappCount = typeof g.whatsappCount === 'number' ? g.whatsappCount : (g.whatsappStatus === 'Imetumia' ? 1 : 0);
          return {
            ...g,
            smsStatus: channel === 'sms' ? 'Imetumia' as const : g.smsStatus,
            whatsappStatus: channel === 'whatsapp' ? 'Imetumia' as const : g.whatsappStatus,
            smsCount: channel === 'sms' ? currentSmsCount + 1 : currentSmsCount,
            whatsappCount: channel === 'whatsapp' ? currentWhatsappCount + 1 : currentWhatsappCount
          };
        }
        return g;
      });
      onUpdateGuests(updated);

      setSendLogs(prev => [
        `[${new Date().toLocaleTimeString()}] ✓ [${channel.toUpperCase()}] Imekamilika kwa ${target.name}${formattedScheduleTime ? ' (Scheduled)' : ''}. ${data.batchId ? `Batch ID: ${data.batchId}` : `Gateway Info: ${data.log || 'Sawa'}`}`,
        ...prev
      ]);
      
      setActiveSendTarget(null);
    } catch (err: any) {
      console.error("[Diagnostic] Send Failure:", err);
      alert("Hitilafu katika utumaji: " + err.message);
      setSendLogs(prev => [
        `[${new Date().toLocaleTimeString()}] ✗ Imeshindwa kwa mgeni: ${target.name}. Sababu: ${err.message}`,
        ...prev
      ]);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleSendAll = async () => {
    if (isSendingAll || isBatchSending) return;
    
    // Only send to guests that are currently visible/filtered
    if (filteredGuests.length === 0) {
      alert("Samahani, hakuna wageni katika orodha ya sasa wa kutumiwa ujumbe huu.");
      return;
    }

    const pendingGuests = filteredGuests.filter(g => g.smsStatus !== 'Imetumia');
    
    if (pendingGuests.length === 0) {
      alert("Hakuna wageni katika orodha hii ambao hawajapata SMS bado!");
      return;
    }

    const formattedScheduleTime = isScheduling && scheduleTime ? scheduleTime.replace('T', ' ') + ':00' : undefined;

    const confirmMsg = `Je, una uhakika unataka kutuma mialiko kwa wageni ${pendingGuests.length} ambao bado hawajapata SMS${formattedScheduleTime ? ' kwa muda ' + formattedScheduleTime : ''}?`;

    if (!confirm(confirmMsg)) {
      return;
    }

    // IF PROVIDER IS MESEJI, WE CAN DO A REAL BATCH SEND IN ONE GO
    if (gatewaySettings.provider === 'meseji') {
      setIsBatchSending(true);
      setLastBatchId(null);
      setSendLogs(prev => [`[INFO] Imeanza kuwasilisha ujunbe wa BATCH kwa Meseji API kwa wageni ${pendingGuests.length}...`, ...prev]);

      try {
        // Use a generic version of the template for batch send (no personalized tags or resolve them generic)
        const sampleText = getGuestMessageText(pendingGuests[0], true);
        
        const res = await fetch('/api/send-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestIds: pendingGuests.map(g => g.id),
            message: sampleText,
            scheduleTime: formattedScheduleTime
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Batch dispatch failed.");

        setLastBatchId(data.batchId);
        
        // Update all guest statuses locally
        const updated = guests.map(g => {
          if (pendingGuests.find(pg => pg.id === g.id)) {
            const currentCount = typeof g.smsCount === 'number' ? g.smsCount : (g.smsStatus === 'Imetumia' ? 1 : 0);
            return { 
              ...g, 
              smsStatus: 'Imetumia' as const,
              smsCount: currentCount + 1
            };
          }
          return g;
        });
        onUpdateGuests(updated);

        setSendLogs(prev => [
          `[${new Date().toLocaleTimeString()}] ✓ BATCH SUCCESS! Batch ID: ${data.batchId || 'N/A'}. Total: ${data.total}`,
          ...prev
        ]);
        
        alert(`Ujumbe wa pamoja (Batch) umekubaliwa na Meseji API!\n\nBatch ID: ${data.batchId || 'N/A'}\nJumla ya Wageni: ${data.total}`);

      } catch (err: any) {
        setSendLogs(prev => [
          `[${new Date().toLocaleTimeString()}] ✗ BATCH FAILED. Sababu: ${err.message}`,
          ...prev
        ]);
        alert("Hitilafu katika utumaji wa Batch: " + err.message);
      } finally {
        setIsBatchSending(false);
      }
      return;
    }

    // FALLBACK: SEQUENTIAL SEND (FOR OTHER PROVIDERS OR SIMULATION)
    setIsSendingAll(true);
    setSendingProgress(0);
    setSendLogs(prev => [`[INFO] Imeanza kuwasilisha ujumbe (${messageType.toUpperCase()}) kwa wageni ${pendingGuests.length} kwa njia ya SMS (Mlolongo)...`, ...prev]);

    let sentCount = 0;
    // Use a local copy for processing to avoid closure issues with 'guests' prop updates
    let processingGuests = [...guests];

    for (let i = 0; i < pendingGuests.length; i++) {
      const guest = pendingGuests[i];
      setCurrentSendingIndex(i);

      setSendLogs(prev => [`[WAIT] Inatuma kwa ${guest.name} (${guest.phone})...`, ...prev]);

      try {
        const mainText = getGuestMessageText(guest, true); // Strip link from main text
        const currentOrigin = typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.origin.includes('run.app') 
          ? window.location.origin 
          : 'https://eventcard.co.tz';
        const appUrl = `${currentOrigin}/?invite=${guest.code || guest.id}&std=true&eventId=${event.id}&lang=${language}`;
        
        // 1. Send Main Message
        const res = await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: guest.id,
            phone: guest.phone,
            text: mainText,
            channel: 'sms',
            scheduleTime: formattedScheduleTime
          })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Mwituko batili");

        // 2. Send Link as separate SMS if enabled
        if (sendSmsLink) {
          // Short delay between messages for the same guest
          await new Promise(resolve => setTimeout(resolve, 500));

          await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: guest.phone,
              text: `Pata kadi yako hapa: ${appUrl}`,
              channel: 'sms',
              scheduleTime: formattedScheduleTime
            })
          });
        }

        // Update local processing state and fire onUpdateGuests to parent
        processingGuests = processingGuests.map(g => {
          if (g.id === guest.id) {
            const currentCount = typeof g.smsCount === 'number' ? g.smsCount : (g.smsStatus === 'Imetumia' ? 1 : 0);
            return { 
              ...g, 
              smsStatus: 'Imetumia' as const,
              smsCount: currentCount + 1
            };
          }
          return g;
        });
        onUpdateGuests(processingGuests);

        setSendLogs(prev => [
          `[${new Date().toLocaleTimeString()}] ✓ Imetumwa kwa: ${guest.name}. Gateway: ${data.log || 'Sawa'}`,
          ...prev
        ]);
      } catch (err: any) {
        setSendLogs(prev => [
          `[${new Date().toLocaleTimeString()}] ✗ Imeshindwa kwa: ${guest.name}. Sababu: ${err.message}`,
          ...prev
        ]);
      }

      sentCount++;
      setSendingProgress(Math.round((sentCount / pendingGuests.length) * 100));

      // 1.5 seconds cooldown standard to give gateways breathing space
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    setIsSendingAll(false);
    setCurrentSendingIndex(-1);
    setSendingProgress(100);
    setSendLogs(prev => [`[SUCCESS] ✓ Zoezi la kutuma kwa wingi limekamilishwa!`, ...prev]);
  };

  const handleReset = () => {
    const reset = guests.map(g => ({
      ...g,
      smsStatus: 'Sijatuma' as const,
      whatsappStatus: 'Sijatuma' as const,
      smsCount: 0,
      whatsappCount: 0
    }));
    onUpdateGuests(reset);
    setSendLogs([]);
    setSendingProgress(0);
  };

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[1.75rem] p-6 sm:p-8 space-y-6 font-sans text-xs text-white" id="send-messages-container">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-400 animate-pulse" />
            <span>Sambaza Kadi na Vikumbusho (Messages)</span>
          </h2>
          <p className="text-slate-350 mt-0.5">Tuma mialiko au vikumbusho kwa wageni kwa SMS au WhatsApp.</p>
        </div>

        <div className="flex gap-2 self-start sm:self-auto font-semibold flex-wrap items-center">
          {gatewaySettings.provider !== 'simulation' && gatewaySettings.senderId && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold ${
              gatewaySettings.senderIdStatus === 'approved' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : gatewaySettings.senderIdStatus === 'pending'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span>{gatewaySettings.senderId}: {
                gatewaySettings.senderIdStatus === 'approved' ? 'IMETHIBITISHWA' :
                gatewaySettings.senderIdStatus === 'pending' ? 'INAHAKIKIWA...' : 'IMEKATALIWA'
              }</span>
            </div>
          )}

          {filteredGuests.length > 0 && (
            <button
              onClick={handleReset}
              className="text-slate-200 border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition flex items-center gap-1 font-bold text-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Hali</span>
            </button>
          )}

          <div className="flex items-center space-x-2 border border-white/10 bg-white/5 rounded-xl px-2 py-1">
            <label className="text-[10px] text-slate-300 font-bold flex items-center gap-1 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isScheduling} 
                onChange={(e) => setIsScheduling(e.target.checked)} 
                className="w-3 h-3 rounded"
              />
              Schedule
            </label>
            {isScheduling && (
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="bg-[#070b13] border border-white/10 text-slate-200 text-[10px] rounded px-2 py-1 outline-none"
              />
            )}
          </div>

          <button
            onClick={handleSendAll}
            disabled={isSendingAll || filteredGuests.length === 0}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-white px-4 py-2 rounded-xl transition flex items-center gap-1.5 font-bold shadow disabled:bg-white/10 disabled:text-slate-500 disabled:cursor-not-allowed text-xs cursor-pointer"
          >
            <PlayCircle className="w-4 h-4" />
            <span>{isSendingAll ? 'Inatuma...' : isScheduling ? 'Weka Ratiba' : 'Tuma Zote'}</span>
          </button>
        </div>
      </div>

      {/* Message Type Selector */}
      <div className="flex items-center space-x-2 border-b border-white/10 pb-2">
        {[
          { id: 'invitation', label: 'Invitations' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setMessageType(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
              messageType === tab.id 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-slate-400 hover:bg-white/5 border border-transparent'
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Numerical Sending Metrics cards wrapper */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <p className="text-[9px] uppercase font-mono tracking-wider text-slate-400 font-bold">Wageni Waliobakia</p>
          <p className="text-2xl font-extrabold text-white mt-1">{countPending}</p>
        </div>

        <div className="backdrop-blur-md bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
          <p className="text-[9px] uppercase font-mono tracking-wider text-emerald-300 font-bold">Imetuma SMS</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-1">{countSmsSent}</p>
        </div>

        <div className="backdrop-blur-md bg-teal-500/10 border border-teal-500/20 rounded-2xl p-4 text-center">
          <p className="text-[9px] uppercase font-mono tracking-wider text-teal-300 font-bold">Imetuma WhatsApp</p>
          <p className="text-2xl font-extrabold text-teal-400 mt-1">{countWhatsappSent}</p>
        </div>

        <div className="backdrop-blur-md bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
          <p className="text-[9px] uppercase font-mono tracking-wider text-blue-300 font-bold">Jumla Iliyotekelezwa</p>
          <p className="text-2xl font-extrabold text-blue-400 mt-1">
            {guests.length > 0 ? Math.round(((guests.length - countPending) / guests.length) * 100) : 0}%
          </p>
        </div>

      </div>

      {/* Progress tracker inside sending state */}
      {(isSendingAll || isBatchSending) && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3.5 text-xs">
          <div className="flex justify-between items-center font-semibold text-white">
            <div className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 text-blue-400 ${isBatchSending ? 'animate-spin' : ''}`} />
              <span>{isBatchSending ? 'Inatuma Batch ya Meseji API...' : 'Inasambaza Kadi za Mialiko kwa Wingi...'}</span>
            </div>
            {!isBatchSending && (
              <span className="font-mono text-blue-400">{sendingProgress}% ({currentSendingIndex}/{guests.length})</span>
            )}
            {isBatchSending && (
              <span className="font-mono text-amber-400 animate-pulse italic">Processing Batch...</span>
            )}
          </div>
          
          <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden relative">
            {isBatchSending ? (
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-1/2 h-full opacity-70"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                style={{ width: `${sendingProgress}%` }}
              />
            )}
          </div>
          
          {isBatchSending && (
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <AlertCircle className="w-3 h-3 text-amber-500" />
              <span>Tafadhali usifunge dirisha hili hadi mwitikio wa Batch ID upatikane kutoka kwa Meseji API.</span>
            </div>
          )}
          
          {!isBatchSending && (
            <p className="text-[10px] text-slate-400 italic">Mchakato unatumia simulation ya API kufikisha mialiko yenye picha binafsi ya kadi na nambari ya siri ya QR.</p>
          )}
        </div>
      )}

      {/* Success Feedback for Batch */}
      {lastBatchId && !isBatchSending && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-400">Batch Imewasilishwa kwa Mafanikio!</p>
              <p className="text-[10px] text-emerald-300/70 font-mono">BATCH ID: <span className="bg-emerald-500/20 px-1.5 py-0.5 rounded select-all font-bold">{lastBatchId}</span></p>
            </div>
          </div>
          <button 
            onClick={() => setLastBatchId(null)}
            className="p-1 hover:bg-white/5 rounded-lg text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Template Editor Section */}
      <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4" id="template-editor-box">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                Hariri Muundo wa Mwaliko (Edit Invitation Template)
              </h3>
              <p className="text-[10px] text-slate-400">
                Badilisha maandishi ya mwaliko yatakayotumwa kwa kila mgeni kwa kutumia mifano ya mabano dynamic.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetTemplate}
            className="text-[10px] text-slate-400 hover:text-white border border-white/10 hover:bg-white/5 px-2.5 py-1.5 rounded-lg transition font-mono flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3" />
            Rudisha ya Msingi (Default)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Editor Area */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label htmlFor="message-template-textarea" className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400">
                Ujumbe wa Mwaliko (Andika hapa)
              </label>
              <span className="text-[9px] text-[#10b981] font-bold font-mono">● Auto-saves to storage</span>
            </div>
            
            <textarea
              id="message-template-textarea"
              value={activeTemplateValue}
              onChange={(e) => setActiveTemplateValue(e.target.value)}
              rows={7}
              className="w-full bg-[#070b13] border border-white/10 rounded-xl p-3 text-white font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 leading-relaxed resize-y scrollbar-thin select-all"
              placeholder="Andika mwaliko wako wa mgeni..."
            />

            {/* Custom Option: Conserve SMS Credits Toggle */}
            <div className="p-3.5 rounded-xl border border-white/5 bg-slate-950/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    id="toggle-sms-link"
                    type="checkbox"
                    checked={sendSmsLink}
                    onChange={(e) => setSendSmsLink(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/30 bg-slate-900 border-white/10 cursor-pointer"
                  />
                  <label htmlFor="toggle-sms-link" className="text-[10.5px] font-bold text-slate-200 cursor-pointer select-none">
                    Tuma Kiungo cha Kadi (Link) katika SMS ya pili?
                  </label>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  sendSmsLink ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'
                }`}>
                  {sendSmsLink ? 'SMS 2 + LINK' : 'SMS 1 YA MANENO PEKEE'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed pl-6">
                {sendSmsLink 
                  ? "ITAFIKA KWA SMS MBILI: Moja ni ujumbe wa maneno ya mialiko, na ya pili ni kiungo cha mtandaoni cha kadi. Inatumia salio zaidi ya SMS."
                  : "ITAFIKA KWA SMS MOJA TU: Inatuma ujumbe wako wa maandishi pekee bila kadi/kiungo ya picha. Inapunguza nusu ya gharama na inalinda salio lako la SMS 31!"
                }
              </p>
            </div>

            {/* Clickable Placeholders */}
            <div className="hidden space-y-1.5">
              <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500 block font-bold">
                Bofya vibandiko hivi kuweka taarifa zinazobadilika (Dynamic Placeholders):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { tag: '{name}', label: 'Jina la Mgeni' },
                  { tag: '{host_name}', label: 'Mwenyeji' },
                  { tag: '{event_name}', label: 'Sherehe' },
                  { tag: '{kiungo}', label: 'Kiungo cha Kadi' },
                  { tag: '{date}', label: 'Tarehe' },
                  { tag: '{venue}', label: 'Ukumbi' },
                  { tag: '{time}', label: 'Muda' },
                  { tag: '{card_number}', label: 'Namba ya Kadi' },
                  { tag: '{card_type}', label: 'Aina ya Kadi' },
                  { tag: '{contact_1_name}', label: 'Mwasiliano 1' },
                  { tag: '{contact_2_name}', label: 'Mwasiliano 2' }
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => insertPlaceholder(item.tag)}
                    className="px-2 py-1 bg-white/5 hover:bg-blue-500/20 hover:text-blue-200 text-[10px] text-slate-300 border border-white/10 hover:border-blue-500/30 rounded-lg transition font-mono font-medium cursor-pointer"
                    title={`Click to insert ${item.tag}`}
                  >
                    <span className="text-blue-400 font-extrabold font-mono">{item.tag}</span> <span className="text-slate-500 italic">({item.label})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Preview Area */}
          <div className="flex flex-col h-full bg-[#070b13]/50 rounded-xl border border-white/5 p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center space-x-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-300 font-bold">Live Dynamic Preview (Mfano kwa mgeni wa kwanza)</span>
              </div>
              {guests.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold font-mono font-sans">
                  Mgeni: {guests[0].name}
                </span>
              )}
            </div>

            <div className="flex-grow bg-[#04080e] p-3.5 rounded-lg border border-white/5 font-mono text-[10.5px] text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[190px] overflow-y-auto select-all scrollbar-thin">
              {guests.length > 0 ? getGuestMessageText(guests[0], false) : "Tafadhali kwanza ingiza wageni katika sehemu ya 'Wageni' ili kuona preview hapa."}
            </div>

            <div className="text-[9.5px] text-slate-400 flex items-start space-x-1.5 leading-normal">
              <span className="text-amber-500 text-[11px] font-bold">ℹ</span>
              <p>Mabadiliko yoyote unayofanya hapa yatasasisha ujumbe wote utakaotembea kupitia WhatsApp na SMS kwenye jedwali hapo chini.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Split visual: Left list of guests, Right terminal log summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Guest List and Actions (8 Cols) */}
        <div className="lg:col-span-8 border border-white/10 rounded-2xl overflow-hidden bg-white/5 text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 text-slate-400 font-mono uppercase text-[9px] border-b border-white/10">
                  <th className="px-5 py-3">{isEn ? 'Guest Name' : 'Jina la Mgeni'}</th>
                  <th className="px-5 py-3">{isEn ? 'Phone' : 'Phone'}</th>
                  <th className="px-5 py-3 text-center">RSVP</th>
                  <th className="px-5 py-3 text-center">{isEn ? 'SMS Status' : 'Hali SMS'}</th>
                  <th className="px-5 py-3 text-center">{isEn ? 'WhatsApp Status' : 'Hali WhatsApp'}</th>
                  <th className="px-5 py-3 text-right">{isEn ? 'Action' : 'Zoezi la Kutuma'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white">
                {filteredGuests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500 italic">
                      {messageType === 'save_the_date' 
                        ? 'Hakuna wageni waliothibitisha kuhudhuria bado. Save the Date inatumwa kwa wale walioweka "Atahudhuria" pekee.'
                        : 'Hakuna wageni waliopatikana.'}
                    </td>
                  </tr>
                ) : (
                  filteredGuests.map((guest) => (
                    <tr key={guest.id} className="hover:bg-white/5 transition border-b border-white/5">
                      <td className="px-5 py-4 font-bold text-white">
                        <div>{guest.name}</div>
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-300">{guest.phone}</td>
                      
                      {/* RSVP STATUS */}
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          guest.rsvpStatus === 'Atahudhuria' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : guest.rsvpStatus === 'Hatahudhuria'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-white/5 text-slate-400 border-white/10'
                        }`}>
                          {guest.rsvpStatus}
                        </span>
                      </td>

                      {/* SMS STATUS BADGE */}
                      <td className="px-5 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            guest.smsStatus === 'Imetumia' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-white/5 text-slate-400 border-white/10'
                          }`}>
                            {guest.smsStatus}
                          </span>
                          {guest.smsStatus === 'Imetumia' && (
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              Zilizotumwa: <strong className="text-emerald-400 font-bold">{guest.smsCount || 1}</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* WHATSAPP STATUS BADGE */}
                      <td className="px-5 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            guest.whatsappStatus === 'Imetumia' 
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                              : 'bg-white/5 text-slate-400 border-white/10'
                          }`}>
                            {guest.whatsappStatus}
                          </span>
                          {guest.whatsappStatus === 'Imetumia' && (
                            <span className="text-[10px] text-slate-400 font-mono font-normal">
                              Zilizotumwa: <strong className="text-blue-400 font-bold">{guest.whatsappCount || 1}</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3 text-right space-x-1.5 flex justify-end items-center font-bold">
                        {/* Edit information button */}
                        <button
                          onClick={() => handleStartEdit(guest)}
                          className={`p-1 px-2 border transition rounded-lg text-[10px] cursor-pointer ${
                            editingGuest?.id === guest.id 
                              ? 'bg-blue-500 text-white border-blue-400' 
                              : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border-transparent'
                          }`}
                          title="Hariri Taarifa za Mgeni"
                        >
                          Hariri (Edit)
                        </button>

                        {/* Reset Status button */}
                        {(guest.smsStatus === 'Imetumia' || guest.whatsappStatus === 'Imetumia') && (
                          <button
                            onClick={() => handleResetSingleGuest(guest.id)}
                            className="p-1 px-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg transition cursor-pointer text-[10px]"
                            title="Futa Hali ya Kutuma"
                          >
                            Reset Hali
                          </button>
                        )}

                        <button
                          onClick={() => handleSendSingle(guest.id, 'sms')}
                          disabled={guest.smsStatus === 'Imetumia' || isSendingAll}
                          className={`px-2 py-1.5 border rounded-lg font-bold transition text-[11px] cursor-pointer ${
                            activeSendTarget?.guest.id === guest.id && activeSendTarget.channel === 'sms'
                              ? 'bg-emerald-500 text-white border-emerald-400'
                              : 'bg-white/5 hover:bg-white/10 text-emerald-400 hover:text-emerald-300 border-white/10 disabled:bg-white/5 disabled:text-slate-600 disabled:border-transparent'
                          }`}
                        >
                          SMS
                        </button>
                        <button
                          onClick={() => handleSendSingle(guest.id, 'whatsapp')}
                          disabled={guest.whatsappStatus === 'Imetumia' || isSendingAll}
                          className={`px-2 py-1.5 border rounded-lg font-bold transition text-[11px] cursor-pointer ${
                            activeSendTarget?.guest.id === guest.id && activeSendTarget.channel === 'whatsapp'
                              ? 'bg-blue-500 text-white border-blue-400'
                              : 'bg-white/5 hover:bg-white/10 text-blue-450 hover:text-blue-305 border-white/10 disabled:bg-white/5 disabled:text-slate-600 disabled:border-transparent'
                          }`}
                        >
                          WA
                        </button>
                      </td>
                    </tr>
                  ))
                )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Right simulated cloud logger (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          <h4 className="font-bold text-slate-300 text-[10px] uppercase font-mono tracking-wider">Miamala na Kumbukumbu ya Kutuma (Logs)</h4>
          <div className="flex-grow bg-slate-950/60 rounded-2xl p-4 font-mono text-[9px] h-[300px] overflow-y-auto border border-white/10 space-y-1.5 leading-relaxed antialiased">
            {sendLogs.length === 0 ? (
              <p className="text-slate-600 italic">Kubonyeza "Vuta na Tuma zote" au kutuma kadi moja mmoja kutaorodhesha taarifa za kadi hapa...</p>
            ) : (
              sendLogs.map((log, i) => {
                const isError = log.includes('✗') || log.includes('Imeshindwa') || log.includes('Hitilafu');
                return (
                  <div key={i} className={`animate-fade-in ${isError ? 'text-rose-400 font-semibold' : 'text-emerald-400'}`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Navigation section */}
      <div className="flex justify-end pt-4 border-t border-white/10">
        <button
          onClick={onNext}
          className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-white font-bold rounded-xl transition shadow flex items-center space-x-2 text-xs"
        >
          <span>Fuatilia Majibu ya Wageni (RSVP Responses)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <PortalModal key="reset-confirm-portal">
            <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md z-[9999]" id="reset-template-modal">
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 font-sans text-xs text-white animate-fade-in"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/35 flex items-center justify-center text-amber-500 mx-auto">
                  <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H19" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white">
                    Kurudisha Kiolezo Msingi?
                  </h3>
                  <p className="text-xs text-slate-400 leading-normal">
                    Je, una uhakika unataka kurudisha muundo wa ujumbe wa msingi (Default Template)? Kitendo hiki kitafuta mabadiliko yoyote uliyofanya kwenye ujumbe huu kwa sasa.
                  </p>
                </div>
                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-grow py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-bold text-slate-355 transition cursor-pointer"
                  >
                    Ghairi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      executeResetTemplate();
                      setShowResetConfirm(false);
                    }}
                    className="flex-grow py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 hover:shadow-[0_0_15px_rgba(245,158,11,0.30)] text-xs font-bold text-white transition cursor-pointer"
                  >
                    Ndiyo, Rudisha
                  </button>
                </div>
              </motion.div>
            </div>
          </PortalModal>
        )}
      </AnimatePresence>

      {/* 2. Modal: Edit Guest */}
      <AnimatePresence>
        {editingGuest && (
          <PortalModal key="edit-guest-portal">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="backdrop-blur-xl bg-[#090f1d] rounded-3xl p-6 sm:p-8 max-w-md w-full border border-white/15 shadow-2xl space-y-5 text-xs font-sans relative text-white text-left"
              >
                <button 
                  onClick={() => setEditingGuest(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white transition cursor-pointer"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-base font-bold text-white pr-8">
                  {isEn ? 'Edit Guest Information' : 'Hariri Taarifa za Mgeni'}
                </h3>
                
                <form onSubmit={handleSaveEditGuest} className="space-y-4 text-xs font-sans">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="edit-send-mgeni-name">
                      {isEn ? 'GUEST NAME *' : 'JINA LA MGENI *'}
                    </label>
                    <input 
                      id="edit-send-mgeni-name"
                      type="text" 
                      required 
                      placeholder="Weka jina la mgeni..."
                      value={editGuestName}
                      onChange={(e) => setEditGuestName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="edit-send-mgeni-phone">
                      {isEn ? 'PHONE NUMBER *' : 'NAMBA YA SIMU *'}
                    </label>
                    <input 
                      id="edit-send-mgeni-phone"
                      type="tel" 
                      required 
                      placeholder="e.g. 0714786751"
                      value={editGuestPhone}
                      onChange={(e) => setEditGuestPhone(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-355 block" htmlFor="edit-send-mgeni-type">
                      {isEn ? 'CARD / TABLE TYPE *' : 'KUNDI / AINA YA KADI *'}
                    </label>
                    <select
                      id="edit-send-mgeni-type"
                      value={editGuestType}
                      onChange={(e) => setEditGuestType(e.target.value)}
                      className="w-full bg-[#050b18] border border-white/15 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold cursor-pointer"
                    >
                      <option value="SINGLE">SINGLE</option>
                      <option value="DOUBLE">DOUBLE</option>
                      <option value="UNCLASSIFIED">UNCLASSIFIED</option>
                    </select>
                  </div>

                  <div className="flex space-x-2 pt-2 border-t border-white/5">
                    <button 
                      type="button"
                      onClick={() => setEditingGuest(null)}
                      className="flex-grow py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition cursor-pointer text-center"
                    >
                      {isEn ? 'Cancel' : 'Ghairi'}
                    </button>
                    <button 
                      type="submit"
                      className="flex-grow py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white font-bold rounded-xl transition shadow-md cursor-pointer text-center"
                    >
                      {isEn ? 'Save Changes ✓' : 'Hifadhi ✓'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </PortalModal>
        )}
      </AnimatePresence>

      {/* 3. Modal: Active Send Target / Card Dispatch Modals */}
      <AnimatePresence>
        {activeSendTarget && (
          <PortalModal key="active-send-portal">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="send-dispatch-overlay-modal">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-[#0f172a] border border-white/10 rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-2xl space-y-4 text-left font-sans text-white relative"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center space-x-2">
                  <div className={`p-2 rounded-xl ${activeSendTarget.channel === 'whatsapp' ? 'bg-teal-500/10 text-teal-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">
                      {isEn 
                        ? `Send via ${activeSendTarget.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}` 
                        : `Tuma kwa ${activeSendTarget.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`}
                    </h3>
                    <p className="text-[10px] text-slate-455 font-medium font-sans">
                      {isEn ? 'Guest:' : 'Mgeni:'} <span className="text-white font-bold">{activeSendTarget.guest.name}</span> ({activeSendTarget.guest.phone})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSendTarget(null)}
                  className="p-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition cursor-pointer absolute top-4 right-4"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message Body Box */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider">
                    {isEn ? 'MESSAGE CONTENT' : 'MAUDHUI YA UJUMBE'}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getGuestMessageText(activeSendTarget.guest, activeSendTarget.channel === 'sms', activeSendTarget.channel === 'whatsapp'));
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className="flex items-center space-x-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition cursor-pointer"
                    type="button"
                  >
                    {copySuccess ? <Check className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                    <span>{copySuccess ? (isEn ? 'Copied!' : 'Imenakiliwa!') : (isEn ? 'Copy Ujumbe' : 'Copy Ujumbe')}</span>
                  </button>
                </div>
                
                <div className="bg-slate-950 p-4 rounded-xl border border-white/5 font-mono text-[10.5px] text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[140px] overflow-y-auto select-all scrollbar-thin">
                  {getGuestMessageText(activeSendTarget.guest, activeSendTarget.channel === 'sms', activeSendTarget.channel === 'whatsapp')}
                </div>
              </div>

              {/* Visual Card Preview and Secure Local Downloader */}
              <div className="flex flex-col items-center justify-center p-3.5 bg-slate-950/60 rounded-xl border border-white/5 space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 self-start font-mono uppercase tracking-wider">
                  {isEn ? 'INVITATION CARD PREVIEW' : 'MUONEKANO WA KADI YA MWALIKO (INVITATION CARD)'}
                </span>
                
                <div className="relative group overflow-hidden rounded-lg border border-white/10 shadow-lg min-h-[150px] w-full flex items-center justify-center bg-[#070b13]">
                  {!modalImageLoaded ? (
                    <div className="flex flex-col items-center justify-center p-6 space-y-2 text-slate-400">
                      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <p className="text-[10px]">{isEn ? 'Generating card preview...' : 'Inatengeneza muonekano wa kadi...'}</p>
                    </div>
                  ) : (
                    <img 
                      src={modalCardUrl} 
                      alt="Muonekano wa Kadi" 
                      className="w-40 sm:w-44 h-auto rounded-lg transition duration-200 group-hover:scale-[1.01]" 
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>

                {modalImageLoaded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-1">
                    <button
                      type="button"
                      onClick={handleCopyImageToClipboard}
                      className="py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-300 transition flex items-center justify-center space-x-1.5 cursor-pointer hover:text-blue-200 text-center"
                      title={isEn ? 'Copy invitation card image directly to clipboard' : 'Nakili picha hii moja kwa moja ili uweze kubandika (Paste) kwenye soga'}
                    >
                      {copyImageSuccess ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{isEn ? 'Copied!' : 'Picha Imenakiliwa!'}</span>
                        </>
                      ) : (
                        <>
                          <Clipboard className="w-3.5 h-3.5 text-blue-400" />
                          <span>📋 {isEn ? 'COPY CARD IMAGE' : 'COPY PICHA YA KADI'}</span>
                        </>
                      )}
                    </button>

                    <a
                      href={modalCardUrl}
                      download={`Mwaliko_${activeSendTarget.guest.name.trim().replace(/\s+/g, '_')}.jpg`}
                      className="py-2.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-300 transition flex items-center justify-center space-x-1.5 cursor-pointer hover:text-emerald-200 text-center"
                    >
                      <span>📥 {isEn ? 'DOWNLOAD CARD' : 'PAKUA PICHA YA KADI'}</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Guide/Instruction section */}
              <div className="bg-white/[0.01]/10 border border-white/5 p-4 rounded-xl text-[10.5px] text-slate-300 leading-normal space-y-1">
                <p className="font-bold text-white flex items-center space-x-1 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{isEn ? 'Quick Messaging Guide (Copy-Paste) :' : 'Mbinu wepesi ya Kutuma Ujumbe (Copy-Paste) :'}</span>
                </p>
                {activeSendTarget.channel === 'whatsapp' ? (
                  <div className="text-slate-400 text-left space-y-1.5">
                    <p className="border-l-2 border-emerald-500 pl-2">
                       <span className="text-emerald-400 font-bold block">🚀 NJIA RAHISI (Bila Kupakua):</span>
                       1. Bonyeza kitufe cha bluu cha <b>"📋 COPY PICHA YA KADI"</b> hapo juu. <br />
                       2. Bonyeza kitufe cha <b>"Copy Ujumbe"</b> upande wa juu wa ujumbe. <br />
                       3. Bonyeza <b>"Fungua WhatsApp"</b> chini. Soga ikifunguka, <b>Bandika (Paste / Ctrl+V)</b> picha, kisha bandika yale maandishi kama maelezo ya picha (caption) na utume! ✓
                    </p>
                    <p className="border-l-2 border-blue-500 pl-2 mt-1">
                       <span className="text-blue-400 font-bold block">💾 NJIA MBADALA (Kwa Kupakua):</span>
                       Kama kitufe cha copy kisizae katika kivinjari chako: Pakua picha kwa kubonyeza <b>"📥 PAKUA PICHA YA KADI"</b>, kisha pakia kama faili la picha kwenye soga ya mgeni na uweke ujumbe uliounakili kama caption.
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-400">
                    {isEn 
                      ? 'Copy the invitation message and download the card, then send to your guest via SMS/MMS.'
                      : 'Soma maelekezo ya kadi, kisha kabla ya kutuma mwaliko nakili ujumbe na uutumie pamoja na picha uliyopakua kwa njia ya SMS ili kuruhusu mratibu kuendelea naye.'}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveSendTarget(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-slate-300 transition cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'Ghairi'}
                </button>
                
                {activeSendTarget.channel === 'whatsapp' ? (
                  <a
                    href={`https://wa.me/${cleanPhoneForWhatsapp(activeSendTarget.guest.phone)}?text=${encodeURIComponent(getGuestMessageText(activeSendTarget.guest, false, true))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleConfirmSent(activeSendTarget.guest.id, 'whatsapp')}
                    className={`flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.30)] text-xs font-extrabold text-white transition flex items-center justify-center space-x-1.5 cursor-pointer text-center ${isDispatching ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{isDispatching ? (isEn ? 'Processing...' : 'Inachakata...') : (isEn ? 'Open WhatsApp' : 'Fungua WhatsApp')}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled={isDispatching}
                    onClick={() => handleConfirmSent(activeSendTarget.guest.id, 'sms')}
                    className={`flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-xs font-extrabold text-white transition cursor-pointer text-center ${isDispatching ? 'opacity-70 grayscale' : ''}`}
                  >
                    <span>{isDispatching ? (isEn ? 'Sending...' : 'Inatuma...') : (isEn ? 'Mark Sent ✓' : 'Kamilisha (Mark Sent) ✓')}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
          </PortalModal>
        )}
      </AnimatePresence>

    </div>
  );
}
