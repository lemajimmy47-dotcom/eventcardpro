import { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, CheckCircle, MessageSquare, Phone, Users, Heart, Sparkles, Send, QrCode, X, Shield, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface LandingPageProps {
  onStart: () => void;
  onLoginClick: () => void;
}

export default function LandingPage({ onStart, onLoginClick }: LandingPageProps) {
  const { language, setLanguage, t } = useLanguage();
  const [activePolicyTab, setActivePolicyTab] = useState<'privacy' | 'terms' | null>(null);

  return (
    <div className="min-h-screen bg-[#050b18] text-white flex flex-col font-sans relative overflow-x-hidden" id="landing-page-root">
      
      {/* Absolute Ambient Background Blur circles aligned with Design HTML guidelines */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[140px]"></div>
      </div>

      {/* Navigation Header */}
      <header className="backdrop-blur-md bg-[#050b18]/75 border-b border-white/10 sticky top-0 z-50 px-4 py-3 sm:px-6 shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="Event Card Logo" className="h-10 w-auto object-contain" />
          </div>

          <nav className="hidden md:flex space-x-8 text-sm font-medium text-slate-350">
            <a href="#features" className="hover:text-white transition-colors">
              {language === 'sw' ? 'Sifa za Mfumo' : 'System Features'}
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              {language === 'sw' ? 'Jinsi Inavyofanya Kazi' : 'How It Works'}
            </a>
            <a href="#faqs" className="hover:text-white transition-colors">
              {language === 'sw' ? 'Maswali ya Kawaida' : 'FAQs'}
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              {language === 'sw' ? 'Mawasiliano' : 'Contact Us'}
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            {/* Language Selector */}
            <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10 shadow-inner mr-1">
              <button
                onClick={() => setLanguage('sw')}
                className={`px-2 py-1 text-[9px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  language === 'sw' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md' : 'text-slate-405 hover:text-white'
                }`}
              >
                SW
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 text-[9px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  language === 'en' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md' : 'text-slate-405 hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            <button 
              id="nav-login-btn"
              onClick={onLoginClick}
              className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 transition"
            >
              {t('landing.btnLogin')}
            </button>
            <button 
              id="landing-register-btn"
              onClick={onStart}
              className="text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] px-4 py-2 rounded-xl transition"
            >
              {t('landing.btnStartNow')}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow relative z-10">
        <section className="relative px-4 py-16 sm:px-6 lg:px-8 overflow-hidden">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left side: text */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-450 animate-pulse"></span>
                <span>{t('landing.inviteTag')}</span>
              </div>
              
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-sans tracking-tight text-white leading-none">
                {t('landing.title1')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 underline decoration-purple-400 decoration-wavy">{t('landing.title2')}</span>
              </h2>
              
              <p className="text-lg text-slate-300 leading-relaxed font-sans">
                {t('landing.subtitle')}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button 
                  id="hero-get-started"
                  onClick={onStart}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_20px_rgba(59,130,246,0.40)] text-white font-semibold px-8 py-4 rounded-xl transition duration-150 text-center inline-flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5 text-purple-300" />
                  <span>{t('landing.btnStart')}</span>
                </button>
                <a 
                  href="#how-it-works"
                  className="border border-white/10 backdrop-blur-md bg-white/5 hover:bg-white/10 text-white font-semibold px-8 py-4 rounded-xl transition inline-flex items-center justify-center space-x-2"
                >
                  <span>{t('landing.btnHowItWorks')}</span>
                </a>
              </div>

              {/* Trust/Live Counters */}
              <div className="pt-6 grid grid-cols-3 gap-4 border-t border-white/10 font-mono text-xs text-slate-450">
                <div>
                  <span className="block text-2xl font-bold text-white">4,800+</span>
                  {t('landing.statSent')}
                </div>
                <div>
                  <span className="block text-2xl font-bold text-blue-400">98.4%</span>
                  {t('landing.statRsvped')}
                </div>
                <div>
                  <span className="block text-2xl font-bold text-purple-400">0%</span>
                  {t('landing.statSavePaper')}
                </div>
              </div>
            </motion.div>

            {/* Right side: Mockup Showcase / Interactive graphics with custom client-logo */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="relative flex justify-center"
            >
              {/* Outer phone container styled as matte glass */}
              <div className="relative w-full max-w-sm rounded-[2.5rem] bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-4 aspect-[9/17] flex flex-col justify-between overflow-hidden">
                {/* Speaker pill */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-5 rounded-full bg-slate-900 z-10 flex items-center justify-center border border-white/10">
                  <div className="w-12 h-1 bg-slate-800 rounded-full"></div>
                </div>

                {/* Simulated Invite screen */}
                <div className="flex-grow mt-6 bg-[#030712] rounded-[2rem] p-4 flex flex-col text-white border border-white/15 relative overflow-y-auto">
                  <div className="border border-white/10 p-2 rounded-lg text-center mt-2 flex-grow flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">{language === 'sw' ? 'MIAKOTI (EVENT PREVIEW)' : 'EVENT PREVIEW'}</p>
                      <h4 className="font-bold text-sm text-white leading-tight">{language === 'sw' ? 'IMANI & NEEMA' : 'JOHN & MARY'}</h4>
                      <p className="text-[9px] text-slate-400 italic mt-0.5">{language === 'sw' ? 'Mwaliko wa Kipekee' : 'Exclusive Invitation'}</p>
                    </div>

                    {/* Styled Card Image in Mockup */}
                    <div className="my-2 border border-dashed border-blue-500/30 bg-blue-500/10 rounded-lg p-3 flex flex-col items-center justify-center">
                      <Heart className="w-6 h-6 text-purple-400 animate-pulse mb-1" />
                      <p className="text-[10px] font-bold text-white">{language === 'sw' ? 'JUMA HAMISI' : 'JOHN SMITH'}</p>
                      <span className="text-[8px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full mt-1">DOUBLE</span>
                    </div>

                    <div className="text-[9px] text-slate-300 space-y-0.5 text-left pl-2 font-sans">
                      <p>• <strong>{language === 'sw' ? 'Tarehe:' : 'Date:'}</strong> 26/11/2026</p>
                      <p>• <strong>{language === 'sw' ? 'Saa:' : 'Time:'}</strong> 12:00 PM</p>
                      <p>• <strong>{language === 'sw' ? 'Mahali:' : 'Venue:'}</strong> Isamuhyo Hall</p>
                    </div>

                    {/* Simulated QR block */}
                    <div className="mt-2 flex flex-col items-center">
                      <div className="w-12 h-12 bg-white flex items-center justify-center p-1 rounded-lg border border-white/20">
                        <QrCode className="w-10 h-10 text-slate-900" />
                      </div>
                      <span className="text-[7px] text-slate-400 mt-1 uppercase font-mono">GUEST QR-982</span>
                    </div>

                    {/* Interactive Simulated RSVP Option */}
                    <div className="flex gap-2 mt-3 justify-center">
                      <span className="text-[9px] bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-1 px-3 rounded-full cursor-pointer transition">{language === 'sw' ? 'Nitafika' : 'Attending'}</span>
                      <span className="text-[9px] bg-white/10 hover:bg-white/20 text-slate-300 font-semibold py-1 px-3 rounded-full cursor-pointer transition">{language === 'sw' ? 'Sitaweza' : 'Declined'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute top-20 -left-6 bg-white/5 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-white/10 flex items-center space-x-2 animate-bounce">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-semibold">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-450">{language === 'sw' ? 'Mgeni Amejibu' : 'Guest Replied'}</p>
                  <p className="text-xs font-bold font-sans text-white">{language === 'sw' ? 'Atahudhuria ✓' : 'Attending ✓'}</p>
                </div>
              </div>

              <div className="absolute bottom-20 -right-6 bg-white/5 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-white/10 flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-semibold">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-450">{language === 'sw' ? 'Imetuma Salama' : 'Sent Smoothly'}</p>
                  <p className="text-xs font-bold font-sans text-white">WhatsApp & SMS</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-white/10 bg-black/10 relative">
          <div className="max-w-7xl mx-auto text-center space-y-4 mb-16 relative z-10">
            <h3 className="text-xs uppercase font-mono tracking-widest text-blue-400 font-bold">{t('landing.featuresTitle')}</h3>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight font-sans">
              {t('landing.featuresHeading')}
            </h2>
            <p className="text-slate-350 max-w-2xl mx-auto">
              {t('landing.featuresSub')}
            </p>
          </div>

          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
            
            {/* Feature 1 */}
            <div className="backdrop-blur-xl bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white font-sans">{t('feature.1.title')}</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                {t('feature.1.desc')}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="backdrop-blur-xl bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl flex items-center justify-center">
                <Send className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white font-sans">{t('feature.2.title')}</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                {t('feature.2.desc')}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="backdrop-blur-xl bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white font-sans">{t('feature.3.title')}</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                {t('feature.3.desc')}
              </p>
            </div>

            {/* Feature 4 */}
            <div className="backdrop-blur-xl bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 bg-[#2563eb]/10 text-blue-400 border border-[#2563eb]/20 rounded-xl flex items-center justify-center">
                <QrCode className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white font-sans">{t('feature.4.title')}</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                {t('feature.4.desc')}
              </p>
            </div>

            {/* Feature 5 */}
            <div className="backdrop-blur-xl bg-white/5 hover:bg-white/10 transition border border-white/10 rounded-2xl p-6 space-y-4">
              <div className="w-12 h-12 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white font-sans">{t('feature.5.title')}</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                {t('feature.5.desc')}
              </p>
            </div>

          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-b border-white/10 bg-black/20">
          <div className="max-w-7xl mx-auto text-center space-y-4 mb-16">
            <h3 className="text-xs uppercase font-mono tracking-widest text-[#3b82f6] font-bold">{t('landing.howItWorksTitle')}</h3>
            <h2 className="text-3xl sm:text-4xl font-bold text-white font-sans tracking-tight">
              {t('landing.howItWorksHeading')}
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-sm">
              {t('landing.howItWorksSub')}
            </p>
          </div>

          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            
            {/* Step 1 */}
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-6 border border-white/10 text-center space-y-3 shadow-md relative">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-mono flex items-center justify-center font-bold shadow-lg border border-white/10">1</span>
              <h4 className="font-bold text-white pt-2 font-sans text-base">{t('step.1.title')}</h4>
              <p className="text-xs text-slate-300">
                {t('step.1.desc')}
              </p>
            </div>

            {/* Step 2 */}
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-6 border border-white/10 text-center space-y-3 shadow-md relative">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-mono flex items-center justify-center font-bold shadow-lg border border-white/10">2</span>
              <h4 className="font-bold text-white pt-2 font-sans text-base">{t('step.2.title')}</h4>
              <p className="text-xs text-slate-300">
                {t('step.2.desc')}
              </p>
            </div>

            {/* Step 3 */}
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-6 border border-white/10 text-center space-y-3 shadow-md relative">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-mono flex items-center justify-center font-bold shadow-lg border border-white/10">3</span>
              <h4 className="font-bold text-white pt-2 font-sans text-base">{t('step.3.title')}</h4>
              <p className="text-xs text-slate-300">
                {t('step.3.desc')}
              </p>
            </div>

            {/* Step 4 */}
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-6 border border-white/10 text-center space-y-3 shadow-md relative">
              <span className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-mono flex items-center justify-center font-bold shadow-lg border border-white/10">4</span>
              <h4 className="font-bold text-white pt-2 font-sans text-base">{t('step.4.title')}</h4>
              <p className="text-xs text-slate-300">
                {t('step.4.desc')}
              </p>
            </div>

          </div>
        </section>

        {/* FAQ Section */}
        <section id="faqs" className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-white font-sans tracking-tight">{t('landing.faqTitle')}</h2>
              <p className="text-slate-300 text-sm">{t('landing.faqSub')}</p>
            </div>

            <div className="space-y-4 font-sans text-sm">
              <div className="border border-white/10 p-5 rounded-xl bg-white/5 backdrop-blur-md">
                <h4 className="font-bold text-white mb-1">{t('faq.1.q')}</h4>
                <p className="text-slate-300 leading-relaxed">
                  {t('faq.1.a')}
                </p>
              </div>

              <div className="border border-white/10 p-5 rounded-xl bg-white/5 backdrop-blur-md">
                <h4 className="font-bold text-white mb-1">{t('faq.2.q')}</h4>
                <p className="text-slate-300 leading-relaxed">
                  {t('faq.2.a')}
                </p>
              </div>

              <div className="border border-white/10 p-5 rounded-xl bg-white/5 backdrop-blur-md">
                <h4 className="font-bold text-white mb-1">{t('faq.3.q')}</h4>
                <p className="text-slate-300 leading-relaxed">
                  {t('faq.3.a')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-12 bg-black/45 text-slate-100 px-4 sm:px-6 lg:px-8 border-t border-white/10">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="space-y-4 text-left">
              <h3 className="text-xl font-bold font-sans">EVENT<span className="text-red-500">CARD</span> DIGITAL SOLUTIONS</h3>
              <p className="text-slate-400 text-xs max-w-lg">
                {language === 'sw' 
                 ? 'Mfumo Rasmi uliosajiliwa kwa ajili ya usimamizi na uratibu wa matukio, kadi za kidijitali za mwaliko kwa njia ya WhatsApp na SMS dhabiti.' 
                 : 'Official registered platform for digital event management, smart invitations, and seamless WhatsApp & SMS-driven RSVP coordination.'}
              </p>
              <div className="text-slate-500 text-xs font-sans space-y-1">
                <p><strong>HQ:</strong> Mlimani Tower, Floor 5, Sam Nujoma Road, Dar es Salaam, Tanzania</p>
                <p><strong>Reg No:</strong> Tanzanian Business Registration No. 493012-B</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 text-xs font-mono">
              <span className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-blue-400" />
                <span>info@eventcard.co.tz</span>
              </span>
              <span className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-[#3b82f6]" />
                <span>+255 653 578 184</span>
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with Compliance Policies */}
      <footer className="bg-[#050b18] text-slate-400 py-8 text-center text-xs border-t border-white/10 space-y-4">
        <div className="flex justify-center space-x-6 text-sm text-slate-400 font-medium">
          <button 
            onClick={() => setActivePolicyTab('privacy')}
            className="hover:text-white transition duration-150 cursor-pointer flex items-center gap-1.5"
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>{language === 'sw' ? 'Sera ya Faragha (Privacy)' : 'Privacy Policy'}</span>
          </button>
          <span className="text-white/10">|</span>
          <button 
            onClick={() => setActivePolicyTab('terms')}
            className="hover:text-white transition duration-150 cursor-pointer flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>{language === 'sw' ? 'Mkataba wa Huduma (Terms)' : 'Terms of Service'}</span>
          </button>
        </div>
        <p className="text-slate-500">{t('landing.rights')}</p>
        <p className="text-[10px] text-slate-600 max-w-2xl mx-auto px-4 leading-relaxed">
          Disclaimer: WhatsApp is a registered trademark of Meta Platforms, Inc. This application uses the official Meta Cloud API strictly to send customized invitations and RSVP checks with positive opt-in consent from our users.
        </p>
      </footer>

      {/* Policies Modal */}
      {activePolicyTab && (
        <div className="fixed inset-0 z-50 bg-[#030712]/92 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0b1328] border border-white/15 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative" id="policy-modal">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#111a36]">
              <div className="flex items-center space-x-2 text-white">
                {activePolicyTab === 'privacy' ? <Shield className="w-5 h-5 text-emerald-400" /> : <FileText className="w-5 h-5 text-blue-400" />}
                <h3 className="text-lg font-bold font-sans">
                  {activePolicyTab === 'privacy' 
                    ? (language === 'sw' ? 'Sera ya Faragha - EVENTCARD' : 'Privacy & Data Protection Policy') 
                    : (language === 'sw' ? 'Masharti na Mkataba wa Huduma' : 'Terms of Service & API Agreement')}
                </h3>
              </div>
              <button 
                onClick={() => setActivePolicyTab(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition duration-150 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto text-slate-300 space-y-6 text-sm font-sans leading-relaxed text-left">
              {activePolicyTab === 'privacy' ? (
                <>
                  {/* Privacy Policy Content */}
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">1. Utangulizi / Introduction</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> EVENTCARD inajitolea kulinda faragha ya data zako zote. Sera hii inaeleza jinsi tunavyokusanya, kutumia, kuhifadhi, na kulinda orodha ya wageni (majina na namba za simu) unapojiandikisha kwenye mfumo wetu kutuma kadi za mialiko na kupata RSVP kupitia WhatsApp Business API.
                    </p>
                    <p>
                      <strong>English:</strong> EVENTCARD is strictly committed to protecting user privacy. This policy details how we collect, process, store, and safeguard guest contact information (names and telephone numbers) when you utilize our digital system to dispatch invitation cards and obtain real-time RSVP responses using the Meta WhatsApp Business API.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">2. Ukusanyaji wa Data & Uidhinishaji (Data Harvesting & Consents)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Unapopakia orodha ya wageni wako, tunajaza majina yao, namba ya simu ya nchi husika, na hadhi zao za RSVP. Ni wajibu wa mratibu wa kamati au bwana/bibi harusi kuhakikisha kuwa wageni waliorodheshwa wanatarajia mwaliko huu na wamekubali kupokea taarifa. Hatutumi na hatutawahi kutuma rasilimali za utangazaji au ujumbe wa spam usiohitajika.
                    </p>
                    <p>
                      <strong>English:</strong> When you upload your guest directory, we process guest names, registered phone numbers under country protocols, and RSVP tallies. It is the sole responsibility of the host (the Event Committee or Couple) to ensure guests have an established active connection model and expect to receive the invitation metadata. We absolutely do not send unauthorized advertising or spam.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">3. WhatsApp Business API - Uwasilishaji na Uhakiki wa Ridhaa (Opt-In & Opt-Out Policy)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Kila ujumbe wa WhatsApp unaotumwa kutoka kwenye mfumo wetu unajumuisha mwongozo wa jinsi ya KUKATAA (Exit/Opt-out). Mgeni anaweza kuandika neno <strong>"STOP"</strong> au <strong>"KANSILA"</strong> kurudisha jibu la kiotomatiki linalofuta mara moja namba yake kwenye vikumbusho vya baadae. Hii inahakikisha utii wetu kamili kwa sera za WhatsApp Business.
                    </p>
                    <p>
                      <strong>English:</strong> Every WhatsApp transmission dispatched through our system includes an explicit, interactive guide for Opt-Out. Any guest can reply with the keyword <strong>"STOP"</strong> to instantly suppress future automated reminders. This mechanism strictly complies with Meta’s Core Policy for WhatsApp Interactive Messaging.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">4. Kushirikiana kwa Data na Usalama (Data Integrity & Third Party Sharing Restrictions)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Hatutoi, hatuuzi, wala hatuonyeshi namba za simu za wageni wako kwa makampuni mengine ya biashara au mashirika ya upande wa tatu. Data zote zinasimbwa kwa njia thabiti (encryption) kwenye seva na kutumiwa TU kwa ajili ya mchakato wa RSVP wa tukio husika ambalo mtumiaji amesajili.
                    </p>
                    <p>
                      <strong>English:</strong> We do not sell, rent, or lease your guests' telephone contact lists to independent advertisers, brokers, or external entities. All databases are securely isolated and encrypted under modern TLS/SSL security, analyzed solely to fulfill the RSVP event tracking actions requested by physical organizers.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">5. Mawasiliano na Maswali (Contact Information)</h4>
                    <p className="mb-1">Tanzanian Business Administration Office:</p>
                    <p>📧 Email: privacy@eventcard.co.tz</p>
                    <p>📍 Mlimani Tower, Floor 5, Sam Nujoma Road, Dar es Salaam, Tanzania</p>
                  </div>
                </>
              ) : (
                <>
                  {/* Terms of Service Content */}
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">1. Kukubaliana na Masharti (Acceptance of Terms)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Kwa kusajili harusi au tukio lolote ndani ya EVENTCARD, unakubali kufuata kanuni na sheria zote za nchi yetu (Sheria ya Ulinzi wa Data ya Kibinafsi, 2022) na Sheria za Biashara za Meta WhatsApp.
                    </p>
                    <p>
                      <strong>English:</strong> By registering a ceremony, wedding, or gala inside the EVENTCARD dashboard, you fully agree to meet Tanzanian national digital provisions (Personal Data Protection Act, 2022) and standard Meta Platforms Business policies for automated notifications.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">2. Matumizi Yanayoruhusiwa (Permitted Usage & Compliance)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Ni marufuku kutumia mfumo huu kutuma ujumbe wowote wa kisiasa, matangazo ya kibiashara kujitafutia wateja binafsi, habari potofu, au tabia ya unyanyasaji. Mfumo huu umetengenezwa kwa ajili ya kadi za matukio (mialiko ya harusi, vipindi vya kwaya, mikutano, nk) pekee.
                    </p>
                    <p>
                      <strong>English:</strong> Users are strictly prohibited from utilizing this system to dispatch political materials, unsolicited retail solicitations, bulk spam sequences, or offensive communications. The application is solely intended as a premium invitation interface for authenticated familial, corporate, and communal gatherings.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">3. Gharama za API & Upatikanaji (API Conditions & Service Outages)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Uwasilishaji wa ujumbe wa WhatsApp huendeshwa kupitia miundombinu thabiti ya Meta Business API. Wakati mwingine matatizo ya mtandao duniani yanaweza kusababisha ucheleweshaji mdogo wa ujumbe unaotumwa. EVENTCARD inajitahidi kutoa asilimia 99.9 ya uhakika wa utendaji wa mfumo.
                    </p>
                    <p>
                      <strong>English:</strong> WhatsApp dispatching is serviced by the official Meta Business Cloud API framework. In rare moments of trans-network failures, delivery latency might fluctuate. EVENTCARD guarantees a 99.9% system uptime commitment for backend API services.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base mb-2">4. Ukomeshaji wa Akaunti (Account Suspension Actions)</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Akaunti yoyote inayoripotiwa kutuma mwaliko wenye namba zenye mashaka au isiyo na ridhaa itafungwa haraka ili kulinda taswira ya namba zetu za API na usalama wa wateja wengine.
                    </p>
                    <p>
                      <strong>English:</strong> Any user profile flagged for outbound transmission of spam or non-consensual telephone import directories will undergo instant administrative review and termination to protect overall API deliverability standards.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex justify-end bg-[#0e172e]">
              <button 
                onClick={() => {
                  setActivePolicyTab(null);
                }}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.30)] text-white text-xs font-semibold px-5 py-2.5 rounded-lg cursor-pointer transition duration-150"
              >
                {language === 'sw' ? 'Nimesoma na Kuelewa' : 'I Understand'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
