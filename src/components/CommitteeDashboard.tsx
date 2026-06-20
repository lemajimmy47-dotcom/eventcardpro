import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Coins, CheckCircle, AlertTriangle, TrendingUp, DollarSign, 
  Layers, Download, Printer, PlusCircle, Activity, Bell, Share2, 
  ExternalLink, Code, ShieldCheck, RefreshCw, Smartphone, Eye, Check, X, Clipboard,
  FolderOpen, FileText, Upload, Paperclip
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { EventDetails, Guest, CommitteeMember, CommitteeActivityLog, CommitteeNotification, ContributionPayment } from '../types';
import { safeLocalStorage } from '../utils/storage';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ContributionManager from './ContributionManager';

interface CommitteeDashboardProps {
  key?: React.Key;
  event: EventDetails;
  guests: Guest[];
  onUpdateEvent: (updated: EventDetails) => void;
  onUpdateGuests: (updated: Guest[]) => void;
}

export default function CommitteeDashboard({
  event,
  guests,
  onUpdateEvent,
  onUpdateGuests
}: CommitteeDashboardProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  // State for simulated fundraising target
  const fundraisingTarget = event.fundraisingGoal || 15000000;

  // State for simulated committee members
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [committeeRoles, setCommitteeRoles] = useState<{id: string; name: string; description: string; permissionLevel: string}[]>([]);

  // State for simulated logged-in committee role to showcase role-based features!
  const [activeRole, setActiveRole] = useState<'Event Owner' | 'Treasurer' | 'Secretary' | 'Committee Member'>('Event Owner');

  // Simulated live notifications state list
  const [notifications, setNotifications] = useState<CommitteeNotification[]>(() => {
    const saved = safeLocalStorage.getItem(`kadi_committee_notifications_${event.id}`);
    if (saved) return JSON.parse(saved);
    return [
      { id: 'n-1', type: 'pledge', title: 'Ahadi Mpya ya Mchango', message: 'Ally Khalfan amesajili ahadi mpya ya TZS 500,000.', createdAt: '04/06/2026 11:32', read: false },
      { id: 'n-2', type: 'payment', title: 'Malipo Mapya', message: 'Salma Khamis (Mweka Hazina) amesajili malipo ya TZS 300,000 kwa Ally Khalfan.', createdAt: '04/06/2026 12:15', read: false },
      { id: 'n-3', type: 'completed', title: 'Mchango Umekamilika', message: 'Fatma Said amekamilisha malipo yote ya ahadi yake ya TZS 1,000,000.', createdAt: '04/06/2026 13:02', read: false }
    ];
  });

  // Simulated activity logs of the committee members
  const [activityLogs, setActivityLogs] = useState<CommitteeActivityLog[]>(() => {
    const saved = safeLocalStorage.getItem(`kadi_committee_activity_${event.id}`);
    if (saved) return JSON.parse(saved);
    return [
      { id: 'a-1', user: 'James Lema (Chairperson)', role: 'Chairman', action: 'Alitazama muhtasari wa makusanyo', date: '04/06/2026', time: '10:14', ipAddress: '197.250.32.18' },
      { id: 'a-2', user: 'Salma Khamis (Treasurer)', role: 'Treasurer', action: 'Amesajili muamala wa malipo wa TZS 300,000', date: '04/06/2026', time: '12:15', ipAddress: '197.250.33.22' },
      { id: 'a-3', user: 'Emmanuel Shija (Secretary)', role: 'Secretary', action: 'Alipakua ripoti ya wageni wasioahidi', date: '04/06/2026', time: '12:40', ipAddress: '102.222.18.9' }
    ];
  });

  // Inner sub-tabs inside Committee Dashboard
  const [currentSubTab, setCurrentSubTab] = useState<'dashboard' | 'analytics' | 'reports' | 'members' | 'activity' | 'public-link' | 'contributions' | 'files'>('dashboard');

  // Event files list
  const [eventFiles, setEventFiles] = useState<{ id: string; name: string; size: string; type: string; category: 'pdf' | 'spreadsheet' | 'document' | 'image' | 'other'; uploadedAt: string; dataUrl?: string }[]>(() => {
    const saved = safeLocalStorage.getItem(`kadi_event_files_${event.id}`);
    if (saved) return JSON.parse(saved);
    // Seed with beautiful defaults to make it immediately functional
    return [
      { id: 'file-1', name: 'Bajeti_Kamati_Rasmi.xlsx', size: '142 KB', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: 'spreadsheet', uploadedAt: '12/06/2026 14:15' },
      { id: 'file-2', name: 'Programu_ya_Sherehe_Draft_v2.pdf', size: '840 KB', type: 'application/pdf', category: 'pdf', uploadedAt: '13/06/2026 09:30' },
      { id: 'file-3', name: 'Mchoro_wa_Kumbi_Main_Hall.png', size: '1.2 MB', type: 'image/png', category: 'image', uploadedAt: '14/06/2026 10:05' }
    ];
  });

  useEffect(() => {
    safeLocalStorage.setItem(`kadi_event_files_${event.id}`, JSON.stringify(eventFiles));
  }, [eventFiles, event.id]);

  // States for event files manager tab
  const [fileFilter, setFileFilter] = useState<'all' | 'pdf' | 'spreadsheet' | 'document' | 'image' | 'other'>('all');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Input states for registering new committee members
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPosition, setMemberPosition] = useState<'Chairperson' | 'Treasurer' | 'Secretary' | 'Committee Member' | 'Event Owner'>('Committee Member');
  const [memberMethod, setMemberMethod] = useState<'SMS' | 'WhatsApp' | 'Email'>('WhatsApp');
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [invitationLinkSent, setInvitationLinkSent] = useState<string | null>(null);

  // Treasurer Record Payment panel states
  const [showTreasurerPayModal, setShowTreasurerPayModal] = useState(false);
  const [treasuryTargetGuest, setTreasuryTargetGuest] = useState<Guest | null>(null);
  const [treasuryAmount, setTreasuryAmount] = useState<string>('');
  const [treasuryRef, setTreasuryRef] = useState<string>('');
  const [treasuryNotes, setTreasuryNotes] = useState<string>(isEn ? 'Direct collection' : 'Makusanyo ya kamati');

  // Public progress simulator modal
  const [showPublicProgressPreview, setShowPublicProgressPreview] = useState(false);

  // Auto-refresh timer state
  const [secondsToRefresh, setSecondsToRefresh] = useState(60);

  // Selected report type for CSV/PDF exports
  const [selectedReport, setSelectedReport] = useState<string>('Summary');

  // Dashboard Lock State
  const [isLocked, setIsLocked] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [loggedInRole, setLoggedInRole] = useState<'Event Owner' | 'Treasurer' | 'Secretary' | 'Committee Member' | null>(null);

  const handleLogout = () => {
    setIsLocked(true);
    setPinInput('');
    setLoggedInRole(null);
    setActiveRole('Event Owner');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const processUploadedFile = (file: File) => {
    if (file.size > 20 * 1024 * 1024) { // Increase to 20MB
      setUploadError(isEn ? "File is too large (max 20MB)" : "Faili ni kubwa kupita kiasi (max 20MB)");
      return;
    }
    
    const categoryFromType = (type: string): "pdf" | "spreadsheet" | "document" | "image" | "other" => {
      if (type.includes("pdf")) return "pdf";
      if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return "spreadsheet";
      if (type.includes("word") || type.includes("text") || type.includes("document")) return "document";
      if (type.includes("image")) return "image";
      return "other";
    };

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const newFile = {
        id: "file-" + Date.now(),
        name: file.name,
        type: file.type,
        size: (file.size / 1024).toFixed(1) + " KB",
        category: categoryFromType(file.type),
        dataUrl: content,
        uploadedAt: new Date().toLocaleString()
      };
      setEventFiles(prev => [newFile, ...prev]);
      setUploadError(null);
    };
    reader.readAsDataURL(file);
  };

  // GROUP LEVEL SUMMARIES CALCULATIONS
  const groupSummaries = useMemo(() => {
    const groupMap = new Map<string, { count: number; pledged: number; collected: number; balances: number }>();
    guests.forEach(g => {
      const cat = (g.cardType || 'SINGLE').toUpperCase();
      const pledge = g.pledgeAmount || 0;
      const paid = g.paidAmount || 0;
      const bal = pledge - paid;
      
      if (!groupMap.has(cat)) {
        groupMap.set(cat, { count: 0, pledged: 0, collected: 0, balances: 0 });
      }
      const data = groupMap.get(cat)!;
      data.count++;
      data.pledged += pledge;
      data.collected += paid;
      data.balances += bal;
    });

    const list = Array.from(groupMap.entries()).map(([name, data]) => ({
      name,
      ...data
    }));

    const totals = list.reduce(
      (acc, curr) => {
        acc.count += curr.count;
        acc.pledged += curr.pledged;
        acc.collected += curr.collected;
        acc.balances += curr.balances;
        return acc;
      },
      { count: 0, pledged: 0, collected: 0, balances: 0 }
    );

    return { list, totals };
  }, [guests]);

  // MASTER GUEST REVENUE DATABASE CALCULATIONS
  const masterGuestList = useMemo(() => {
    return [...guests].sort((a, b) => a.name.localeCompare(b.name)).map((g, index) => {
      const pledge = g.pledgeAmount || 0;
      const paid = g.paidAmount || 0;
      const bal = pledge - paid;
      let clearance: 'Pending' | 'Partial' | 'Completed' = 'Pending';
      if (pledge > 0) {
        if (paid >= pledge) {
          clearance = 'Completed';
        } else if (paid > 0) {
          clearance = 'Partial';
        }
      } else {
        clearance = 'Pending';
      }
      return {
        sn: index + 1,
        name: g.name,
        phone: g.phone || '-',
        category: (g.cardType || 'SINGLE').toUpperCase(),
        pledge,
        paid,
        balance: bal,
        clearance
      };
    });
  }, [guests]);

  // Save Event Goal
  const handleSaveGoal = (goalVal: number) => {
    const updated = { ...event, fundraisingGoal: goalVal };
    onUpdateEvent(updated);
    addActivityLog('Event Owner (Admin)', 'Alibadilisha Fundraising Goal kufikia TZS ' + goalVal.toLocaleString());
  };

  // Helper to add activity logs
  const addActivityLog = (user: string, action: string) => {
    const newLog: CommitteeActivityLog = {
      id: 'a-' + Date.now(),
      user,
      role: activeRole,
      action,
      date: new Date().toLocaleDateString('sw-TZ'),
      time: new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
      ipAddress: '197.250.' + Math.floor(10 + Math.random() * 89) + '.' + Math.floor(100 + Math.random() * 150)
    };
    const updated = [newLog, ...activityLogs];
    setActivityLogs(updated);
    safeLocalStorage.setItem(`kadi_committee_activity_${event.id}`, JSON.stringify(updated));
  };

  // Fetch committee users and roles
  useEffect(() => {
    fetch('/api/committee/members')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCommitteeMembers(data);
      })
      .catch(err => console.error("Failed to fetch committee members:", err));
      
    fetch('/api/committee/roles')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCommitteeRoles(data);
      })
      .catch(err => console.error("Failed to fetch committee roles:", err));
  }, []);

  // Auto counter to refresh progress metrics or simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsToRefresh((prev) => {
        if (prev <= 1) {
          // Reset timer
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute metrics from guest pledges and payments
  const metrics = useMemo(() => {
    let totalGuestsCount = guests.length;
    let pledgedGuestsCount = 0;
    let partiallyPaidGuestsCount = 0;
    let fullyPaidGuestsCount = 0;
    let unpledgedGuestsCount = 0;

    let totalPledgedAmount = 0;
    let totalPaidAmount = 0;

    guests.forEach(g => {
      const pledge = g.pledgeAmount || 0;
      const paid = g.paidAmount || 0;
      totalPledgedAmount += pledge;
      totalPaidAmount += paid;

      if (pledge === 0) {
        unpledgedGuestsCount++;
      } else {
        if (paid === 0) {
          pledgedGuestsCount++;
        } else if (paid >= pledge) {
          fullyPaidGuestsCount++;
        } else {
          partiallyPaidGuestsCount++;
        }
      }
    });

    const outstandingBalance = totalPledgedAmount - totalPaidAmount;
    const remainingToTarget = Math.max(0, fundraisingTarget - totalPaidAmount);
    const progressRate = fundraisingTarget > 0 ? ((totalPaidAmount / fundraisingTarget) * 100).toFixed(1) : '0';

    return {
      totalGuests: totalGuestsCount,
      totalPledgedAmount,
      totalPaidAmount,
      outstandingBalance,
      unpledgedCount: unpledgedGuestsCount,
      pledgedCount: pledgedGuestsCount,
      partiallyPaidCount: partiallyPaidGuestsCount,
      fullyPaidCount: fullyPaidGuestsCount,
      progress: progressRate,
      remainingToTarget
    };
  }, [guests, fundraisingTarget]);

  // Lists for CSV dispatch 
  const unpledgedList = useMemo(() => guests.filter(g => (g.pledgeAmount || 0) === 0), [guests]);
  const activePledgeList = useMemo(() => guests.filter(g => (g.pledgeAmount || 0) > 0), [guests]);
  const fullyPaidList = useMemo(() => guests.filter(g => (g.pledgeAmount || 0) > 0 && (g.paidAmount || 0) >= (g.pledgeAmount || 0)), [guests]);
  const partialPaidList = useMemo(() => guests.filter(g => (g.pledgeAmount || 0) > 0 && (g.paidAmount || 0) > 0 && (g.paidAmount || 0) < (g.pledgeAmount || 0)), [guests]);
  const noPaymentPledgeList = useMemo(() => guests.filter(g => (g.pledgeAmount || 0) > 0 && (g.paidAmount || 0) === 0), [guests]);

  // Handle saving new simulated member
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName || !memberPhone) return;

    let permission: any = 'Summary Access';
    const roleMatch = committeeRoles.find(r => r.name === memberPosition);
    if (roleMatch) {
      permission = roleMatch.permissionLevel;
    } else {
      if (memberPosition === 'Chairperson' || memberPosition === 'Event Owner') permission = 'Full Access';
      else if (memberPosition === 'Treasurer') permission = 'Treasurer Access';
      else if (memberPosition === 'Secretary') permission = 'Viewer Access';
    }

    try {
      const resp = await fetch('/api/committee/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: memberName,
          phone: memberPhone,
          email: memberEmail || 'kamati@eventcard.co.tz',
          position: memberPosition,
          permissionLevel: permission
        })
      });
      const data = await resp.json();
      
      if (data.success && data.member) {
        const urlToUse = typeof window !== 'undefined' ? window.location.origin : 'https://eventcard.co.tz';
        const simulatedLink = `${urlToUse}/?token=${data.member.token}&event=${event.id}`;
        setInvitationLinkSent(simulatedLink);

        fetch('/api/committee/members')
          .then(res => res.json())
          .then(list => {
            if (Array.isArray(list)) setCommitteeMembers(list);
          });
      }
    } catch (e) {
      console.error(e);
    }

    // Activity log entry
    addActivityLog('Event Owner (Admin)', `Alimualika mjumbe mpya: ${memberName} (${memberPosition}) kupitia ${memberMethod}`);

    // Push notification
    const newNotif: CommitteeNotification = {
      id: 'n-' + Date.now(),
      type: 'pledge',
      title: 'Mjumbe Mpya Alikwa',
      message: `${memberName} ameajiriwa kama ${memberPosition} wa kamati. Salio la sasa linaweza kutazamwa na mfumo.`,
      createdAt: new Date().toLocaleDateString('sw-TZ') + ' ' + new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    const updatedNotifs = [newNotif, ...notifications];
    setNotifications(updatedNotifs);
    safeLocalStorage.setItem(`kadi_committee_notifications_${event.id}`, JSON.stringify(updatedNotifs));

    setMemberName('');
    setMemberPhone('');
    setMemberEmail('');
  };

  // Treasurer records payment
  const handleSavePaymentTreasury = () => {
    if (!treasuryTargetGuest || !treasuryAmount) return;
    const amountVal = parseFloat(treasuryAmount);
    if (isNaN(amountVal) || amountVal <= 0) return;

    const updatedGuests = guests.map(g => {
      if (g.id === treasuryTargetGuest.id) {
        const currentPayments = g.payments || [];
        const newPayment: ContributionPayment = {
          id: 'pay-' + Date.now(),
          amount: amountVal,
          date: new Date().toLocaleDateString('sw-TZ'),
          reference: treasuryRef || 'TXN-' + Math.floor(100000 + Math.random() * 899999),
          notes: treasuryNotes
        };
        const updatedPayments = [newPayment, ...currentPayments];
        const newPaid = (g.paidAmount || 0) + amountVal;
        const pledge = g.pledgeAmount || 0;
        
        let status: any = g.pledgeStatus || 'Pledged';
        if (newPaid >= pledge) {
          status = 'Fully Paid';
        } else if (newPaid > 0) {
          status = 'Partially Paid';
        }

        return {
          ...g,
          paidAmount: newPaid,
          pledgeStatus: status,
          payments: updatedPayments
        };
      }
      return g;
    });

    onUpdateGuests(updatedGuests);
    safeLocalStorage.setItem('kadi_guests', JSON.stringify(updatedGuests));

    // Log the transaction
    addActivityLog(`Salma Khamis (Treasurer)`, `Amesajili mchango wa TZS ${amountVal.toLocaleString()} kwa ${treasuryTargetGuest.name}`);

    // Toast/notifications
    const isCompleted = (treasuryTargetGuest.paidAmount || 0) + amountVal >= (treasuryTargetGuest.pledgeAmount || 0);
    const notifMsg = isCompleted
      ? `${treasuryTargetGuest.name} Amemaliza Ahadi Yake kwa Malipo kamili ya TZS ${amountVal.toLocaleString()}`
      : `${treasuryTargetGuest.name} Amelipa salio la TZS ${amountVal.toLocaleString()}. Salio lake lililosalia: TZS ${((treasuryTargetGuest.pledgeAmount || 0) - ((treasuryTargetGuest.paidAmount || 0) + amountVal)).toLocaleString()}`;

    const newNotif: CommitteeNotification = {
      id: 'n-' + Date.now(),
      type: isCompleted ? 'completed' : 'payment',
      title: isCompleted ? 'Ahadi Imekamilika!' : 'Mchango Mpya',
      message: notifMsg,
      createdAt: new Date().toLocaleDateString('sw-TZ') + ' ' + new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    setNotifications([newNotif, ...notifications]);
    safeLocalStorage.setItem(`kadi_committee_notifications_${event.id}`, JSON.stringify([newNotif, ...notifications]));

    // Clear and CLOSE
    setShowTreasurerPayModal(false);
    setTreasuryTargetGuest(null);
    setTreasuryAmount('');
    setTreasuryRef('');
  };

  // Simulate progress alerts / triggers
  const handleSimulateUpdateTrigger = () => {
    // Choose an unpledged or partially paid guest to create mock action
    const randomGuests = guests.filter(g => (g.pledgeAmount || 0) === 0);
    if (randomGuests.length === 0) {
      alert(isEn ? "All guests have active pledges!" : "Wageni wote tayari wana ahadi!");
      return;
    }
    const target = randomGuests[Math.floor(Math.random() * randomGuests.length)];
    const randomPledge = [200000, 300000, 500000, 1000000][Math.floor(Math.random() * 4)];

    const updated = guests.map(g => {
      if (g.id === target.id) {
        return {
          ...g,
          pledgeAmount: randomPledge,
          pledgeStatus: 'Pledged' as any,
          paidAmount: 0,
          payments: []
        };
      }
      return g;
    });

    onUpdateGuests(updated);
    safeLocalStorage.setItem('kadi_guests', JSON.stringify(updated));

    addActivityLog('System Observer', `${target.name} amesajili ahadi ya TZS ${randomPledge.toLocaleString()} kupitia Pledge Link ya mwanachama.`);
    
    // Add real notification
    const newNotif: CommitteeNotification = {
      id: 'n-' + Date.now(),
      type: 'pledge',
      title: 'Ahadi Mpya (Pledge Entry)',
      message: `${target.name} ameweka ahadi mpya ya TZS ${randomPledge.toLocaleString()} kwenye kadi ya baraka.`,
      createdAt: new Date().toLocaleDateString('sw-TZ') + ' ' + new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
    setNotifications([newNotif, ...notifications]);
    safeLocalStorage.setItem(`kadi_committee_notifications_${event.id}`, JSON.stringify([newNotif, ...notifications]));
  };

  // Reset metrics/database logs simulation
  const handleClearNotifications = () => {
    setNotifications([]);
    safeLocalStorage.setItem(`kadi_committee_notifications_${event.id}`, JSON.stringify([]));
  };

  // CSV down report generator
  // Report for attendance
  const checkedInList = useMemo(() => guests.filter(g => g.checkedIn), [guests]);

  const downloadAttendanceCSV = () => {
    addActivityLog(`${activeRole} View`, `Amepakua Ripoti ya Mahudhurio (CSV)`);
    const headers = ["ID", "Namba ya Kadi (Code)", "Jina la Mgeni", "Namba ya Simu", "Aina ya Kadi (Card Type)", "Muda wa Kuingia (Check-in Time)", "RSVP Status", "Idadi ya Wageni (Companions)"];
    
    let csvContent = "\uFEFF" + headers.join(",") + "\n";
    
    checkedInList.forEach(g => {
      csvContent += [
        g.id || '',
        g.code || '',
        `"${(g.name || '').replace(/"/g, '""')}"`,
        g.phone || '',
        g.cardType || '',
        g.checkedInTime || '',
        g.rsvpStatus || '',
        g.rsvpGuestsCount || 1
      ].join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Mahudhurio_Walioingia_${(event.name || 'Sherehe').replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadReportPDF = () => {
    addActivityLog(`${activeRole} View`, `Amepakua Ripoti ya PDF rasmi: ${selectedReport}`);
    
    const doc = new jsPDF(selectedReport === 'Summary' ? 'l' : 'p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    const now = new Date();
    const weekdayEn = now.toLocaleDateString('en-US', { weekday: 'long' });
    const dateEn = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeEn = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    
    // Custom exact-match layout for "Summary Ledger"
    if (selectedReport === 'Summary') {
      const printedDateStr = `${weekdayEn}, ${dateEn} at ${timeEn}`;
      
      const logoEl = document.querySelector('img[alt="EventCard Logo"]') as HTMLImageElement;
      let logoHeight = 0;
      let ratio = 1;
      if (logoEl && logoEl.complete && logoEl.naturalWidth > 0) {
        // Preserve aspect ratio
        ratio = logoEl.naturalWidth / logoEl.naturalHeight;
        logoHeight = 16;
        const targetWidth = logoHeight * ratio;
        doc.addImage(logoEl, 'PNG', 12, 10.5, targetWidth, logoHeight);
      } else {
        // Event Card Logo mockup fallback
        doc.setFontSize(16);
        doc.setFont("helvetica", "bolditalic");
        doc.setTextColor(6, 182, 212); // Cyan 500
        doc.text("Event", 12, 18);
        doc.setTextColor(168, 85, 247); // Purple 500
        doc.text("Card", 27, 18);
        doc.setFont("helvetica", "normal"); // reset
      }

      // Header: AUDIT MASTER badge
      let badgeX = 42;
      if (logoHeight > 0) {
        badgeX = 12 + (logoHeight * ratio) + 8;
      }
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.setFillColor(243, 244, 246); // Slate 100
      doc.roundedRect(badgeX, 13, 30, 7, 1, 1, 'FD');
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);    // Slate 700
      doc.text("AUDIT MASTER", badgeX + 15, 17.5, { align: "center" });

      // Printed Date Header right
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text("EXPORTED/PRINTED DATE:", pageWidth - 12, 14.5, { align: 'right' });
      doc.setTextColor(30, 41, 59);    // Slate 800
      doc.text(printedDateStr, pageWidth - 12, 18, { align: 'right' });

      // Title Heading
      doc.setFontSize(18);
      doc.setTextColor(15, 23, 42);    // Slate 900
      doc.text("OFFICIAL CONTRIBUTIONS REPORT", 12, 32);
      
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const eventNameTxt = `WEDDING OF ${event.name || "CHRISTIAN & HERIETH"}`.toUpperCase();
      doc.text(eventNameTxt, 12, 38);
      const wName = doc.getTextWidth(eventNameTxt);
      
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text("  •  ", 12 + wName, 38);
      const wDot = doc.getTextWidth("  •  ");
      
      doc.setTextColor(100, 116, 139);
      doc.text("EVENT DATE: ", 12 + wName + wDot, 38);
      const wLabel = doc.getTextWidth("EVENT DATE: ");
      
      doc.setTextColor(15, 23, 42);
      doc.text(`${event.date || '2026-09-26'}`, 12 + wName + wDot + wLabel, 38);

      // Separator Line
      doc.setDrawColor(15, 23, 42); // Black accent
      doc.setLineWidth(0.8);
      doc.line(12, 42, pageWidth - 12, 42);

      // Summary Cards (4 Cards)
      const outstandingBal = metrics.totalPledgedAmount - metrics.totalPaidAmount;
      const cardY = 48;
      const cardWidth = (pageWidth - 24 - 12) / 4; // 4 cards, total 12 margin gaps
      const cardHeight = 24;

      const cards = [
        { label: "TARGET BUDGET", value: `${fundraisingTarget.toLocaleString()} TZS`, bgColor: [59, 130, 246] },    // Blue 500
        { label: "TOTAL PLEDGED", value: `${metrics.totalPledgedAmount.toLocaleString()} TZS`, bgColor: [245, 158, 11] }, // Amber 500
        { label: "CASH COLLECTED", value: `${metrics.totalPaidAmount.toLocaleString()} TZS`, bgColor: [16, 185, 129] },  // Emerald 500
        { label: "OUTSTANDING BAL", value: `${outstandingBal.toLocaleString()} TZS`, bgColor: [225, 29, 72] }      // Rose 600
      ];

      cards.forEach((card, i) => {
        const x = 12 + i * (cardWidth + 4);
        doc.setFillColor(card.bgColor[0], card.bgColor[1], card.bgColor[2]);
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 3, 3, 'F');
        
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(card.label, x + cardWidth / 2, cardY + 8, { align: 'center', letterSpacing: 0.5 } as any);
        
        doc.setFontSize(14);
        doc.text(card.value, x + cardWidth / 2, cardY + 17, { align: 'center' });
      });

      // Group Summaries Section
      const groupY = cardY + 32;
      doc.setFillColor(241, 245, 249); // Slate 100
      doc.roundedRect(12, groupY, pageWidth - 24, 8, 1, 1, 'F');
      
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("GROUP LEVEL SUMMARIES", 15, groupY + 5.5);

      const groupData = groupSummaries.list.map(data => [
        data.name.toUpperCase(),
        data.count,
        data.pledged.toLocaleString(),
        data.collected.toLocaleString(),
        data.balances.toLocaleString()
      ]);
      groupData.push([
        'TOTALS',
        groupSummaries.totals.count,
        groupSummaries.totals.pledged.toLocaleString(),
        groupSummaries.totals.collected.toLocaleString(),
        groupSummaries.totals.balances.toLocaleString()
      ]);

      autoTable(doc, {
        startY: groupY + 10,
        head: [['CAMPAIGN GROUP', 'COUNT', 'TOTAL PLEDGED', 'COLLECTED CASH', 'BALANCES']],
        body: groupData,
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8.5, fontStyle: 'bold', lineColor: [226, 232, 240], lineWidth: 0.1 },
        bodyStyles: { textColor: [51, 65, 85], fontSize: 8.5, lineColor: [226, 232, 240] },
        styles: { cellPadding: 4, halign: 'center' },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold' } // Campaign group
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
             if (data.row.index === groupData.length - 1) { // TOTALS row
               data.cell.styles.fontStyle = 'bold';
               data.cell.styles.fillColor = [248, 250, 252];
               data.cell.styles.textColor = [15, 23, 42];
             }
             if (data.column.index === 2) { // Total Pledged
                data.cell.styles.textColor = [180, 83, 9]; // Amber 700 / nice orange
                data.cell.styles.fontStyle = 'bold';
             }
             if (data.column.index === 3) { // Cash Collected
                data.cell.styles.textColor = [21, 128, 61]; // Green 600
                data.cell.styles.fontStyle = 'bold';
             }
             if (data.column.index === 4) { // Balances
                data.cell.styles.textColor = [220, 38, 38]; // Red 600
                data.cell.styles.fontStyle = 'bold';
             }
          }
        }
      });

      // Master Database Section
      let tableY = (doc as any).lastAutoTable.finalY + 14;

      // if page space is running out, add a new page
      if (tableY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        tableY = 15;
      }

      doc.setFillColor(241, 245, 249); // Slate 100
      doc.roundedRect(12, tableY, pageWidth - 24, 8, 1, 1, 'F');
      
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text("MASTER GUEST REVENUE DATABASE", 15, tableY + 5.5);
      
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`${guests.length} GUESTS TOTAL`, pageWidth - 15, tableY + 5.5, { align: 'right' });

      let snCounter = 1;
      const guestData = masterGuestList.map(g => [
        snCounter++,
        g.name.toUpperCase(),
        g.phone,
        (g.category || '').toUpperCase(),
        g.pledge.toLocaleString(),
        g.paid.toLocaleString(),
        g.balance.toLocaleString(),
        (g.clearance || 'PENDING').toUpperCase()
      ]);

      autoTable(doc, {
        startY: tableY + 10,
        head: [['S/N', 'GUEST FULL NAME', 'MOBILE', 'CATEGORY', 'PLEDGE', 'PAID AMT', 'BALANCE', 'CLEARANCE']],
        body: guestData,
        theme: 'grid',
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold', lineColor: [226, 232, 240], lineWidth: 0.1 },
        bodyStyles: { textColor: [51, 65, 85], fontSize: 8, lineColor: [226, 232, 240] },
        styles: { cellPadding: 4, halign: 'center' },
        columnStyles: {
          1: { halign: 'left', fontStyle: 'bold' } // Guest name
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
            if (data.column.index === 4) { // Pledge
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.column.index === 5) { // Paid Amt
              data.cell.styles.textColor = [21, 128, 61]; // Green
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.column.index === 6) { // Balance
              data.cell.styles.textColor = [220, 38, 38]; // Red
              data.cell.styles.fontStyle = 'bold';
            }
            if (data.column.index === 7) { // Clearance
              if (data.cell.raw === 'COMPLETED') {
                data.cell.styles.textColor = [21, 128, 61];
                data.cell.styles.fontStyle = 'bold';
              } else {
                data.cell.styles.textColor = [15, 23, 42];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        }
      });

      doc.save(`Official_${selectedReport}_Report_${(event.name || "SHEREHE").replace(/\s+/g, '_')}.pdf`);
      return;
    }

    // --- Legacy Generator For Other Reports ---
    const pageWidthOld = doc.internal.pageSize.getWidth();

    // 1. Header Box
    doc.setFillColor(15, 23, 42); // Navy Slate-900 header block
    doc.rect(10, 10, pageWidthOld - 20, 20, 'F');
    
    doc.setFontSize(7.5);
    doc.setTextColor(243, 244, 246);
    doc.setFont("helvetica", "bold");
    doc.text(`EVENTCARD REPORT ENGINE`, 15, 17);

    const weekdaySw = now.toLocaleDateString('sw-TZ', { weekday: 'long' });
    const dateFormattedSw = now.toLocaleDateString('sw-TZ', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeFormattedSw = now.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const printedDateTime = `${dateFormattedSw} saa ${timeFormattedSw}`;
    
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.setFont("helvetica", "normal");
    doc.text(`Imetolewa: ${printedDateTime}`, pageWidthOld - 15, 17, { align: 'right' });

    // Report title inside header box
    let reportTitle = "";
    let reportTitleSw = "";
    if (selectedReport === 'Summary') {
      reportTitle = "OFFICIAL CONTRIBUTIONS SUMMARY";
      reportTitleSw = "Muhtasari wa Makusanyo na Ahadi";
    } else if (selectedReport === 'Collection') {
      reportTitle = "PAYMENTS LOG & COLLECTION LEDGER";
      reportTitleSw = "Orodha Kamili na Deteli ya Makusanyo";
    } else if (selectedReport === 'Outstanding') {
      reportTitle = "DUE BALANCES & OUTSTANDING REPORT";
      reportTitleSw = "Wenye Salio la Deni Inayodaiwa";
    } else if (selectedReport === 'FullyPaid') {
      reportTitle = "FULLY PAID CONTRIBUTIONS";
      reportTitleSw = "Waliolipa Ahadi Kikamilifu";
    } else if (selectedReport === 'Pending') {
      reportTitle = "ACTIVE COMMITMENTS & PLEDGES";
      reportTitleSw = "Orodha Kuu ya Ahadi Zilizowekwa";
    } else if (selectedReport === 'NoPledge') {
      reportTitle = "GUESTS WITH NO RECORDED PLEDGES";
      reportTitleSw = "Wasioonyesha Ahadi ya Mchango";
    } else if (selectedReport === 'Attendance') {
      reportTitle = "EVENT ENTRY & ATTENDANCE REGISTER";
      reportTitleSw = "Mahudhurio ya Wageni Walioingia";
    } else if (selectedReport === 'RSVP_Report') {
      reportTitle = "RSVP & CAMPAIGN COMMUNICATIONS REPORT";
      reportTitleSw = "Hali ya RSVP na Idadi ya Ujumbe Uliotumwa";
    }

    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(reportTitle.toUpperCase(), 15, 25);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(251, 191, 36); // Amber
    doc.text(reportTitleSw, pageWidth - 15, 25, { align: 'right' });

    // 4. Subtitle Event details
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.text("Sherehe / Event: ", 10, 36);
    const wEventLabel = doc.getTextWidth("Sherehe / Event: ");

    doc.setFont("helvetica", "bold");
    const eventNameUpper = `${event.name.toUpperCase()}`;
    doc.text(eventNameUpper, 10 + wEventLabel, 36);
    const wEventName = doc.getTextWidth(eventNameUpper);

    doc.setFont("helvetica", "normal");
    const dateLabel = " • Tarehe: ";
    doc.text(dateLabel, 10 + wEventLabel + wEventName, 36);
    const wDateLabel = doc.getTextWidth(dateLabel);

    doc.setFont("helvetica", "bold");
    const eventDateVal = `${event.date || '2026-05-31'}`;
    doc.text(eventDateVal, 10 + wEventLabel + wEventName + wDateLabel, 36);

    // Thick horizontal line
    doc.setDrawColor(15, 23, 42); // Black accent line
    doc.setLineWidth(0.5);
    doc.line(10, 39, pageWidth - 10, 39);

    // Calculate overall statistics
    const totalSmsSent = guests.reduce((sum, g) => sum + (g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0)), 0);
    const totalWhatsappSent = guests.reduce((sum, g) => sum + (g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)), 0);

    // Render depending on selection
    if (selectedReport === 'Summary') {
      // Summary cards
      const cardY = 44;
      const cardWidth = (pageWidth - 28) / 3;
      const cardHeight = 18;

      const cards = [
        { label: "TARGET BUDGET", value: `${fundraisingTarget.toLocaleString()} TZS`, color: [15, 23, 42] },
        { label: "TOTAL PLEDGED", value: `${metrics.totalPledgedAmount.toLocaleString()} TZS`, color: [15, 23, 42] },
        { label: "CASH COLLECTED", value: `${metrics.totalPaidAmount.toLocaleString()} TZS`, color: [22, 163, 74] }
      ];

      cards.forEach((card, i) => {
        const x = 10 + i * (cardWidth + 4);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(218, 223, 230);
        doc.rect(x, cardY, cardWidth, cardHeight, 'FD');
        
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text(card.label, x + cardWidth / 2, cardY + 5, { align: 'center' });
        
        doc.setFontSize(9.5);
        doc.setTextColor(card.color[0], card.color[1], card.color[2]);
        doc.text(card.value, x + cardWidth / 2, cardY + 12, { align: 'center' });
      });

      // Quick message stats bar
      const commY = 66;
      doc.setFillColor(241, 245, 249);
      doc.rect(10, commY, pageWidth - 20, 7, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.setFont("helvetica", "bold");
      doc.text(`JUMLA YA MAWASILIANO YALIYOTUMWA: SMS Zilizotumwa: ${totalSmsSent}  •  WhatsApp Zilizotumwa: ${totalWhatsappSent}`, 13, commY + 4.8);

      // Group Summaries
      const groupY = 77;
      doc.setFillColor(243, 244, 246);
      doc.rect(10, groupY, pageWidth - 20, 8, 'F');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("GROUP LEVEL SUMMARIES", 12, groupY + 5.5);

      const groupData = groupSummaries.list.map(data => [
        data.name,
        data.count,
        data.pledged.toLocaleString(),
        data.collected.toLocaleString(),
        data.balances.toLocaleString()
      ]);
      groupData.push([
        'TOTALS',
        groupSummaries.totals.count,
        groupSummaries.totals.pledged.toLocaleString(),
        groupSummaries.totals.collected.toLocaleString(),
        groupSummaries.totals.balances.toLocaleString()
      ]);

      autoTable(doc, {
        startY: groupY + 11,
        head: [['Campaign Group', 'Count', 'Total Pledged', 'Collected Cash', 'Balances']],
        body: groupData,
        theme: 'grid',
        headStyles: { fillColor: [222, 229, 237], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 7.5, cellPadding: 3 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === groupData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
          }
        }
      });

      // Master Database
      const dbY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFillColor(243, 244, 246);
      doc.rect(10, dbY, pageWidth - 20, 8, 'F');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("GUEST REVENUE & CAMPAIGN DISPATCH DATABASE", 12, dbY + 5.5);

      const tableData = masterGuestList.map(g => {
        // match category guest record
        const matchingGuestObj = guests.find(gst => gst.id === g.id || gst.name === g.name);
        const smsC = matchingGuestObj ? (matchingGuestObj.smsCount || (matchingGuestObj.smsStatus === 'Imetumia' ? 1 : 0)) : (g.clearance === 'Completed' ? 1 : 0);
        const waC = matchingGuestObj ? (matchingGuestObj.whatsappCount || (matchingGuestObj.whatsappStatus === 'Imetumia' ? 1 : 0)) : (g.clearance === 'Completed' ? 1 : 0);
        return [
          g.sn,
          g.name,
          g.phone,
          g.category,
          g.pledge.toLocaleString(),
          g.paid.toLocaleString(),
          g.balance.toLocaleString(),
          smsC,
          waC
        ];
      });

      autoTable(doc, {
        startY: dbY + 11,
        head: [['S/N', 'Full Name', 'Mobile', 'Category', 'Pledge', 'Paid', 'Balance', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [222, 229, 237], textColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 3 },
        columnStyles: {
          0: { halign: 'center' },
          1: { fontStyle: 'bold' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'center' },
          8: { halign: 'center' }
        }
      });

    } else if (selectedReport === 'Collection') {
      // Collections
      const allPayments: any[] = [];
      guests.forEach(g => {
        (g.payments || []).forEach(p => {
          allPayments.push({
            name: g.name,
            phone: g.phone,
            p,
            sms: g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0),
            wa: g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)
          });
        });
      });
      allPayments.sort((a,b) => new Date(b.p.date).getTime() - new Date(a.p.date).getTime());

      // Summary Card
      const cardY = 44;
      const cardWidth = (pageWidth - 24) / 2;
      const cardHeight = 16;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(218, 223, 230);
      doc.rect(10, cardY, cardWidth, cardHeight, 'FD');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("JUMLA YA MAKUSANYO YOTE (TOTAL COLLECTED)", 15, cardY + 5);
      doc.setFontSize(9.5);
      doc.setTextColor(22, 163, 74);
      doc.text(`${metrics.totalPaidAmount.toLocaleString()} TZS`, 15, cardY + 12);

      doc.setFillColor(248, 250, 252);
      doc.rect(10 + cardWidth + 4, cardY, cardWidth, cardHeight, 'FD');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text("JUMLA YA UJUMBE ULIOPELEKWA (SMS / WHATSAPP)", 10 + cardWidth + 9, cardY + 5);
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`SMS: ${totalSmsSent} zilizotumwa  •  WA: ${totalWhatsappSent} zilizotumwa`, 10 + cardWidth + 9, cardY + 11);

      const tableData = allPayments.map((itm, idx) => [
        idx + 1,
        itm.name,
        itm.phone,
        Number(itm.p.amount).toLocaleString(),
        itm.p.date,
        itm.p.reference || '-',
        itm.sms,
        itm.wa
      ]);

      const totalAmtPayments = allPayments.reduce((sum, item) => sum + Number(item.p.amount), 0);
      tableData.push([
        'T',
        'JUMLA',
        '-',
        totalAmtPayments.toLocaleString(),
        '-',
        '-',
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: cardY + 20,
        head: [isEn ? ['S/N', 'Payer (Guest Name)', 'Phone', 'Amount (TZS)', 'Date', 'Ref', 'SMS', 'WA'] : ['S/N', 'Mlipaji (Guest Name)', 'Simu', 'Kiasi (TZS)', 'Tarehe', 'Ref', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [222, 229, 237], textColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 3.5 },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'right', fontStyle: 'bold' },
          6: { halign: 'center' },
          7: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
          }
        }
      });

    } else if (selectedReport === 'Outstanding') {
      const list = [...partialPaidList, ...noPaymentPledgeList];
      const tableData = list.map((g, idx) => [
        idx + 1,
        g.name,
        g.phone,
        (g.pledgeAmount || 0).toLocaleString(),
        (g.paidAmount || 0).toLocaleString(),
        ((g.pledgeAmount || 0) - (g.paidAmount || 0)).toLocaleString(),
        g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0),
        g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)
      ]);

      // Add a Row for Grand Totals
      const totalPledged = list.reduce((sum, g) => sum + (g.pledgeAmount || 0), 0);
      const totalPaid = list.reduce((sum, g) => sum + (g.paidAmount || 0), 0);
      const totalBal = totalPledged - totalPaid;
      tableData.push([
        'T',
        isEn ? 'GRAND TOTAL OUTSTANDING' : 'JUMLA INAYODAIWA',
        '-',
        totalPledged.toLocaleString(),
        totalPaid.toLocaleString(),
        totalBal.toLocaleString(),
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: 44,
        head: [isEn 
          ? ['S/N', 'Guest Name', 'Phone', 'Pledge (TZS)', 'Paid (TZS)', 'Balance (TZS)', 'SMS', 'WA']
          : ['S/N', 'Mgeni (Guest Name)', 'Simu', 'Ahadi (TZS)', 'Kilicholipwa (TZS)', 'Deni / Salio (TZS)', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [222, 229, 237], textColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 3 },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] },
          6: { halign: 'center' },
          7: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
            data.cell.styles.textColor = [15, 23, 42];
          }
        }
      });

    } else if (selectedReport === 'FullyPaid') {
      const tableData = fullyPaidList.map((g, idx) => [
        idx + 1,
        g.name,
        g.phone,
        (g.pledgeAmount || 0).toLocaleString(),
        g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0),
        g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)
      ]);

      const sumPaid = fullyPaidList.reduce((sum, g) => sum + (g.pledgeAmount || 0), 0);
      tableData.push([
        'T',
        isEn ? 'GRAND TOTAL PAID' : 'JUMLA WALIOLIPA',
        '-',
        sumPaid.toLocaleString(),
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: 44,
        head: [isEn 
          ? ['S/N', 'Contributor Name', 'Phone Number', 'Amount Paid (TZS)', 'SMS', 'WA']
          : ['S/N', 'Mchangiaji (Guest Name)', 'Namba ya Simu', 'Kiasi Kilicholipwa (TZS)', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [222, 229, 237], textColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 3.5 },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'right', fontStyle: 'bold', textColor: [22, 163, 74] },
          4: { halign: 'center' },
          5: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
          }
        }
      });

    } else if (selectedReport === 'Pending') {
      const tableData = activePledgeList.map((g, idx) => [
        idx + 1,
        g.name,
        g.phone,
        g.pledgeStatus || 'Pledged',
        (g.pledgeAmount || 0).toLocaleString(),
        g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0),
        g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)
      ]);

      const sumPledge = activePledgeList.reduce((sum, g) => sum + (g.pledgeAmount || 0), 0);
      tableData.push([
        'T',
        isEn ? 'GRAND TOTAL PLEDGES' : 'JUMLA YA AHADI',
        '-',
        '-',
        sumPledge.toLocaleString(),
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: 44,
        head: [isEn 
          ? ['S/N', 'Guest Name', 'Phone', 'Status', 'Pledge Amount (TZS)', 'SMS', 'WA']
          : ['S/N', 'Mgeni (Guest Name)', 'Simu', 'Hali', 'Kiasi ya Ahadi (TZS)', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [222, 229, 237], textColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 3.5 },
        columnStyles: {
          0: { halign: 'center' },
          4: { halign: 'right', fontStyle: 'bold' },
          5: { halign: 'center' },
          6: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
          }
        }
      });

    } else if (selectedReport === 'NoPledge') {
      const tableData = unpledgedList.map((g, idx) => [
        idx + 1,
        g.name,
        g.phone,
        `https://eventcard.co.tz/pledge/${g.code}`,
        g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0),
        g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)
      ]);

      tableData.push([
        'T',
        isEn ? 'TOTAL NO PLEDGE' : 'JUMLA WASIOAHIDI',
        `${unpledgedList.length} ${isEn ? 'Guests' : 'Wageni'}`,
        '-',
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: 44,
        head: [isEn 
          ? ['S/N', 'Guest Name', 'Mobile Phone', 'Registration Link', 'SMS', 'WA']
          : ['S/N', 'Jina la Mgeni', 'Simu ya Mkononi', 'Viungo vya Usajili (Link)', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [222, 229, 237], textColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 3.5 },
        columnStyles: {
          0: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
          }
        }
      });

    } else if (selectedReport === 'Attendance') {
      const list = [...checkedInList].sort((a,b) => (b.checkedInTime || '').localeCompare(a.checkedInTime || ''));
      const tableData = list.map((g, idx) => [
        idx + 1,
        g.checkedInTime || '-',
        g.name,
        g.phone || '-',
        g.cardType || 'SINGLE',
        'SUCCESS SCAN',
        g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0),
        g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)
      ]);

      tableData.push([
        'T',
        isEn ? 'TOTAL CHECKED IN' : 'JUMLA YA WALIOINGIA',
        `${list.length} ${isEn ? 'Cards' : 'Kadi'}`,
        '-',
        '-',
        '-',
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: 44,
        head: [isEn 
          ? ['S/N', 'Time', 'Guest Name', 'Phone Number', 'Card Type', 'Scan Status', 'SMS', 'WA']
          : ['S/N', 'Muda (Time)', 'Jina la Mgeni', 'Namba ya Simu', 'Aina ya Kadi', 'Hali ya Skani', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [222, 229, 237], textColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 3.5 },
        columnStyles: {
          0: { halign: 'center' },
          1: { fontStyle: 'bold' },
          4: { halign: 'center' },
          5: { halign: 'center', textColor: [22, 163, 74], fontStyle: 'bold' },
          6: { halign: 'center' },
          7: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
            data.cell.styles.textColor = [15, 23, 42];
          }
        }
      });

    } else if (selectedReport === 'RSVP_Report') {
      const sortedRSVPGuests = [...guests].sort((a,b) => {
        const valA = a.rsvpStatus === 'Atahudhuria' ? 1 : a.rsvpStatus === 'Labda' ? 2 : a.rsvpStatus === 'Bado' || !a.rsvpStatus ? 3 : 4;
        const valB = b.rsvpStatus === 'Atahudhuria' ? 1 : b.rsvpStatus === 'Labda' ? 2 : b.rsvpStatus === 'Bado' || !b.rsvpStatus ? 3 : 4;
        return valA - valB || a.name.localeCompare(b.name);
      });

      // RSVP metrics
      const countComing = guests.filter(g => g.rsvpStatus === 'Atahudhuria').length;
      const totalPeopleAttending = guests.filter(g => g.rsvpStatus === 'Atahudhuria').reduce((acc, current) => acc + (current.rsvpGuestsCount || 1), 0);
      const countDeclined = guests.filter(g => g.rsvpStatus === 'Hatahudhuria').length;
      const countMaybe = guests.filter(g => g.rsvpStatus === 'Labda').length;
      const countPending = guests.filter(g => !g.rsvpStatus || g.rsvpStatus === 'Bado').length;

      // Stats cards
      const cardY = 44;
      const cardWidth = (pageWidth - 28) / 3;
      const cardHeight = 16;

      const cards = [
        { label: "WATAKAOFIKA (COMING)", value: `${countComing} Kadi / ${totalPeopleAttending} Watu`, color: [22, 163, 74] },
        { label: "HAWATAHUDHURIA / LABDA", value: `${countDeclined} Hawaji / ${countMaybe} Labda`, color: [185, 28, 28] },
        { label: "BADO MAJIBU (PENDING)", value: `${countPending} Wageni`, color: [15, 23, 42] }
      ];

      cards.forEach((card, i) => {
        const x = 10 + i * (cardWidth + 4);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(218, 223, 230);
        doc.rect(x, cardY, cardWidth, cardHeight, 'FD');
        
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text(card.label, x + cardWidth / 2, cardY + 5, { align: 'center' });
        
        doc.setFontSize(8);
        doc.setTextColor(card.color[0], card.color[1], card.color[2]);
        doc.text(card.value, x + cardWidth / 2, cardY + 11, { align: 'center' });
      });

      const tableData = sortedRSVPGuests.map((g, idx) => [
        idx + 1,
        g.name,
        g.phone || '-',
        g.cardType || 'SINGLE',
        g.rsvpStatus || 'Bado',
        g.rsvpGuestsCount || 1,
        g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0),
        g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)
      ]);

      const sumRSVPPeople = guests.reduce((sum, g) => sum + (g.rsvpStatus === 'Atahudhuria' ? (g.rsvpGuestsCount || 1) : 0), 0);
      tableData.push([
        'T',
        isEn ? 'GRAND TOTAL' : 'JUMLA KUU',
        '-',
        '-',
        '-',
        isEn ? `${sumRSVPPeople} Attending Guests` : `${sumRSVPPeople} Watu Watakaohudhuria`,
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: cardY + 20,
        head: [isEn 
          ? ['S/N', 'Guest Name', 'Phone', 'Card Type', 'RSVP Status', 'RSVP Count', 'SMS', 'WA']
          : ['S/N', 'Jina la Mgeni', 'Simu', 'Aina ya Kadi', 'Hali ya RSVP', 'Watu RSVP', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [222, 229, 237], textColor: [15, 23, 42], fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 3 },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'center', fontStyle: 'bold' },
          4: { halign: 'center' },
          5: { halign: 'center', fontStyle: 'bold' },
          6: { halign: 'center' },
          7: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
            data.cell.styles.textColor = [15, 23, 42];
          } else if (data.section === 'body' && data.column.index === 4) {
            const val = data.cell.text[0];
            if (val === 'Atahudhuria') {
              data.cell.styles.textColor = [22, 163, 74]; // Green
              data.cell.styles.fontStyle = 'bold';
            } else if (val === 'Hatahudhuria') {
              data.cell.styles.textColor = [220, 38, 38]; // Red
            } else if (val === 'Labda') {
              data.cell.styles.textColor = [217, 119, 6]; // Amber
            }
          }
        }
      });
    }

    doc.save(`Official_${selectedReport}_Report_${event.name.replace(/\s+/g, '_')}.pdf`);
  };

  const downloadReportCSV = (title: string, list: Guest[]) => {
    addActivityLog(`${activeRole} View`, `Amepakua Ripoti ya CSV: ${title}`);
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += isEn 
      ? "Guest Name,Phone,Pledge Status,Pledge Amount(TZS),Paid Amount(TZS),Balance Due(TZS)\n"
      : "Jina la Mgeni,Simu,Hali ya Ahadi,Kiasi cha Ahadi(TZS),Kiasi Kilicholipwa(TZS),Salio la Deni(TZS)\n";
    
    list.forEach(g => {
      const b = (g.pledgeAmount || 0) - (g.paidAmount || 0);
      csvContent += `"${g.name}","${g.phone}","${g.pledgeStatus || 'No Pledge'}",${g.pledgeAmount || 0},${g.paidAmount || 0},${b}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${title.replace(/\s+/g, '_')}_CommitteeReport_${event.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render analytics charts datasets
  const collectionChartData = useMemo(() => {
    // Break down guest payments daily
    const paymentsList: { name: string; value: number }[] = [];
    guests.forEach(g => {
      (g.payments || []).forEach(p => {
        const d = p.date || '04/06/2026';
        const found = paymentsList.find(x => x.name === d);
        if (found) {
          found.value += p.amount;
        } else {
          paymentsList.push({ name: d, value: p.amount });
        }
      });
    });

    if (paymentsList.length === 0) {
      return [
        { name: '01/06', value: 2500000 },
        { name: '02/06', value: 4300000 },
        { name: '03/06', value: 1800000 },
        { name: '04/06', value: metrics.totalPaidAmount || 1200000 }
      ];
    }
    return paymentsList.sort((a,b) => a.name.localeCompare(b.name));
  }, [guests, metrics.totalPaidAmount]);

  // Top contributors list (highest pledges, payments)
  const topContributorsData = useMemo(() => {
    const list = [...guests].filter(g => (g.pledgeAmount || 0) > 0);
    return list.sort((a,b) => (b.pledgeAmount || 0) - (a.pledgeAmount || 0)).slice(0, 5);
  }, [guests]);

  // Printable PDF triggered view
  const handlePrintTrigger = () => {
    addActivityLog(`${activeRole} View`, `Alichapisha au ku-export PDF kwa ripoti: ${selectedReport}`);
    window.print();
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === '1234') {
      setActiveRole('Event Owner');
      setLoggedInRole('Event Owner');
      setIsLocked(false);
      setPinError('');
    } else if (pinInput === '2222') {
      setActiveRole('Treasurer');
      setLoggedInRole('Treasurer');
      setIsLocked(false);
      setPinError('');
    } else if (pinInput === '3333') {
      setActiveRole('Secretary');
      setLoggedInRole('Secretary');
      setIsLocked(false);
      setPinError('');
    } else if (pinInput === '4444') {
      setActiveRole('Committee Member');
      setLoggedInRole('Committee Member');
      setIsLocked(false);
      setPinError('');
    } else {
      setPinError(isEn ? 'Incorrect PIN code' : 'Nywila sio sahihi. Namba za kujaribu: 1234, 2222, 3333, au 4444');
    }
  };

  if (isLocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-10 px-4 text-center">
        <ShieldCheck className="w-16 h-16 text-emerald-500 mb-6 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse" />
        <h2 className="text-xl font-black text-white uppercase font-mono tracking-widest mb-2">
          {isEn ? "Committee Module Secured" : "Bodi ya Kamati Imefungwa"}
        </h2>
        <p className="text-slate-400 text-xs mb-8 max-w-sm leading-relaxed">
          {isEn 
            ? "Enter role PIN (Owner: 1234, Treasurer: 2222, Secretary: 3333, Member: 4444)" 
            : "Tumia PIN hizi kuingia kulingana na cheo: Admin (1234), Hazina (2222), Katibu (3333), Mjumbe (4444)"}
        </p>
        
        <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-4">
          <div className="space-y-2">
            <input
              type="password"
              inputMode="numeric"
              placeholder={isEn ? "Enter PIN" : "Weka PIN"}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full text-center px-4 py-3 bg-slate-950/60 border border-white/10 rounded-2xl text-2xl font-mono tracking-[0.5em] text-white focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-slate-700 placeholder:tracking-normal placeholder:text-sm"
              autoFocus
              maxLength={4}
            />
            {pinError && <p className="text-rose-500 text-[10px] font-bold uppercase">{pinError}</p>}
          </div>
          
          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 cursor-pointer"
          >
            {isEn ? "Unlock Dashboard" : "Fungua Mfumo"}
          </button>
        </form>
        
        <div className="mt-8 text-[10.5px] text-slate-500 font-mono flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          <span>{isEn ? "End-to-End Encrypted Access" : "Mfumo umelindwa kikamilifu (AES-256)"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-xs text-slate-100 pb-16" id="committee-system-module-parent">
      
      {/* Top Simulator & Role selection rail - ONLY visible to Event Owner/Admin */}
      {loggedInRole === 'Event Owner' && (
        <div className="backdrop-blur-md bg-white/[0.02] border border-amber-500/20 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[9px] px-2.5 py-1 rounded-full uppercase font-bold flex items-center w-fit gap-1 animate-pulse">
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              <span>Simulate Committee Role Options</span>
            </span>
            <h2 className="text-sm font-black text-white uppercase font-mono tracking-wide">
              {isEn ? "Role-Based Permissions Sandbox" : "Pitia Majukumu ya Wanakamati (Simulator)"}
            </h2>
            <p className="text-slate-400 text-[10.5px]">
              {isEn ? "Toggle simulated positions to witness secure access scopes in action instantly:" : "Bonyeza majukumu tofauti hapa chini ili kuona jinsi gani mifumo ya ulinzi inavyofanya kazi:"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-white/5">
            {[
              { tag: 'Event Owner', label: isEn ? 'Event Owner / Admin' : 'Mwenye Shughuli (Admin)' },
              { tag: 'Treasurer', label: isEn ? 'Treasurer' : 'Hazina (Treasurer)' },
              { tag: 'Secretary', label: isEn ? 'Secretary' : 'Katibu (Secretary)' },
              { tag: 'Committee Member', label: isEn ? 'Committee Member' : 'Mjumbe wa Kamati' }
            ].map((r) => (
              <button
                key={r.tag}
                onClick={() => {
                  setActiveRole(r.tag as any);
                  addActivityLog(`System Simulator`, `Amebadili hadhi ya kutazama na kuwa: ${r.tag}`);
                }}
                className={`p-2 px-3 rounded-xl transition font-bold font-mono text-[10px] uppercase cursor-pointer ${
                  activeRole === r.tag 
                    ? 'bg-amber-500 text-slate-150 shadow-md scale-98 font-black' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Role Notice banner with Logout/Lock button */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
        activeRole === 'Treasurer' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450' :
        activeRole === 'Secretary' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
        activeRole === 'Committee Member' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 font-mono text-[11px]' :
        'bg-amber-500/5 border-amber-500/10 text-amber-400'
      }`}>
        <div className="flex items-start gap-3">
          <Activity className="w-5 h-5 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <p className="font-extrabold uppercase tracking-wider text-xs">
              {activeRole === 'Event Owner' && (isEn ? "Logged in as Event Owner (Full Access Granted)" : "Umeingia kama Mwenye Shughuli (Ruhusa Kamili ya Admin)")}
              {activeRole === 'Treasurer' && (isEn ? "Logged in as Mweka Hazina (Treasurer - Payments Access Only)" : "Umeingia kama Mweka Hazina (Hazina - Ruhusa ya Kuongeza Malipo tu, Hakuna kufuta)")}
              {activeRole === 'Secretary' && (isEn ? "Logged in as Katibu (Secretary - Viewer Access with Pledges & Lists)" : "Umeingia kama Katibu wa Kamati (Secretary - Kuona data pekee, Hakuna kuhariri)")}
              {activeRole === 'Committee Member' && (isEn ? "Logged in as Committee Member (Summary Dashboard Only - Personal logs hidden)" : "Umeingia kama Mjumbe wa Kamati (Summary tu - Taarifa za kifedha za mtu mmoja mmoja zimefichwa)")}
            </p>
            <p className="text-slate-400 text-[10.5px]">
              {activeRole === 'Event Owner' && (isEn ? "✓ Modify targets • ✓ Manage committee members • ✓ Record payments • ✓ Deep analytics • ✓ Public progress manager" : "✓ Badilisha Malengo • ✓ Ongeza Wanakamati • ✓ Sajili malipo yote • ✓ Utendaji wa log na Ripoti")}
              {activeRole === 'Treasurer' && (isEn ? "✓ Record payment amounts • ✓ Print/download reports • ✗ Cannot delete records • ✗ Cannot change committee members" : "✓ Sajili malipo mapya • ✓ Pakua Ripoti • ✗ Huwezi kufuta muamala wowote • ✗ Huwezi kubadili wajumbe")}
              {activeRole === 'Secretary' && (isEn ? "✓ Read-only guests & pledges • ✓ Export reports • ✗ Cannot add payments • ✗ Cannot modify system setups" : "✓ Tazama wageni na ahadi zao • ✓ Pakua Ripoti • ✗ Huwezi kuongeza malipo wala kuandikisha data")}
              {activeRole === 'Committee Member' && (isEn ? "✓ Summary widgets & charts only • ✗ Restricted from viewing detailed names, individual payment logs, or contact numbers" : "✓ Tazama asilimia na chati tu • ✗ Umezuiliwa kuona majina, simu au kiasi kimoja kimoja cha mtu kukulinda siri")}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/35 text-rose-400 rounded-xl font-mono text-[10px] font-extrabold uppercase flex items-center gap-1.5 self-start sm:self-center transition-all cursor-pointer shadow-sm active:scale-95"
          id="btn-committee-logout"
        >
          <X className="w-3.5 h-3.5" />
          <span>{isEn ? "Lock / Logout 🔒" : "Ondoka Kwenye Mfumo 🔒"}</span>
        </button>
      </div>

      {/* Primary tab switcher */}
      <div className="flex overflow-x-auto gap-2 border-b border-white/10 pb-1 shrink-0" id="committee-subtabs-nav">
        {[
          { id: 'dashboard', label: isEn ? 'Dashboard Summary' : 'Mwanzo wa Kamati', icon: Layers },
          { id: 'analytics', label: isEn ? 'Analytics & Trends' : 'Takwimu za Chati', icon: TrendingUp },
          { id: 'reports', label: isEn ? 'Committee Reports' : 'Ripoti za Kamati', icon: Printer },
          { id: 'members', label: isEn ? 'Manage Committee' : 'Wanakamati wote', icon: Users },
          { id: 'contributions', label: isEn ? 'Contribution Module' : 'Michango & Kadi', icon: Coins },
          { id: 'files', label: isEn ? 'Documents & Files' : 'Nyaraka & Faili', icon: FolderOpen },
          { id: 'activity', label: isEn ? 'Activity Logs' : 'Kihistoria cha Logs', icon: Activity },
          { id: 'public-link', label: isEn ? 'Public Tracking Link' : 'Public Progress Link', icon: Share2 }
        ].map((tab) => {
          // Hide tabs depending on simulated permissions
          if (tab.id === 'members' || tab.id === 'activity') {
            if (activeRole !== 'Event Owner') return null; // Only Owner
          }
          if (tab.id === 'contributions') {
            if (activeRole !== 'Event Owner' && activeRole !== 'Treasurer') return null; // Owner & Treasurer
          }
          if (tab.id === 'reports' || tab.id === 'public-link') {
            if (activeRole === 'Committee Member') return null; // Owner, Treasurer, Secretary
          }
          
          const isActive = currentSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentSubTab(tab.id as any)}
              className={`flex items-center gap-2 py-2.5 px-4 font-mono font-extrabold text-[10.5px] uppercase border-b-2 transition shrink-0 cursor-pointer ${
                isActive 
                  ? 'border-amber-500 text-amber-400 bg-white/[0.02]' 
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: COMMITTEE DASHBOARD */}
      {currentSubTab === 'dashboard' && (
        <div className="space-y-6 animate-fade-in" id="panel-committee-home">
          
          {/* Target Tracking progress bar */}
          <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute right-4 top-4 text-slate-800 pointer-events-none"><Coins className="w-24 h-24 stroke-[0.8]" /></div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="space-y-2">
                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[9px] px-2.5 py-1 rounded-full uppercase font-bold">
                  {isEn ? "Active Target Tracker" : "Mfuatiliaji Maalum wa Fundraising Target"}
                </span>
                <h3 className="text-lg font-black text-white uppercase font-sans tracking-wide">
                  {isEn ? "FUNDRAISING GOAL STATUS" : "MALENGO YA MAKUSANYO (TARGET TRACKER)"}
                </h3>
                <p className="text-slate-400 text-xs">
                  {isEn ? "Comparison with the target set by the event organization committee:" : "Kiasi kilichopangwa na kamati kulinganisha na makusanyo ya sasa:"}
                </p>
              </div>

              {activeRole === 'Event Owner' ? (
                <div className="bg-slate-950/80 p-3 rounded-2xl border border-white/10 space-y-2 min-w-[200px]">
                  <label className="text-[9px] font-mono uppercase font-bold text-slate-400 block" htmlFor="fundraising-target-input">
                    {isEn ? "Set Target Goal (TZS):" : "Weka Target ya Sherehe (TZS):"}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      id="fundraising-target-input"
                      type="number" 
                      defaultValue={fundraisingTarget} 
                      onBlur={(e) => handleSaveGoal(Number(e.target.value) || 15000000)}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white font-mono font-bold text-xs focus:ring-1 focus:ring-amber-500 w-full"
                    />
                    <button className="bg-amber-500 text-slate-900 px-2 py-1 text-[10px] font-bold rounded uppercase hover:bg-amber-400">OK</button>
                  </div>
                  <span className="text-[9px] text-slate-500 block">{isEn ? "Click out / tab save" : "Bofya nje ili kuhifadhi"}</span>
                </div>
              ) : (
                <div className="text-right">
                  <p className="text-[10px] uppercase font-mono text-slate-400">{isEn ? "Fundraising Target Set" : "Kiwango cha Target kilichosajiliwa"}</p>
                  <p className="text-xl font-black text-amber-400 font-mono">TZS {fundraisingTarget.toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Visual metric meters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-8 relative z-10 pt-6 border-t border-white/5">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">{isEn ? "Target Amount" : "Shabaha Iliyowekwa"}</span>
                <p className="text-lg font-black text-white font-mono">TZS {fundraisingTarget.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-emerald-400 block">{isEn ? "Collected (Paid)" : "Kiasi Kilichokusanywa"}</span>
                <p className="text-lg font-black text-emerald-400 font-mono">TZS {metrics.totalPaidAmount.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-rose-400 block">{isEn ? "Remaining Balance" : "Gharama Iliyobaki"}</span>
                <p className="text-lg font-black text-rose-400 font-mono">TZS {metrics.remainingToTarget.toLocaleString()}</p>
              </div>
            </div>

            {/* Custom crafted progress bar */}
            <div className="space-y-2 mt-8 relative z-10">
              <div className="flex justify-between items-center text-xs font-mono font-bold">
                <span className="text-amber-400">{isEn ? "Collection Progress:" : "Maendeleo ya Makusanyo:"}</span>
                <span className="text-white text-sm font-black text-glow">{metrics.progress}%</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
                <div 
                  className="bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${Math.min(100, parseFloat(metrics.progress))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Metrics numbers row matching 16.3 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-1">
              <span className="text-[9.5px] font-mono text-slate-400 uppercase font-bold">{isEn ? "Total Guests" : "Wageni Wote"}</span>
              <p className="text-xl font-black text-white font-mono">{metrics.totalGuests}</p>
              <p className="text-[9px] text-slate-500 italic">{isEn ? "Guests loaded in directory" : "Wageni wote walioalikwa"}</p>
            </div>

            <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-1">
              <span className="text-[9.5px] font-mono text-cyan-400 uppercase font-bold">{isEn ? "Contributors Count" : "Idadi Waliotoa Ahadi"}</span>
              <p className="text-xl font-black text-cyan-400 font-mono">
                {metrics.pledgedCount + metrics.partiallyPaidCount + metrics.fullyPaidCount}
              </p>
              <p className="text-[9px] text-slate-500 italic">
                {(( (metrics.pledgedCount + metrics.partiallyPaidCount + metrics.fullyPaidCount) / (metrics.totalGuests || 1)) * 100).toFixed(0)}% {isEn ? "of guests participated" : "ya wageni wote walioshiriki"}
              </p>
            </div>

            <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-1">
              <span className="text-[9.5px] font-mono text-amber-400 uppercase font-bold">{isEn ? "Total Pledged" : "Jumla ya Ahadi TZS"}</span>
              <p className="text-xl font-black text-yellow-450 font-mono">TZS {metrics.totalPledgedAmount.toLocaleString()}</p>
              <p className="text-[9px] text-slate-500 italic">{isEn ? "Official commitment commitments" : "Thamani ya ahadi rasmi"}</p>
            </div>

            <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-2xl p-5 space-y-1">
              <span className="text-[9.5px] font-mono text-emerald-400 uppercase font-bold">{isEn ? "Total Collected" : "Jumla ya Malipo TZS"}</span>
              <p className="text-xl font-black text-emerald-450 font-mono">TZS {metrics.totalPaidAmount.toLocaleString()}</p>
              <p className="text-[9px] text-emerald-500/80 font-bold font-mono">TZS {metrics.outstandingBalance.toLocaleString()} {isEn ? "pending due" : "inadaiwa"}</p>
            </div>

          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="backdrop-blur-md bg-white/[0.01] border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-emerald-400 uppercase font-bold block">{isEn ? "Fully Paid Contributors" : "Waliolipa Ahadi Yote"}</span>
                <p className="text-lg font-black text-white font-mono">{metrics.fullyPaidCount}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-500/30 stroke-[1.5]" />
            </div>

            <div className="backdrop-blur-md bg-white/[0.01] border border-cyan-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-cyan-400 uppercase font-bold block">{isEn ? "Partially Paid Contribs" : "Waliolipa Nusu/Sehemu"}</span>
                <p className="text-lg font-black text-white font-mono">{metrics.partiallyPaidCount}</p>
              </div>
              <Activity className="w-8 h-8 text-cyan-500/30 stroke-[1.5]" />
            </div>

            <div className="backdrop-blur-md bg-white/[0.01] border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-amber-400 uppercase font-bold block">{isEn ? "No Pledge Registered" : "Bado hawajaahidi"}</span>
                <p className="text-lg font-black text-white font-mono">{metrics.unpledgedCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-500/35 stroke-[1.5]" />
            </div>

            <div className="backdrop-blur-md bg-white/[0.01] border border-rose-500/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[9px] font-mono text-rose-455 uppercase font-bold block">{isEn ? "Outstanding Balance" : "Sura ya Salio linalodaiwa"}</span>
                <p className="text-lg font-black text-rose-400 font-mono">TZS {metrics.outstandingBalance.toLocaleString()}</p>
              </div>
              <Coins className="w-8 h-8 text-rose-500/30 stroke-[1.5]" />
            </div>

          </div>

          {/* MAIN COLUMN BODY: Live Monitor vs Pledge Simulation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Live Collection Monitor - 16.4 */}
            <div className="lg:col-span-7 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>{isEn ? "Live Contributions Activity Feed" : "Kichunguzi cha Makusanyo ya Live (Live Feed)"}</span>
                  </h4>
                  <p className="text-[10px] text-slate-450">{isEn ? "Recent transactions logged in committee" : "Miamala ya makusanyo inayotokea hivi punde kwenye kamati"}</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-white/5">
                  <span className="text-[9.5px] font-mono text-slate-400">{isEn ? "Auto-refresh in:" : "Inajisafisha baada ya:"} <strong className="text-amber-400">{secondsToRefresh}s</strong></span>
                  <button 
                    onClick={() => {
                      setSecondsToRefresh(60);
                      addActivityLog(`${activeRole} Action`, 'Alifanya manual refresh kwenye Live Monitor feed');
                    }}
                    title="Manual Refresh"
                    className="text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 text-slate-350" />
                  </button>
                </div>
              </div>

              {/* Sandbox Trigger controls for mock updates */}
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 text-[11px] leading-relaxed text-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p>
                  {isEn ? "Sandbox helper: Simulate a guest completing their financial pledge online:" : "Sandbox: Gusa kitufe cha upande wa kulia ili ku-simulate mgeni kuongeza ahadi mpya kwenye mfumo:"}
                </p>
                <button
                  onClick={handleSimulateUpdateTrigger}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold uppercase py-1.5 px-3.5 rounded-lg shrink-0 transition flex items-center gap-1 cursor-pointer font-mono"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isEn ? "Simulate Guest Pledge" : "Simulate Ahadi Mpya"}</span>
                </button>
              </div>

              {/* Transactions Ledger matching 16.4 */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {guests.filter(g => (g.payments || []).length > 0).length === 0 ? (
                  <p className="text-center py-10 text-slate-500 font-mono text-[11px]">
                    {isEn ? "No contribution payments registered yet on this event." : "Bado hakuna mabadiliko au malipo yoyote yaliyosajiliwa kwenye event ya sasa."}
                  </p>
                ) : (
                  guests.map(g => {
                    const payments = g.payments || [];
                    return payments.map(p => (
                      <div key={p.id} className="p-3.5 bg-slate-900/40 rounded-xl border border-white/5 flex items-center justify-between gap-3 hover:bg-slate-900/80 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-450 font-bold text-xs uppercase">
                            {g.name[0]}
                          </div>
                          <div>
                            <p className="font-extrabold text-white text-xs uppercase">{g.name}</p>
                            <p className="text-[10px] text-slate-450 font-mono mt-0.5">
                              {p.notes || (isEn ? "Contribution" : "Mchango wa Harusi")} • Ref: <span className="text-slate-350">{p.reference}</span>
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-black text-emerald-400 font-mono text-xs">+ TZS {p.amount.toLocaleString()}</p>
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-[9px] text-slate-500 font-mono">{p.date}</span>
                            <span className="bg-emerald-500/15 border border-emerald-500/20 text-emerald-450 px-1.5 py-0.5 rounded-full text-[8.5px] uppercase font-bold font-mono">
                              delivered
                            </span>
                          </div>
                        </div>
                      </div>
                    ));
                  })
                )}
              </div>
            </div>

            {/* Treasurer Payment recording / Individual Directory lookup */}
            <div className="lg:col-span-5 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider">
                  {isEn ? "Simulated Ledger Options" : "Mionekano ya Wajumbe (Role-Action Security)"}
                </h4>
                <p className="text-slate-400 text-[10.5px]">
                  {activeRole === 'Treasurer' 
                    ? (isEn ? "Treasurer Tools: Select any guest below to record as payment updates." : "Kama Mweka Hazina, unaweza kurekodi malipo mapya ya wageni hapa:")
                    : (isEn ? "Only Trem/Owner may register collections. View list below:" : "Ni Mweka Hazina tu mwenye uwezo wa kurekodi malipo mapya ya mgeni:")
                  }
                </p>
              </div>

              {/* Guest Roster Ledger with lookup */}
              <div className="space-y-2 max-h-96 overflow-y-auto divide-y divide-white/5">
                {activeRole === 'Committee Member' ? (
                  <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-red-500/10 space-y-3">
                    <ShieldCheck className="w-10 h-10 text-rose-500 mx-auto" />
                    <p className="font-mono text-[11px] text-rose-400 uppercase font-black">
                      {isEn ? "ACCESS RESTRICTED" : "KAZI IMEZUIWA KWA MJUMBE"}
                    </p>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      {isEn ? "According to security control 16.11, general Committee Members cannot view names or individual payment levels. Switch simulator to Event Owner or Treasurer above to unlock." : "Kwa kuzingatia sheria ya kiratibu 16.11 na usalama, mjumbe wa kamati wa kawaida hawezi kuona majina au kiasi kimoja kimoja cha wachangiaji."}
                    </p>
                  </div>
                ) : (
                  guests.map(g => {
                    const balance = (g.pledgeAmount || 0) - (g.paidAmount || 0);
                    return (
                      <div key={g.id} className="pt-2.5 pb-2 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-bold text-white uppercase text-[11px]">{g.name}</p>
                          <p className="text-[9.5px] font-mono text-slate-450 mt-0.5">
                            {isEn ? "Pledged" : "Ahadi"}: TZS {(g.pledgeAmount || 0).toLocaleString()} • {isEn ? "Paid" : "Kusanywa"}: TZS {(g.paidAmount || 0).toLocaleString()}
                          </p>
                        </div>

                        <div className="text-right flex items-center gap-2">
                          <div className="font-mono text-right">
                            {balance > 0 ? (
                              <span className="block text-[10px] font-bold text-rose-400">Den: TZS {balance.toLocaleString()}</span>
                            ) : (
                              g.pledgeAmount ? <span className="bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded text-[8.5px] uppercase font-mono">FULLY PAID</span> : <span className="text-slate-650 text-[9.5px]">No Pledge</span>
                            )}
                          </div>

                          {activeRole === 'Treasurer' && (g.pledgeAmount || 0) > 0 && balance > 0 && (
                            <button
                              onClick={() => {
                                setTreasuryTargetGuest(g);
                                setShowTreasurerPayModal(true);
                              }}
                              className="bg-emerald-500 text-slate-950 font-extrabold font-mono text-[9px] uppercase tracking-wider py-1 px-2.5 rounded hover:bg-emerald-400 transition cursor-pointer"
                            >
                              + Lipa
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* Committee Notifications panel - 16.8 */}
          <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="space-y-1">
                <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>{isEn ? "Committee Alert & Event Notification Dispatch Logs" : "Mfumo wa Taarifa Maalum za Kamati (Notifications)"}</span>
                </h4>
                <p className="text-slate-400 text-[10.5px]">
                  {isEn ? "Pledges, completions, and fundraising target achieved alert indicators:" : "Taarifa zote za papo kwa papo za ahadi mpya, makusanyo kukamilika au target kuu kufikiwa:"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={handleClearNotifications}
                  className="p-1 px-3 bg-white/5 rounded-lg border border-white/5 text-slate-400 hover:text-white transition font-mono text-[9.5px]"
                >
                  {isEn ? "Clear Alerts" : "Futa Zote"}
                </button>
              </div>
            </div>

            {/* Channel Dispatch indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-white/5">
              <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-400">In-App Console Channel</span>
                <span className="font-bold text-emerald-400">● LIVE</span>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-400">SMS Outbox Alerts</span>
                <span className="font-bold text-emerald-400">● ACTIVE</span>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-xl border border-white/5 flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-400">WhatsApp Alert Dispatcher</span>
                <span className="font-bold text-emerald-400">● ACTIVE</span>
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center py-6 text-slate-500 font-mono text-xs">
                  {isEn ? "No notifications registered." : "Hakuna taarifa yoyote mpya ya mabadiliko ya michango kwa sasa."}
                </p>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="p-3 bg-slate-900/60 rounded-xl border border-white/5 flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1 animate-ping shrink-0" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white text-xs uppercase">{n.title}</p>
                        <span className="text-[9px] font-mono text-slate-500">• {n.createdAt}</span>
                      </div>
                      <p className="text-[11px] text-slate-450 leading-relaxed">{n.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* SUB-TAB 2: CONTRIBUTION ANALYTICS */}
      {currentSubTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in" id="panel-committee-analytics">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Trend Graphs - 16.5 */}
            <div className="lg:col-span-8 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider">
                  {isEn ? "Collection Flow Progress Graph" : "Kasi ya Makusanyo kwa Siku (Collection Trend Tracker)"}
                </h4>
                <p className="text-slate-400 text-[10.5px]">
                  {isEn ? "Historical progression tracking daily, weekly or monthly incoming collections:" : "Kiasi cha miamala inayoingia nchini kila siku kuwezesha kamati kupanga bajeti:"}
                </p>
              </div>

              {/* Area collection chart */}
              <div className="h-60 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={collectionChartData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '11px', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Aggregated details row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/5 text-center">
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">{isEn ? "Daily Collection Flow" : "Kiwango cha Daily Collections"}</span>
                  <p className="text-base font-black text-amber-400 mt-1 font-mono">TZS {(metrics.totalPaidAmount / Math.max(1, collectionChartData.length)).toFixed(0).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">{isEn ? "Estimated Weekly Rate" : "Kadirio Weekly Collections"}</span>
                  <p className="text-base font-black text-white mt-1 font-mono">TZS {(metrics.totalPaidAmount || 4500000).toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-xl">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">{isEn ? "Active Event Month Sum" : "Monthly Sum (Target status)"}</span>
                  <p className="text-base font-black text-emerald-400 mt-1 font-mono">TZS {metrics.totalPaidAmount.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Top Contributors analytics - 16.5 */}
            <div className="lg:col-span-4 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
              <div className="border-b border-white/5 pb-2">
                <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-yellow-450" />
                  <span>{isEn ? "Pledging Hall of Honor" : "Watunza Heshima (Top Contributors)"}</span>
                </h4>
                <p className="text-slate-400 text-[10.5px]">
                  {isEn ? "Highest individual pledges registered on this active event:" : "Orodha ya wageni waliosajili ahadi zenye thamani kubwa zaidi ya michango:"}
                </p>
              </div>

              {activeRole === 'Committee Member' ? (
                <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-red-500/10 space-y-2">
                  <ShieldCheck className="w-8 h-8 text-rose-500 mx-auto" />
                  <p className="font-mono text-[11px] text-rose-455 uppercase font-black">{isEn ? "ACCESS RESTRICTED" : "KAZI IMEZUIWA"}</p>
                  <p className="text-[10px] text-slate-400 italic">
                    {isEn ? "Committee members can only view general collection rates. Individual rosters are protected." : "Wajumbe wamezuiwa kuona majina kuzuia upendeleo."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topContributorsData.length === 0 ? (
                    <p className="text-center py-6 text-slate-500">
                      {isEn ? "No registered pledges yet." : "Bado hakuna ahadi zilizowekwa."}
                    </p>
                  ) : (
                    topContributorsData.map((g, index) => (
                      <div key={g.id} className="p-3 bg-slate-900/40 rounded-xl border border-white/5 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-black text-xs text-amber-500">#{index+1}</span>
                          <div>
                            <p className="font-bold text-white uppercase text-[10.5px]">{g.name}</p>
                            <p className="text-[9.5px] font-mono text-slate-400 uppercase mt-0.5">
                              {isEn ? "Paid" : "Amelipa"}: TZS {(g.paidAmount || 0).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-mono font-black text-yellow-450 text-[11.5px]">TZS {(g.pledgeAmount || 0).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* SUB-TAB 3: COMMITTEE REPORTS */}
      {currentSubTab === 'reports' && (
        <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-6 animate-fade-in" id="panel-committee-reports">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-1.5 animate-pulse">
                <Printer className="w-4 h-4 text-amber-400" />
                <span>{isEn ? "Financial Committee Official Ledgers" : "Mfumo Muhimu wa Ripoti za Vitengo vya Sherehe"}</span>
              </h3>
              <p className="text-slate-450 text-[11px]">
                {isEn ? "Generate, export, and formulate reports for the financial audit committee:" : "Zalisha, kagua na andaa matokeo rasmi ya makusanyo kwa wajumbe wa harusi:"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadReportPDF}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 px-4 rounded-xl font-mono text-[10.5px] uppercase transition cursor-pointer shadow-md"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{isEn ? "Export Official PDF" : "Pakua Ripoti ya PDF (Rasmi)"}</span>
              </button>
            </div>
          </div>

          {/* Select Report view switcher - 16.7 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'Summary', name: isEn ? '1. Summary Ledger' : '1. Muhtasari wa Michango' },
              { id: 'Collection', name: isEn ? '2. Collections Log' : '2. Ripoti ya Makusanyo' },
              { id: 'Outstanding', name: isEn ? '3. Due Balances' : '3. Wenye Salio la Deni' },
              { id: 'FullyPaid', name: isEn ? '4. Fully Paid' : '4. Waliolipa Yote' },
              { id: 'Pending', name: isEn ? '5. Active Pledges' : '5. Wenye Ahadi' },
              { id: 'NoPledge', name: isEn ? '6. No Pledge' : '6. Wasioahidi Bado' },
              { id: 'Attendance', name: isEn ? '7. Attendance Log' : '7. Mahudhurio ya Wageni' },
              { id: 'RSVP_Report', name: isEn ? '8. RSVP & Messages' : '8. RSVP & Ujumbe' },
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedReport(r.id)}
                className={`py-2 px-3 border rounded-xl font-mono text-[9px] font-bold text-center uppercase transition cursor-pointer text-slate-100 ${
                  selectedReport === r.id 
                    ? 'bg-white/10 border-amber-500 text-amber-400 font-extrabold' 
                    : 'bg-white/[0.01] border-white/5 hover:bg-white/5 hover:border-white/10'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>

          {/* REPORT SCREEN RENDER CONTAINER */}
          <div className={`p-5 rounded-2xl border space-y-4 ${
            selectedReport === 'Summary' 
              ? 'bg-transparent border-transparent p-0' 
              : 'bg-slate-950/80 border-white/5'
          }`} id="printable-area-committee">
            
            {/* Header info showing for other reports */}
            {selectedReport !== 'Summary' && (() => {
              const totalSmsSent = guests.reduce((sum, g) => sum + (g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0)), 0);
              const totalWhatsappSent = guests.reduce((sum, g) => sum + (g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)), 0);
              return (
                <div className="border-b border-white/10 pb-4 text-center justify-center space-y-1.5 pb-4">
                  <h1 className="text-sm font-black uppercase text-amber-400 tracking-wider">EVENTCARD COMMITTEE OFFICIAL LEDGER</h1>
                  <p className="text-[10px] font-mono text-slate-400 uppercase">Event: <span className="text-white font-bold">{event.name || 'Harusi yetu'}</span> • Code: {event.id}</p>
                  <p className="text-[9px] font-mono text-slate-500">{isEn ? "Active Report:" : "Aina ya Ripoti ya Sasa:"} <strong className="text-white uppercase">{selectedReport}</strong> • Printed At: {new Date().toLocaleDateString('sw-TZ')}</p>
                  <div className="flex flex-wrap justify-center items-center gap-3 mt-2 px-3 py-1 bg-white/5 rounded-xl border border-white/5 max-w-lg mx-auto divide-x divide-white/10">
                    <span className="text-[10px] text-slate-400 font-mono pl-2">
                      Jumla SMS Zilizotumwa: <strong className="text-blue-400 font-black">{totalSmsSent}</strong>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono pl-3">
                      Jumla WA Zilizotumwa: <strong className="text-emerald-400 font-black">{totalWhatsappSent}</strong>
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Render 1: Summary Ledger (Prstine layout matching specification) */}
            {selectedReport === 'Summary' && (() => {
              const now = new Date();
              const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
              const dateFormatted = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
              const timeFormatted = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
              const printedDateString = `${weekday}, ${dateFormatted} at ${timeFormatted}`;

              return (
                <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6 max-w-5xl mx-auto font-sans" id="printable-report-card">
                  {/* Embed style block for perfect print purposes to target print-friendly styles cleanly */}
                  <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                      /* Hide everything except screen content */
                      body * {
                        visibility: hidden;
                      }
                      #printable-report-card, #printable-report-card * {
                        visibility: visible;
                      }
                      #printable-report-card {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                      }
                      /* Explicit print-color adjustments */
                      .print-bg-gray {
                        background-color: #f3f4f6 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      .print-bg-header {
                        background-color: #dee5ed !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      .print-border-gray {
                        border-color: #dddddd !important;
                      }
                      .print-text-green {
                        color: #16a34a !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      .print-text-red {
                        color: #dc2626 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                      .print-text-amber {
                        color: #92400e !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                      }
                    }
                  `}} />

                  {/* 1. HEADER BAR */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-4">
                      {/* Logo & Badge / Label Box */}
                      <div className="flex items-center gap-4">
                        <img src="/logo.png" alt="EventCard Logo" className="h-20 w-auto object-contain" />
                        <div className="inline-flex items-center border border-slate-300 px-3 py-1.5 rounded print-border-gray bg-slate-900/5">
                          <span className="text-xs font-black text-slate-700 uppercase tracking-widest">
                            AUDIT MASTER
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Printed Date (Right-aligned) */}
                    <div className="sm:text-right space-y-0.5 text-[11px] text-slate-500">
                      <p className="font-semibold uppercase tracking-wider text-slate-400">{isEn ? 'Exported/Printed Date:' : 'Tarehe ya Kuchapishwa:'}</p>
                      <p className="font-bold text-slate-800">{printedDateString}</p>
                    </div>
                  </div>

                  {/* Document Heading */}
                  <div className="mt-4 space-y-1">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                      {isEn ? 'OFFICIAL CONTRIBUTIONS REPORT' : 'RIPOTI RASMI YA MICHANGO'}
                    </h1>
                    <p className="text-[12px] font-medium text-slate-600 uppercase flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="font-bold text-slate-900">{event.name}</span>
                      <span>•</span>
                      <span>{isEn ? 'Event Date:' : 'Tarehe ya Sherehe:'}</span>
                      <span className="font-bold text-slate-900">{event.date || '2026-05-31'}</span>
                    </p>
                  </div>

                  {/* Thick Solid Dark Divider */}
                  <div className="h-1 bg-slate-900 my-2" />

                  {/* 2. SUMMARY METRICS ROW - 4 bordered cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Target - BLUE VIBRANT */}
                    <div className="border border-blue-400 bg-blue-600 p-5 rounded-2xl text-center flex flex-col justify-between shadow-lg shadow-blue-500/20">
                      <span className="text-[9.5px] font-black text-blue-50 uppercase tracking-[0.2em]">{isEn ? 'TARGET BUDGET' : 'MALENGO (TARGET)'}</span>
                      <span className="text-xl font-black text-white mt-2 block font-mono">
                        {fundraisingTarget.toLocaleString()} TZS
                      </span>
                    </div>
                    {/* Card 2: Pledged - AMBER VIBRANT */}
                    <div className="border border-amber-400 bg-amber-500 p-5 rounded-2xl text-center flex flex-col justify-between shadow-lg shadow-amber-500/20">
                      <span className="text-[9.5px] font-black text-amber-50 uppercase tracking-[0.2em]">{isEn ? 'TOTAL PLEDGED' : 'JUMLA YA AHADI'}</span>
                      <span className="text-xl font-black text-white mt-2 block font-mono">
                        {metrics.totalPledgedAmount.toLocaleString()} TZS
                      </span>
                    </div>
                    {/* Card 3: Collected - EMERALD VIBRANT */}
                    <div className="border border-emerald-400 bg-emerald-600 p-5 rounded-2xl text-center flex flex-col justify-between shadow-lg shadow-emerald-500/20">
                      <span className="text-[9.5px] font-black text-emerald-50 uppercase tracking-[0.2em]">{isEn ? 'CASH COLLECTED' : 'FEDHA TASLIMU'}</span>
                      <span className="text-xl font-black text-white mt-2 block font-mono">
                        {metrics.totalPaidAmount.toLocaleString()} TZS
                      </span>
                    </div>
                    {/* Card 4: Outstanding - ROSE VIBRANT */}
                    <div className="border border-rose-400 bg-rose-600 p-5 rounded-2xl text-center flex flex-col justify-between shadow-lg shadow-rose-500/20">
                      <span className="text-[9.5px] font-black text-rose-50 uppercase tracking-[0.2em]">{isEn ? 'OUTSTANDING BAL' : 'DENI / SALIO'}</span>
                      <span className="text-xl font-black text-white mt-2 block font-mono">
                        {metrics.outstandingBalance.toLocaleString()} TZS
                      </span>
                    </div>
                  </div>

                  {/* 3. GROUP LEVEL SUMMARIES SECTION */}
                  <div className="space-y-3 pt-2">
                    <div className="bg-slate-100 p-2.5 rounded-lg flex items-center justify-between print-bg-gray">
                      <h3 className="font-black text-[11.5px] text-slate-900 uppercase tracking-wider">
                        {isEn ? 'GROUP LEVEL SUMMARIES' : 'MUHTASARI KWA MAKUNDI'}
                      </h3>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 print-border-gray">
                      <table className="w-full text-left border-collapse text-xs print-border-gray">
                        <thead>
                          <tr className="bg-[#dee5ed] text-slate-900 font-bold border-b border-slate-200 print-bg-header print-border-gray">
                            <th className="py-2.5 px-4 border-r border-slate-200 print-border-gray uppercase tracking-wider">{isEn ? 'Campaign Group' : 'Kundi la Mchangiaji'}</th>
                            <th className="py-2.5 px-4 border-r border-slate-200 text-center print-border-gray uppercase tracking-wider">{isEn ? 'Count' : 'Idadi'}</th>
                            <th className="py-2.5 px-4 border-r border-slate-200 text-right print-border-gray uppercase tracking-wider">{isEn ? 'Total Pledged' : 'Jumla ya Ahadi'}</th>
                            <th className="py-2.5 px-4 border-r border-slate-200 text-right print-border-gray uppercase tracking-wider">{isEn ? 'Collected Cash' : 'Makusanyo'}</th>
                            <th className="py-2.5 px-4 text-right print-border-gray uppercase tracking-wider">{isEn ? 'Balances' : 'Mabaki (TZS)'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {groupSummaries.list.map((group, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 print-border-gray">
                              <td className="py-2.5 px-4 border-r border-slate-200 font-bold text-slate-800 print-border-gray uppercase">{group.name}</td>
                              <td className="py-2.5 px-4 border-r border-slate-200 text-center text-slate-700 print-border-gray font-mono">{group.count}</td>
                              <td className="py-2.5 px-4 border-r border-slate-200 text-right text-[#92400e] print-text-amber font-semibold print-border-gray font-mono">{group.pledged.toLocaleString()}</td>
                              <td className="py-2.5 px-4 border-r border-slate-200 text-right text-[#16a34a] print-text-green font-semibold print-border-gray font-mono">{group.collected.toLocaleString()}</td>
                              <td className="py-2.5 px-4 text-right text-[#dc2626] print-text-red font-semibold print-border-gray font-mono">{group.balances.toLocaleString()}</td>
                            </tr>
                          ))}
                          {/* Aggregated Totals Row */}
                          <tr className="bg-slate-100 font-black border-t-2 border-slate-300 print-bg-gray print-border-gray text-slate-900">
                            <td className="py-2.5 px-4 border-r border-slate-200 print-border-gray">{isEn ? 'TOTALS' : 'JUMLA KUU'}</td>
                            <td className="py-2.5 px-4 border-r border-slate-200 text-center print-border-gray font-mono">{groupSummaries.totals.count}</td>
                            <td className="py-2.5 px-4 border-r border-slate-200 text-right text-[#92400e] print-text-amber print-border-gray font-mono">{groupSummaries.totals.pledged.toLocaleString()}</td>
                            <td className="py-2.5 px-4 border-r border-slate-200 text-right text-[#16a34a] print-text-green print-border-gray font-mono">{groupSummaries.totals.collected.toLocaleString()}</td>
                            <td className="py-2.5 px-4 text-right text-[#dc2626] print-text-red print-border-gray font-mono">{groupSummaries.totals.balances.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 4. MASTER GUEST REVENUE DATABASE SECTION */}
                  <div className="space-y-3 pt-2">
                    <div className="bg-slate-100 p-2.5 rounded-lg flex items-center justify-between print-bg-gray">
                      <h3 className="font-black text-[11.5px] text-slate-900 uppercase tracking-wider">
                        {isEn ? 'MASTER GUEST REVENUE DATABASE' : 'DAFTARI KUU LA MICHANGO YA WAGENI'}
                      </h3>
                      <span className="text-[10px] font-extrabold text-slate-600 tracking-widest uppercase">
                        {guests.length} {isEn ? 'GUESTS TOTAL' : 'WAGENI WOTE'}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 print-border-gray">
                      <table className="w-full text-left border-collapse text-[11px] print-border-gray">
                        <thead>
                          <tr className="bg-[#dee5ed] text-slate-900 font-bold border-b border-slate-200 print-bg-header print-border-gray">
                            <th className="py-2.5 px-3 border-r border-slate-200 text-center print-border-gray uppercase tracking-wider">{isEn ? 'S/N' : 'Na.'}</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 print-border-gray uppercase tracking-wider">{isEn ? 'Guest Full Name' : 'Jina la Mgeni'}</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 print-border-gray uppercase tracking-wider">{isEn ? 'Mobile' : 'Simu'}</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 print-border-gray uppercase tracking-wider">{isEn ? 'Category' : 'Kundi'}</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-right print-border-gray uppercase tracking-wider">{isEn ? 'Pledge' : 'Ahadi'}</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-right print-border-gray uppercase tracking-wider">{isEn ? 'Paid Amt' : 'Imelipwa'}</th>
                            <th className="py-2.5 px-3 border-r border-slate-200 text-right print-border-gray uppercase tracking-wider">{isEn ? 'Balance' : 'Salio'}</th>
                            <th className="py-2.5 px-3 print-border-gray uppercase tracking-wider">{isEn ? 'Clearance' : 'Hali'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {masterGuestList.map((g) => (
                            <tr key={g.sn} className="hover:bg-slate-50/50 print-border-gray text-slate-700">
                              <td className="py-2.5 px-3 border-r border-slate-200 text-center print-border-gray font-mono text-slate-500">{g.sn}</td>
                              <td className="py-2.5 px-3 border-r border-slate-200 font-extrabold text-slate-900 print-border-gray uppercase">{g.name}</td>
                              <td className="py-2.5 px-3 border-r border-slate-200 print-border-gray font-mono">{g.phone}</td>
                              <td className="py-2.5 px-3 border-r border-slate-200 print-border-gray text-[10px] uppercase font-bold text-slate-600">{g.category}</td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-right text-slate-900 font-bold print-border-gray font-mono">{g.pledge.toLocaleString()}</td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-right text-[#16a34a] print-text-green font-bold print-border-gray font-mono">{g.paid.toLocaleString()}</td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-right text-[#dc2626] print-text-red font-bold print-border-gray font-mono">{g.balance.toLocaleString()}</td>
                              <td className={`py-2.5 px-3 border-r border-slate-200 font-bold print-border-gray uppercase text-[10px] ${
                                g.clearance === 'Completed' ? 'text-green-600 print-text-green font-black' : g.clearance === 'Partial' ? 'text-red-600 print-text-red font-black' : 'text-slate-900'
                              }`}>
                                {isEn ? g.clearance : (g.clearance === 'Completed' ? 'Umekamilisha' : g.clearance === 'Partial' ? 'Kiasi' : 'Bado')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Native print button (remains ignored on printed format via CSS) */}
                  <div className="flex justify-between items-center pt-4 border-t border-slate-100 print:hidden">
                    <button 
                      onClick={() => downloadReportCSV('Muhtasari_Ledger', guests)}
                      className="p-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-mono text-[10.5px] font-bold flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Download Excel / CSV' : 'Pakua Excel / CSV'}</span>
                    </button>
                    
                    <button 
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 bg-slate-900 text-white font-extrabold hover:bg-slate-800 text-[11px] py-2.5 px-4 rounded-xl font-mono uppercase transition cursor-pointer shadow-md"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Direct Browser Print' : 'Chapa Moja kwa Moja'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Render 2: Collections Log / Detailed Payments Report */}
            {selectedReport === 'Collection' && (
              <div className="space-y-6">
                <style dangerouslySetInnerHTML={{ __html: `
                  @media print {
                    .print-table { color: #000 !important; }
                    .print-table th { background: #f1f5f9 !important; color: #475569 !important; border-bottom: 2px solid #cbd5e1 !important; }
                    .print-table td { border-bottom: 1px solid #e2e8f0 !important; }
                    .print-text-emerald { color: #059669 !important; -webkit-print-color-adjust: exact !important; }
                    .print-bg-slate { background: #f8fafc !important; -webkit-print-color-adjust: exact !important; }
                  }
                `}} />

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/5 p-5 rounded-2xl border border-white/5 shadow-inner">
                  <div>
                    <h4 className="font-black text-sm uppercase text-white font-mono tracking-tighter">2. Deteli ya Makusanyo / Payments Ledger</h4>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">{event.name} • {event.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => downloadReportCSV('Log_ya_Makusanyo_Yaliyolipwa', activePledgeList)}
                      className="flex items-center gap-2 bg-slate-800 text-amber-400 hover:bg-slate-700 font-bold text-[10px] py-2 px-4 rounded-xl border border-amber-500/10 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>DOWNLOAD CSV</span>
                    </button>
                    <button 
                      onClick={() => window.print()}
                      className="flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-500 font-bold text-[10px] py-2 px-4 rounded-xl shadow-lg shadow-emerald-900/20 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>CHAPA RIPOTI</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
                   <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl shadow-lg shadow-emerald-950/20">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{isEn ? 'TOTAL COLLECTION' : 'JUMLA MAKUSANYO'}</p>
                      <p className="text-2xl font-mono font-black text-emerald-300 mt-2">{metrics.totalPaidAmount.toLocaleString()} <span className="text-xs opacity-60">TZS</span></p>
                      <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between">
                         <span className="text-[9px] text-emerald-500 font-bold uppercase">{isEn ? 'Success Rate' : 'Kiwango cha Mafanikio'}</span>
                         <span className="text-[10px] font-black text-white">{metrics.totalPledgedAmount > 0 ? ((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100).toFixed(1) : 0}%</span>
                      </div>
                   </div>
                   <div className="bg-blue-500/10 border border-blue-500/30 p-5 rounded-2xl shadow-lg shadow-blue-950/20">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{isEn ? 'PAYMENTS COUNT' : 'IDADI YA MALIPO'}</p>
                      <p className="text-2xl font-mono font-black text-blue-300 mt-2">{guests.reduce((acc, g) => acc + (g.payments || []).length, 0)}</p>
                      <div className="mt-4 pt-3 border-t border-blue-500/20 flex items-center justify-between">
                         <span className="text-[9px] text-blue-500 font-bold uppercase">{isEn ? 'Average Trans' : 'Wastani wa Malipo'}</span>
                         <span className="text-[10px] font-black text-white">
                           {Math.round(metrics.totalPaidAmount / (guests.reduce((acc, g) => acc + (g.payments || []).length, 0) || 1)).toLocaleString()}
                         </span>
                      </div>
                   </div>
                   <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl shadow-lg shadow-amber-950/20">
                      <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{isEn ? 'PENDING COMMITMENT' : 'PENDING COMMITMENT'}</p>
                      <p className="text-2xl font-mono font-black text-amber-200 mt-2">{metrics.outstandingBalance.toLocaleString()} <span className="text-xs opacity-60">TZS</span></p>
                      <div className="mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-between">
                         <span className="text-[9px] text-amber-500 font-bold uppercase">{isEn ? 'In Arrears' : 'Inadaiwa'}</span>
                         <span className="text-[10px] font-black text-rose-400">{isEn ? 'Action Required' : 'Hatua Inahitajika'}</span>
                      </div>
                   </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/50">
                  <table className="w-full text-left border-collapse font-sans text-xs print-table">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                        <th className="py-3.5 px-4 font-black">S/N</th>
                        <th className="py-3.5 px-4 font-black">Mlipaji (Guest Name)</th>
                        <th className="py-3.5 px-4 font-black text-right">Kiasi Kilicholipwa</th>
                        <th className="py-3.5 px-4 font-black">Tarehe</th>
                        <th className="py-3.5 px-4 font-black">Msimbo / Ref</th>
                        <th className="py-3.5 px-4 font-black">Maelezo (Notes)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {(() => {
                        let sn = 1;
                        const allPayments: {guestName: string, p: any}[] = [];
                        guests.forEach(g => {
                          (g.payments || []).forEach(p => {
                            allPayments.push({ guestName: g.name || '', p });
                          });
                        });
                        
                        // Sort by date descending
                        allPayments.sort((a, b) => new Date(b.p.date).getTime() - new Date(a.p.date).getTime());

                        if (allPayments.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="py-12 text-center text-slate-500 font-sans italic">
                                <p className="text-lg">📭</p>
                                <p className="mt-2">Hakuna malipo yaliyosajiliwa bado kwenye mfumo.</p>
                              </td>
                            </tr>
                          );
                        }

                        return allPayments.map((item, idx) => (
                          <tr key={item.p.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="py-3 px-4 text-slate-500 text-[10px]">{idx + 1}</td>
                            <td className="py-3 px-4 font-bold text-slate-200 group-hover:text-white uppercase tracking-tight">{item.guestName}</td>
                            <td className="py-3 px-4 text-right">
                               <span className="bg-emerald-500/10 text-emerald-400 print-text-emerald font-black px-2.5 py-1 rounded-lg border border-emerald-500/20 text-[11px]">
                                 {item.p.amount.toLocaleString()}
                               </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-medium">{item.p.date}</td>
                            <td className="py-4 px-4">
                               <span className="text-slate-500 text-[10px] break-all border-b border-dotted border-slate-700 pb-0.5">{item.p.reference || 'N/A'}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[10px] group-hover:text-slate-300 transition-colors max-w-xs truncate" title={item.p.notes}>
                              {item.p.notes || '-'}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center bg-slate-950/40 p-4 rounded-xl border border-white/5 print:hidden">
                   <p className="text-[10px] text-slate-500 font-medium">Record iliyochaguliwa inajumuisha malipo yote yaliyosajiliwa hadi sasa.</p>
                   <p className="text-[10px] text-slate-400 font-mono italic">Verified by Kadi Digital Audit System</p>
                </div>
              </div>
            )}

            {/* Render 3: Due Balances */}
            {selectedReport === 'Outstanding' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono">3. Orodha ya Wenye Balansi Inayodaiwa</h4>
                  <button 
                    onClick={() => downloadReportCSV('Orodha_ya_Wenye_Madeni', [...partialPaidList, ...noPaymentPledgeList])}
                    className="p-1 px-2.5 bg-white/5 hover:bg-white/10 rounded font-mono text-[10px] text-amber-400 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download CSV</span>
                  </button>
                </div>

                <table className="w-full text-left border-collapse font-sans text-xs" id="table-outstanding-report">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-2 px-3">Guest Name</th>
                      <th className="py-2 px-3">Pledge Type</th>
                      <th className="py-2 px-3 text-right">Commitment TZS</th>
                      <th className="py-2 px-3 text-right">Paid So Far TZS</th>
                      <th className="py-2 px-3 text-right text-rose-400">Balance Due TZS</th>
                      <th className="py-2 px-3 text-center">SMS</th>
                      <th className="py-2 px-3 text-center">WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                    {[...partialPaidList, ...noPaymentPledgeList].length === 0 ? (
                      <tr><td colSpan={7} className="py-6 text-center text-slate-500">Mungu ni mwema! Hakuna mtu anayedaiwa sasa hivi.</td></tr>
                    ) : (
                      [...partialPaidList, ...noPaymentPledgeList].map(g => {
                        const b = (g.pledgeAmount || 0) - (g.paidAmount || 0);
                        return (
                          <tr key={g.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2 px-3 font-bold uppercase">{g.name}</td>
                            <td className="py-2 px-3 text-slate-400 uppercase text-[9.5px]">{(g.paidAmount || 0) > 0 ? 'LIPA NUSU' : 'HAIJALIPWA BADO'}</td>
                            <td className="py-2 px-3 text-right">TZS {(g.pledgeAmount || 0).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right">TZS {(g.paidAmount || 0).toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-rose-400 font-black">TZS {b.toLocaleString()}</td>
                            <td className="py-2 px-3 text-center text-blue-400 font-bold">{g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0)}</td>
                            <td className="py-2 px-3 text-center text-emerald-400 font-bold">{g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Render 4: Fully Paid */}
            {selectedReport === 'FullyPaid' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono">4. Orodha ya Waliotimiza Ahadi Kikamilifu</h4>
                  <button 
                    onClick={() => downloadReportCSV('Orodha_ya_Waliolipa_Yote', fullyPaidList)}
                    className="p-1 px-2.5 bg-white/5 hover:bg-white/10 rounded font-mono text-[10px] text-amber-400 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download CSV</span>
                  </button>
                </div>

                <table className="w-full text-left border-collapse font-sans text-xs" id="table-fullypaid-report">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-2 px-3">Mchangiaji</th>
                      <th className="py-2 px-3">Simu ya Mkononi</th>
                      <th className="py-2 px-3 text-right">Goal Completed TZS</th>
                      <th className="py-2 px-3 text-center">SMS</th>
                      <th className="py-2 px-3 text-center">WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                    {fullyPaidList.length === 0 ? (
                      <tr><td colSpan={5} className="py-6 text-center text-slate-500">Haipo kumbukumbu yoyote ya mchangiaji aliyelipa yote bado.</td></tr>
                    ) : (
                      fullyPaidList.map(g => (
                        <tr key={g.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 font-bold uppercase">{g.name}</td>
                          <td className="py-2 px-3 text-slate-400">{g.phone || 'Hakuna simu'}</td>
                          <td className="py-2 px-3 text-right text-emerald-400 font-black">TZS {(g.pledgeAmount || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-center text-blue-400 font-bold">{g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0)}</td>
                          <td className="py-2 px-3 text-center text-emerald-400 font-bold">{g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Render 5: Active Pledges */}
            {selectedReport === 'Pending' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono">5. Orodha Kuu ya Ahadi Zote zilizowekwa</h4>
                  <button 
                    onClick={() => downloadReportCSV('Kumbukumbu_ya_Ahadi_Zote', activePledgeList)}
                    className="p-1 px-2.5 bg-white/5 hover:bg-white/10 rounded font-mono text-[10px] text-amber-400 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download CSV</span>
                  </button>
                </div>

                <table className="w-full text-left border-collapse font-sans text-xs" id="table-pending-report">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-2 px-3">Mgeni</th>
                      <th className="py-2 px-3 font-mono">status</th>
                      <th className="py-2 px-3 text-right font-mono">Amount Pledge</th>
                      <th className="py-2 px-3 text-center">SMS</th>
                      <th className="py-2 px-3 text-center">WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                    {activePledgeList.length === 0 ? (
                      <tr><td colSpan={5} className="py-6 text-center text-slate-500">Hakuna ahadi ya mchango iliyoandikishwa bado.</td></tr>
                    ) : (
                      activePledgeList.map(g => (
                        <tr key={g.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 font-bold uppercase">{g.name}</td>
                          <td className="py-2 px-3 text-amber-400 uppercase text-[9.5px]">{g.pledgeStatus}</td>
                          <td className="py-2 px-3 text-right font-black">TZS {(g.pledgeAmount || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-center text-blue-400 font-bold">{g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0)}</td>
                          <td className="py-2 px-3 text-center text-emerald-400 font-bold">{g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Render 7: Attendance Log */}
            {selectedReport === 'Attendance' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono">7. Orodha ya Wageni Walioingia (Check-ins)</h4>
                  <button 
                    onClick={downloadAttendanceCSV}
                    disabled={checkedInList.length === 0}
                    className="p-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 disabled:bg-white/5 rounded font-mono text-[10px] text-emerald-400 disabled:text-slate-500 border border-emerald-500/20 flex items-center gap-1 transition cursor-pointer"
                    title="Export all check-ins to CSV"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download Attendance CSV ({checkedInList.length})</span>
                  </button>
                </div>

                <table className="w-full text-left border-collapse font-sans text-xs" id="table-attendance-report">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-2 px-3">Muda (Time)</th>
                      <th className="py-2 px-3">Jina la Mgeni</th>
                      <th className="py-2 px-3">Aina ya Kadi</th>
                      <th className="py-2 px-3 text-right">Hali ya Skani</th>
                      <th className="py-2 px-3 text-center">SMS</th>
                      <th className="py-2 px-3 text-center">WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                    {checkedInList.length === 0 ? (
                      <tr><td colSpan={6} className="py-10 text-center text-slate-500 italic uppercase tracking-widest text-[9px]">Skani bado hazijaanza. Hakuna mahudhurio ya kuonyesha.</td></tr>
                    ) : (
                      [...checkedInList]
                        .sort((a,b) => (b.checkedInTime || '').localeCompare(a.checkedInTime || ''))
                        .map(g => (
                          <tr key={g.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-3 text-blue-400 font-bold">{g.checkedInTime}</td>
                            <td className="py-2.5 px-3 font-bold uppercase">{g.name}</td>
                            <td className="py-2.5 px-3 text-slate-400 text-[9px]">{g.cardType}</td>
                            <td className="py-2.5 px-3 text-right text-emerald-400 font-black">SUCCESS</td>
                            <td className="py-2.5 px-3 text-center text-blue-400 font-bold">{g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0)}</td>
                            <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">{g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)}</td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {selectedReport === 'NoPledge' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono">6. Orodha ya Wageni ambao Bado Hawajaonyesha Ahadi Yoyote</h4>
                  <button 
                    onClick={() => downloadReportCSV('Orodha_Wasioahidi_Bado', unpledgedList)}
                    className="p-1 px-2.5 bg-white/5 hover:bg-white/10 rounded font-mono text-[10px] text-amber-400 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download CSV ({unpledgedList.length})</span>
                  </button>
                </div>

                <table className="w-full text-left border-collapse font-sans text-xs" id="table-nopledge-report">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase">
                      <th className="py-2 px-3">Jina la Mgeni</th>
                      <th className="py-2 px-3">Mwasiliano ya Simu</th>
                      <th className="py-2 px-3 text-center">Registration Link</th>
                      <th className="py-2 px-3 text-center">SMS</th>
                      <th className="py-2 px-3 text-center">WA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                    {unpledgedList.length === 0 ? (
                      <tr><td colSpan={5} className="py-6 text-center text-slate-500">Safi sana! Wageni wote wameshasajili ahadi zao.</td></tr>
                    ) : (
                      unpledgedList.map(g => (
                        <tr key={g.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 font-bold uppercase">{g.name}</td>
                          <td className="py-2 px-3 text-slate-400">{g.phone || 'Hakuna namba ya simu'}</td>
                          <td className="py-2 px-3 text-center text-slate-550 text-[10px]">https://eventcard.co.tz/pledge/{g.code}</td>
                          <td className="py-2 px-3 text-center text-blue-400 font-bold">{g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0)}</td>
                          <td className="py-2 px-3 text-center text-emerald-400 font-bold">{g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Render 8: RSVP & Messages Report Dashboard */}
            {selectedReport === 'RSVP_Report' && (() => {
              const countComing = guests.filter(g => g.rsvpStatus === 'Atahudhuria').length;
              const totalPeopleAttending = guests.filter(g => g.rsvpStatus === 'Atahudhuria').reduce((acc, current) => acc + (current.rsvpGuestsCount || 1), 0);
              const countDeclined = guests.filter(g => g.rsvpStatus === 'Hatahudhuria').length;
              const countMaybe = guests.filter(g => g.rsvpStatus === 'Labda').length;
              const countPending = guests.filter(g => !g.rsvpStatus || g.rsvpStatus === 'Bado').length;
              
              const sortedRSVPGuests = [...guests].sort((a,b) => {
                const valA = a.rsvpStatus === 'Atahudhuria' ? 1 : a.rsvpStatus === 'Labda' ? 2 : a.rsvpStatus === 'Bado' || !a.rsvpStatus ? 3 : 4;
                const valB = b.rsvpStatus === 'Atahudhuria' ? 1 : b.rsvpStatus === 'Labda' ? 2 : b.rsvpStatus === 'Bado' || !b.rsvpStatus ? 3 : 4;
                return valA - valB || a.name.localeCompare(b.name);
              });

              return (
                <div className="space-y-6" id="panel-rsvp-report">
                  {/* RSVP stats grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                     <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl shadow">
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">WATAKAOFIKA / COMING</p>
                        <p className="text-xl font-mono font-black text-emerald-300 mt-2">{countComing} Kadi ({totalPeopleAttending} Watu)</p>
                     </div>
                     <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl shadow">
                        <p className="text-[10px] font-black text-rose-455 uppercase tracking-widest">HAWATAHUDHURIA / DECLINED</p>
                        <p className="text-xl font-mono font-black text-rose-300 mt-2">{countDeclined} Kadi</p>
                     </div>
                     <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl shadow">
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">LABDA / MAYBE</p>
                        <p className="text-xl font-mono font-black text-amber-300 mt-2">{countMaybe} Kadi</p>
                     </div>
                     <div className="bg-slate-500/10 border border-slate-500/30 p-4 rounded-2xl shadow">
                        <p className="text-[10px] font-black text-slate-350 uppercase tracking-widest">BADO MAJIBU / PENDING</p>
                        <p className="text-xl font-mono font-black text-slate-200 mt-2">{countPending} Wageni</p>
                     </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono">8. RSVP & Ujumbe (Zilizotumwa kwa Mgeni Mmoja Mmoja)</h4>
                    <span className="text-[10px] font-bold font-mono text-slate-400 uppercase">Jumla: {guests.length} Wageni Waliosajiliwa</span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-900/50">
                    <table className="w-full text-left border-collapse font-sans text-xs">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                          <th className="py-3 px-4 font-black">S/N</th>
                          <th className="py-3 px-4 font-black">Mgeni / Guest Name</th>
                          <th className="py-3 px-4 font-black">Simu</th>
                          <th className="py-3 px-4 font-black text-center">Aina ya Kadi</th>
                          <th className="py-3 px-4 font-black text-center">RSVP Jibu</th>
                          <th className="py-3 px-4 font-black text-center">Watu RSVP</th>
                          <th className="py-3 px-4 font-black text-center">SMS</th>
                          <th className="py-3 px-4 font-black text-center">WA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                        {sortedRSVPGuests.map((g, idx) => (
                          <tr key={g.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-4 font-bold uppercase">{g.name}</td>
                            <td className="py-2.5 px-4 text-slate-400">{g.phone || '-'}</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                g.cardType === 'DOUBLE' 
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-400/20' 
                                  : 'bg-blue-500/10 text-blue-300 border-blue-400/20'
                              }`}>
                                {g.cardType || 'SINGLE'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                g.rsvpStatus === 'Atahudhuria' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                g.rsvpStatus === 'Hatahudhuria' ? 'bg-red-500/10 text-rose-450 border-red-500/20' :
                                g.rsvpStatus === 'Labda' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                'bg-white/5 text-slate-400 border-white/10'
                              }`}>
                                {g.rsvpStatus || 'Bado Jibu'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-300 font-bold">{g.rsvpStatus === 'Hatahudhuria' ? 0 : (g.rsvpGuestsCount || 1)}</td>
                            <td className="py-2.5 px-4 text-center text-blue-400 font-bold">{g.smsCount || (g.smsStatus === 'Imetumia' ? 1 : 0)}</td>
                            <td className="py-2.5 px-4 text-center text-emerald-400 font-bold">{g.whatsappCount || (g.whatsappStatus === 'Imetumia' ? 1 : 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

          </div>

        </div>
      )}

      {/* SUB-TAB 4: MANAGE COMMITTEE (ADMIN ONLY) - 16.1 */}
      {currentSubTab === 'members' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in" id="panel-committee-setup">
          
          {/* Form to add members */}
          <div className="lg:col-span-5 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="border-b border-white/5 pb-2">
              <span className="bg-blue-500/10 border border-blue-500/20 text-blue-450 font-mono text-[9px] px-2.5 py-1 rounded-full uppercase font-bold">
                {isEn ? "Add New Committee Members" : "Ongeza Wanakamati Wapya"}
              </span>
              <h3 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider mt-2">
                {isEn ? "Invitations Dispatch Center" : "Sajili Mjumbe wa Kamati"}
              </h3>
              <p className="text-slate-400 text-[10.5px]">
                {isEn ? "System dispatches instant access login links to target members:" : "Utatuma kiungo cha ufikiaji na namba ya logins papo kwa hapo kwa mjumbe mpya:"}
              </p>
            </div>

            <form onSubmit={handleCreateMember} className="space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]" htmlFor="member-fullname">{isEn ? "Full Name:" : "Jina Kamili la Mjumbe:"}</label>
                <input 
                  id="member-fullname"
                  type="text" 
                  value={memberName} 
                  onChange={(e) => setMemberName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500" 
                  required 
                  placeholder="e.g. Salama Khamis"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]" htmlFor="member-phone">{isEn ? "Phone Number:" : "Simu ya Mkononi:"}</label>
                  <input 
                    id="member-phone"
                    type="tel" 
                    value={memberPhone} 
                    onChange={(e) => setMemberPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono" 
                    required 
                    placeholder="e.g. 0712345678"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]" htmlFor="member-email">{isEn ? "Email address:" : "Barua Pepe (Email):"}</label>
                  <input 
                    id="member-email"
                    type="email" 
                    value={memberEmail} 
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono" 
                    placeholder="e.g. salma@gmail.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]">{isEn ? "Position & Responsibility:" : "Nafasi kwenye Kamati (Position):"}</label>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  {(committeeRoles.length > 0 ? committeeRoles.map(r => ({ val: r.name, label: r.name })) : [
                    { val: 'Chairperson', label: 'Chairperson' },
                    { val: 'Treasurer', label: 'Treasurer' },
                    { val: 'Secretary', label: 'Secretary' },
                    { val: 'Committee Member', label: 'Committee Member' }
                  ]).map(pos => (
                    <button
                      type="button"
                      key={pos.val}
                      onClick={() => setMemberPosition(pos.val as any)}
                      className={`p-2 border rounded-xl text-left text-[10px] font-bold uppercase transition ${
                        memberPosition === pos.val
                          ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                          : 'border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 block uppercase font-mono text-[9.5px]">{isEn ? "Invitation Channel:" : "Njia ya Kutuma Mwaliko:"}</label>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  {['SMS', 'WhatsApp', 'Email'].map(ch => (
                    <button
                      type="button"
                      key={ch}
                      onClick={() => setMemberMethod(ch as any)}
                      className={`p-2 border rounded-xl text-center text-[10px] font-bold uppercase transition ${
                        memberMethod === ch
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                          : 'border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition shadow-md hover:brightness-110 cursor-pointer"
              >
                {isEn ? "Send Login Link invitation" : "Alika Mjumbe (Tuma Login Link)"}
              </button>
            </form>

            {/* Generated demo link simulator visual assistance */}
            {invitationLinkSent && (
              <div className="p-4 bg-slate-950 rounded-xl border border-white/5 space-y-2 animate-fade-in text-[11px]">
                <p className="text-emerald-400 font-bold font-mono">✓ Mjumbe amefanikiwa kualikwa kwenye kamati!</p>
                <p className="text-slate-450 text-[10.5px]">
                  Simulated dispatch successful. Invitation login link was copied:
                </p>
                <input 
                  type="text" 
                  readOnly 
                  value={invitationLinkSent} 
                  className="w-full bg-white/5 border border-white/5 p-1 px-2 rounded text-slate-350 text-[10px] font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>
            )}
          </div>

          {/* Roster of members - 16.12 */}
          <div className="lg:col-span-7 backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4">
            <div className="border-b border-white/5 pb-2">
              <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider">
                {isEn ? "Registered Committee Members list" : "Orodha ya Wanakamati waliopo kwenye mfumo"}
              </h4>
              <p className="text-slate-450 text-[10.5px]">{isEn ? "Roster of honor with position configurations:" : "Kadi za watendaji wa kamati ya sasa kufuana na mamlaka yao:"}</p>
            </div>

            <div className="space-y-3">
              {committeeMembers.map(m => (
                <div key={m.id} className="p-4 bg-slate-900/60 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-mono text-slate-400 text-lg uppercase font-bold">
                      {m.name[0]}
                    </div>
                    <div>
                      <p className="font-extrabold text-white uppercase text-[12px]">{m.name}</p>
                      <p className="text-[10px] text-slate-450 font-mono mt-0.5">{m.phone} • <span className="text-slate-350">{m.email}</span></p>
                    </div>
                  </div>

                  <div className="text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1">
                    <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-1 rounded-lg text-[9.5px] uppercase font-bold font-mono">
                      {m.position}
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono uppercase">{m.permissionLevel}</span>
                  </div>
                  {activeRole === 'Event Owner' && (
                    <button
                      onClick={() => {
                        fetch(`/api/committee/members/${m.id}`, { method: 'DELETE' })
                          .then(() => fetch('/api/committee/members'))
                          .then(res => res.json())
                          .then(list => {
                            if (Array.isArray(list)) setCommitteeMembers(list);
                          });
                      }}
                      className="mt-2 sm:mt-0 px-2 py-1 bg-red-500/10 text-red-500 rounded border border-red-500/20 hover:bg-red-500/20 text-[10px] font-bold uppercase transition"
                    >
                      {isEn ? 'Remove' : 'Ondoa'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {activeRole === 'Event Owner' && (
              <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                <div className="flex items-center gap-2 text-rose-450 border-b border-rose-500/10 pb-2">
                  <Share2 className="w-4 h-4 shrink-0" />
                  <h4 className="font-extrabold uppercase font-mono tracking-wider text-xs">
                    {isEn ? "Share Dashboard Access (PIN Locks)" : "Shiriki Viungo kwa Wajumbe Nakala"}
                  </h4>
                </div>
                <p className="text-[10.5px] text-slate-400">
                  {isEn 
                    ? "Share the main dashboard link and their respective role PIN codes for encrypted access. Each role has specific permissions configured." 
                    : "Watumie wajumbe link kuu ya kamati kisha uwape PIN zao halisi kulingana na cheo chao katika kamati. Kila mjumbe ana ruhusa zinazoendana na cheo chake."}
                </p>
                <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-3 font-mono text-[10px]">
                  <p className="text-white flex flex-wrap items-center gap-1.5 leading-relaxed">
                    <strong>URL MAALUM (Link):</strong> 
                    <span className="text-amber-400 select-all underline decoration-amber-500/30 underline-offset-4 font-bold">{window.location.origin}/?portal=committee&eventId={event.id}</span>
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <div className="flex justify-between items-center bg-white/5 p-2.5 px-3 rounded text-slate-350">
                      <span>Mweka Hazina (Treasurer)</span>
                      <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded tracking-widest">PIN: 2222</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-2.5 px-3 rounded text-slate-350">
                      <span>Katibu (Secretary)</span>
                      <span className="text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded tracking-widest">PIN: 3333</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-2.5 px-3 rounded text-slate-350">
                      <span>Mjumbe (Member)</span>
                      <span className="text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded tracking-widest">PIN: 4444</span>
                    </div>
                    <div className="flex justify-between items-center bg-rose-500/5 border border-rose-500/10 p-2.5 px-3 rounded text-slate-350">
                      <span>Mwenye Shughuli (Admin)</span>
                      <span className="text-rose-400 font-bold bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded tracking-widest">PIN: 1234</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      const msg = `Ahlan! Karibu kwenye Portal ya Kamati ya sherehe yetu.\n\nBofya link hii kuingia: ${window.location.origin}/?portal=committee&eventId=${event.id}\n\nPIN ya Mweka Hazina: 2222\nPIN ya Katibu: 3333\nPIN ya Mjumbe wa kawaida: 4444\n\nTafadhali tumia nywila (PIN) inayoendana na cheo chako kuzuia muingiliano.`;
                      navigator.clipboard.writeText(msg);
                      alert(isEn ? 'Copied to clipboard' : 'Ujumbe umenakiliwa! Sasa unaweza kwenda ku-paste (kubandika) Whatsapp kwa wanakamati!');
                    }}
                    className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 hover:border-slate-400 text-white rounded-lg pb-[1px] uppercase tracking-wider font-extrabold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                  >
                    <Clipboard className="w-3.5 h-3.5" /> 
                    {isEn ? "Copy Access Message for WhatsApp" : "Nakili Ujumbe kwa ajili ya WhatsApp"}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* SUB-TAB: CONTRIBUTIONS MODULE */}
      {currentSubTab === 'contributions' && (
        <div className="animate-fade-in" id="panel-committee-contributions">
          <div className="bg-[#050b18] border border-white/5 rounded-3xl overflow-hidden min-h-[500px]">
            <ContributionManager
              event={event}
              guests={guests}
              onUpdateEvent={onUpdateEvent}
              onUpdateGuests={onUpdateGuests}
              eventsList={[event]}
              onSelectEvent={() => {}}
            />
          </div>
        </div>
      )}

      {/* SUB-TAB 5: ACTIVITY LOGS (ADMIN ONLY) - 16.9 */}
      {currentSubTab === 'activity' && (
        <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-5 space-y-4 animate-fade-in" id="panel-committee-activity">
          <div className="border-b border-white/5 pb-3">
            <h4 className="font-extrabold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-450" />
              <span>{isEn ? "Committee Activity Log audits" : "Kihistoria cha Logs za Wanakamati (Audit Trails)"}</span>
            </h4>
            <p className="text-slate-400 text-[10.5px]">
              {isEn ? "System audit events recorded on this event space dynamically:" : "Tathmini ya mienendo yote inayofanywa na wajumbe kuzuia ufisadi na kudhibiti data zote:"}
            </p>
          </div>

          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 font-mono text-[9.5px] uppercase">
                <th className="py-2.5 px-3">{isEn ? 'USER' : 'MTENDAJI'}</th>
                <th className="py-2.5 px-3">{isEn ? 'ACTION EXECUTED' : 'KITENDO'}</th>
                <th className="py-2.5 px-3">{isEn ? 'DATE / TIME' : 'MUDA'}</th>
                <th className="py-2.5 px-3 text-right">{isEn ? 'IP ADDRESS' : 'IP ADDRESS'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[10.5px] text-slate-300">
              {activityLogs.map(log => (
                <tr key={log.id} className="hover:bg-white/[0.01] transition-all">
                  <td className="py-2 px-3 font-extrabold text-white uppercase">{log.user}</td>
                  <td className="py-2 px-3 text-slate-350">{log.action}</td>
                  <td className="py-2 px-3 text-slate-500">{log.date} {log.time}</td>
                  <td className="py-2 px-3 text-right text-slate-500">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-TAB 6: COMMITTEE PUBLIC LINK (OPTIONAL) - 16.10 */}
      {currentSubTab === 'public-link' && (
        <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 animate-fade-in max-w-2xl mx-auto text-center" id="panel-committee-public-link">
          
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-black flex items-center justify-center mx-auto text-xl uppercase animate-pulse">
              <Share2 className="w-6 h-6 text-amber-400" />
            </div>
            <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[9.5px] px-2.5 py-1 rounded-full uppercase font-bold inline-block">
              {isEn ? "Public Progress tracker indicator" : "Kiungo cha Maendeleo ya Harusi ya Public (Public Link)"}
            </span>
            <h3 className="text-lg font-black text-white uppercase font-mono tracking-wide">
              {isEn ? "SECURE PUBLIC TRACKING LINK" : "WEKA KIUNGO MAALUM KWA PUBLIC"}
            </h3>
            <p className="text-slate-400 text-[11px] leading-relaxed max-w-md mx-auto">
              {isEn ? "According to mandate 16.10, this link is completely safe to share in WhatsApp groups. Displays overall progress bar and metrics without any contributor names or confidential data." : "Sheria ya 16.10: Kiungo hiki kiko salama kabisa kushirikisha kwenye vikundi vya WhatsApp vya kamati nzima ya harusi. Inaonyesha asilimia pekee bila kuonyesha majina ya watu."}
            </p>
          </div>

          <div className="p-4 bg-slate-950 border border-white/5 rounded-2xl space-y-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">{isEn ? "Generated Public Progress URL:" : "Kiungo cha maendeleo kilichozalishwa na mfumo:"}</span>
              <span className="text-emerald-400 text-[9.5px] font-mono font-bold">● ACTIVE</span>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={`${window.location.origin}${window.location.pathname}?progress=true&event_id=${event.id}`} 
                className="w-full bg-white/5 border border-white/5 px-3 py-2 text-slate-300 text-[10.5px] font-mono rounded-xl focus:outline-none"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?progress=true&event_id=${event.id}`);
                  alert(isEn ? "Copied public link!" : "Copied successfully!");
                }}
                className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-white font-mono text-[10.5px] rounded-xl font-bold uppercase transition"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setShowPublicProgressPreview(true);
                addActivityLog(`${activeRole} View`, 'Alitazama Public Progress Preview tab kibinafsi');
              }}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold uppercase font-mono tracking-wider py-2.5 px-6 rounded-xl text-[10.5px] flex items-center gap-2 transition cursor-pointer shadow-md"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{isEn ? "Live Preview Public URL Page" : "Fungua Public Progress Page"}</span>
            </button>
          </div>

        </div>
      )}

      {/* SUB-TAB 7: EVENT DOCUMENTS & SHRED FILES MANAGER */}
      {currentSubTab === 'files' && (
        <div className="backdrop-blur-md bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 animate-fade-in" id="panel-committee-event-files">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div className="space-y-1 text-left">
              <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-[9px] px-2.5 py-1 rounded-full uppercase font-bold inline-block">
                {isEn ? "Secure Shared repository" : "Hifadhi ya Faili na Nyaraka Pamoja"}
              </span>
              <h3 className="text-lg font-black text-white uppercase font-sans tracking-wide">
                {isEn ? "EVENT SHARED DOCUMENTS & RECORDS" : "NYARAKA NA FAILI ZA KAMATI YA SHEREHE"}
              </h3>
              <p className="text-slate-400 text-[11px]">
                {isEn ? "Upload and access planning guides, pdf flyers, event program outlines, schedules, budgets, and template designs." : "Pakia na uhifadhi miongozo ya sherehe, bajeti za Excel, ratiba za PDF, michoro ya kumbi au images mbalimbali za kamati yetu."}
              </p>
            </div>
          </div>

          {/* Interactive Drag and Drop Upload Zone */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 space-y-4">
              <div 
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 relative ${
                  dragActive 
                    ? 'border-amber-500 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.05)]' 
                    : 'border-white/10 hover:border-blue-500/40 bg-slate-950/40 hover:bg-slate-950/60'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  id="event-doc-file-input"
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processUploadedFile(e.target.files[0]);
                    }
                  }}
                />
                
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <button 
                      onClick={() => document.getElementById('event-doc-file-input')?.click()}
                      className="text-blue-400 hover:text-blue-300 font-bold text-xs underline cursor-pointer"
                    >
                      {isEn ? "Choose File To Upload" : "Chagua Faili la Kupakia"}
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {isEn ? "or drag and drop it here" : "au kokota na uwasilishe hapa"}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-white/5 space-y-1">
                    <p className="text-[9px] text-slate-500 font-mono">
                      {isEn ? "Formats: PDF, XLSX, DOCX, PNG, JPG" : "Aina: PDF, Excel, Word, Picha"}
                    </p>
                    <p className="text-[9px] text-amber-500/70 font-mono">
                      {isEn ? "Max: 1.5MB per file" : "Kikomo: 1.5MB kwa faili"}
                    </p>
                  </div>
                </div>
              </div>

              {uploadError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[10.5px] font-sans flex items-start gap-2 text-left">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="bg-slate-950/70 border border-white/5 rounded-2xl p-4 text-left space-y-2">
                <h4 className="text-[10px] uppercase font-mono tracking-wider font-extrabold text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isEn ? "System Integrity & Encryption" : "Ulinzi na Usiri wa Faili"}</span>
                </h4>
                <p className="text-[10px] leading-relaxed text-slate-400">
                  {isEn ? "All files are converted into highly compressed secure base64 format for high availability. Larger file templates are logged and compiled dynamically." : "Faili zote zinabanwa kitaalam na kubadilishwa kuwa base64 kwa ajili ya kufikiwa kwa haraka, kukuwezesha kuzindua na kuzisambaza bila hasara ya data."}
                </p>
              </div>
            </div>

            {/* Files List Display and Filters */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Filter tabs */}
              <div className="flex overflow-x-auto gap-1 border-b border-white/5 pb-1 shrink-0 scrollbar-none">
                {[
                  { id: 'all', label: isEn ? 'All Files' : 'Zote', count: eventFiles.length },
                  { id: 'pdf', label: 'PDFs', count: eventFiles.filter(f => f.category === 'pdf').length },
                  { id: 'spreadsheet', label: isEn ? 'Tables / Excel' : 'Lahajedwali', count: eventFiles.filter(f => f.category === 'spreadsheet').length },
                  { id: 'document', label: isEn ? 'Documents' : 'Nyaraka za Matini', count: eventFiles.filter(f => f.category === 'document').length },
                  { id: 'image', label: isEn ? 'Images & Cards' : 'Picha na Kadi', count: eventFiles.filter(f => f.category === 'image').length }
                ].map((filter) => {
                  const isActive = fileFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setFileFilter(filter.id as any)}
                      className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-mono text-[9.5px] uppercase font-black transition cursor-pointer ${
                        isActive 
                          ? 'bg-amber-500 text-slate-950 shadow-sm' 
                          : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span>{filter.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-mono ${isActive ? 'bg-slate-950 text-amber-400' : 'bg-white/10 text-slate-300'}`}>
                        {filter.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Files Loop Grid */}
              <div className="space-y-3">
                {eventFiles.filter(f => fileFilter === 'all' || f.category === fileFilter).length === 0 ? (
                  <div className="text-center p-8 bg-slate-950/20 border border-white/5 rounded-2xl space-y-3">
                    <FolderOpen className="w-12 h-12 text-slate-600 mx-auto stroke-[1.2]" />
                    <div>
                      <h4 className="text-xs font-black text-white uppercase">{isEn ? "No Files Found" : "Hakuna Faili Lililopatikana"}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto">
                        {isEn ? "No files stored under this category yet. Upload a document from the panel on the left." : "Hakuna nyaraka au picha iliyohifadhiwa hapa kwa sasa. Pakia document kutoka upande wa kushoto."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {eventFiles
                      .filter(f => fileFilter === 'all' || f.category === fileFilter)
                      .map((file) => {
                        // Classify colors & badges based on categories
                        let colorClasses = 'border-slate-800 bg-slate-900/40 text-slate-400';
                        let badgeLabel = 'FILE';
                        if (file.category === 'pdf') {
                          colorClasses = 'border-rose-500/15 bg-rose-500/[0.02] text-rose-400';
                          badgeLabel = 'PDF';
                        } else if (file.category === 'spreadsheet') {
                          colorClasses = 'border-emerald-500/15 bg-emerald-500/[0.02] text-emerald-400';
                          badgeLabel = 'SPREADSHEET';
                        } else if (file.category === 'document') {
                          colorClasses = 'border-blue-500/15 bg-blue-500/[0.02] text-blue-400';
                          badgeLabel = 'DOC';
                        } else if (file.category === 'image') {
                          colorClasses = 'border-purple-500/15 bg-purple-500/[0.02] text-purple-400';
                          badgeLabel = 'IMAGE';
                        }

                        return (
                          <div 
                            key={file.id} 
                            className={`p-4 border rounded-2xl flex flex-col justify-between space-y-3 transition-all duration-300 hover:scale-[1.01] hover:border-slate-500/30 ${colorClasses}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="p-2 bg-black/30 rounded-lg">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="space-y-0.5 text-left min-w-0 flex-1">
                                <h4 className="text-xs font-bold text-slate-200 truncate font-mono uppercase" title={file.name}>
                                  {file.name}
                                </h4>
                                <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                                  <span>{file.size}</span>
                                  <span>&bull;</span>
                                  <span className="font-mono text-[8px]">{file.uploadedAt}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-white/5">
                              <span className="text-[8px] font-mono tracking-wider bg-black/40 text-slate-400 px-1.5 py-0.5 rounded uppercase font-black">
                                {badgeLabel}
                              </span>

                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => {
                                    if (file.dataUrl) {
                                      // Direct real base64 trigger downloads
                                      const link = document.createElement('a');
                                      link.href = file.dataUrl;
                                      link.download = file.name;
                                      link.click();
                                    } else {
                                      // Native offline textual representations
                                      const textContent = `HARUSI SYSTEM FILE ARCHIVE\n============================\nDefault Seeded Record Details\n----------------------------\nFaili: ${file.name}\nUkubwa: ${file.size}\nIdara: ${badgeLabel}\nTukio: ${event.name}\nTarehe: ${file.uploadedAt}\n\n[Hifadhi imefanikiwa kwa usahihi katika mfumo wa makusanyo]`;
                                      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
                                      const rUrl = URL.createObjectURL(blob);
                                      const rLink = document.createElement('a');
                                      rLink.href = rUrl;
                                      rLink.download = file.name.endsWith('.txt') || file.name.includes('.') ? file.name : `${file.name}.txt`;
                                      rLink.click();
                                      URL.revokeObjectURL(rUrl);
                                    }
                                    addActivityLog(`${activeRole} (Download)`, `Alipakua faili: ${file.name}`);
                                  }}
                                  className="p-1.5 bg-black/30 hover:bg-black/50 text-white rounded-lg cursor-pointer transition text-[9px] font-mono font-bold uppercase flex items-center gap-1"
                                  title={isEn ? "Download file" : "Pakua faili"}
                                >
                                  <Download className="w-3 h-3 text-slate-400" />
                                  <span>{isEn ? "GET" : "PAKUA"}</span>
                                </button>
                                
                                {activeRole === 'Event Owner' && (
                                  <button
                                    onClick={() => {
                                      if (confirm(isEn ? `Are you sure you want to delete ${file.name}?` : `Je, una uhakika wa kufuta faili la ${file.name}?`)) {
                                        setEventFiles(prev => prev.filter(f => f.id !== file.id));
                                        addActivityLog(`${activeRole} (Delete)`, `Alifuta faili: ${file.name}`);
                                      }
                                    }}
                                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg cursor-pointer transition"
                                    title={isEn ? "Delete file" : "Futa faili"}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
              
            </div>
          </div>

        </div>
      )}


      {/* TREASURER PAYMENT REGISTRATION MODAL FORM */}
      {showTreasurerPayModal && treasuryTargetGuest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" id="treasury-add-payment-modal">
          <div className="bg-slate-900 border border-white/10 w-full max-w-sm rounded-3xl p-6 space-y-4">
            
            <div className="border-b border-white/5 pb-2">
              <h3 className="font-extrabold text-xs uppercase font-mono tracking-wider text-emerald-450">
                {isEn ? "Record Contribution Payment Piece" : "Kamati: Sajili Malipo ya Mchango"}
              </h3>
              <p className="text-[10.5px] text-slate-400 uppercase font-mono mt-0.5">Contributor: <strong className="text-white uppercase">{treasuryTargetGuest.name}</strong></p>
              <p className="text-[9.5px] text-amber-400 font-mono mt-0.5">
                {isEn ? "Target Pledge" : "Ahadi"}: TZS {treasuryTargetGuest.pledgeAmount?.toLocaleString()} • {isEn ? "Paid" : "Amelipa So far"}: TZS {(treasuryTargetGuest.paidAmount || 0).toLocaleString()}
              </p>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-400 block" htmlFor="treasury-pay-amount-input">
                  {isEn ? "Enter Amount Paid (TZS):" : "Kiasi Kilicholipwa Sasa (TZS):"}
                </label>
                <input 
                  id="treasury-pay-amount-input"
                  type="number" 
                  value={treasuryAmount} 
                  onChange={(e) => setTreasuryAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500" 
                  placeholder="e.g. 200000"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-400 block" htmlFor="treasury-pay-ref-input">
                  {isEn ? "Transaction Reference (MPESA/CRDB etc):" : "Kumbukumbu la Muamala / Reference:"}
                </label>
                <input 
                  id="treasury-pay-ref-input"
                  type="text" 
                  value={treasuryRef} 
                  onChange={(e) => setTreasuryRef(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-amber-500" 
                  placeholder="e.g. QX627889162"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-mono text-slate-400 block" htmlFor="treasury-pay-notes-input">
                  {isEn ? "Short Audit Notes:" : "Maelezo Mafupi (Notes):"}
                </label>
                <input 
                  id="treasury-pay-notes-input"
                  type="text" 
                  value={treasuryNotes} 
                  onChange={(e) => setTreasuryNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500" 
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTreasurerPayModal(false);
                    setTreasuryTargetGuest(null);
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-slate-800 rounded-lg text-slate-350 font-bold uppercase font-mono text-[10px]"
                >
                  {isEn ? "Cancel" : "Ghairi"}
                </button>
                <button
                  type="button"
                  onClick={handleSavePaymentTreasury}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 rounded-lg font-black uppercase font-mono text-[10px] hover:brightness-110 shadow-md"
                >
                  {isEn ? "Submit Payment" : "Sajili Matokeo"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* PUBLIC LEADERBOARD PREVIEW MODAL SCREEN */}
      {showPublicProgressPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md" id="public-progress-modal-sim">
          <div className="bg-[#0b1329] border border-white/10 w-full max-w-md rounded-3xl p-6 sm:p-8 space-y-6 relative overflow-hidden">
            
            {/* Absolute close circle */}
            <button
              onClick={() => setShowPublicProgressPreview(false)}
              className="absolute right-4 top-4 text-slate-450 hover:text-white p-2 rounded-full hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Simulated browser window tag bar */}
            <div className="flex items-center gap-2 text-slate-500 text-[10.5px] font-mono border-b border-white/5 pb-4 mt-2">
              <span className="w-3 h-3 rounded-full bg-red-500/50"></span>
              <span className="w-3 h-3 rounded-full bg-yellow-500/50"></span>
              <span className="w-3 h-3 rounded-full bg-green-500/50"></span>
              <span className="text-slate-400 font-bold ml-1">eventcard.co.tz/progress/{event.id}</span>
            </div>

            <div className="text-center space-y-2">
              <Coins className="w-12 h-12 text-amber-500 mx-auto stroke-[1.2] animate-bounce" />
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                {event.name || (isEn ? "Our Event Fundraise Progress" : "MICHANGO YA HARUSI YETU")}
              </h2>
              <p className="text-slate-400 text-xs font-medium leading-relaxed uppercase font-mono">
                {isEn ? "OFFICIAL PUBLIC AUDIT PROGRESS BAR" : "MAENDELEO YA MAKUSANYO YA KAMATI KIKAMILIFU"}
              </p>
            </div>

            {/* Clean, Human visual tracker stats without any single names */}
            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl grid grid-cols-3 gap-2.5 text-center">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 block">{isEn ? "Target" : "Target kuu"}</span>
                <p className="text-xs font-bold text-white font-mono">TZS {fundraisingTarget.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-emerald-450 block">{isEn ? "Collected" : "Zilizolipwa"}</span>
                <p className="text-xs font-bold text-emerald-400 font-mono">TZS {metrics.totalPaidAmount.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-rose-455 block">{isEn ? "Remaining" : "Bado Zinasalia"}</span>
                <p className="text-xs font-bold text-rose-400 font-mono">TZS {metrics.remainingToTarget.toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono font-bold">
                <span className="text-slate-400">{isEn ? "Target Reached Rate:" : "Asilimia za Kufikia Lengo:"}</span>
                <span className="text-amber-400">{metrics.progress}%</span>
              </div>
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
                <div 
                  className="bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 h-full rounded-full" 
                  style={{ width: `${Math.min(100, parseFloat(metrics.progress))}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-[11px] leading-relaxed text-center">
              <p className="font-bold">✓ {isEn ? "100% Secure & Confidential View" : "✓ Mfumo Salama wa Kuficha majina"}</p>
              <p className="text-slate-450 text-[10px] mt-0.5">
                {isEn ? "Names of individual contributors are withheld to enforce privacy strictly according to regulation 16.11." : "Taarifa zote za siri za kila mtu zimefichwa kikamilifu ili kulinda watumiaji."}
              </p>
            </div>

            <p className="text-slate-500 text-[10px] font-mono text-center">EVENTCARD © 2026 • Powered by AI Studio Build</p>

          </div>
        </div>
      )}

    </div>
  );
}
