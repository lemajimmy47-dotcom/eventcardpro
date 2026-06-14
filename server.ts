import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initDB, readDB, writeDB, fetchFromFirestore, updateMemoryAndLocalFileOnly, getStateForClient, readDBLatest } from "./src/firebase-db";

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

async function dispatchSMS(phone: string, text: string, channel: 'sms' | 'whatsapp', settings: any, scheduleTime?: string) {
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
      const finalUrl = settings.whatsappUrl
        .replace(/{to}/g, formattedPhone)
        .replace(/{message}/g, encodeURIComponent(text));
      // Use GET for simple webhook URLs unless it's a custom provider
      const response = await fetch(finalUrl, { method: 'GET' });
      return await response.text();
    }
    return "WhatsApp Simulation";
  }

  // Handle normal SMS gateway channels
  if (settings.provider === "simulation" || !settings.provider) {
    return "SMS Simulation";
  }

  const senderId = settings.senderId || "EVENTCARD";
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

  const response = await fetch(requestUrl, fetchOptions);
  const responseContent = await response.text();
  
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
      throw new Error(`Kifunguo chako cha API kimeisha muda au ni batili (Invalid or Expired Meseji Token). Tafadhali ingia kwenye akaunti yako ya Meseji.co.tz, thibitisha salio la SMS (Credits), na utengeneze token mpya chini ya API Settings, kisha uisasishe kwenye ukurasa wa 'Kutuma Mialiko/Ujumbe' > 'Alama ya Mipangilio' (Settings). [Jibu la Gateway: ${responseContent}]`);
    }
    
    throw new Error(`Gateway Error (${response.status}): ${responseContent}`);
  }
  return responseContent;
}

async function startServer() {
  const initData = await initDB();
  await performSelfCleaningAndMigration(initData);
  
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API 1: Fetch overall state
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
      const { guestId, phone, text, channel, scheduleTime } = req.body;
      if (!phone || !text) {
        return res.status(400).json({ error: "Missing phone number or message text" });
      }

      const db = await readDBLatest();
      const settings = db.smsGatewaySettings || { provider: "simulation" };

      const result = await dispatchSMS(phone, text, channel || 'sms', settings, scheduleTime);
      
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
          user: 'Admin',
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
