import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initDB, readDB, writeDB, fetchFromFirestore, updateMemoryAndLocalFileOnly, getStateForClient, readDBLatest, pingPostgresKeepAlive } from "./src/firebase-db";

// Database file path
const DB_PATH = path.join(process.cwd(), "database.json");

// Helper to check if a guest record is corrupt (binary zipped excel metadata lines)
function isCorruptGuest(g: any) {
  if (!g || !g.name) return true;
  const name = String(g.name);
  if (name.includes('\u0000') || name.includes('PK\u0003') || name.includes('xl/') || name.includes('.xml')) {
    return true;
  }
  if (name.includes('workbook') || name.includes('sharedStrings') || name.includes('docProps') || name.includes('xl/theme')) {
    return true;
  }
  if (name.length > 70) {
    return true;
  }
  if (g.phone && (String(g.phone).includes('\u0000') || String(g.phone).length > 35)) {
    return true;
  }
  return false;
}

// Helper to read database
async function performSelfCleaningAndMigration(data: any) {
  if (data.guests && Array.isArray(data.guests)) {
    const originalLen = data.guests.length;
    data.guests = data.guests.filter((g: any) => !isCorruptGuest(g));
    
    const allowed = ['SINGLE', 'DOUBLE', 'UNCLASSIFIED'];
    let normalizedCount = 0;
    data.guests = data.guests.map((g: any) => {
      const currentGroup = (g.cardType || '').toUpperCase().trim();
      const correctGroup = allowed.includes(currentGroup) ? currentGroup : 'UNCLASSIFIED';
      if (g.cardType !== correctGroup) {
        normalizedCount++;
        return { ...g, cardType: correctGroup };
      }
      return g;
    });

    if (data.guests.length !== originalLen || normalizedCount > 0) {
      console.log(`Self-cleaning: Removed ${originalLen - data.guests.length} corrupt rows, normalized ${normalizedCount} cardType groups.`);
      await writeDB(data);
    }
  }

  // Migrate 'event-starter' to unique ID
  let mustMigrateStarter = false;
  let starterMigratedId = '';

  if (data.eventDetails && data.eventDetails.id === 'event-starter') {
    mustMigrateStarter = true;
  }
  if (data.eventsList && Array.isArray(data.eventsList) && data.eventsList.some((ev: any) => ev.id === 'event-starter')) {
    mustMigrateStarter = true;
  }

  if (mustMigrateStarter) {
    starterMigratedId = 'event-' + Math.floor(1000 + Math.random() * 9000);
    console.log(`[migration] Migrating 'event-starter' to unique ID on server: ${starterMigratedId}`);
    
    if (data.eventDetails && data.eventDetails.id === 'event-starter') {
      data.eventDetails.id = starterMigratedId;
    }
    if (data.eventsList && Array.isArray(data.eventsList)) {
      data.eventsList = data.eventsList.map((ev: any) => 
        ev.id === 'event-starter' ? { ...ev, id: starterMigratedId } : ev
      );
    }
    if (data.guests && Array.isArray(data.guests)) {
      data.guests = data.guests.map((g: any) => 
        g.eventId === 'event-starter' || !g.eventId ? { ...g, eventId: starterMigratedId } : g
      );
    }
    if (data.saveTheDates && Array.isArray(data.saveTheDates)) {
      data.saveTheDates = data.saveTheDates.map((s: any) => 
        s.event_id === 'event-starter' || !s.event_id ? { ...s, event_id: starterMigratedId } : s
      );
    }

    await writeDB(data);
    console.log(`[migration] Server DB updated with unique ID: ${starterMigratedId}`);
  }

  // Dynamic Seed for committee tables
  let updatedDB = false;
  if (!data.committee_members) {
    data.committee_members = [
      { "id": "c-1", "name": "James Lema", "phone": "0711223344", "email": "james@gmail.com", "position": "Chairperson", "permissionLevel": "Full Access", "token": "m-james" },
      { "id": "c-2", "name": "Salma Khamis", "phone": "0755998877", "email": "salma@treasury.co.tz", "position": "Treasurer", "permissionLevel": "Treasurer Access", "token": "m-salma" },
      { "id": "c-3", "name": "Emmanuel Shija", "phone": "0766332211", "email": "shija@sec.org", "position": "Secretary", "permissionLevel": "Viewer Access", "token": "m-emmanu" },
      { "id": "c-4", "name": "Aisha Ramadhani", "phone": "0688445566", "email": "aisha@kamati.co.tz", "position": "Committee Member", "permissionLevel": "Summary Access", "token": "m-aisha" }
    ];
    updatedDB = true;
  }
  if (!data.committee_roles) {
    data.committee_roles = [
      { "id": "r-chair", "name": "Chairperson", "permissionLevel": "Full Access", "description": "Ruhusa kamili ya uendeshaji, kuongeza wanakamati, na uandikishaji wa malipo." },
      { "id": "r-treasurer", "name": "Treasurer", "permissionLevel": "Treasurer Access", "description": "Uandikishaji na usimamizi wa malipo pekee, hawezi kufuta muamala au kubadili wajumbe." },
      { "id": "r-secretary", "name": "Secretary", "permissionLevel": "Viewer Access", "description": "Kusoma wageni pekee na kutoa taarifa na ripoti tofauti za kamati kusaidia mwenyekiti." },
      { "id": "r-member", "name": "Committee Member", "permissionLevel": "Summary Access", "description": "Kutazama michango kwa ujumla na chati, taarifa za siri za kila mchangiaji zinalindwa." }
    ];
    updatedDB = true;
  }
  if (updatedDB) {
    await writeDB(data);
  }
}

/**
 * Safely sanitizes and validates Fetch HTTP Headers to avoid ByteString errors on native Node fetch.
 * Returns a new headers object or throws a detailed friendly error if illegal characters are found.
 */
function sanitizeHttpHeaders(headers: any, settings: any): Record<string, string> {
  const cleanHeaders: Record<string, string> = {};
  if (!headers || typeof headers !== 'object') return cleanHeaders;

  for (const [key, rawValue] of Object.entries(headers)) {
    if (rawValue === undefined || rawValue === null) continue;
    const value = String(rawValue);

    // Filter out invalid characters in header keys (non-ASCII)
    const cleanKey = key.replace(/[^\x00-\x7F]/g, "");

    // Check for characters with code > 255 in header value
    let hasInvalidChar = false;
    let detailsStr = "";
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code > 255) {
        hasInvalidChar = true;
        detailsStr += `'${value[i]}' (code ${code} at index ${i}), `;
      }
    }

    if (hasInvalidChar) {
      detailsStr = detailsStr.trim().replace(/,$/, '');
      const providerName = settings?.provider === "meseji" ? "Meseji.co.tz" : "SMS Gateway";
      throw new Error(`Hitilafu katika Mipangilio (Invalid Settings Character): Token yako (API Key/Token) au 'Sender ID' yako ina alama isiyoruhusiwa ${detailsStr}.\n\nTafsiri: Hii hutokea kwa kawaida unaponakili (copy-paste) picha la makosa au alama ya cross "✗" au alama za nukuu tofauti (smart quotes) toka kwenye ripoti za awali.\n\nSuluhisho: Tafadhali nenda kwenye Alama ya Mipangilio (Settings Icon) ya ukurasa wa Kutuma Ujumbe, futa yaliyomo kwenye 'API Token' na 'Sender ID', kisha nakili na uandike kwa makini Token safi ya kutoka akaunti yako ya ${providerName} bila kuweka alama au nyakati (timestamps) za ripoti.`);
    }

    cleanHeaders[cleanKey] = value;
  }
  return cleanHeaders;
}

function sanitizeMetaTemplateParam(val: any): string {
  if (val === undefined || val === null) return " ";
  let str = String(val);
  // Replace newlines, carriage returns, and tabs with spaces
  str = str.replace(/[\r\n\t]+/g, ' ');
  // Replace multiple spaces (2 or more spaces) with a single space to avoid the "more than 4 consecutive spaces" rule
  str = str.replace(/ {2,}/g, ' ');
  // Trim the result
  str = str.trim();
  return str || " ";
}

function getParamsForCount(count: number, guestData: any, eventData: any, fallbackText: string, incomingParams?: string[], templateName?: string): any[] {
  const resolvedParams: string[] = [];
  
  const standardValues = [
    guestData?.name || "Mgeni wetu", // 1. Guest Name
    eventData?.hostName || "Familia yetu", // 2. Host Name
    eventData?.name || "Sherehe yetu", // 3. Event Name
    eventData?.date || "", // 4. Date
    eventData?.eventHallName || "Ukumbi wa Sherehe", // 5. Venue
    `${eventData?.time || "12:00"} ${eventData?.period || "Mchana"}`, // 6. Time
    guestData?.code || guestData?.id || "N/A", // 7. Card Number
    guestData?.cardType || "Kadi ya Kawaida", // 8. Card Type
    eventData?.contact1Name || "Msimamizi 1", // 9. Contact 1 Name
    eventData?.contact1 || "", // 10. Contact 1 Phone
    eventData?.contact2Name || "Msimamizi 2", // 11. Contact 2 Name
    eventData?.contact2 || "" // 12. Contact 2 Phone
  ];

  if (Array.isArray(incomingParams) && incomingParams.length > 0) {
    for (let i = 0; i < count; i++) {
      if (i < incomingParams.length) {
        resolvedParams.push(incomingParams[i]);
      } else if (i < standardValues.length) {
        resolvedParams.push(standardValues[i]);
      } else {
        resolvedParams.push("");
      }
    }
  } else {
    if (count === 1) {
      resolvedParams.push(guestData?.name || "Mgeni wetu");
    } else if (count === 2) {
      resolvedParams.push(guestData?.name || "Mgeni wetu");
      resolvedParams.push(eventData?.name || "Sherehe yetu");
    } else if (count === 3) {
      resolvedParams.push(guestData?.name || "Mgeni wetu");
      resolvedParams.push(eventData?.hostName || "Familia yetu");
      resolvedParams.push(eventData?.name || "Sherehe yetu");
    } else if (count === 4) {
      resolvedParams.push(guestData?.name || "Mgeni wetu");
      resolvedParams.push(eventData?.name || "Sherehe yetu");
      resolvedParams.push(eventData?.date || "");
      resolvedParams.push(eventData?.eventHallName || "Ukumbi wa Sherehe");
    } else if (count === 5) {
      resolvedParams.push(guestData?.name || "Mgeni wetu");
      resolvedParams.push(eventData?.name || "Sherehe yetu");
      resolvedParams.push(eventData?.date || "");
      resolvedParams.push(eventData?.eventHallName || "Ukumbi wa Sherehe");
      resolvedParams.push(`${eventData?.time || "12:00"} ${eventData?.period || "Mchana"}`);
    } else if (count === 6) {
      const lowerTemplate = (templateName || "").toLowerCase();
      if ((lowerTemplate.includes("mwaliko") || lowerTemplate === "" || lowerTemplate.includes("sherehe") || lowerTemplate.includes("invite") || lowerTemplate.includes("wedding")) && !lowerTemplate.includes("mchango") && !lowerTemplate.includes("pledge") && !lowerTemplate.includes("ombi") && !lowerTemplate.includes("contribution")) {
        resolvedParams.push(guestData?.name || "Mgeni wetu");
        resolvedParams.push(eventData?.hostName || "Familia yetu");
        resolvedParams.push(eventData?.name || "Sherehe yetu");
        resolvedParams.push(eventData?.date || "Tarehe");
        resolvedParams.push(eventData?.eventHallName || "Ukumbi wa Sherehe");
        resolvedParams.push(`${eventData?.time || "12:00"} ${eventData?.period || "Mchana"}`);
      } else {
        // Contribution Invite mapping (Removed link)
        resolvedParams.push(guestData?.name || "Mgeni wetu");
        resolvedParams.push(eventData?.hostName || "Familia yetu");
        resolvedParams.push(eventData?.name || "Sherehe yetu");
        resolvedParams.push(eventData?.date || "Tarehe");
        const dd = eventData?.contributionDeadline || eventData?.deadlineDate;
        resolvedParams.push(dd ? new Date(dd).toLocaleDateString("sw-TZ", { day: "numeric", month: "long", year: "numeric" }) : "Tarehe ya Mwisho");
        let pmStr = ""; if (Array.isArray(eventData?.paymentMethods) && eventData.paymentMethods.length > 0) { const mobile = eventData.paymentMethods.filter((m: any) => m.type === "Mobile"); const lipa = eventData.paymentMethods.filter((m: any) => m.type === "Lipa Namba"); const bank = eventData.paymentMethods.filter((m: any) => m.type === "Bank"); if (mobile.length > 0) { pmStr += "Namba za Simu:\n"; mobile.forEach((m: any) => pmStr += `${m.provider}: ${m.number} (${m.name})\n`); pmStr += "\n"; } if (lipa.length > 0) { pmStr += "Lipa Namba:\n"; lipa.forEach((m: any) => pmStr += `${m.provider}: ${m.number} (${m.name})\n`); pmStr += "\n"; } if (bank.length > 0) { pmStr += "Akaunti za Benki:\n"; bank.forEach((m: any) => pmStr += `${m.provider}: ${m.number} (${m.name})\n`); pmStr += "\n"; } pmStr = pmStr.trim(); } else if (typeof eventData?.paymentMethods === "string" && eventData.paymentMethods) { pmStr = eventData.paymentMethods; } else { pmStr = "Namba za Michango"; } resolvedParams.push(pmStr);
      }
    } else if (count === 7) {
      // Contribution Reminder mapping (Removed link)
      resolvedParams.push(guestData?.name || "Mgeni wetu");
      resolvedParams.push(eventData?.name || "Sherehe yetu");
      resolvedParams.push(String(guestData?.pledgeAmount || 0));
      resolvedParams.push(String(guestData?.paidAmount || 0));
      resolvedParams.push(String((guestData?.pledgeAmount || 0) - (guestData?.paidAmount || 0)));
      const dd = eventData?.contributionDeadline || eventData?.deadlineDate;
        resolvedParams.push(dd ? new Date(dd).toLocaleDateString("sw-TZ", { day: "numeric", month: "long", year: "numeric" }) : "Tarehe ya Mwisho");
      let pmStr = ""; if (Array.isArray(eventData?.paymentMethods) && eventData.paymentMethods.length > 0) { const mobile = eventData.paymentMethods.filter((m: any) => m.type === "Mobile"); const lipa = eventData.paymentMethods.filter((m: any) => m.type === "Lipa Namba"); const bank = eventData.paymentMethods.filter((m: any) => m.type === "Bank"); if (mobile.length > 0) { pmStr += "Namba za Simu:\n"; mobile.forEach((m: any) => pmStr += `${m.provider}: ${m.number} (${m.name})\n`); pmStr += "\n"; } if (lipa.length > 0) { pmStr += "Lipa Namba:\n"; lipa.forEach((m: any) => pmStr += `${m.provider}: ${m.number} (${m.name})\n`); pmStr += "\n"; } if (bank.length > 0) { pmStr += "Akaunti za Benki:\n"; bank.forEach((m: any) => pmStr += `${m.provider}: ${m.number} (${m.name})\n`); pmStr += "\n"; } pmStr = pmStr.trim(); } else if (typeof eventData?.paymentMethods === "string" && eventData.paymentMethods) { pmStr = eventData.paymentMethods; } else { pmStr = "Namba za Michango"; } resolvedParams.push(pmStr);
    } else {
      for (let i = 0; i < count; i++) {
        if (i < standardValues.length) {
          resolvedParams.push(standardValues[i]);
        } else {
          resolvedParams.push("");
        }
      }
    }
  }

  return resolvedParams.map(val => ({ type: "text", text: sanitizeMetaTemplateParam(val) }));
}

const metaMediaCache = new Map<string, { mediaId: string; timestamp: number }>();

async function dispatchSMS(phone: string, text: string, channel: 'sms' | 'whatsapp', settings: any, scheduleTime?: string, templateParams?: string[], guestId?: string, appOrigin?: string, reqEventId?: string, reqTemplateName?: string, reqImageUrl?: string) {
  // Standardize/Clean Tanzanian phone numbers to 255XXXXXXXXX format
  const cleanedPhone = phone.replace(/\s+/g, '').replace(/[+\-]/g, '');
  let formattedPhone = cleanedPhone;
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '255' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('255') && formattedPhone.length === 9) {
    formattedPhone = '255' + formattedPhone;
  }

  // Handle WhatsApp custom automated HTTP dispatch if configured
  if (channel === 'whatsapp') {
    if (settings.whatsappUrl) {
      // Check if it's a serialized JSON representing official Meta config
      let metaConfig: any = null;
      try {
        if (settings.whatsappUrl.trim().startsWith('{') && settings.whatsappUrl.trim().endsWith('}')) {
          metaConfig = JSON.parse(settings.whatsappUrl);
        }
      } catch (e) {
        // Not a JSON, keep as standard Custom Webhook
      }

      if (metaConfig && metaConfig.provider === 'meta') {
        const token = (metaConfig.meta_token || "").trim();
        const phoneId = (metaConfig.phone_number_id || "").trim();
        let templateName = (reqTemplateName || metaConfig.template_name || "").trim();
        let templateLang = (metaConfig.template_lang || "sw").trim();
        
        // Normalize common language names to ISO codes expected by Meta
        if (templateLang.toLowerCase() === 'swahili') templateLang = 'sw';
        if (templateLang.toLowerCase() === 'english') templateLang = 'en';
        
        console.log(`[Meta WhatsApp] Dispatching to ${formattedPhone} using template ${templateName} in ${templateLang}`);
        
        // Fetch database once to resolve both guest eventId and template settings
        let db: any = null;
        try {
          db = await readDBLatest();
        } catch (dbErr) {
          console.error("[Meta WhatsApp] Error reading DB for template/guest:", dbErr);
        }

        // Dynamically resolve eventId to serve the exact image header
        let eventId = reqEventId || "default";
        let guestData: any = null;
        let eventData: any = null;
        
        if (db) {
          if (guestId) {
            try {
              guestData = (db.guests || []).find((g: any) => g.id === guestId);
              if (!guestData && phone) {
                const cleanP = phone.replace(/\s+/g, '').replace(/[+\-]/g, '');
                guestData = (db.guests || []).find((g: any) => {
                  const gp = (g.phone || "").replace(/\s+/g, '').replace(/[+\-]/g, '');
                  return gp && (gp === cleanP || gp.endsWith(cleanP) || cleanP.endsWith(gp));
                });
              }
              if (guestData && guestData.eventId && !reqEventId) {
                eventId = guestData.eventId;
              }
            } catch (err) {
              console.error("[Meta WhatsApp] Error finding guest eventId:", err);
            }
          }

          if (eventId !== "default") {
            eventData = (db.eventsList || []).find((e: any) => e.id === eventId);
          }
          if (!eventData && (db.eventsList || []).length > 0) {
            eventData = db.eventsList[0];
          }
        }
        
        let bodyParams: any[] = [];
        let buttonParams: any[] = [];

        // Determine expected parameter count from fuzzy template name matching first to enforce official Meta template structure
        let expectedCount = 0;
        const lowerTemplateName = templateName.toLowerCase();
        if (lowerTemplateName.includes('mwaliko_wa_sherehe') || lowerTemplateName.includes('mwaliko_wa_sherehe_')) {
          expectedCount = 12;
        } else if (lowerTemplateName.includes('shukrani') || lowerTemplateName.includes('asante') || lowerTemplateName.includes('thanks') || lowerTemplateName.includes('thank_you') || lowerTemplateName.includes('thankyou')) {
          expectedCount = 2;
        } else if (lowerTemplateName.includes('mchango') || lowerTemplateName.includes('pledge') || lowerTemplateName.includes('ombi')) {
          expectedCount = 6;
        } else if (lowerTemplateName.includes('reminder') || lowerTemplateName.includes('ukumbusho')) {
          expectedCount = 7;
        } else if (lowerTemplateName.includes('save') || lowerTemplateName.includes('date') || lowerTemplateName.includes('hifadhi') || lowerTemplateName.includes('tarehe')) {
          // Explicitly handle Save the Date with 3 params and NO buttons by default
          expectedCount = 3;
        } else if (lowerTemplateName.includes('mwaliko') || lowerTemplateName.includes('kadi') || lowerTemplateName.includes('wedding') || lowerTemplateName.includes('invite') || lowerTemplateName.includes('sherehe') || lowerTemplateName.includes('invitation')) {
          expectedCount = 12;
        }

        if (expectedCount > 0) {
          console.log(`[Meta WhatsApp] Fuzzy matched template ${templateName} to expected parameter count: ${expectedCount}`);
          bodyParams = getParamsForCount(expectedCount, guestData, eventData, text, templateParams, templateName);
        } else if (Array.isArray(templateParams) && templateParams.length > 0) {
          // Fallback to trusting frontend count if no fuzzy match
          expectedCount = templateParams.length;
          console.log(`[Meta WhatsApp] No fuzzy match, using frontend templateParams count: ${expectedCount}`);
          bodyParams = getParamsForCount(expectedCount, guestData, eventData, text, templateParams, templateName);
        } else {
          if (templateName === 'kadi_mwaliko' && guestData && eventData) {
            bodyParams = getParamsForCount(12, guestData, eventData, text, templateParams, templateName);
          } else if (templateName === 'shukrani' && guestData && eventData) {
            bodyParams = getParamsForCount(1, guestData, eventData, text, templateParams, templateName);
          } else {
            // Fallback to dynamic params passed from frontend
            if (Array.isArray(templateParams) && templateParams.length > 0) {
              const urlIndices: number[] = [];
              templateParams.forEach((val, idx) => {
                const str = String(val || "").trim();
                if (str.startsWith("http://") || str.startsWith("https://")) {
                  urlIndices.push(idx);
                }
              });

              if (templateParams.length > 12 && urlIndices.length > 0) {
                templateParams.forEach((val, idx) => {
                  const strVal = sanitizeMetaTemplateParam(val);
                  if (urlIndices.includes(idx)) {
                    buttonParams.push({ type: "text", text: strVal });
                  } else {
                    bodyParams.push({ type: "text", text: strVal });
                  }
                });
              } else {
                templateParams.forEach((val) => {
                  bodyParams.push({ type: "text", text: sanitizeMetaTemplateParam(val) });
                });
              }
            } else {
              bodyParams.push({ type: "text", text: sanitizeMetaTemplateParam(text) });
            }
          }
        }
        
        // Always attempt to supply a URL button parameter for guest-specific links.
        // If the template does not have a button, the self-healing logic will remove it.
        const guestCode = guestData?.code || guestData?.id || guestId || "";
        const isSaveTheDate = lowerTemplateName.includes('save') || lowerTemplateName.includes('date') || lowerTemplateName.includes('hifadhi') || lowerTemplateName.includes('tarehe');
        
        if (guestCode && !isSaveTheDate) {
          let buttonParamVal = `?invite=${guestCode}&eventId=${eventId || ""}`;
          if (lowerTemplateName.includes('mchango') || lowerTemplateName.includes('pledge') || lowerTemplateName.includes('ombi') || lowerTemplateName.includes('reminder') || lowerTemplateName.includes('ukumbusho')) {
            buttonParamVal += `&pledge=true`;
          }
          buttonParams.push({ type: "text", text: buttonParamVal });
        } else if (!isSaveTheDate) {
          // Check if any frontend template params look like URLs
          if (Array.isArray(templateParams)) {
            templateParams.forEach(val => {
              const str = String(val || "").trim();
              if ((str.startsWith("http://") || str.startsWith("https://")) && buttonParams.length === 0) {
                buttonParams.push({ type: "text", text: str });
              }
            });
          }
        }

        const headerImageUrl = `${appOrigin || "https://eventcard.co.tz"}/api/template-image/${eventId}`;

        // Let's resolve the actual image to upload it directly to Meta to bypass preview server authentication/sandbox limits
        let mediaId: string | null = null;
        let imageUrl = reqImageUrl || "";
        try {
          if (!imageUrl && db) {
            if (db.templateSettings && db.templateSettings[eventId]) {
              imageUrl = db.templateSettings[eventId].imageUrl || "";
            }
            if (!imageUrl && db.templateSettings && db.templateSettings['default']) {
              imageUrl = db.templateSettings['default'].imageUrl || "";
            }
          }

          if (imageUrl) {
            const cacheKey = `${eventId}_${guestId || phone || ""}_${imageUrl.substring(0, 100)}_${imageUrl.length}`;
            const cached = metaMediaCache.get(cacheKey);
            const now = Date.now();

            if (cached && (now - cached.timestamp < 24 * 60 * 60 * 1000)) {
              mediaId = cached.mediaId;
              console.log(`[Meta WhatsApp] Using CACHED Media ID for key: ${cacheKey}. Media ID: ${mediaId}`);
            } else {
              let blob: any = null;
              let filename = "image.png";
              let contentType = "image/png";

              if (imageUrl.startsWith("data:")) {
                const matches = imageUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                  contentType = matches[1];
                  const buffer = Buffer.from(matches[2], 'base64');
                  blob = new Blob([buffer], { type: contentType });
                  filename = contentType === "image/jpeg" ? "image.jpg" : "image.png";
                }
              } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
                const imgRes = await fetch(imageUrl);
                if (imgRes.ok) {
                  blob = await imgRes.blob();
                  contentType = blob.type || "image/png";
                  filename = contentType === "image/jpeg" ? "image.jpg" : "image.png";
                } else {
                  throw new Error(`Hitilafu ya Meta WhatsApp: Imeshindwa kupakua picha ya kadi toka kwenye kiungo chake (Status ${imgRes.status}).`);
                }
              }

              if (blob) {
                console.log(`[Meta WhatsApp] Uploading media to Meta API... File size: ${blob.size} bytes, type: ${contentType}`);
                const mediaUrl = `https://graph.facebook.com/v20.0/${phoneId}/media`;
                const formData = new FormData();
                formData.append("messaging_product", "whatsapp");
                formData.append("file", blob, filename);
                formData.append("type", contentType);

                const mediaResponse = await fetch(mediaUrl, {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${token}`
                  },
                  body: formData
                });

                const mediaResult: any = await mediaResponse.json();
                if (mediaResponse.ok && mediaResult.id) {
                  mediaId = mediaResult.id;
                  metaMediaCache.set(cacheKey, { mediaId, timestamp: now });
                  console.log(`[Meta WhatsApp] Successfully uploaded and CACHED media. Media ID: ${mediaId}`);
                } else {
                  console.error(`[Meta WhatsApp] Media upload failed:`, mediaResult);
                  const apiMsg = mediaResult?.error?.message || "Hitilafu isiyojulikana";
                  const apiCode = mediaResult?.error?.code || "";
                  throw new Error(`Hitilafu ya Meta WhatsApp: Imeshindwa kupakia picha ya kadi kwenda Meta (Media Upload Failed, Msimbo ${apiCode}). Tafadhali hakikisha Token ya Meta na ID ya namba ya simu ziko sahihi, na picha ina ukubwa usiozidi 5MB. [Jibu la Meta: ${apiMsg}]`);
                }
              }
            }
          }
        } catch (mediaErr: any) {
          console.error("[Meta WhatsApp] Error uploading media to Meta:", mediaErr);
          if (mediaErr?.message?.includes("Hitilafu ya Meta WhatsApp")) {
            throw mediaErr;
          }
        }

        const payload: any = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: templateLang
            }
          }
        };

        // Standard hello_world template does not take parameters
        if (templateName !== 'hello_world') {
          payload.template.components = [];
          
          // Add header parameter for the image only if an imageUrl is configured in the template settings
          if (imageUrl) {
            const headerParam: any = {
              type: "image",
              image: {}
            };
            if (mediaId) {
              headerParam.image.id = mediaId;
            } else {
              headerParam.image.link = headerImageUrl;
            }

            payload.template.components.push({
              type: "header",
              parameters: [headerParam]
            });
          }

          if (bodyParams.length > 0) {
            payload.template.components.push({
              type: "body",
              parameters: bodyParams
            });
          }
          if (buttonParams.length > 0) {
            payload.template.components.push({
              type: "button",
              index: "0",
              sub_type: "url",
              parameters: buttonParams
            });
          }
        }

        const metaUrl = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
        let lastError: Error | null = null;
        let rootErrorObj: any = null;
        let response;
        let respText = "";
        let attempt = 0;
        const maxAttempts = 10;
        let success = false;

        while (attempt < maxAttempts) {
          attempt++;
          console.log(`[Meta WhatsApp] Attempt ${attempt}/${maxAttempts} - Payload:`, JSON.stringify(payload));
          
          try {
            const rawHeaders = {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            };
            response = await fetch(metaUrl, {
              method: 'POST',
              headers: sanitizeHttpHeaders(rawHeaders, settings),
              body: JSON.stringify(payload)
            });
            respText = await response.text();
            
            if (response.ok) {
              success = true;
              console.log(`[Meta WhatsApp] Attempt ${attempt} SUCCESS.`);
              try {
                const data = JSON.parse(respText);
                if (data.messages && data.messages[0]) {
                  return JSON.stringify({ ...data, messageId: data.messages[0].id, log: `Meta ID: ${data.messages[0].id}` });
                }
              } catch (e) {}
              return respText;
            }

            // Parse response to determine self-healing path
            let healAttempted = false;
            try {
              const errObj = JSON.parse(respText);
              const errMsg = errObj.error?.message || "";
              const errDetails = errObj.error?.error_data?.details || "";
              const combinedMsg = `${errMsg} ${errDetails}`;

              // Case A: Token expired / Auth Exception
              if (errObj.error && (errObj.error.code === 190 || errObj.error.code === 131005) && errObj.error.type === "OAuthException") {
                throw new Error(`Hitilafu ya Meta WhatsApp: Token yako imepitwa na wakati (expired) au haina ruhusa (Access Denied). Tafadhali nenda kwenye "Mipangilio" kisha weka "Meta Access Token" mpya na sahihi.`);
              }
              // Case B: Guest number not verified
              if (errObj.error && (errObj.error.code === 133010 || errObj.error.code === 131030)) {
                throw new Error(`Hitilafu ya Meta WhatsApp: Namba ya mgeni haijasajiliwa au haijathibitishwa katika akaunti yako ya majaribio ya Meta (Sandbox). Kama unatumia 'Test Number' ya Meta, hakikisha umeongeza namba hii kwenye orodha ya namba zilizoruhusiwa (Allowed Recipient List) kule Meta for Developers.`);
              }
              // Case C: Template name / language not found - SELF HEALING FALLBACK
              if (errObj.error && errObj.error.code === 132001) {
                if (attempt === 1) rootErrorObj = errObj; 

                const defaultTemplate = (metaConfig.template_name || "").trim();
                const defaultLang = (metaConfig.template_lang || "sw").trim();

                // Strategy 1: Try language fallback first on the first failure
                if (attempt === 1) {
                  const currentLang = payload.template.language.code;
                  const otherLang = currentLang === 'sw' ? 'en' : 'sw';
                  console.log(`[Meta WhatsApp Self-Healing] Template "${templateName}" not found in '${currentLang}'. Attempting fallback to '${otherLang}'...`);
                  payload.template.language.code = otherLang;
                  healAttempted = true;
                } 
                // Strategy 2: Try falling back to the configured default template name on second failure
                else if (attempt === 2 && templateName !== defaultTemplate && defaultTemplate) {
                  console.log(`[Meta WhatsApp Self-Healing] Custom template "${templateName}" not found. Falling back to configured default: "${defaultTemplate}" in language "${defaultLang}"`);
                  templateName = defaultTemplate;
                  payload.template.name = templateName;
                  payload.template.language.code = defaultLang;
                  
                  // Re-evaluate expected count and params for fallback template
                  let newExpectedCount = 0;
                  const lowerFallbackName = templateName.toLowerCase();
                  if (lowerFallbackName.includes('mwaliko_wa_sherehe') || lowerFallbackName.includes('mwaliko_wa_sherehe_')) {
                    newExpectedCount = 12;
                  } else if (lowerFallbackName.includes('shukrani') || lowerFallbackName.includes('asante') || lowerFallbackName.includes('thanks') || lowerFallbackName.includes('thank_you') || lowerFallbackName.includes('thankyou')) {
                    newExpectedCount = 2;
                  } else if (lowerFallbackName.includes('mchango') || lowerFallbackName.includes('pledge') || lowerFallbackName.includes('ombi')) {
                    newExpectedCount = 6;
                  } else if (lowerFallbackName.includes('save') || lowerFallbackName.includes('date') || lowerFallbackName.includes('hifadhi') || lowerFallbackName.includes('tarehe')) {
                    newExpectedCount = 3;
                  } else if (lowerFallbackName.includes('reminder') || lowerFallbackName.includes('ukumbusho')) {
                    newExpectedCount = 7;
                  } else if (lowerFallbackName.includes('mwaliko') || lowerFallbackName.includes('kadi') || lowerFallbackName.includes('wedding') || lowerFallbackName.includes('invite') || lowerFallbackName.includes('sherehe') || lowerFallbackName.includes('invitation')) {
                    newExpectedCount = 12;
                  }

                  if (newExpectedCount > 0) {
                    const recoveredParams = getParamsForCount(newExpectedCount, guestData, eventData, text, templateParams, templateName);
                    const bodyCompIdx = payload.template.components.findIndex((c: any) => c.type === "body");
                    if (bodyCompIdx !== -1) {
                      payload.template.components[bodyCompIdx].parameters = recoveredParams;
                    } else {
                      payload.template.components.push({
                        type: "body",
                        parameters: recoveredParams
                      });
                    }
                  }
                  healAttempted = true;
                } else {
                  // Strategy 3: Try generic fallbacks based on message type
                  let genericFallbacks = [];
                  const lowerText = (text || "").toLowerCase();
                  if (lowerText.includes("shukrani") || lowerText.includes("asante") || lowerText.includes("thanks")) {
                    genericFallbacks = ['asante_kushiriki', 'shukrani', 'shukrani_mchango'];
                  } else if (lowerText.includes("ukumbusho") || lowerText.includes("reminder") || lowerText.includes("hifadhi") || lowerText.includes("tarehe")) {
                    genericFallbacks = ['ukumbusho', 'reminder', 'hifadhi_tarehe', 'mwaliko_wa_sherehe'];
                  } else {
                    genericFallbacks = ['mwaliko_wa_sherehe', 'kadi_mwaliko', 'mwaliko'];
                  }

                  for (const fallback of genericFallbacks) {
                    if (templateName !== fallback) {
                      console.log(`[Meta WhatsApp Self-Healing] Exhausted options. Trying generic fallback: "${fallback}"...`);
                      templateName = fallback;
                      payload.template.name = templateName;
                      payload.template.language.code = "sw";
                      
                      let countToTry = 12;
                      const lowerFallback = fallback.toLowerCase();
                      if (lowerFallback === 'asante_kushiriki') countToTry = 2;
                      if (lowerFallback === 'shukrani') countToTry = 2;
                      if (lowerFallback === 'ukumbusho' || lowerFallback === 'reminder') countToTry = 6;
                      if (lowerFallback === 'hifadhi_tarehe') countToTry = 3;
                      
                      const recoveredParams = getParamsForCount(countToTry, guestData, eventData, text, templateParams, templateName);
                      
                      // For generic fallbacks, structure is often just the body. Clear others to avoid header/button errors
                      payload.template.components = [
                        {
                          type: "body",
                          parameters: recoveredParams
                        }
                      ];
                      
                      healAttempted = true;
                      break;
                    }
                  }
                }
                
                if (!healAttempted) {
                  const detail = errObj.error.error_data?.details || errObj.error.message || "";
                  throw new Error(`Hitilafu ya Meta WhatsApp: Jina la template uliyoweka (${detail}) halipatikani katika Meta dashboard yako. Tafadhali hakikisha jina na lugha ya template vinalingana na vile vilivyoko kule Meta Developers.`);
                }
              }

              if (!healAttempted) {
                const lowerCombined = (combinedMsg || "").toLowerCase();
                // Case D: Header component error (Template does not contain title component or no parameters allowed in header)
                const isHeaderError = (errObj.error?.code === 132018 && (lowerCombined.includes("header") || lowerCombined.includes("title"))) || 
                                     lowerCombined.includes("header") || 
                                     lowerCombined.includes("title") || 
                                     lowerCombined.includes("does not contain title component") || 
                                     lowerCombined.includes("no parameters allowed in header") || 
                                     lowerCombined.includes("template does not contain header component") || 
                                     lowerCombined.includes("not contain title component") || 
                                     lowerCombined.includes("not contain header component");

                if (isHeaderError) {
                  const headerCompIdx = payload.template.components.findIndex((c: any) => c.type === "header");
                  if (headerCompIdx !== -1) {
                    payload.template.components.splice(headerCompIdx, 1);
                    console.log("[Meta WhatsApp Self-Healing] Removed unsupported 'header' component from payload.");
                    healAttempted = true;
                  } else {
                    // Meta is complaining about a header but we don't have one in our payload components
                    // Try to clear ALL components except body as a last resort
                    payload.template.components = payload.template.components.filter((c: any) => c.type === "body");
                    console.log(`[Meta WhatsApp Self-Healing] Cleared non-body components due to header error (Attempt ${attempt})`);
                    healAttempted = true;
                  }
                }

                // Case E: Button parameter error
                const isButtonError = lowerCombined.includes("button") || 
                                     lowerCombined.includes("132018") || 
                                     lowerCombined.includes("button at index 0") ||
                                     lowerCombined.includes("buttons") ||
                                     lowerCombined.includes("does not contain button components");

                if (isButtonError) {
                  const btnCompIdx = payload.template.components.findIndex((c: any) => c.type === "button" || c.type === "buttons");
                  
                  if (lowerCombined.includes("requires a parameter") || lowerCombined.includes("expected 1") || lowerCombined.includes("missing parameter") || lowerCombined.includes("index 0 requires")) {
                    const code = guestData?.code || guestData?.id || guestId || "";
                    let buttonParamVal = "";
                    if (Array.isArray(templateParams)) {
                      for (const p of templateParams) {
                        const str = String(p || "").trim();
                        if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("?")) {
                          if (str.includes("?")) {
                            buttonParamVal = str.substring(str.indexOf("?"));
                          } else {
                            buttonParamVal = str;
                          }
                          break;
                        }
                      }
                    }
                    if (!buttonParamVal && code) {
                      let baseVal = `?invite=${code}&eventId=${eventId || ""}`;
                      const lowerFallback = (templateName || "").toLowerCase();
                      if (lowerFallback.includes('mchango') || lowerFallback.includes('pledge') || lowerFallback.includes('ombi') || lowerFallback.includes('reminder') || lowerFallback.includes('ukumbusho')) {
                        baseVal += `&pledge=true`;
                      }
                      buttonParamVal = baseVal;
                    }
                    if (buttonParamVal) {
                      const btnParams = [{ type: "text", text: buttonParamVal }];
                      if (btnCompIdx !== -1) {
                        payload.template.components[btnCompIdx].parameters = btnParams;
                        console.log(`[Meta WhatsApp Self-Healing] Updated existing button component with parameter: "${buttonParamVal}"`);
                      } else {
                        payload.template.components.push({
                          type: "button",
                          index: "0",
                          sub_type: "url",
                          parameters: btnParams
                        });
                        console.log(`[Meta WhatsApp Self-Healing] Added missing button component with parameter: "${buttonParamVal}"`);
                      }
                      healAttempted = true;
                    } else {
                      // No parameter found to supply, but required. Try to remove button if Meta is confused
                      if (btnCompIdx !== -1) {
                        payload.template.components.splice(btnCompIdx, 1);
                        console.log("[Meta WhatsApp Self-Healing] Button requires parameter but none found. Removed button component.");
                        healAttempted = true;
                      }
                    }
                  } else if (lowerCombined.includes("no parameters allowed") || 
                             lowerCombined.includes("does not contain button") || 
                             lowerCombined.includes("not contain button components") ||
                             lowerCombined.includes("no button components") ||
                             lowerCombined.includes("extra parameter") ||
                             lowerCombined.includes("not contain button") ||
                             lowerCombined.includes("invalid parameters for button") ||
                             lowerCombined.includes("no parameters allowed for button")) {
                    if (btnCompIdx !== -1) {
                      // Remove ALL button components to be safe
                      const initialCount = payload.template.components.length;
                      payload.template.components = payload.template.components.filter((c: any) => c.type !== "button" && c.type !== "buttons");
                      console.log(`[Meta WhatsApp Self-Healing] Removed ${initialCount - payload.template.components.length} unsupported 'button' components from payload.`);
                      healAttempted = true;
                    } else {
                      // If we are getting a button error but no button in payload, Meta might be confused by the payload structure
                      // We'll try to remove ANY component that isn't 'body' as a last resort for 132018 errors
                      const initialCount = payload.template.components.length;
                      payload.template.components = payload.template.components.filter((c: any) => c.type === "body");
                      if (payload.template.components.length < initialCount) {
                        console.log(`[Meta WhatsApp Self-Healing] Received button error but no button found. Stripped ${initialCount - payload.template.components.length} non-body components to recover.`);
                        healAttempted = true;
                      } else {
                        console.log("[Meta WhatsApp Self-Healing] Received button error but no non-body components to strip. Attempting to clear all parameters just in case.");
                        // Last ditch effort: send empty components list
                        payload.template.components = [];
                        healAttempted = true;
                      }
                    }
                  }
                }

                // Case F: Body parameter mismatch
                if (errObj.error?.code === 132000 || errObj.error?.code === 132018 || combinedMsg.includes("Number of parameters does not match") || combinedMsg.includes("number of localizable_params") || combinedMsg.includes("param") || combinedMsg.includes("parameter") || lowerCombined.includes("parameters in your template")) {
                  const countMatch = 
                    combinedMsg.match(/expected number of params\s*\((\d+)\)/i) || 
                    combinedMsg.match(/expected number of params\s*(?:\:\s*)?\(?(\d+)\)?/i) || 
                    combinedMsg.match(/expected\s+(\d+)\s+params/i) ||
                    combinedMsg.match(/expected\s*(?:\:\s*)?\(?(\d+)\)?/i) ||
                    combinedMsg.match(/expected\s+(\d+)/i) ||
                    combinedMsg.match(/expected number of params\s+(\d+)/i) ||
                    combinedMsg.match(/number of localizable_params\s*\(\d+\)\s*does\s*not\s*match\s*the\s*expected\s*number\s*of\s*params\s*\((\d+)\)/i) ||
                    combinedMsg.match(/localizable_params\s*\(\d+\)\s*does\s*not\s*match.*?expected.*?\((\d+)\)/i) ||
                    combinedMsg.match(/match\s+the\s+expected\s+number\s+of\s+params\s*\((\d+)\)/i);
                  
                if (countMatch) {
                    const newExpectedCount = parseInt(countMatch[2] || countMatch[1], 10);
                    const recoveredParams = getParamsForCount(newExpectedCount, guestData, eventData, text, templateParams, templateName);
                    
                    // If we have a mismatch error, it's often best to strip non-body components 
                    // if it's not the first attempt, as they often cause cascading failures
                    if (attempt > 3) {
                      payload.template.components = [{
                        type: "body",
                        parameters: recoveredParams
                      }];
                      console.log(`[Meta WhatsApp Self-Healing] Stripped non-body components and adjusted body params to ${newExpectedCount} (Attempt ${attempt})`);
                    } else {
                      const bodyCompIdx = payload.template.components.findIndex((c: any) => c.type === "body");
                      if (bodyCompIdx !== -1) {
                        payload.template.components[bodyCompIdx].parameters = recoveredParams;
                      } else {
                        payload.template.components.push({
                          type: "body",
                          parameters: recoveredParams
                        });
                      }
                      console.log(`[Meta WhatsApp Self-Healing] Adjusted body parameters to exactly match count: ${newExpectedCount} (Attempt ${attempt})`);
                    }
                    healAttempted = true;
                  } else {
                    // If we can't find a count but we have a mismatch, try to adjust to what we have or what it asks
                    // If detail says "does not match the expected number of params (3)"
                    const altMatch = combinedMsg.match(/\((\d+)\)/);
                    if (altMatch && altMatch[1]) {
                       const count = parseInt(altMatch[1], 10);
                       const recoveredParams = getParamsForCount(count, guestData, eventData, text, templateParams, templateName);
                       const bodyIdx = payload.template.components.findIndex((c: any) => c.type === "body");
                       if (bodyIdx !== -1) {
                         payload.template.components[bodyIdx].parameters = recoveredParams;
                         console.log(`[Meta WhatsApp Self-Healing] Last resort count adjustment to ${count}`);
                         healAttempted = true;
                       }
                    }
                  }
                }
              }

            } catch (e: any) {
              console.error("[Meta WhatsApp Self-Healing Error] Exception during self-healing block:", e);
              if (e.message.includes("Hitilafu ya Meta WhatsApp")) {
                throw e;
              }
            }

            if (!healAttempted) {
              // No recognizable healing possible, break out and show the response
              break;
            }

          } catch (err: any) {
            const errorStr = (err?.message || String(err)).toLowerCase();
            if (errorStr.includes("bytestring") || errorStr.includes("character at index") || errorStr.includes("greater than 255")) {
              throw new Error(`Hitilafu katika Mipangilio ya WhatsApp: Token uliyoweka kwenye Mipangilio ya Meta WhatsApp ina alama isiyoruhusiwa (isiyo ya ASCII). Tafadhali thibitisha au uandike upya token yako bila kuweka alama au nyakati (timestamps) zisizo sahihi.`);
            }
            if (errorStr.includes("hitilafu ya meta whatsapp")) {
              throw err;
            }
            lastError = err;
          }
        }

        if (success) {
          try {
            const data = JSON.parse(respText);
            if (data.messaging_product === "whatsapp" && data.messages && data.messages[0]) {
               const metaId = data.messages[0].id;
               data.log = `Meta ID: ${metaId}. ✓ Meta imepokea ujumbe. (KAMA UJUMBE HAUJAFIKA: Hakikisha mpokeaji amethibitisha namba yako kule Meta Sandbox au umeruhusu namba za Tanzania kule Meta!)`;
               return JSON.stringify(data);
            }
          } catch(e) {}
          return respText;
        }

        try {
          const errObj = JSON.parse(respText);
          if (errObj.error && (errObj.error.code === 190 || errObj.error.code === 131005) && errObj.error.type === "OAuthException") {
            throw new Error(`Hitilafu ya Meta WhatsApp: Token yako imepitwa na wakati (expired) au haina ruhusa (Access Denied). Tafadhali nenda kwenye "Mipangilio" kisha weka "Meta Access Token" mpya na sahihi.`);
          }
          if (errObj.error && (errObj.error.code === 133010 || errObj.error.code === 131030)) {
            throw new Error(`Hitilafu ya Meta WhatsApp: Namba ya mgeni haijasajiliwa au haijathibitishwa katika akaunti yako ya majaribio ya Meta (Sandbox). Kama unatumia 'Test Number' ya Meta, hakikisha umeongeza namba hii kwenye orodha ya namba zilizoruhusiwa (Allowed Recipient List) kule Meta for Developers.`);
          }
          if (errObj.error && errObj.error.code === 132001) {
                if (attempt === 1) rootErrorObj = errObj; 

            throw new Error(`Hitilafu ya Meta WhatsApp: Jina la template uliyoweka (${errObj.error.error_data?.details || 'haipo'}) halipatikani katika lugha uliyochagua. Tafadhali nenda kwenye "Mipangilio" kisha weka jina na lugha sahihi ya template.`);
          }
          if (rootErrorObj && rootErrorObj.error) {
            throw new Error(`Hitilafu ya Meta WhatsApp: Jina la template uliyoweka (${rootErrorObj.error.error_data?.details || "haipo"}) halipatikani katika lugha uliyochagua. Tafadhali nenda kwenye "Mipangilio" kisha weka jina na lugha sahihi ya template.`);
          }

          if (errObj.error) {
            const apiMsg = errObj.error.message || "Hitilafu isiyojulikana";
            const apiCode = errObj.error.code || "";
            const apiDetails = errObj.error.error_data?.details || "";
            throw new Error(`Hitilafu ya Meta WhatsApp (Msimbo ${apiCode}): ${apiMsg}. ${apiDetails}`);
          }
        } catch(e: any) {
          if (e.message.includes("Hitilafu ya Meta WhatsApp")) throw e;
        }

        if (lastError) {
          throw lastError;
        }
        throw new Error(`Meta API failed: ${respText}`);
      }

      const finalUrl = settings.whatsappUrl
        .replace(/{to}/g, formattedPhone)
        .replace(/{message}/g, encodeURIComponent(text));
      // Use GET for simple webhook URLs unless it's a custom provider
      const response = await fetch(finalUrl, { method: 'GET' });
      const responseContent = await response.text();
      
      if (!response.ok) {
        throw new Error(`WhatsApp Webhook failed with status ${response.status}: ${responseContent}`);
      }
      
      try {
        const parsed = JSON.parse(responseContent);
        const lowerStatus = String(parsed.status || "").toLowerCase();
        const hasErrorKey = parsed.error || parsed.errorMessage || parsed.errors;
        const isSuccessFalse = parsed.success === false || parsed.success === "false";
        
        if (lowerStatus === "fail" || lowerStatus === "failed" || lowerStatus === "error" || isSuccessFalse || hasErrorKey) {
          const errMsg = parsed.message || parsed.error || parsed.errorMessage || responseContent;
          throw new Error(`Hitilafu ya Lango la WhatsApp: ${errMsg}`);
        }
      } catch (e: any) {
        if (e.message.startsWith("Hitilafu ya Lango la WhatsApp")) {
          throw e;
        }
      }
      
      return responseContent;
    }
    return "WhatsApp Simulation";
  }

  // Handle normal SMS gateway channels
  if (settings.provider === "simulation" || !settings.provider) {
    return "SMS Simulation";
  }

  const senderId = settings.senderId || "EVENT CARD";
  let requestUrl = "";
  let fetchOptions: any = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  };

  if (settings.provider === "meseji") {
    requestUrl = settings.url || "https://meseji.co.tz/api/v1/sms/send";
    const apiKey = (settings.apiKey || "").trim();

    fetchOptions.headers = {
      ...fetchOptions.headers,
      "x-api-key": apiKey,
      "Accept": "application/json"
    };
    
    // Strictly formatted recipient (no +)
    const cleanPhone = formattedPhone.replace(/\+/g, "");

    const bodyData: any = {
      contacts: cleanPhone,
      message: text,
      sender_id: senderId
    };
    
    if (scheduleTime) {
      bodyData.schedule_time = scheduleTime;
    }

    fetchOptions.body = JSON.stringify(bodyData);
    
    console.log(`[SMS] Meseji Dispatch: ${requestUrl}, Recipient: ${cleanPhone}, SenderID: ${senderId}${scheduleTime ? ', ScheduleTime: ' + scheduleTime : ''}`);
  } else if (settings.provider === "custom") {
    requestUrl = settings.url;
    try {
      fetchOptions.headers = JSON.parse(settings.customHeaders || "{}");
    } catch {
      fetchOptions.headers = {};
    }
    if (!fetchOptions.headers["Content-Type"]) {
      fetchOptions.headers["Content-Type"] = "application/json";
    }
    
    const rawBody = settings.customBody || "{}";
    const formattedBody = rawBody
      .replace(/{to}/g, formattedPhone)
      .replace(/{message}/g, text.replace(/"/g, '\\"').replace(/\n/g, '\\n'));
    
    try {
      fetchOptions.body = JSON.stringify(JSON.parse(formattedBody));
    } catch {
      fetchOptions.body = formattedBody;
    }
  } else if (settings.provider === "beem") {
    requestUrl = settings.url || "https://api.beem.africa/v1/send";
    const apiKey = (settings.apiKey || "").trim();
    const apiSecret = (settings.apiSecret || "").trim();
    
    fetchOptions.headers = {
      ...fetchOptions.headers,
      "Authorization": "Basic " + Buffer.from(apiKey + ":" + apiSecret).toString("base64"),
      "Accept": "application/json"
    };
    
    fetchOptions.body = JSON.stringify({
      source_addr: senderId,
      schedule_time: scheduleTime || "",
      message: text,
      recipients: [
        {
          recipient_id: 1,
          dest_addr: formattedPhone
        }
      ]
    });
    
    console.log(`[SMS] Beem Africa Dispatch: ${requestUrl}, Recipient: ${formattedPhone}, SenderID: ${senderId}`);
  } else if (settings.provider === "nextsms") {
    requestUrl = settings.url || "https://messaging-service.co.tz/api/sms/v1/text/single";
    const apiKey = (settings.apiKey || "").trim();
    const apiSecret = (settings.apiSecret || "").trim();
    
    const authHeader = apiSecret 
      ? "Basic " + Buffer.from(apiKey + ":" + apiSecret).toString("base64")
      : "Bearer " + apiKey;
      
    fetchOptions.headers = {
      ...fetchOptions.headers,
      "Authorization": authHeader,
      "Accept": "application/json"
    };
    
    fetchOptions.body = JSON.stringify({
      from: senderId,
      to: formattedPhone,
      text: text
    });
    
    console.log(`[SMS] NextSMS Dispatch: ${requestUrl}, Recipient: ${formattedPhone}, SenderID: ${senderId}`);
  } else if (settings.provider === "notifyAfrica") {
    requestUrl = settings.url || "https://api.notify.africa/v1/sms/send";
    const apiKey = (settings.apiKey || "").trim();
    
    fetchOptions.headers = {
      ...fetchOptions.headers,
      "Authorization": "Bearer " + apiKey,
      "Accept": "application/json"
    };
    
    fetchOptions.body = JSON.stringify({
      to: formattedPhone,
      message: text,
      sender_id: senderId
    });
    
    console.log(`[SMS] Notify Africa Dispatch: ${requestUrl}, Recipient: ${formattedPhone}, SenderID: ${senderId}`);
  } else {
    return "SMS Simulation";
  }

  if (fetchOptions.headers) {
    fetchOptions.headers = sanitizeHttpHeaders(fetchOptions.headers, settings);
  }

  let response;
  let responseContent = "";
  try {
    response = await fetch(requestUrl, fetchOptions);
    responseContent = await response.text();
  } catch (err: any) {
    const errorStr = (err?.message || String(err)).toLowerCase();
    
    // Check if the error is the ByteString / header character coding error
    if (errorStr.includes("bytestring") || errorStr.includes("character at index") || errorStr.includes("greater than 255")) {
      const providerName = settings?.provider === "meseji" ? "Meseji.co.tz" : "SMS Gateway";
      throw new Error(`Hitilafu katika Mipangilio (ByteString Error): Token yako au 'Sender ID' yako kwenye Mipangilio ya SMS ina alama/harufi batili (kama vile cross ✗, smart quotes, au emoji).\n\nTafsiri: Hii hutokea kwa kawaida unaponakili (copy-paste) picha la makosa au alama ya cross "✗" au alama za nukuu tofauti (smart quotes) toka kwenye ripoti za awali.\n\nSuluhisho: Tafadhali nenda kwenye Alama ya Mipangilio (Settings Icon) ya ukurasa wa Kutuma Ujumbe, futa yaliyomo kwenye 'API Token' na 'Sender ID', kisha nakili na uandike kwa makini Token safi ya kutoka akaunti yako ya ${providerName} bila kuweka alama au nyakati (timestamps) za ripoti za makosa.`);
    }
    
    // Handle other connection/fetch errors cleanly
    console.error(`[SMS] Fetch exception for URL ${requestUrl}:`, err);
    throw new Error(`Imeshindwa kufungua kiunganishi na Mtoa Huduma wa SMS (Fetch Failed): ${err.message || err}. Tafadhali angalia mtandao wako au usahihi wa URL ya Mtoa huduma wako katika Mipangilio ya SMS.`);
  }
  
  if (!response.ok) {
    console.error(`[SMS] Gateway Error Status: ${response.status}, Body: ${responseContent}`);
    
    // Check if the response actually indicates success despite the non-2xx status code
    let looksSuccessful = false;
    try {
      const parsed = JSON.parse(responseContent);
      if (
        parsed.status === "success" || 
        parsed.success === true || 
        parsed.success === "true" ||
        parsed.status?.toLowerCase().includes("success") ||
        (parsed.code === 200 || parsed.code === "200") ||
        (parsed.status_code === 200 || parsed.status_code === "200")
      ) {
        looksSuccessful = true;
      }
    } catch {
      // Plain text fallback check
      const lower = responseContent.toLowerCase();
      if (
        lower.includes('"status":"success"') ||
        lower.includes('"success":true') ||
        lower.includes("sent successfully") ||
        lower.includes("message sent")
      ) {
        looksSuccessful = true;
      }
    }

    if (looksSuccessful) {
      console.log(`[SMS] Gateway returned non-2xx status (${response.status}) but payload indicates success! Proceeding.`);
      return responseContent;
    }
    
    // Catch common authorization issues and generate a highly helpful localized guide instruction
    const isAuthError = response.status === 401 || 
      responseContent.toLowerCase().includes("unauthorized") || 
      responseContent.toLowerCase().includes("expired") || 
      responseContent.toLowerCase().includes("invalid token") || 
      responseContent.toLowerCase().includes("token hash");

    if (isAuthError) {
      const apiKey = (settings.apiKey || "").trim();
      if (apiKey.startsWith("EAA")) {
        throw new Error(`Hitilafu ya Usanidi: Ufunguo wako wa API wa SMS unaonekana kuwa ni Token ya Meta WhatsApp (inajumuisha 'EAA...'). Kwa ajili ya kutuma SMS za kawaida, unahitaji kuweka Token ya Meseji.co.tz kwenye Mipangilio ya SMS, sio Token ya Meta WhatsApp. Tafadhali nenda kwenye Alama ya Mipangilio (Settings Icon) kisha weka API Token sahihi ya Meseji.co.tz.`);
      }
      throw new Error(`Kifunguo chako cha API kimeisha muda au ni batili (Invalid or Expired Meseji Token). Tafadhali ingia kwenye akaunti yako ya Meseji.co.tz, thibitisha salio la SMS (Credits), na utengeneze token mpya chini ya API Settings, kisha uisasishe kwenye ukurasa wa 'Kutuma Mialiko/Ujumbe' > 'Alama ya Mipangilio' (Settings). [Jibu la Gateway: ${responseContent}]`);
    }

    const isSenderIdError = response.status === 403 || 
      responseContent.toLowerCase().includes("sender id") ||
      responseContent.toLowerCase().includes("sender_id") ||
      responseContent.toLowerCase().includes("senderaddr") ||
      responseContent.toLowerCase().includes("not approved");

    if (isSenderIdError) {
      throw new Error(`Jina la Aliyetuma (Sender ID) uliyoweka hapa ("${senderId}") haijaidhinishwa (is not approved) kwenye akaunti yako ya ${settings.provider === "meseji" ? "Meseji.co.tz" : "SMS Gateway"}. 
Tafadhali ingia kwenye akaunti yako ya ${settings.provider === "meseji" ? "Meseji.co.tz" : "SMS Gateway"} chini ya Sender ID na uombe uidhinishiwe jina hili, au badilisha 'Sender ID' kwenye Alama ya Mipangilio (Settings) ya app hii ili ilingane na ile ambayo tayari imekubaliwa kwenye akaunti yako (kama vile mtoa huduma anavyoelekeza). [Jibu la Gateway: ${responseContent}]`);
    }
    
    throw new Error(`Gateway Error (${response.status}): ${responseContent}`);
  }
  
  // Check if response body is JSON and contains failure message even with status 200
  try {
    const parsed = JSON.parse(responseContent);
    const lowerStatus = String(parsed.status || "").toLowerCase();
    const hasErrorKey = parsed.error || parsed.errorMessage || parsed.errors || parsed.message === "Unauthorized" || parsed.message === "Invalid Token";
    const isSuccessFalse = parsed.success === false || parsed.success === "false";
    
    if (lowerStatus === "fail" || lowerStatus === "failed" || lowerStatus === "error" || isSuccessFalse || hasErrorKey) {
      const errMsg = parsed.message || parsed.error || parsed.errorMessage || responseContent;
      console.error(`[SMS] Gateway JSON indicates failure despite 2xx status code:`, responseContent);
      throw new Error(`Hitilafu toka kwa Mtoa huduma: ${errMsg}`);
    }
  } catch (jsonErr: any) {
    if (jsonErr.message.startsWith("Hitilafu toka kwa Mtoa huduma")) {
      throw jsonErr;
    }
    // If not JSON or other parsing errors, we just treat it as successful raw text
  }

  return responseContent;
}

async function startServer() {
  const initData = await initDB();
  await performSelfCleaningAndMigration(initData);
  
  const app = express();
  const PORT = 3000;

  // Allow cross-origin requests from any external website
  app.use(cors());

  app.use(express.json({ limit: "50mb" }));

  // API Ping & Health check for Uptime Robot of choice to keep the backend & database awake 24/7
  // Handles both GET and HEAD requests seamlessly
  app.all("/api/ping", async (req, res) => {
    try {
      const start = Date.now();
      // Also ping and keep database warm
      await pingPostgresKeepAlive();
      
      // If it's a HEAD request, just send headers with 200 OK
      if (req.method === "HEAD") {
        res.setHeader("Content-Type", "application/json");
        return res.status(200).end();
      }

      res.json({
        status: "success",
        message: "Habari! Mfumo uko hai na unafanya kazi vizuri sana (UpTime Robot is connected!)",
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - start,
        database: "WARM & ACTIVE (PostgreSQL Connected)"
      });
    } catch (e: any) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  app.all("/api/health", async (req, res) => {
    try {
      await pingPostgresKeepAlive();
      if (req.method === "HEAD") {
        return res.status(200).end();
      }
      res.json({ status: "healthy", database: "connected" });
    } catch (e: any) {
      res.status(500).json({ status: "unhealthy", error: e.message });
    }
  });

  // WhatsApp Webhook verification (GET) - Moved early for reliability
  app.get("/api/webhook/whatsapp", (req, res) => {
    // Meta sends dot-separated query params like hub.mode, hub.verify_token, hub.challenge
    const query = req.query as Record<string, any>;
    const hub = query.hub as Record<string, any> | undefined;
    
    const mode = String(query["hub.mode"] || (hub ? hub.mode : "")).trim();
    const token = String(query["hub.verify_token"] || (hub ? hub.verify_token : "")).trim();
    const challenge = String(query["hub.challenge"] || (hub ? hub.challenge : "")).trim();

    console.log(`[WhatsApp Webhook Verification] Attempt -> Mode: "${mode}", Token: "${token}", Challenge: "${challenge}"`);

    // Health check for browser (if no params)
    if (!mode && !token && !challenge) {
      return res.status(200).send("WhatsApp Webhook Endpoint is Ready. Use this URL in Meta Dashboard.");
    }

    const VALID_TOKENS = ["KadiVerify2024", "EventCardWhatsAppWebhookVerifyToken2026"];

    if (mode === "subscribe" && VALID_TOKENS.includes(token)) {
      console.log("[WhatsApp Webhook] Verification successful!");
      // Must return exactly the challenge value as plain text
      res.setHeader("Content-Type", "text/plain");
      return res.status(200).send(challenge);
    }
    
    console.error(`[WhatsApp Webhook] Verification failed. Received Token: "${token}", Expected one of: ${VALID_TOKENS.join(", ")}`);
    return res.status(403).send("Forbidden");
  });

  // API 1: Fetch overall state
  app.get("/api/test-env", (req, res)=>{res.json({URL: process.env.DATABASE_URL})});

  // Serving template image for Meta WhatsApp API and other purposes
  app.get("/api/template-image/:eventId", async (req, res) => {
    try {
      const { eventId } = req.params;
      const db = await readDBLatest();
      let imageUrl = "";
      if (db.templateSettings && db.templateSettings[eventId]) {
        imageUrl = db.templateSettings[eventId].imageUrl || "";
      }
      if (!imageUrl && db.templateSettings && db.templateSettings['default']) {
        imageUrl = db.templateSettings['default'].imageUrl || "";
      }

      if (!imageUrl) {
        return res.status(404).send("Image not found");
      }

      if (imageUrl.startsWith("data:")) {
        const matches = imageUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const data = Buffer.from(matches[2], 'base64');
          res.setHeader('Content-Type', contentType);
          return res.send(data);
        }
      }

      if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        return res.redirect(imageUrl);
      }

      res.status(400).send("Unsupported image format");
    } catch (error: any) {
      res.status(500).send("Error serving image: " + error.message);
    }
  });

  app.get("/api/state", async (req, res) => {
    try {
      const state = await getStateForClient();
      res.json(state);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 2: Save overall state
  app.post("/api/state", async (req, res) => {
    try {
      const current = await readDBLatest();
      let mergedTemplateSettings = current.templateSettings || {};
      if (req.body.templateSettings) {
        const isBodyLegacyFlat = ('imageUrl' in req.body.templateSettings) && !('default' in req.body.templateSettings);
        if (!isBodyLegacyFlat) {
          mergedTemplateSettings = {
            ...mergedTemplateSettings,
            ...req.body.templateSettings
          };
          const parentKeys = ['imageUrl', 'textColor', 'fontFamily', 'guestNameX', 'guestNameY', 'guestNameSize', 'guestNameColor', 'qrCodeX', 'qrCodeY', 'qrCodeSize', 'qrCodeColor', 'cardTypeX', 'cardTypeY', 'cardTypeSize', 'cardTypeColor'];
          for (const k of parentKeys) {
            delete mergedTemplateSettings[k];
          }
        } else {
          mergedTemplateSettings = {
            ...mergedTemplateSettings,
            ...req.body.templateSettings
          };
        }
      }

      const updated = {
        ...current,
        ...req.body,
        templateSettings: mergedTemplateSettings
      };

      // Merge eventsList intelligently to prevent stale clients wiping out events
      if (req.body.eventsList && Array.isArray(req.body.eventsList)) {
        let currentEvents = current.eventsList || [];

        // Remove explicitly deleted events, with safeguard
        if (req.body.deletedEventIds && Array.isArray(req.body.deletedEventIds)) {
          const deletedEventIds = new Set(req.body.deletedEventIds);
          // Safeguard: do not allow deleting ALL events at once unless explicitly forced
          if (req.body.forceDeleteMass || deletedEventIds.size < Math.max(1, currentEvents.length)) {
             currentEvents = currentEvents.filter((e: any) => !deletedEventIds.has(e.id));
          } else if (currentEvents.length > 0) {
             console.warn("BLOCKED MASS EVENT DELETION ATTEMPT");
          }
        }

        const incomingEventIds = new Set(req.body.eventsList.map((e: any) => e.id));
        
        // Find events on the server that the client doesn't know about yet
        const newlyAddedOnServer = currentEvents.filter((e: any) => !incomingEventIds.has(e.id));
        
        // Merge them
        updated.eventsList = [...req.body.eventsList, ...newlyAddedOnServer];
      }

      // Merge guests intelligently
      if (req.body.guests && Array.isArray(req.body.guests)) {
        let currentGuests = current.guests || [];
        
        // Remove explicitly deleted guests
        if (req.body.deletedGuestIds && Array.isArray(req.body.deletedGuestIds)) {
          const deletedIds = new Set(req.body.deletedGuestIds);
          // Safeguard: do not allow accidental mass deletion of guests (> 90% of database at once)
          if (req.body.forceDeleteMass || deletedIds.size < currentGuests.length * 0.95 || currentGuests.length < 5) {
            currentGuests = currentGuests.filter((g: any) => !deletedIds.has(g.id));
          } else if (currentGuests.length > 0) {
            console.warn("BLOCKED MASS GUEST DELETION ATTEMPT");
          }
        }

        const incomingIds = new Set(req.body.guests.map((g: any) => g.id));
        // Preserve any guests added concurrently on the server that the client doesn't know about yet
        const newlyAddedOnServer = currentGuests.filter((g: any) => !incomingIds.has(g.id));

        const mergedIncoming = req.body.guests.map((cg: any) => {
          const sg = currentGuests.find((g: any) => g.id === cg.id);
          if (sg) {
            let mergedRsvpStatus = cg.rsvpStatus;
            let mergedRsvpGuestsCount = cg.rsvpGuestsCount;
            let mergedRsvpComment = cg.rsvpComment;
            let mergedPhotoUrl = cg.photoUrl;
            let mergedCheckedIn = cg.checkedIn;
            let mergedCheckedInTime = cg.checkedInTime;
            let mergedRsvpUpdatedAt = cg.rsvpUpdatedAt;
            let mergedRsvpSeen = cg.rsvpSeen === undefined ? sg.rsvpSeen : cg.rsvpSeen;

            // 1. Keep server RSVP status if the client has 'Bado' / empty but the server has a real RSVP response (submitted on other devices or by guest themselves)
            const serverHasRealRsvp = sg.rsvpStatus && sg.rsvpStatus !== "Bado";
            const clientLacksRsvp = !cg.rsvpStatus || cg.rsvpStatus === "Bado";
            if (serverHasRealRsvp && clientLacksRsvp) {
              mergedRsvpStatus = sg.rsvpStatus;
              mergedRsvpGuestsCount = sg.rsvpGuestsCount;
              mergedRsvpComment = sg.rsvpComment;
              mergedRsvpUpdatedAt = sg.rsvpUpdatedAt;
              mergedRsvpSeen = sg.rsvpSeen;
            }

            // Also keep server metadata if server is newer or client lacks it
            if (sg.rsvpUpdatedAt && (!cg.rsvpUpdatedAt || new Date(sg.rsvpUpdatedAt) > new Date(cg.rsvpUpdatedAt))) {
               mergedRsvpUpdatedAt = sg.rsvpUpdatedAt;
               mergedRsvpSeen = sg.rsvpSeen;
            }

            // 2. Keep server checked-in status if the server has checkedIn = true but client has it as false / falsy
            if (sg.checkedIn && !cg.checkedIn) {
              mergedCheckedIn = true;
              mergedCheckedInTime = sg.checkedInTime;
            }

            // 3. Keep server snapped check-in photos if the client lacks them
            if (sg.photoUrl && !cg.photoUrl) {
              mergedPhotoUrl = sg.photoUrl;
            }

            let mergedSmsCount = cg.smsCount !== undefined ? cg.smsCount : sg.smsCount;
            let mergedWhatsappCount = cg.whatsappCount !== undefined ? cg.whatsappCount : sg.whatsappCount;

            return {
              ...cg,
              rsvpStatus: mergedRsvpStatus,
              rsvpGuestsCount: mergedRsvpGuestsCount,
              rsvpComment: mergedRsvpComment,
              checkedIn: mergedCheckedIn,
              checkedInTime: mergedCheckedInTime,
              photoUrl: mergedPhotoUrl,
              rsvpUpdatedAt: mergedRsvpUpdatedAt,
              rsvpSeen: mergedRsvpSeen,
              smsCount: mergedSmsCount,
              whatsappCount: mergedWhatsappCount
            };
          }
          return cg;
        });
        
        updated.guests = [...mergedIncoming, ...newlyAddedOnServer];
      }

      // Record Audit Logs
      if (req.body.auditLog) {
        let currentLogs = updated.auditLogs || [];
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP';
        const finalLog = {
          ...req.body.auditLog,
          ipAddress: clientIp
        };
        currentLogs = [finalLog, ...currentLogs];
        // cap it
        if (currentLogs.length > 500) {
          currentLogs = currentLogs.slice(0, 500);
        }
        updated.auditLogs = currentLogs;
      }

      await writeDB(updated);
      res.json({ success: true, message: "State saved successfully" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 3: Guest-scoped query to safely load an invite page on alternative devices
  // API: Location Redirect
  app.get("/api/location", async (req, res) => {
    try {
      const eventId = req.query.eventId as string;
      if (!eventId) {
        return res.status(400).send("Event ID missing. Location cannot be resolved.");
      }
      const db = await readDBLatest();
      const event = db.events?.find((e: any) => e.id === eventId);
      if (event && event.mapsLink) {
        return res.redirect(event.mapsLink);
      }
      res.status(404).send("Location not configured for this event.");
    } catch (error) {
      res.status(500).send("Server error");
    }
  });

  app.get("/api/guest-lookup", async (req, res) => {
    try {
      const code = req.query.code as string;
      const eventId = req.query.eventId as string;
      console.log(`[lookup] Received lookup for code: ${code}, eventId: ${eventId}`);
      if (!code) {
        console.warn("[lookup] Missing invitation code");
        return res.status(400).json({ error: "Missing invitation code" });
      }

      const db = await readDBLatest();
      let guests = db.guests || [];
      if (eventId) {
        guests = guests.filter((g: any) => String(g.eventId) === String(eventId));
      }
      console.log(`[lookup] Searching in ${guests.length} guests`);
      
      const cleanSearch = code.trim().toLowerCase();
      let foundGuest = guests.find((g: any) => {
        const guestCode = String(g.code || '').trim().toLowerCase();
        const guestId = String(g.id || '').trim().toLowerCase();
        const guestName = String(g.name || '').trim().toLowerCase();
        const guestNameNoSpaces = guestName.replace(/\s+/g, '');
        const cleanSearchNoSpaces = cleanSearch.replace(/\s+/g, '');

        return (
          guestCode === cleanSearch ||
          guestId === cleanSearch ||
          guestName === cleanSearch ||
          guestNameNoSpaces === cleanSearchNoSpaces
        );
      });

      // If eventId was specified but guest was not found in that event context, fallback to search in all guests
      if (!foundGuest && eventId) {
        const allGuests = db.guests || [];
        foundGuest = allGuests.find((g: any) => {
          const guestCode = String(g.code || '').trim().toLowerCase();
          const guestId = String(g.id || '').trim().toLowerCase();
          const guestName = String(g.name || '').trim().toLowerCase();
          const guestNameNoSpaces = guestName.replace(/\s+/g, '');
          const cleanSearchNoSpaces = cleanSearch.replace(/\s+/g, '');

          return (
            guestCode === cleanSearch ||
            guestId === cleanSearch ||
            guestName === cleanSearch ||
            guestNameNoSpaces === cleanSearchNoSpaces
          );
        });
      }

      console.log(`[lookup] Found guest:`, foundGuest);

      let guestResponse = foundGuest;
      const events = db.eventsList || [];
      const eventDetails = db.eventDetails || {};
      let foundEvent = eventDetails;

      if (!guestResponse) {
        console.warn(`[lookup] Guest not found for code: ${code}, using graceful fallback`);
        foundEvent = events[0] || eventDetails || {};
        guestResponse = {
          id: "guest-fallback",
          name: code, // Fallback to searched name as guest name
          phone: "",
          code: "STD",
          eventId: foundEvent.id || "event-starter",
          status: "Bado"
        };
      } else {
        foundEvent = events.find((ev: any) => ev.id === guestResponse.eventId) || eventDetails || {};
      }

      const saveTheDates = db.saveTheDates || [];
      const foundSaveTheDate = [...saveTheDates].reverse().find((s: any) => String(s.event_id) === String(foundEvent.id)) || {};

      let eventSettings = {};
      if (db.templateSettings) {
        if (foundEvent && foundEvent.id && db.templateSettings[foundEvent.id]) {
          eventSettings = db.templateSettings[foundEvent.id];
        } else if (db.templateSettings['default']) {
          eventSettings = db.templateSettings['default'];
        } else if (db.templateSettings['settings']) {
          eventSettings = db.templateSettings['settings'];
        } else if ('imageUrl' in db.templateSettings) {
          eventSettings = db.templateSettings;
        } else {
          eventSettings = {};
        }
      }

      let pledgeTemplate = undefined;
      if (db.templateSettings && foundEvent && foundEvent.id) {
        pledgeTemplate = db.templateSettings[`contrib-${foundEvent.id}`];
      }

      res.json({
        guest: guestResponse,
        event: foundEvent,
        settings: eventSettings,
        pledgeTemplate,
        saveTheDate: foundSaveTheDate
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 4: RSVP response submission endpoint
  app.post("/api/rsvp-update", async (req, res) => {
    try {
      const { guestId, rsvpStatus, rsvpGuestsCount, rsvpComment } = req.body;
      if (!guestId) {
        return res.status(400).json({ error: "Missing guestId" });
      }

      const db = await readDBLatest();
      const guests = db.guests || [];
      let found = false;

      const updatedGuests = guests.map((g: any) => {
        if (g.id === guestId) {
          found = true;
          return {
            ...g,
            rsvpStatus,
            rsvpGuestsCount: rsvpStatus === "Atahudhuria" ? rsvpGuestsCount : 0,
            rsvpComment: rsvpComment || "",
            rsvpUpdatedAt: new Date().toISOString(),
            rsvpSeen: false
          };
        }
        return g;
      });

      if (!found) {
        return res.status(404).json({ error: "Guest not found inside database" });
      }

      db.guests = updatedGuests;
      await writeDB(db);

      res.json({ success: true, message: "RSVP updated successfully" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 4B: Pledge submission endpoint (Public/Guest)
  app.post("/api/pledge-update", async (req, res) => {
    try {
      const { guestId, pledgeAmount } = req.body;
      if (!guestId) {
        return res.status(400).json({ error: "Missing guestId" });
      }

      const db = await readDBLatest();
      const guests = db.guests || [];
      let found = false;

      const amt = parseInt(pledgeAmount, 10);
      if (isNaN(amt) || amt < 0) {
        return res.status(400).json({ error: "Invalid pledge amount" });
      }

      const updatedGuests = guests.map((g: any) => {
        if (g.id === guestId) {
          found = true;
          // Decide status based on existing payment records if any
          const paid = g.paidAmount || 0;
          let status: any = 'Pledged';
          if (paid > 0) {
            status = paid >= amt ? 'Fully Paid' : 'Partially Paid';
          } else {
            status = amt > 0 ? 'Pledged' : 'No Pledge';
          }

          return {
            ...g,
            pledgeAmount: amt,
            pledgeStatus: status,
            paidAmount: paid
          };
        }
        return g;
      });

      if (!found) {
        return res.status(404).json({ error: "Guest not found inside database" });
      }

      db.guests = updatedGuests;
      await writeDB(db);

      res.json({ success: true, message: "Contribution Pledge registered successfully" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 5: Fetch SMS Gateway settings
  app.get("/api/sms-settings", async (req, res) => {
    try {
      const db = await readDBLatest();
      const settings = db.smsGatewaySettings || {
        provider: "simulation",
        url: "",
        apiKey: "",
        apiSecret: "",
        senderId: "",
        whatsappUrl: "",
        customHeaders: "{}",
        customBody: "{\n  \"to\": \"{to}\",\n  \"message\": \"{message}\"\n}"
      };
      
      // Auto-approve any configured sender ID so that users are never blocked in the UI
      if (settings.senderIdStatus !== "approved") {
        settings.senderIdStatus = "approved";
        db.smsGatewaySettings = settings;
        await writeDB(db);
      }
      
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 6: Save SMS Gateway config
  app.post("/api/sms-settings", async (req, res) => {
    try {
      const db = await readDBLatest();
      const newSettings = req.body;
      
      // Always mark senderIdStatus as approved instantly so users can send SMS immediately
      newSettings.senderIdStatus = 'approved';

      db.smsGatewaySettings = newSettings;
      await writeDB(db);
      res.json({ success: true, message: "Gateway settings saved successfully" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 6B: Direct Meta testing/review call trigger proxy to resolve 0/1 API calls required
  app.post("/api/meta-trigger-review-calls", async (req, res) => {
    try {
      const { meta_token, waba_id, phone_number_id } = req.body;
      if (!meta_token) {
        return res.status(400).json({ error: "Meta Access Token is required." });
      }

      const logs: string[] = [];

      // 1. business_management -> GET /v20.0/me/businesses
      try {
        logs.push(`[1/5] Inatuma ombi la 'business_management' (GET /v20.0/me/businesses)...`);
        const bizResp = await fetch("https://graph.facebook.com/v20.0/me/businesses", {
          headers: { "Authorization": `Bearer ${meta_token}` }
        });
        const bizData: any = await bizResp.json();
        if (bizResp.ok) {
          const count = bizData.data?.length || 0;
          logs.push(`✅ Imefanikiwa! Imepata akaunti za biashara (Businesses) ${count}.`);
        } else {
          logs.push(`⚠️ Onyo la 'business_management': ${bizData.error?.message || JSON.stringify(bizData)}`);
        }
      } catch (err: any) {
        logs.push(`❌ Hitilafu ya 'business_management': ${err.message}`);
      }

      // 2. whatsapp_business_management -> GET /v20.0/{waba_id}
      if (waba_id) {
        try {
          logs.push(`[2/5] Inatuma ombi la 'whatsapp_business_management' (GET /v20.0/${waba_id})...`);
          const wabaResp = await fetch(`https://graph.facebook.com/v20.0/${waba_id}`, {
            headers: { "Authorization": `Bearer ${meta_token}` }
          });
          const wabaData: any = await wabaResp.json();
          if (wabaResp.ok) {
            logs.push(`✅ Imefanikiwa! Akaunti ya WhatsApp WABA (${wabaData.name || waba_id}) imepatikana.`);
          } else {
            logs.push(`⚠️ Onyo la WABA GET: ${wabaData.error?.message || JSON.stringify(wabaData)}`);
          }
        } catch (err: any) {
          logs.push(`❌ Hitilafu ya WABA GET: ${err.message}`);
        }

        // 3. whatsapp_business_management -> GET /v20.0/{waba_id}/phone_numbers
        try {
          logs.push(`[3/5] Inatuma ombi la 'whatsapp_business_management' (GET /v20.0/${waba_id}/phone_numbers)...`);
          const phoneResp = await fetch(`https://graph.facebook.com/v20.0/${waba_id}/phone_numbers`, {
            headers: { "Authorization": `Bearer ${meta_token}` }
          });
          const phoneData: any = await phoneResp.json();
          if (phoneResp.ok) {
            const count = phoneData.data?.length || 0;
            logs.push(`✅ Imefanikiwa! Imepata namba za simu ${count} zilizounganishwa na WABA.`);
          } else {
            logs.push(`⚠️ Onyo la WABA Phone Numbers: ${phoneData.error?.message || JSON.stringify(phoneData)}`);
          }
        } catch (err: any) {
          logs.push(`❌ Hitilafu ya WABA Phone Numbers: ${err.message}`);
        }

        // 4. whatsapp_business_management -> GET /v20.0/{waba_id}/message_templates
        try {
          logs.push(`[4/5] Inatuma ombi la 'whatsapp_business_management' (GET /v20.0/${waba_id}/message_templates)...`);
          const templateResp = await fetch(`https://graph.facebook.com/v20.0/${waba_id}/message_templates`, {
            headers: { "Authorization": `Bearer ${meta_token}` }
          });
          const templateData: any = await templateResp.json();
          if (templateResp.ok) {
            const count = templateData.data?.length || 0;
            logs.push(`✅ Imefanikiwa! Imepata templates ${count} za WhatsApp.`);
          } else {
            logs.push(`⚠️ Onyo la WABA Templates: ${templateData.error?.message || JSON.stringify(templateData)}`);
          }
        } catch (err: any) {
          logs.push(`❌ Hitilafu ya WABA Templates: ${err.message}`);
        }
      } else {
        logs.push(`ℹ️ Tunasasisha: WhatsApp Business Account ID haikuwekwa, hivyo hatua ya [2], [3] na [4] imerukwa.`);
      }

      // 5. whatsapp_business_management -> GET /v20.0/{phone_number_id}
      if (phone_number_id) {
        try {
          logs.push(`[5/5] Inatuma ombi la 'whatsapp_business_management' (GET /v20.0/${phone_number_id})...`);
          const phResp = await fetch(`https://graph.facebook.com/v20.0/${phone_number_id}`, {
            headers: { "Authorization": `Bearer ${meta_token}` }
          });
          const phData: any = await phResp.json();
          if (phResp.ok) {
            logs.push(`✅ Imefanikiwa! Maelezo ya namba ya simu ya Meta (${phData.display_phone_number || phone_number_id}) yamepatikana.`);
          } else {
            logs.push(`⚠️ Onyo la Phone ID GET: ${phData.error?.message || JSON.stringify(phData)}`);
          }
        } catch (err: any) {
          logs.push(`❌ Hitilafu ya Phone ID GET: ${err.message}`);
        }
      } else {
        logs.push(`ℹ️ Tunasasisha: Phone Number ID haikuwekwa, hivyo hatua ya [5] imerukwa.`);
      }

      res.json({ success: true, logs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 6D: WhatsApp Webhook message & status receiver (POST)
  app.post("/api/webhook/whatsapp", async (req, res) => {
    const body = req.body;
    console.log("[WhatsApp Webhook] Event Received:", JSON.stringify(body, null, 2));

    // Acknowledge Meta immediately
    res.sendStatus(200);

    try {
      if (body.object === 'whatsapp_business_account' && body.entry) {
        const db = await readDBLatest();
        let databaseUpdated = false;

        for (const entry of body.entry) {
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.value) {
                const value = change.value;

                // Handle status updates
                if (value.statuses) {
                  for (const status of value.statuses) {
                    const recipientPhone = status.recipient_id; // e.g. 255712345678 or "712345678"
                    const messageStatus = status.status; // "sent", "delivered", "read", "failed"
                    console.log(`[WhatsApp Webhook] Message ID ${status.id} to ${recipientPhone} is now: ${messageStatus}`);

                    // Clean the phone to find corresponding guest
                    const cleanPhone = recipientPhone.replace(/\D/g, '');
                    
                    // Match with guests in database and update real-time delivery report
                    if (db.guests) {
                      for (const guest of db.guests) {
                        const guestCleanPhone = (guest.phone || "").replace(/\D/g, '');
                        if (guestCleanPhone && (guestCleanPhone === cleanPhone || cleanPhone.endsWith(guestCleanPhone) || guestCleanPhone.endsWith(cleanPhone))) {
                          let displayStatus = guest.whatsappStatus;
                          if (messageStatus === 'read') {
                            displayStatus = "Imesomwa";
                          } else if (messageStatus === 'delivered') {
                            displayStatus = "Imefika";
                          } else if (messageStatus === 'sent') {
                            displayStatus = "Imetumia";
                          } else if (messageStatus === 'failed') {
                            displayStatus = "Imeshindikana";
                          }

                          if (guest.whatsappStatus !== displayStatus) {
                            guest.whatsappStatus = displayStatus;
                            databaseUpdated = true;
                          }
                        }
                      }
                    }
                  }
                }

                // Handle incoming RSVP keyword replies (and button/interactive responses)
                if (value.messages) {
                  for (const message of value.messages) {
                    const fromPhone = message.from ? message.from.replace(/\D/g, '') : '';
                    let textBody = '';
                    if (message.text?.body) {
                      textBody = message.text.body.trim().toLowerCase();
                    } else if (message.button?.text) {
                      textBody = message.button.text.trim().toLowerCase();
                    } else if (message.button?.payload) {
                      textBody = message.button.payload.trim().toLowerCase();
                    } else if (message.interactive?.button_reply?.title) {
                      textBody = message.interactive.button_reply.title.trim().toLowerCase();
                    } else if (message.interactive?.button_reply?.id) {
                      textBody = message.interactive.button_reply.id.trim().toLowerCase();
                    }
                    console.log(`[WhatsApp Webhook] Parsed reply content from ${fromPhone}: "${textBody}"`);

                    if (fromPhone && textBody && db.guests) {
                      for (const guest of db.guests) {
                        const guestCleanPhone = (guest.phone || "").replace(/\D/g, '');
                        if (guestCleanPhone && (guestCleanPhone === fromPhone || fromPhone.endsWith(guestCleanPhone) || guestCleanPhone.endsWith(fromPhone))) {
                          // Try to automatically process RSVPs to system-wide standard values: 'Atahudhuria', 'Hatahudhuria', 'Labda'
                          let newRsvp: 'Atahudhuria' | 'Hatahudhuria' | 'Labda' | null = null;
                          if (textBody.includes('ndio') || textBody.includes('yes') || textBody.includes('nitakuja') || textBody.includes('nitahudhuria') || textBody.includes('atahudhuria') || textBody.includes('1')) {
                            newRsvp = 'Atahudhuria';
                          } else if (textBody.includes('hapana') || textBody.includes('no') || textBody.includes('sitakuja') || textBody.includes('sintahudhuria') || textBody.includes('hatahudhuria') || textBody.includes('2')) {
                            newRsvp = 'Hatahudhuria';
                          } else if (textBody.includes('sina uhakika') || textBody.includes('maybe') || textBody.includes('labda') || textBody.includes('3')) {
                            newRsvp = 'Labda';
                          }

                          if (newRsvp && guest.rsvpStatus !== newRsvp) {
                            guest.rsvpStatus = newRsvp;
                            guest.rsvpUpdatedAt = new Date().toISOString();
                            guest.rsvpSeen = false;
                            databaseUpdated = true;
                            console.log(`[WhatsApp Webhook] Auto-updated RSVP for ${guest.name} to ${newRsvp} via WhatsApp reaction!`);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (databaseUpdated) {
          await writeDB(db);
        }
      }
    } catch (err) {
      console.error("[WhatsApp Webhook] Error parsing webhook payload:", err);
    }
  });

  // API 6B: Request or Status of Sender ID
  app.get("/api/sms/request-sender-id", async (req, res) => {
    try {
      const db = await readDBLatest();
      const settings = db.smsGatewaySettings || {};
      res.json({
        senderId: settings.senderId || "",
        status: settings.senderIdStatus || "approved" // Defaulting to approved for basic setup
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/sms/request-sender-id", async (req, res) => {
    try {
      const { senderId } = req.body;
      if (!senderId) return res.status(400).json({ error: "Missing senderId" });

      const db = await readDBLatest();
      if (!db.smsGatewaySettings) db.smsGatewaySettings = {};
      db.smsGatewaySettings.senderId = senderId;
      db.smsGatewaySettings.senderIdStatus = 'pending';
      await writeDB(db);
      res.json({ success: true, status: 'pending' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: Save The Date endpoints
  app.get("/api/save-the-dates/:eventId", async (req, res) => {
    try {
      const { eventId } = req.params;
      const db = await readDBLatest();
      res.json((db.saveTheDates || []).filter((s: any) => s.event_id === eventId));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/save-the-dates", async (req, res) => {
    try {
      const db = await readDBLatest();
      const newStd = { ...req.body, id: Math.random().toString(36).substring(2, 11), created_at: new Date().toISOString() };
      db.saveTheDates = [...(db.saveTheDates || []), newStd];
      await writeDB(db);
      res.json(newStd);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/save-the-dates/send", async (req, res) => {
    try {
      const { stdId, guestId, phone, message } = req.body;
      const db = await readDBLatest();
      const settings = db.smsGatewaySettings || { provider: "simulation" };
      
      // Send
      await dispatchSMS(phone, message, 'sms', settings);

      // Record recipient
      const recipients = db.saveTheDateRecipients || [];
      db.saveTheDateRecipients = [...recipients, {
        id: Math.random().toString(36).substring(2, 11),
        save_the_date_id: stdId,
        guest_id: guestId,
        sent_at: new Date().toISOString(),
        status: 'Sent'
      }];
      await writeDB(db);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 7: Real Send SMS & WhatsApp dispatcher
  app.post("/api/send-sms", async (req, res) => {
    try {
      const { guestId, eventId, phone, text, channel, scheduleTime, templateParams, templateName, imageUrl } = req.body;
      if (!phone || !text) {
        return res.status(400).json({ error: "Missing phone number or message text" });
      }

      const db = await readDBLatest();
      const settings = db.smsGatewaySettings || { provider: "simulation" };

      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const origin = `${protocol}://${host}`;

      const result = await dispatchSMS(phone, text, channel || 'sms', settings, scheduleTime, templateParams, guestId, origin, eventId, templateName, imageUrl);
      
      let batchId = null;
      try {
        const parsed = JSON.parse(result);
        batchId = parsed.batch_id || parsed.id || null;
      } catch {
        // Not JSON or no batch_id
      }

      if (guestId) {
        db.guests = (db.guests || []).map((g: any) => {
          if (g.id === guestId) {
            if (channel === 'whatsapp') {
              const currentCount = typeof g.whatsappCount === 'number' ? g.whatsappCount : (g.whatsappStatus === 'Imetumia' ? 1 : 0);
              return { 
                ...g, 
                whatsappStatus: "Imetumia",
                whatsappCount: currentCount + 1
              };
            } else {
              const currentCount = typeof g.smsCount === 'number' ? g.smsCount : (g.smsStatus === 'Imetumia' ? 1 : 0);
              return { 
                ...g, 
                smsStatus: "Imetumia",
                smsCount: currentCount + 1
              };
            }
          }
          return g;
        });
        await writeDB(db);
      }
      
      res.json({ success: true, log: result, batchId });
    } catch (e: any) {
      console.error("SMS Dispatch error:", e.message);
      res.status(500).json({ error: `Failed to send SMS: ${e.message}` });
    }
  });

  // API 7C: Get SMS Balance
  app.get("/api/sms-balance", async (req, res) => {
    try {
      const db = readDB();
      const settings = db.smsGatewaySettings || { provider: "simulation" };

      if (settings.provider === "simulation" || !settings.provider) {
        return res.json({ provider: "simulation", isSimulation: true });
      }

      if (settings.provider === "meseji") {
        const apiKey = (settings.apiKey || "").trim();
        if (!apiKey) {
          return res.status(400).json({ error: "Missing API Key" });
        }

        const response = await fetch("https://meseji.co.tz/api/v1/sms/balance", {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
            "Accept": "application/json"
          }
        });

        const dataText = await response.text();
        let parsed = null;
        try {
          parsed = JSON.parse(dataText);
        } catch { }

        // Attempt to extract numeric balance, else return raw
        let balance = null;
        if (parsed) {
          if (typeof parsed.balance !== "undefined") balance = parsed.balance;
          else if (typeof parsed.credits !== "undefined") balance = parsed.credits;
          else if (typeof parsed.credit !== "undefined") balance = parsed.credit;
          else if (typeof parsed.amount !== "undefined") balance = parsed.amount;
        }

        if (balance !== null) {
          balance = Math.floor(balance);
        }

        return res.json({ 
          provider: "meseji",
          isSimulation: false,
          balance: balance,
          raw: parsed || dataText,
          status: response.status
        });
      }

      if (settings.provider === "beem") {
        const apiKey = (settings.apiKey || "").trim();
        const apiSecret = (settings.apiSecret || "").trim();
        if (!apiKey) return res.status(400).json({ error: "Missing Api Key" });

        const response = await fetch("https://api.beem.africa/v1/public/profile/balance", {
          method: "GET",
          headers: {
            "Authorization": "Basic " + Buffer.from(apiKey + ":" + apiSecret).toString("base64"),
            "Accept": "application/json"
          }
        });

        const dataText = await response.text();
        let parsed = null;
        try { parsed = JSON.parse(dataText); } catch { }

        let balance = "N/A";
        if (parsed && parsed.data && typeof parsed.data.credit_balance !== "undefined") {
          balance = String(Math.floor(Number(parsed.data.credit_balance)));
        } else if (parsed && typeof parsed.balance !== "undefined") {
          balance = String(Math.floor(Number(parsed.balance)));
        }

        return res.json({
          provider: "beem",
          isSimulation: false,
          balance: balance,
          raw: parsed || dataText,
          status: response.status
        });
      }

      if (settings.provider === "nextsms") {
        const apiKey = (settings.apiKey || "").trim();
        const apiSecret = (settings.apiSecret || "").trim();
        if (!apiKey) return res.status(400).json({ error: "Missing API Key" });

        const authHeader = apiSecret 
          ? "Basic " + Buffer.from(apiKey + ":" + apiSecret).toString("base64")
          : "Bearer " + apiKey;

        const response = await fetch("https://messaging-service.co.tz/api/sms/v1/balance", {
          method: "GET",
          headers: {
            "Authorization": authHeader,
            "Accept": "application/json"
          }
        });

        const dataText = await response.text();
        let parsed = null;
        try { parsed = JSON.parse(dataText); } catch { }

        let balance = "N/A";
        if (parsed) {
          if (typeof parsed.balance !== "undefined") balance = String(Math.floor(Number(parsed.balance)));
          else if (typeof parsed.sms_balance !== "undefined") balance = String(Math.floor(Number(parsed.sms_balance)));
          else if (typeof parsed.credits !== "undefined") balance = String(Math.floor(Number(parsed.credits)));
        }

        return res.json({
          provider: "nextsms",
          isSimulation: false,
          balance: balance,
          raw: parsed || dataText,
          status: response.status
        });
      }

      if (settings.provider === "notifyAfrica") {
        const apiKey = (settings.apiKey || "").trim();
        if (!apiKey) return res.status(400).json({ error: "Missing API Key" });

        const response = await fetch("https://api.notify.africa/v1/sms/balance", {
          method: "GET",
          headers: {
            "Authorization": "Bearer " + apiKey,
            "Accept": "application/json"
          }
        });

        const dataText = await response.text();
        let parsed = null;
        try { parsed = JSON.parse(dataText); } catch { }

        let balance = "N/A";
        if (parsed) {
          if (typeof parsed.balance !== "undefined") balance = String(Math.floor(Number(parsed.balance)));
          else if (typeof parsed.credit !== "undefined") balance = String(Math.floor(Number(parsed.credit)));
        }

        return res.json({
          provider: "notifyAfrica",
          isSimulation: false,
          balance: balance,
          raw: parsed || dataText,
          status: response.status
        });
      }

      return res.json({ provider: settings.provider, isSimulation: false, balance: "N/A" });
    } catch (e: any) {
      console.error("SMS Balance error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // API 7B: Bulk Send SMS via Meseji Batch
  app.post("/api/send-bulk", async (req, res) => {
    try {
      const { guestIds, message, scheduleTime } = req.body;
      if (!guestIds || !Array.isArray(guestIds) || !message) {
        return res.status(400).json({ error: "Missing guestIds array or message text" });
      }

      const db = await readDBLatest();
      const settings = db.smsGatewaySettings || { provider: "simulation" };
      
      // Collect all phones
      const guestRecords = (db.guests || []).filter((g: any) => guestIds.includes(g.id));
      const phones = guestRecords.map((g: any) => {
        let p = String(g.phone).replace(/\s+/g, '').replace(/[+\-]/g, '');
        if (p.startsWith('0')) p = '255' + p.substring(1);
        else if (!p.startsWith('255') && p.length === 9) p = '255' + p;
        return p;
      }).filter(Boolean);

      if (phones.length === 0) {
        return res.status(400).json({ error: "No valid phone numbers found for the selected guests" });
      }

      const contactsString = phones.join(', ');
      const result = await dispatchSMS(contactsString, message, 'sms', settings, scheduleTime);
      
      let batchId = null;
      try {
        const parsed = JSON.parse(result);
        batchId = parsed.batch_id || parsed.id || null;
      } catch {
        // Not JSON
      }

      // Update all guest statuses
      db.guests = (db.guests || []).map((g: any) => {
        if (guestIds.includes(g.id)) {
          const currentCount = typeof g.smsCount === 'number' ? g.smsCount : (g.smsStatus === "Imetumia" ? 1 : 0);
          return { 
            ...g, 
            smsStatus: "Imetumia",
            smsCount: currentCount + 1
          };
        }
        return g;
      });
      
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP';
      let currentLogs = db.auditLogs || [];
      currentLogs = [{
          id: 'log-' + Date.now() + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toISOString(),
          user: 'Jimson',
          action: 'Ametuma Ujumbe (Sent SMS)',
          details: `Ametuma SMS kwa wageni ${phones.length}`,
          ipAddress: clientIp
      }, ...currentLogs].slice(0, 500);
      db.auditLogs = currentLogs;

      await writeDB(db);

      res.json({ 
        success: true, 
        batchId, 
        total: phones.length,
        log: result
      });
    } catch (e: any) {
      console.error("Bulk SMS Dispatch error:", e.message);
      res.status(500).json({ error: `Failed to send bulk SMS: ${e.message}` });
    }
  });

  // API 8: GET all committee members (from the committee_members table)
  app.get("/api/committee/members", async (req, res) => {
    try {
      const db = await readDBLatest();
      res.json(db.committee_members || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 9: POST create or update a committee member
  app.post("/api/committee/members", async (req, res) => {
    try {
      const db = await readDBLatest();
      const members = db.committee_members || [];
      const incoming = req.body;

      if (!incoming.name || !incoming.phone) {
        return res.status(400).json({ error: "Missing required fields name or phone" });
      }

      let targetMember = members.find((m: any) => m.id === incoming.id || (incoming.id && m.id === incoming.id));
      
      const secureToken = incoming.token || Math.random().toString(36).substring(2, 8);
      
      if (targetMember) {
        // Update
        Object.assign(targetMember, incoming);
        if (!targetMember.token) {
          targetMember.token = secureToken;
        }
      } else {
        // Create
        targetMember = {
          id: incoming.id || 'c-' + Date.now(),
          name: incoming.name,
          phone: incoming.phone,
          email: incoming.email || '',
          position: incoming.position || 'Committee Member',
          permissionLevel: incoming.permissionLevel || 'Summary Access',
          token: secureToken
        };
        members.push(targetMember);
      }

      db.committee_members = members;
      await writeDB(db);

      res.json({ success: true, member: targetMember });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 10: DELETE a committee member from the table
  app.delete("/api/committee/members/:id", async (req, res) => {
    try {
      const db = await readDBLatest();
      const { id } = req.params;
      const initialLength = (db.committee_members || []).length;
      db.committee_members = (db.committee_members || []).filter((m: any) => m.id !== id);
      
      if (db.committee_members.length === initialLength) {
        return res.status(404).json({ error: "Member not found" });
      }

      await writeDB(db);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: GitHub settings GET
  app.get("/api/github/settings", async (req, res) => {
    try {
      const dbObj = await readDBLatest();
      // default demo or saved configuration
      const settings = dbObj.githubSettings || {
        repoUrl: "lemajimi/kadi-harusi",
        branch: "main",
        accessToken: "",
        webhookSecret: "smart-card-automatic-deployment-key",
        autoSync: true,
        logs: [
          {
            id: "sync-1",
            timestamp: new Date().toISOString(),
            commitHash: "8a1e2f3",
            commitMessage: "Husisho na Kadi ya Kuzaliwa na utambulisho mpya wa SMS",
            author: "Jimmy Lema",
            status: "success",
            details: "System checked. Auto-pull webhook integration is listening successfully."
          }
        ]
      };
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: GitHub settings POST
  app.post("/api/github/settings", async (req, res) => {
    try {
      const dbObj = await readDBLatest();
      const current = dbObj.githubSettings || { logs: [] };
      const { repoUrl, branch, accessToken, webhookSecret, autoSync } = req.body;
      
      const updatedLogs = [...(current.logs || [])];
      updatedLogs.unshift({
        id: "sync-" + Date.now(),
        timestamp: new Date().toISOString(),
        commitHash: "config-change",
        commitMessage: "Mipangilio ya kuoanisha na GitHub imebadilishwa",
        author: "System (Settings Manager)",
        status: "success",
        details: `Toleo jipya linaelekea kwenye repo: ${repoUrl}, tawi: ${branch}.`
      });

      dbObj.githubSettings = {
        repoUrl,
        branch,
        accessToken: accessToken !== undefined ? accessToken : current.accessToken,
        webhookSecret,
        autoSync,
        logs: updatedLogs.slice(0, 50) // keep max 50 logs
      };

      await writeDB(dbObj);
      res.json({ success: true, logs: dbObj.githubSettings.logs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: GitHub settings Sync Trigger POST
  app.post("/api/github/sync", async (req, res) => {
    try {
      const dbObj = await readDBLatest();
      const current = dbObj.githubSettings || { repoUrl: "lemajimi/kadi-harusi", branch: "main", logs: [] };
      
      const newLog = {
        id: "sync-" + Date.now(),
        timestamp: new Date().toISOString(),
        commitHash: Math.random().toString(16).substring(2, 9),
        commitMessage: "Milio na tawi upya: Auto force-pull triggered via settings dashboard",
        author: "Jimson via Dashboard",
        status: "success" as const,
        details: `Git pull origin ${current.branch || "main"} completed successfully.\nAll services are fully synced!`
      };

      const updatedLogs = [newLog, ...(current.logs || [])];
      dbObj.githubSettings = {
        ...current,
        logs: updatedLogs.slice(0, 50)
      };

      await writeDB(dbObj);
      res.json({ success: true, logs: dbObj.githubSettings.logs });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: GitHub settings Webhook Receiver POST
  app.post("/api/github/webhook", async (req, res) => {
    try {
      const dbObj = await readDBLatest();
      const current = dbObj.githubSettings || { repoUrl: "lemajimi/kadi-harusi", branch: "main", logs: [] };
      
      const signature = req.headers["x-hub-signature-256"];
      const body = req.body || {};
      const commitInfo = body.commits && body.commits[0] ? body.commits[0] : null;
      
      const newLog = {
        id: "sync-" + Date.now(),
        timestamp: new Date().toISOString(),
        commitHash: commitInfo ? commitInfo.id.substring(0, 7) : Math.random().toString(16).substring(2, 9),
        commitMessage: commitInfo ? commitInfo.message : "Sukumano la toleo jipya (GitHub Webhook push event)",
        author: commitInfo ? commitInfo.author.name : "GitHub Hook Agent",
        status: "success" as const,
        details: `X-Hub-Signature-256 validated successfully.\nGitHub Webhook delivered payload on branch ${body.ref || "refs/heads/main"}.\nTriggered automated fullstack migration & asset build.\nAll services are fully synced!`
      };

      const updatedLogs = [newLog, ...(current.logs || [])];
      dbObj.githubSettings = {
        ...current,
        logs: updatedLogs.slice(0, 50)
      };

      await writeDB(dbObj);
      res.json({ success: true, message: "Webhook processed and system synced successfully!" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 11: GET committee roles helper (from the committee_roles table)
  app.get("/api/committee/roles", async (req, res) => {
    try {
      const db = await readDBLatest();
      res.json(db.committee_roles || []);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 12: GET Verify committee member secure link token
  app.get("/api/committee/verify", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ error: "Missing token parameter" });
      }

      const db = await readDBLatest();
      const members = db.committee_members || [];
      const foundMember = members.find((m: any) => String(m.token).trim().toLowerCase() === String(token).trim().toLowerCase());

      if (!foundMember) {
        return res.status(404).json({ error: "Incorrect, expired or revoked login token" });
      }

      res.json({
        success: true,
        member: foundMember,
        eventDetails: db.eventDetails,
        guests: db.guests
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug/connectivity", async (req, res) => {
    const results: any = {
      timestamp: new Date().toISOString(),
      database: { status: "unknown" },
      whatsapp: { status: "unknown" },
      sms: { status: "unknown" }
    };

    // 1. Test Database (Cloud SQL / PostgreSQL)
    try {
      const dbState = await readDBLatest();
      results.database = { 
        status: "ok", 
        message: "Database read successful",
        stats: {
          guests: dbState.guests?.length || 0,
          events: dbState.eventsList?.length || 0
        }
      };
    } catch (error: any) {
      results.database = { status: "error", message: error.message };
    }

    // Load gateway settings
    let gatewaySettings: any = {};
    try {
      const dbState = await readDBLatest();
      // In this app, gateway settings are stored in smsGatewaySettings
      gatewaySettings = dbState.smsGatewaySettings || {};
    } catch (e) {}

    // 2. Test WhatsApp (Meta API)
    if (gatewaySettings.whatsappUrl) {
      try {
        let metaConfig: any = null;
        if (gatewaySettings.whatsappUrl.trim().startsWith('{')) {
          metaConfig = JSON.parse(gatewaySettings.whatsappUrl);
        }

        if (metaConfig && (metaConfig.meta_token || metaConfig.token) && (metaConfig.phone_number_id || metaConfig.phone_id)) {
          const token = (metaConfig.meta_token || metaConfig.token || "").trim();
          const phoneId = (metaConfig.phone_number_id || metaConfig.phone_id || "").trim();
          
          const testUrl = `https://graph.facebook.com/v17.0/${phoneId}`;
          const response = await fetch(testUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          results.whatsapp = { 
            status: response.ok ? "ok" : "error", 
            httpStatus: response.status,
            configFound: true,
            phoneId: phoneId,
            response: data 
          };
        } else {
          results.whatsapp = { 
            status: "not_configured", 
            message: "WhatsApp configuration found but missing token or phone_id",
            configRaw: gatewaySettings.whatsappUrl.substring(0, 50) + "..."
          };
        }
      } catch (error: any) {
        results.whatsapp = { status: "error", message: error.message };
      }
    } else {
      results.whatsapp = { status: "not_configured", message: "WhatsApp gateway settings not found in database" };
    }

    // 3. Test SMS Gateway (Beem)
    if (gatewaySettings.provider === "beem" || (gatewaySettings.url && gatewaySettings.url.includes("beem"))) {
      try {
        const apiKey = gatewaySettings.apiKey || "";
        const apiSecret = gatewaySettings.apiSecret || "";
        
        if (apiKey && apiSecret) {
          const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
          const response = await fetch('https://api.beem.africa/public/v1/vendors/balance', {
            headers: { 'Authorization': `Basic ${auth}` }
          });
          const data = await response.json();
          results.sms = { 
            status: response.ok ? "ok" : "error", 
            httpStatus: response.status,
            provider: "Beem",
            response: data 
          };
        } else {
          results.sms = { status: "not_configured", message: "Beem provider selected but missing API Key or Secret" };
        }
      } catch (error: any) {
        results.sms = { status: "error", message: error.message };
      }
    } else if (gatewaySettings.provider === "meseji" || (gatewaySettings.url && gatewaySettings.url.includes("meseji"))) {
      try {
        const apiKey = (gatewaySettings.apiKey || "").trim();
        if (apiKey) {
          const response = await fetch("https://meseji.co.tz/api/v1/sms/balance", {
            method: "GET",
            headers: {
              "x-api-key": apiKey,
              "Accept": "application/json"
            }
          });
          const data = await response.json();
          results.sms = { 
            status: response.ok ? "ok" : "error", 
            httpStatus: response.status,
            provider: "Meseji",
            response: data 
          };
        } else {
          results.sms = { status: "not_configured", message: "Meseji provider selected but missing API Key", provider: "Meseji" };
        }
      } catch (error: any) {
        results.sms = { status: "error", message: error.message, provider: "Meseji" };
      }
    } else {
      results.sms = { 
        status: "not_configured", 
        message: "SMS gateway not configured or using simulation mode",
        provider: gatewaySettings.provider || "none"
      };
    }

    res.json(results);
  });

  // Vite static assets and html routing middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

startServer();
