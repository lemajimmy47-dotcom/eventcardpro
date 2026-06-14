import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function SMSGatewayConfig() {
  const { isEn, t } = useLanguage();
  const [gatewaySettings, setGatewaySettings] = useState({
    provider: 'simulation',
    url: '',
    apiKey: '',
    apiSecret: '',
    senderId: '',
    senderIdStatus: 'approved',
    whatsappUrl: '',
    customHeaders: '{}',
    customBody: '{\n  "to": "{to}",\n  "message": "{message}"\n}'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [balance, setBalance] = useState<number | string | null>(null);

  const fetchBalance = () => {
    fetch('/api/sms-balance')
      .then(res => res.json())
      .then(data => {
        if (data && data.balance !== undefined) {
          setBalance(data.balance);
        }
      })
      .catch(err => console.warn("Failed to fetch balance:", err));
  };

  useEffect(() => {
    fetch('/api/sms-settings')
      .then(res => res.json())
      .then(data => {
        if (data && data.provider) {
          setGatewaySettings(prev => ({ ...prev, ...data }));
        }
        setIsLoaded(true);
        fetchBalance();
      })
      .catch(err => {
        console.error("Error fetching SMS gateway settings:", err);
        setIsLoaded(true);
      });
  }, []);

  // Poll for sender ID status if it's pending
  useEffect(() => {
    if (gatewaySettings.provider === 'simulation' || gatewaySettings.senderIdStatus !== 'pending') return;

    const interval = setInterval(() => {
      fetch('/api/sms/request-sender-id')
        .then(res => res.json())
        .then(data => {
          if (data.status && data.status !== gatewaySettings.senderIdStatus) {
            setGatewaySettings(prev => ({ ...prev, senderIdStatus: data.status }));
          }
        })
        .catch(err => console.warn("Failed to poll sender ID status:", err));
    }, 5000);

    return () => clearInterval(interval);
  }, [gatewaySettings.senderIdStatus, gatewaySettings.provider]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    fetch('/api/sms-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gatewaySettings)
    })
      .then(res => {
        if (!res.ok) throw new Error("Kuhifadhi kulishindwa");
        return res.json();
      })
      .then(() => {
        alert(isEn ? "Gateway configuration saved successfully!" : "Mipangilio ya Gateway imehifadhiwa vizuri!");
      })
      .catch(err => {
        alert((isEn ? "Error saving: " : "Hitilafu imetokea: ") + err.message);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  if (!isLoaded) return <div className="animate-pulse text-xs text-slate-400">Loading Gateway Settings...</div>;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 max-w-lg">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-emerald-400" />
          {isEn ? "Global SMS Gateway Settings" : "Mipangilio ya SMS Gateway (Jumla)"}
        </h3>
        {gatewaySettings.provider !== 'simulation' && gatewaySettings.senderId && (
          <div className="flex items-center gap-3">
            {balance !== null && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase cursor-pointer hover:bg-blue-500/20 transition" onClick={fetchBalance} title="Click to refresh balance">
                <RefreshCw className="w-2.5 h-2.5" />
                <span>{balance} SMS</span>
              </div>
            )}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[9px] font-bold uppercase ${
              gatewaySettings.senderIdStatus === 'approved' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : gatewaySettings.senderIdStatus === 'pending'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span>{gatewaySettings.senderId}</span>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        {isEn 
          ? "Configure your SMS Gateway here once, and it will be used across all modules (Invitations, Save the Date, and Contributions)." 
          : "Sanidi Gateway ya Meseji hapa mara moja kwa ajili ya mfumo mzima. Sehemu zote za (Mialiko, Save the Date, na Michango) zitatumia Mipangilio hii."}
      </p>

      <form onSubmit={handleSave} className="space-y-4 pt-2">
        <div className="space-y-1">
          <label className="font-bold text-slate-300 block text-xs">
            {isEn ? "SMS Provider" : "Mtoa Huduma wa SMS (Provider)"}
          </label>
          <select 
            value={gatewaySettings.provider}
            onChange={(e) => {
              const val = e.target.value;
              let defaultUrl = '';
              if (val === 'meseji') {
                defaultUrl = 'https://meseji.co.tz/api/v1/sms/send';
              } else if (val === 'beem') {
                defaultUrl = 'https://api.beem.africa/v1/send';
              } else if (val === 'nextsms') {
                defaultUrl = 'https://messaging-service.co.tz/api/sms/v1/text/single';
              } else if (val === 'notifyAfrica') {
                defaultUrl = 'https://api.notify.africa/v1/sms/send';
              } else {
                defaultUrl = gatewaySettings.url;
              }
              setGatewaySettings({ ...gatewaySettings, provider: val, url: defaultUrl });
            }}
            className="w-full bg-[#050b18] border border-white/10 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500/50 transition-all font-semibold text-xs cursor-pointer"
          >
            <option value="simulation">Simulated Gateway (Simulation)</option>
            <option value="meseji">Meseji API (Tanzania)</option>
            <option value="beem">Beem Africa (Tanzania)</option>
            <option value="notifyAfrica">Notify Africa</option>
            <option value="nextsms">NextSMS</option>
            <option value="custom">Custom SMS API Endpoint (Custom Hook)</option>
          </select>
        </div>

        {gatewaySettings.provider !== 'simulation' && (
          <>
            <div className="space-y-1">
              <label className="font-bold text-slate-300 block text-xs">
                {isEn ? "Sender ID / Brand Name" : "Jina la Kutuma (Sender ID)"}
              </label>
              <input 
                type="text" 
                maxLength={11}
                placeholder="Ex. HARUSI"
                value={gatewaySettings.senderId}
                onChange={(e) => setGatewaySettings({ ...gatewaySettings, senderId: e.target.value.toUpperCase().trim() })}
                className="w-full bg-[#050b18] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 uppercase font-mono tracking-wider transition-all"
              />
            </div>

            <div className="space-y-1 mt-3">
              <label className="font-bold text-slate-300 block text-xs">
                {isEn ? "API Key / Token Secret" : "Ufunguo wa API (API Key / Token)"}
              </label>
              <input 
                type="password" 
                placeholder="Weka ufunguo wako wa API hapa..."
                value={gatewaySettings.apiKey}
                onChange={(e) => setGatewaySettings({ ...gatewaySettings, apiKey: e.target.value.trim() })}
                className="w-full bg-[#050b18] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono transition-all"
              />
            </div>

            {(gatewaySettings.provider === 'beem' || gatewaySettings.provider === 'nextsms') && (
              <div className="space-y-1 mt-3">
                <label className="font-bold text-slate-300 block text-xs">
                  {isEn ? "API Secret Key" : "Ufunguo wa Siri wa API (API Secret)"}
                </label>
                <input 
                  type="password" 
                  placeholder="Weka ufunguo wa siri wa API..."
                  value={gatewaySettings.apiSecret || ''}
                  onChange={(e) => setGatewaySettings({ ...gatewaySettings, apiSecret: e.target.value.trim() })}
                  className="w-full bg-[#050b18] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono transition-all"
                />
              </div>
            )}

            {(gatewaySettings.provider !== 'meseji') && (
              <div className="space-y-1 mt-3">
                <label className="font-bold text-slate-300 block text-xs">API Endpoint URL</label>
                <input 
                  type="url" 
                  placeholder="https://api.example.com/sms/send"
                  value={gatewaySettings.url}
                  onChange={(e) => setGatewaySettings({ ...gatewaySettings, url: e.target.value })}
                  className="w-full bg-[#050b18] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[10px]"
                />
              </div>
            )}

            {gatewaySettings.provider === 'custom' && (
              <div className="space-y-4 bg-black/20 p-4 border border-white/5 rounded-xl mt-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block text-xs">Custom Headers (JSON)</label>
                  <textarea 
                    rows={2}
                    value={gatewaySettings.customHeaders}
                    onChange={(e) => setGatewaySettings({ ...gatewaySettings, customHeaders: e.target.value })}
                    className="w-full bg-[#050b18] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[10px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 block text-xs">Custom Body Payload (JSON)</label>
                  <p className="text-[9px] text-slate-500 pb-1">
                    Use <code className="text-emerald-400">{"{to}"}</code> for phone and <code className="text-emerald-400">{"{message}"}</code> for text content.
                  </p>
                  <textarea 
                    rows={4}
                    value={gatewaySettings.customBody}
                    onChange={(e) => setGatewaySettings({ ...gatewaySettings, customBody: e.target.value })}
                    className="w-full bg-[#050b18] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[10px]"
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-1 border-t border-white/10 pt-4 mt-2">
              <label className="font-bold text-slate-300 block text-xs">Automated WhatsApp URL Hook (Optional)</label>
              <p className="text-[9px] text-slate-500 pb-1">
                E.g. <code className="text-emerald-400">https://wa.yourserver.com/send?phone={"{to}"}&text={"{message}"}</code>
              </p>
              <input 
                type="url" 
                placeholder="https://"
                value={gatewaySettings.whatsappUrl}
                onChange={(e) => setGatewaySettings({ ...gatewaySettings, whatsappUrl: e.target.value })}
                className="w-full bg-[#050b18] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-[10px]"
              />
            </div>
          </>
        )}

        <div className="flex gap-3 pt-3">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl font-bold uppercase tracking-wider text-[11px] transition duration-200 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? "Inahifadhi..." : (isEn ? "Save Settings" : "Hifadhi Mipangilio")}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Una uhakika unataka kufuta mipangilio yote?')) {
                setGatewaySettings({
                  provider: 'simulation',
                  url: '',
                  apiKey: '',
                  apiSecret: '',
                  senderId: '',
                  senderIdStatus: 'approved',
                  whatsappUrl: '',
                  customHeaders: '{}',
                  customBody: '{\n  "to": "{to}",\n  "message": "{message}"\n}'
                });
                fetch('/api/sms-settings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ provider: 'simulation' })
                });
              }
            }}
            className="bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-rose-400 px-4 py-2 rounded-xl font-bold uppercase tracking-wider text-[11px] transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isEn ? "Reset" : "Futa"}
          </button>
        </div>
      </form>
    </div>
  );
}
