import { db } from "./index.ts";
import * as schema from "./schema.ts";
import { eq, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "database.json");

// Robust Error Handling Wrappers
async function executeQuery<T>(label: string, queryFn: () => Promise<T>): Promise<T> {
  try {
    return await queryFn();
  } catch (error) {
    console.error(`[CloudSQL Error] ${label} failed:`, error);
    throw new Error(`Database operation '${label}' failed. Please try again later.`, { cause: error });
  }
}

// 1. One-time Boot Seeder / Backup File Importer
export async function seedFromBackupFile(): Promise<boolean> {
  return await executeQuery("seedFromBackupFile", async () => {
    // Check if events or guests are already populated
    const eventCount = await db.select({ count: sql<number>`count(*)` }).from(schema.events);
    const guestCount = await db.select({ count: sql<number>`count(*)` }).from(schema.guests);
    
    const countEvents = Number(eventCount[0]?.count || 0);
    const countGuests = Number(guestCount[0]?.count || 0);
    
    if (countEvents > 0 || countGuests > 0) {
      console.log(`[SQL Seeder] Tables are already populated (events: ${countEvents}, guests: ${countGuests}). Skipping migration.`);
      return false;
    }

    if (!fs.existsSync(DB_PATH)) {
      console.log("[SQL Seeder] No database.json backup found to migrate.");
      return false;
    }

    console.log("[SQL Seeder] Scanning database.json data for importing into Cloud SQL Postgres...");
    const rawData = fs.readFileSync(DB_PATH, "utf-8");
    const backup = JSON.parse(rawData);

    // Seed Events
    if (backup.eventsList && Array.isArray(backup.eventsList)) {
      console.log(`[SQL Seeder] Importing ${backup.eventsList.length} events...`);
      for (const ev of backup.eventsList) {
        if (!ev.id) continue;
        await db.insert(schema.events).values({
          id: String(ev.id),
          senderId: ev.senderId ? String(ev.senderId) : null,
          name: String(ev.name || "Sherehe"),
          date: ev.date ? String(ev.date) : null,
          time: ev.time ? String(ev.time) : null,
          period: ev.period ? String(ev.period) : null,
          eventHallName: ev.eventHallName ? String(ev.eventHallName) : null,
          coordinates: ev.coordinates ? String(ev.coordinates) : null,
          hostName: ev.hostName ? String(ev.hostName) : null,
          dressCode: ev.dressCode ? String(ev.dressCode) : null,
          contact1: ev.contact1 ? String(ev.contact1) : null,
          contact1Name: ev.contact1Name ? String(ev.contact1Name) : null,
          contact2: ev.contact2 ? String(ev.contact2) : null,
          contact2Name: ev.contact2Name ? String(ev.contact2Name) : null,
          contact3: ev.contact3 ? String(ev.contact3) : null,
          contact3Name: ev.contact3Name ? String(ev.contact3Name) : null,
          mapsLink: ev.mapsLink ? String(ev.mapsLink) : null,
          eventImgUrl: ev.eventImgUrl ? String(ev.eventImgUrl) : null,
          messageLogs: ev.messageLogs || null,
          contributionsEnabled: ev.contributionsEnabled === true,
          fundraisingGoal: typeof ev.fundraisingGoal === "number" ? ev.fundraisingGoal : 0,
          autoRsvpRemindersEnabled: ev.autoRsvpRemindersEnabled === true,
        }).onConflictDoNothing();
      }
    }

    // Fallback: Check active event details if eventsList is empty
    if (backup.eventDetails && backup.eventDetails.id) {
      const ed = backup.eventDetails;
      console.log(`[SQL Seeder] Importing active event Details: ${ed.name}...`);
      await db.insert(schema.events).values({
        id: String(ed.id),
        senderId: ed.senderId ? String(ed.senderId) : null,
        name: String(ed.name || "Sherehe"),
        date: ed.date ? String(ed.date) : null,
        time: ed.time ? String(ed.time) : null,
        period: ed.period ? String(ed.period) : null,
        eventHallName: ed.eventHallName ? String(ed.eventHallName) : null,
        coordinates: ed.coordinates ? String(ed.coordinates) : null,
        hostName: ed.hostName ? String(ed.hostName) : null,
        dressCode: ed.dressCode ? String(ed.dressCode) : null,
        contact1: ed.contact1 ? String(ed.contact1) : null,
        contact1Name: ed.contact1Name ? String(ed.contact1Name) : null,
        contact2: ed.contact2 ? String(ed.contact2) : null,
        contact2Name: ed.contact2Name ? String(ed.contact2Name) : null,
        contact3: ed.contact3 ? String(ed.contact3) : null,
        contact3Name: ed.contact3Name ? String(ed.contact3Name) : null,
        mapsLink: ed.mapsLink ? String(ed.mapsLink) : null,
        eventImgUrl: ed.eventImgUrl ? String(ed.eventImgUrl) : null,
        messageLogs: ed.messageLogs || null,
        contributionsEnabled: ed.contributionsEnabled === true,
        fundraisingGoal: typeof ed.fundraisingGoal === "number" ? ed.fundraisingGoal : 0,
        autoRsvpRemindersEnabled: ed.autoRsvpRemindersEnabled === true,
      }).onConflictDoNothing();
    }

    // Seed Guests
    if (backup.guests && Array.isArray(backup.guests)) {
      console.log(`[SQL Seeder] Importing ${backup.guests.length} guests...`);
      for (const g of backup.guests) {
        if (!g.id) continue;
        await db.insert(schema.guests).values({
          id: String(g.id),
          eventId: g.eventId ? String(g.eventId) : null,
          code: String(g.code || "REG"),
          name: String(g.name || ""),
          phone: String(g.phone || ""),
          cardType: String(g.cardType || "UNCLASSIFIED"),
          smsStatus: String(g.smsStatus || "Sijatuma"),
          whatsappStatus: String(g.whatsappStatus || "Sijatuma"),
          rsvpStatus: String(g.rsvpStatus || "Bado"),
          rsvpGuestsCount: typeof g.rsvpGuestsCount === "number" ? g.rsvpGuestsCount : 0,
          rsvpComment: g.rsvpComment ? String(g.rsvpComment) : null,
          checkedIn: g.checkedIn === true,
          checkedInTime: g.checkedInTime ? String(g.checkedInTime) : null,
          photoUrl: g.photoUrl ? String(g.photoUrl) : null,
          cardImageUrl: g.cardImageUrl ? String(g.cardImageUrl) : null,
          smsCount: typeof g.smsCount === "number" ? g.smsCount : 0,
          whatsappCount: typeof g.whatsappCount === "number" ? g.whatsappCount : 0,
          category: g.category ? String(g.category) : null,
          pledgeAmount: typeof g.pledgeAmount === "number" ? g.pledgeAmount : 0,
          paidAmount: typeof g.paidAmount === "number" ? g.paidAmount : 0,
          pledgeStatus: String(g.pledgeStatus || "No Pledge"),
          payments: g.payments || null,
          rsvpUpdatedAt: g.rsvpUpdatedAt ? String(g.rsvpUpdatedAt) : null,
          rsvpSeen: g.rsvpSeen !== false,
        }).onConflictDoNothing();
      }
    }

    // Seed SaveTheDates
    if (backup.saveTheDates && Array.isArray(backup.saveTheDates)) {
      console.log(`[SQL Seeder] Importing ${backup.saveTheDates.length} save the date templates...`);
      for (const s of backup.saveTheDates) {
        if (!s.id) continue;
        await db.insert(schema.saveTheDates).values({
          id: String(s.id),
          eventId: s.event_id ? String(s.event_id) : null,
          title: String(s.title || ""),
          message: String(s.message || ""),
          imageUrl: s.image_url ? String(s.image_url) : null,
          createdAt: s.created_at ? String(s.created_at) : null,
        }).onConflictDoNothing();
      }
    }

    // Seed Recipients
    if (backup.saveTheDateRecipients && Array.isArray(backup.saveTheDateRecipients)) {
      console.log(`[SQL Seeder] Importing ${backup.saveTheDateRecipients.length} recipients...`);
      for (const r of backup.saveTheDateRecipients) {
        if (!r.id) continue;
        await db.insert(schema.saveTheDateRecipients).values({
          id: String(r.id),
          saveTheDateId: r.save_the_date_id ? String(r.save_the_date_id) : null,
          guestId: r.guest_id ? String(r.guest_id) : null,
          sentAt: r.sent_at ? String(r.sent_at) : null,
          status: String(r.status || "Pending"),
        }).onConflictDoNothing();
      }
    }

    // Seed Template Settings
    if (backup.templateSettings && typeof backup.templateSettings === "object") {
      console.log(`[SQL Seeder] Importing template settings...`);
      for (const [key, t] of Object.entries(backup.templateSettings)) {
        if (!t || typeof t !== "object") continue;
        const tsObj = t as any;
        await db.insert(schema.templateSettings).values({
          id: String(key),
          imageUrl: String(tsObj.imageUrl || ""),
          textColor: tsObj.textColor ? String(tsObj.textColor) : "#333333",
          fontFamily: tsObj.fontFamily ? String(tsObj.fontFamily) : "Inter",
          guestNameX: typeof tsObj.guestNameX === "number" ? tsObj.guestNameX : 50,
          guestNameY: typeof tsObj.guestNameY === "number" ? tsObj.guestNameY : 50,
          guestNameSize: typeof tsObj.guestNameSize === "number" ? tsObj.guestNameSize : 24,
          guestNameColor: tsObj.guestNameColor ? String(tsObj.guestNameColor) : null,
          qrCodeX: typeof tsObj.qrCodeX === "number" ? tsObj.qrCodeX : 50,
          qrCodeY: typeof tsObj.qrCodeY === "number" ? tsObj.qrCodeY : 70,
          qrCodeSize: typeof tsObj.qrCodeSize === "number" ? tsObj.qrCodeSize : 120,
          qrCodeColor: tsObj.qrCodeColor ? String(tsObj.qrCodeColor) : null,
          cardTypeX: typeof tsObj.cardTypeX === "number" ? tsObj.cardTypeX : 50,
          cardTypeY: typeof tsObj.cardTypeY === "number" ? tsObj.cardTypeY : 25,
          cardTypeSize: typeof tsObj.cardTypeSize === "number" ? tsObj.cardTypeSize : 16,
          cardTypeColor: tsObj.cardTypeColor ? String(tsObj.cardTypeColor) : null,
        }).onConflictDoNothing();
      }
    }

    // Seed SMS Gateway Settings
    if (backup.smsGatewaySettings && typeof backup.smsGatewaySettings === "object") {
      console.log(`[SQL Seeder] Importing SMS Gateway Settings...`);
      const s = backup.smsGatewaySettings;
      await db.insert(schema.smsGatewaySettings).values({
        id: "settings",
        provider: s.provider ? String(s.provider) : "simulation",
        url: s.url ? String(s.url) : null,
        apiKey: s.apiKey ? String(s.apiKey) : null,
        apiSecret: s.apiSecret ? String(s.apiSecret) : null,
        senderId: s.senderId ? String(s.senderId) : null,
        senderIdStatus: s.senderIdStatus ? String(s.senderIdStatus) : "approved",
        whatsappUrl: s.whatsappUrl ? String(s.whatsappUrl) : null,
        customHeaders: s.customHeaders ? String(s.customHeaders) : "{}",
        customBody: s.customBody ? String(s.customBody) : "{}",
      }).onConflictDoNothing();
    }

    // Seed Committee Members
    if (backup.committee_members && Array.isArray(backup.committee_members)) {
      console.log(`[SQL Seeder] Importing ${backup.committee_members.length} committee members...`);
      for (const m of backup.committee_members) {
        if (!m.id) continue;
        await db.insert(schema.committeeMembers).values({
          id: String(m.id),
          name: String(m.name || ""),
          phone: String(m.phone || ""),
          email: m.email ? String(m.email) : null,
          position: m.position ? String(m.position) : "Committee Member",
          permissionLevel: m.permissionLevel ? String(m.permissionLevel) : "Summary Access",
          token: m.token ? String(m.token) : null,
        }).onConflictDoNothing();
      }
    }

    // Seed Committee Roles
    if (backup.committee_roles && Array.isArray(backup.committee_roles)) {
      console.log(`[SQL Seeder] Importing ${backup.committee_roles.length} roles...`);
      for (const r of backup.committee_roles) {
        if (!r.id) continue;
        await db.insert(schema.committeeRoles).values({
          id: String(r.id),
          name: String(r.name || ""),
          permissionLevel: String(r.permissionLevel || ""),
          description: r.description ? String(r.description) : null,
        }).onConflictDoNothing();
      }
    }

    // Seed Audit Logs
    if (backup.auditLogs && Array.isArray(backup.auditLogs)) {
      console.log(`[SQL Seeder] Importing ${backup.auditLogs.length} audit logs...`);
      for (const l of backup.auditLogs) {
        if (!l.id) continue;
        await db.insert(schema.auditLogs).values({
          id: String(l.id),
          timestamp: String(l.timestamp || new Date().toISOString()),
          user: String(l.user || "System"),
          action: String(l.action || ""),
          details: String(l.details || ""),
          ipAddress: l.ipAddress ? String(l.ipAddress) : null,
        }).onConflictDoNothing();
      }
    }

    // Seed User Account
    if (backup.userAccount && typeof backup.userAccount === "object") {
      console.log(`[SQL Seeder] Importing User Account...`);
      const u = backup.userAccount;
      await db.insert(schema.userAccount).values({
        id: "account",
        username: u.username ? String(u.username) : null,
        phone: u.phone ? String(u.phone) : null,
        email: u.email ? String(u.email) : null,
        walletBalance: typeof u.walletBalance === "number" ? u.walletBalance : 0,
        transactions: u.transactions || null,
      }).onConflictDoNothing();
    }

    console.log("[SQL Seeder] SQLite / JSON Database backup has been fully imported into Cloud SQL PostgreSQL.");
    return true;
  });
}

// 2. State Reconstruction function
export async function fetchFullStateFromDB(): Promise<any> {
  return await executeQuery("fetchFullStateFromDB", async () => {
    // Load lists from PostgreSQL
    const sqlEvents = await db.select().from(schema.events);
    const sqlGuests = await db.select().from(schema.guests);
    const sqlSaveTheDates = await db.select().from(schema.saveTheDates);
    const sqlRecipients = await db.select().from(schema.saveTheDateRecipients);
    const sqlTemplates = await db.select().from(schema.templateSettings);
    const sqlSmsSettings = await db.select().from(schema.smsGatewaySettings);
    const sqlCommitteeMembers = await db.select().from(schema.committeeMembers);
    const sqlCommitteeRoles = await db.select().from(schema.committeeRoles);
    const sqlAuditLogs = await db.select().from(schema.auditLogs);
    const sqlUserAcc = await db.select().from(schema.userAccount);

    // Reconstruct lists and nested formats
    const eventsList = sqlEvents.map(e => ({
      id: e.id,
      senderId: e.senderId || "",
      name: e.name,
      date: e.date || "",
      time: e.time || "",
      period: e.period || "Jioni",
      eventHallName: e.eventHallName || "",
      coordinates: e.coordinates || "",
      hostName: e.hostName || "",
      dressCode: e.dressCode || "",
      contact1: e.contact1 || "",
      contact1Name: e.contact1Name || "",
      contact2: e.contact2 || "",
      contact2Name: e.contact2Name || "",
      contact3: e.contact3 || "",
      contact3Name: e.contact3Name || "",
      mapsLink: e.mapsLink || "",
      eventImgUrl: e.eventImgUrl || "",
      messageLogs: e.messageLogs || [],
      contributionsEnabled: e.contributionsEnabled || false,
      fundraisingGoal: e.fundraisingGoal || 0,
      autoRsvpRemindersEnabled: e.autoRsvpRemindersEnabled || false,
    }));

    // Find active event details (last edited or event-starter, or the first event in list)
    const eventDetailsObj = eventsList.find(e => e.id !== "event-starter") || eventsList[0] || {};

    const guests = sqlGuests.map(g => ({
      id: g.id,
      eventId: g.eventId || "",
      code: g.code,
      name: g.name,
      phone: g.phone,
      cardType: g.cardType,
      smsStatus: g.smsStatus || "Sijatuma",
      whatsappStatus: g.whatsappStatus || "Sijatuma",
      rsvpStatus: g.rsvpStatus || "Bado",
      rsvpGuestsCount: g.rsvpGuestsCount || 0,
      rsvpComment: g.rsvpComment || "",
      checkedIn: g.checkedIn || false,
      checkedInTime: g.checkedInTime || "",
      photoUrl: g.photoUrl || "",
      cardImageUrl: g.cardImageUrl || "",
      smsCount: g.smsCount || 0,
      whatsappCount: g.whatsappCount || 0,
      category: g.category || "",
      pledgeAmount: g.pledgeAmount || 0,
      paidAmount: g.paidAmount || 0,
      pledgeStatus: g.pledgeStatus || "No Pledge",
      payments: g.payments || [],
      rsvpUpdatedAt: g.rsvpUpdatedAt || "",
      rsvpSeen: g.rsvpSeen !== false,
    }));

    const saveTheDates = sqlSaveTheDates.map(s => ({
      id: s.id,
      event_id: s.eventId || "",
      title: s.title,
      message: s.message,
      image_url: s.imageUrl || "",
      created_at: s.createdAt || "",
    }));

    const saveTheDateRecipients = sqlRecipients.map(r => ({
      id: r.id,
      save_the_date_id: r.saveTheDateId || "",
      guest_id: r.guestId || "",
      sent_at: r.sentAt || "",
      status: r.status || "Pending",
    }));

    // ReconstructtemplateSettings map
    const templateSettingsMap: any = {};
    for (const t of sqlTemplates) {
      templateSettingsMap[t.id] = {
        imageUrl: t.imageUrl,
        textColor: t.textColor || "#333333",
        fontFamily: t.fontFamily || "Inter",
        guestNameX: t.guestNameX || 50,
        guestNameY: t.guestNameY || 50,
        guestNameSize: t.guestNameSize || 24,
        guestNameColor: t.guestNameColor || undefined,
        qrCodeX: t.qrCodeX || 50,
        qrCodeY: t.qrCodeY || 70,
        qrCodeSize: t.qrCodeSize || 120,
        qrCodeColor: t.qrCodeColor || undefined,
        cardTypeX: t.cardTypeX || 50,
        cardTypeY: t.cardTypeY || 25,
        cardTypeSize: t.cardTypeSize || 16,
        cardTypeColor: t.cardTypeColor || undefined,
      };
    }

    const firstSms = sqlSmsSettings[0];
    const smsGatewaySettings = firstSms ? {
      provider: firstSms.provider || "simulation",
      url: firstSms.url || "",
      apiKey: firstSms.apiKey || "",
      apiSecret: firstSms.apiSecret || "",
      senderId: firstSms.senderId || "",
      senderIdStatus: firstSms.senderIdStatus || "approved",
      whatsappUrl: firstSms.whatsappUrl || "",
      customHeaders: firstSms.customHeaders || "{}",
      customBody: firstSms.customBody || "{\n  \"to\": \"{to}\",\n  \"message\": \"{message}\"\n}",
    } : {
      provider: "simulation",
      url: "",
      apiKey: "",
      apiSecret: "",
      senderId: "",
      senderIdStatus: "approved",
      whatsappUrl: "",
      customHeaders: "{}",
      customBody: "{\n  \"to\": \"{to}\",\n  \"message\": \"{message}\"\n}",
    };

    const committee_members = sqlCommitteeMembers.map(m => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      email: m.email || "",
      position: m.position || "Committee Member",
      permissionLevel: m.permissionLevel || "Summary Access",
      token: m.token || "",
    }));

    const committee_roles = sqlCommitteeRoles.map(r => ({
      id: r.id,
      name: r.name,
      permissionLevel: r.permissionLevel,
      description: r.description || "",
    }));

    const auditLogs = sqlAuditLogs.map(l => ({
      id: l.id,
      timestamp: l.timestamp,
      user: l.user,
      action: l.action,
      details: l.details,
      ipAddress: l.ipAddress || "",
    })).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const rawAcc = sqlUserAcc[0];
    const userAccount = rawAcc ? {
      username: rawAcc.username || "",
      phone: rawAcc.phone || "",
      email: rawAcc.email || "",
      walletBalance: rawAcc.walletBalance || 0,
      transactions: rawAcc.transactions || [],
    } : {
      username: "",
      phone: "",
      email: "",
      walletBalance: 0,
      transactions: [],
    };

    return {
      eventsList,
      eventDetails: eventDetailsObj,
      guests,
      templateSettings: templateSettingsMap,
      smsGatewaySettings,
      committee_members,
      committee_roles,
      saveTheDates,
      saveTheDateRecipients,
      auditLogs,
      userAccount,
    };
  });
}

// 3. Robust Relational Upsert function
export async function syncStateToRelationalDB(data: any): Promise<void> {
  await executeQuery("syncStateToRelationalDB", async () => {
    // 3.1. Save events (from eventsList or single eventDetails)
    if (data.eventsList && Array.isArray(data.eventsList)) {
      for (const ev of data.eventsList) {
        if (!ev.id) continue;
        await db.insert(schema.events).values({
          id: String(ev.id),
          senderId: ev.senderId ? String(ev.senderId) : null,
          name: String(ev.name || "Sherehe"),
          date: ev.date ? String(ev.date) : null,
          time: ev.time ? String(ev.time) : null,
          period: ev.period ? String(ev.period) : null,
          eventHallName: ev.eventHallName ? String(ev.eventHallName) : null,
          coordinates: ev.coordinates ? String(ev.coordinates) : null,
          hostName: ev.hostName ? String(ev.hostName) : null,
          dressCode: ev.dressCode ? String(ev.dressCode) : null,
          contact1: ev.contact1 ? String(ev.contact1) : null,
          contact1Name: ev.contact1Name ? String(ev.contact1Name) : null,
          contact2: ev.contact2 ? String(ev.contact2) : null,
          contact2Name: ev.contact2Name ? String(ev.contact2Name) : null,
          contact3: ev.contact3 ? String(ev.contact3) : null,
          contact3Name: ev.contact3Name ? String(ev.contact3Name) : null,
          mapsLink: ev.mapsLink ? String(ev.mapsLink) : null,
          eventImgUrl: ev.eventImgUrl ? String(ev.eventImgUrl) : null,
          messageLogs: ev.messageLogs || null,
          contributionsEnabled: ev.contributionsEnabled === true,
          fundraisingGoal: typeof ev.fundraisingGoal === "number" ? ev.fundraisingGoal : 0,
          autoRsvpRemindersEnabled: ev.autoRsvpRemindersEnabled === true,
        }).onConflictDoUpdate({
          target: schema.events.id,
          set: {
            senderId: ev.senderId ? String(ev.senderId) : null,
            name: String(ev.name || "Sherehe"),
            date: ev.date ? String(ev.date) : null,
            time: ev.time ? String(ev.time) : null,
            period: ev.period ? String(ev.period) : null,
            eventHallName: ev.eventHallName ? String(ev.eventHallName) : null,
            coordinates: ev.coordinates ? String(ev.coordinates) : null,
            hostName: ev.hostName ? String(ev.hostName) : null,
            dressCode: ev.dressCode ? String(ev.dressCode) : null,
            contact1: ev.contact1 ? String(ev.contact1) : null,
            contact1Name: ev.contact1Name ? String(ev.contact1Name) : null,
            contact2: ev.contact2 ? String(ev.contact2) : null,
            contact2Name: ev.contact2Name ? String(ev.contact2Name) : null,
            contact3: ev.contact3 ? String(ev.contact3) : null,
            contact3Name: ev.contact3Name ? String(ev.contact3Name) : null,
            mapsLink: ev.mapsLink ? String(ev.mapsLink) : null,
            eventImgUrl: ev.eventImgUrl ? String(ev.eventImgUrl) : null,
            messageLogs: ev.messageLogs || null,
            contributionsEnabled: ev.contributionsEnabled === true,
            fundraisingGoal: typeof ev.fundraisingGoal === "number" ? ev.fundraisingGoal : 0,
            autoRsvpRemindersEnabled: ev.autoRsvpRemindersEnabled === true,
          },
        });
      }
    }

    if (data.eventDetails && data.eventDetails.id) {
      const ed = data.eventDetails;
      await db.insert(schema.events).values({
        id: String(ed.id),
        senderId: ed.senderId ? String(ed.senderId) : null,
        name: String(ed.name || "Sherehe"),
        date: ed.date ? String(ed.date) : null,
        time: ed.time ? String(ed.time) : null,
        period: ed.period ? String(ed.period) : null,
        eventHallName: ed.eventHallName ? String(ed.eventHallName) : null,
        coordinates: ed.coordinates ? String(ed.coordinates) : null,
        hostName: ed.hostName ? String(ed.hostName) : null,
        dressCode: ed.dressCode ? String(ed.dressCode) : null,
        contact1: ed.contact1 ? String(ed.contact1) : null,
        contact1Name: ed.contact1Name ? String(ed.contact1Name) : null,
        contact2: ed.contact2 ? String(ed.contact2) : null,
        contact2Name: ed.contact2Name ? String(ed.contact2Name) : null,
        contact3: ed.contact3 ? String(ed.contact3) : null,
        contact3Name: ed.contact3Name ? String(ed.contact3Name) : null,
        mapsLink: ed.mapsLink ? String(ed.mapsLink) : null,
        eventImgUrl: ed.eventImgUrl ? String(ed.eventImgUrl) : null,
        messageLogs: ed.messageLogs || null,
        contributionsEnabled: ed.contributionsEnabled === true,
        fundraisingGoal: typeof ed.fundraisingGoal === "number" ? ed.fundraisingGoal : 0,
        autoRsvpRemindersEnabled: ed.autoRsvpRemindersEnabled === true,
      }).onConflictDoUpdate({
        target: schema.events.id,
        set: {
          senderId: ed.senderId ? String(ed.senderId) : null,
          name: String(ed.name || "Sherehe"),
          date: ed.date ? String(ed.date) : null,
          time: ed.time ? String(ed.time) : null,
          period: ed.period ? String(ed.period) : null,
          eventHallName: ed.eventHallName ? String(ed.eventHallName) : null,
          coordinates: ed.coordinates ? String(ed.coordinates) : null,
          hostName: ed.hostName ? String(ed.hostName) : null,
          dressCode: ed.dressCode ? String(ed.dressCode) : null,
          contact1: ed.contact1 ? String(ed.contact1) : null,
          contact1Name: ed.contact1Name ? String(ed.contact1Name) : null,
          contact2: ed.contact2 ? String(ed.contact2) : null,
          contact2Name: ed.contact2Name ? String(ed.contact2Name) : null,
          contact3: ed.contact3 ? String(ed.contact3) : null,
          contact3Name: ed.contact3Name ? String(ed.contact3Name) : null,
          mapsLink: ed.mapsLink ? String(ed.mapsLink) : null,
          eventImgUrl: ed.eventImgUrl ? String(ed.eventImgUrl) : null,
          messageLogs: ed.messageLogs || null,
          contributionsEnabled: ed.contributionsEnabled === true,
          fundraisingGoal: typeof ed.fundraisingGoal === "number" ? ed.fundraisingGoal : 0,
          autoRsvpRemindersEnabled: ed.autoRsvpRemindersEnabled === true,
        },
      });
    }

    // 3.2. Save Guests
    if (data.guests && Array.isArray(data.guests)) {
      for (const g of data.guests) {
        if (!g.id) continue;
        await db.insert(schema.guests).values({
          id: String(g.id),
          eventId: g.eventId ? String(g.eventId) : null,
          code: String(g.code || "REG"),
          name: String(g.name || ""),
          phone: String(g.phone || ""),
          cardType: String(g.cardType || "UNCLASSIFIED"),
          smsStatus: String(g.smsStatus || "Sijatuma"),
          whatsappStatus: String(g.whatsappStatus || "Sijatuma"),
          rsvpStatus: String(g.rsvpStatus || "Bado"),
          rsvpGuestsCount: typeof g.rsvpGuestsCount === "number" ? g.rsvpGuestsCount : 0,
          rsvpComment: g.rsvpComment ? String(g.rsvpComment) : null,
          checkedIn: g.checkedIn === true,
          checkedInTime: g.checkedInTime ? String(g.checkedInTime) : null,
          photoUrl: g.photoUrl ? String(g.photoUrl) : null,
          cardImageUrl: g.cardImageUrl ? String(g.cardImageUrl) : null,
          smsCount: typeof g.smsCount === "number" ? g.smsCount : 0,
          whatsappCount: typeof g.whatsappCount === "number" ? g.whatsappCount : 0,
          category: g.category ? String(g.category) : null,
          pledgeAmount: typeof g.pledgeAmount === "number" ? g.pledgeAmount : 0,
          paidAmount: typeof g.paidAmount === "number" ? g.paidAmount : 0,
          pledgeStatus: String(g.pledgeStatus || "No Pledge"),
          payments: g.payments || null,
          rsvpUpdatedAt: g.rsvpUpdatedAt ? String(g.rsvpUpdatedAt) : null,
          rsvpSeen: g.rsvpSeen !== false,
        }).onConflictDoUpdate({
          target: schema.guests.id,
          set: {
            eventId: g.eventId ? String(g.eventId) : null,
            code: String(g.code || "REG"),
            name: String(g.name || ""),
            phone: String(g.phone || ""),
            cardType: String(g.cardType || "UNCLASSIFIED"),
            smsStatus: String(g.smsStatus || "Sijatuma"),
            whatsappStatus: String(g.whatsappStatus || "Sijatuma"),
            rsvpStatus: String(g.rsvpStatus || "Bado"),
            rsvpGuestsCount: typeof g.rsvpGuestsCount === "number" ? g.rsvpGuestsCount : 0,
            rsvpComment: g.rsvpComment ? String(g.rsvpComment) : null,
            checkedIn: g.checkedIn === true,
            checkedInTime: g.checkedInTime ? String(g.checkedInTime) : null,
            photoUrl: g.photoUrl ? String(g.photoUrl) : null,
            cardImageUrl: g.cardImageUrl ? String(g.cardImageUrl) : null,
            smsCount: typeof g.smsCount === "number" ? g.smsCount : 0,
            whatsappCount: typeof g.whatsappCount === "number" ? g.whatsappCount : 0,
            category: g.category ? String(g.category) : null,
            pledgeAmount: typeof g.pledgeAmount === "number" ? g.pledgeAmount : 0,
            paidAmount: typeof g.paidAmount === "number" ? g.paidAmount : 0,
            pledgeStatus: String(g.pledgeStatus || "No Pledge"),
            payments: g.payments || null,
            rsvpUpdatedAt: g.rsvpUpdatedAt ? String(g.rsvpUpdatedAt) : null,
            rsvpSeen: g.rsvpSeen !== false,
          },
        });
      }
    }

    // 3.3. Delete explicitly requested guests if client sends deletedGuestIds
    if (data.deletedGuestIds && Array.isArray(data.deletedGuestIds)) {
      for (const dgId of data.deletedGuestIds) {
        await db.delete(schema.guests).where(eq(schema.guests.id, dgId));
      }
    }
    if (data.deletedEventIds && Array.isArray(data.deletedEventIds)) {
      for (const deId of data.deletedEventIds) {
        await db.delete(schema.events).where(eq(schema.events.id, deId));
      }
    }

    // 3.4. Save SaveTheDates
    if (data.saveTheDates && Array.isArray(data.saveTheDates)) {
      for (const s of data.saveTheDates) {
        if (!s.id) continue;
        await db.insert(schema.saveTheDates).values({
          id: String(s.id),
          eventId: s.event_id ? String(s.event_id) : null,
          title: String(s.title || ""),
          message: String(s.message || ""),
          imageUrl: s.image_url ? String(s.image_url) : null,
          createdAt: s.created_at ? String(s.created_at) : null,
        }).onConflictDoUpdate({
          target: schema.saveTheDates.id,
          set: {
            eventId: s.event_id ? String(s.event_id) : null,
            title: String(s.title || ""),
            message: String(s.message || ""),
            imageUrl: s.image_url ? String(s.image_url) : null,
            createdAt: s.created_at ? String(s.created_at) : null,
          },
        });
      }
    }

    // 3.5. Save Recipients
    if (data.saveTheDateRecipients && Array.isArray(data.saveTheDateRecipients)) {
      for (const r of data.saveTheDateRecipients) {
        if (!r.id) continue;
        await db.insert(schema.saveTheDateRecipients).values({
          id: String(r.id),
          saveTheDateId: r.save_the_date_id ? String(r.save_the_date_id) : null,
          guestId: r.guest_id ? String(r.guest_id) : null,
          sentAt: r.sent_at ? String(r.sent_at) : null,
          status: String(r.status || "Pending"),
        }).onConflictDoUpdate({
          target: schema.saveTheDateRecipients.id,
          set: {
            saveTheDateId: r.save_the_date_id ? String(r.save_the_date_id) : null,
            guestId: r.guest_id ? String(r.guest_id) : null,
            sentAt: r.sent_at ? String(r.sent_at) : null,
            status: String(r.status || "Pending"),
          },
        });
      }
    }

    // 3.6. Save Template Settings
    if (data.templateSettings && typeof data.templateSettings === "object") {
      Object.assign(data.templateSettings, data.templateSettings); // Stabilize
      for (const [key, t] of Object.entries(data.templateSettings)) {
        if (!t || typeof t !== "object") continue;
        const tsObj = t as any;
        await db.insert(schema.templateSettings).values({
          id: String(key),
          imageUrl: String(tsObj.imageUrl || ""),
          textColor: tsObj.textColor ? String(tsObj.textColor) : "#333333",
          fontFamily: tsObj.fontFamily ? String(tsObj.fontFamily) : "Inter",
          guestNameX: typeof tsObj.guestNameX === "number" ? tsObj.guestNameX : 50,
          guestNameY: typeof tsObj.guestNameY === "number" ? tsObj.guestNameY : 50,
          guestNameSize: typeof tsObj.guestNameSize === "number" ? tsObj.guestNameSize : 24,
          guestNameColor: tsObj.guestNameColor ? String(tsObj.guestNameColor) : null,
          qrCodeX: typeof tsObj.qrCodeX === "number" ? tsObj.qrCodeX : 50,
          qrCodeY: typeof tsObj.qrCodeY === "number" ? tsObj.qrCodeY : 70,
          qrCodeSize: typeof tsObj.qrCodeSize === "number" ? tsObj.qrCodeSize : 120,
          qrCodeColor: tsObj.qrCodeColor ? String(tsObj.qrCodeColor) : null,
          cardTypeX: typeof tsObj.cardTypeX === "number" ? tsObj.cardTypeX : 50,
          cardTypeY: typeof tsObj.cardTypeY === "number" ? tsObj.cardTypeY : 25,
          cardTypeSize: typeof tsObj.cardTypeSize === "number" ? tsObj.cardTypeSize : 16,
          cardTypeColor: tsObj.cardTypeColor ? String(tsObj.cardTypeColor) : null,
        }).onConflictDoUpdate({
          target: schema.templateSettings.id,
          set: {
            imageUrl: String(tsObj.imageUrl || ""),
            textColor: tsObj.textColor ? String(tsObj.textColor) : "#333333",
            fontFamily: tsObj.fontFamily ? String(tsObj.fontFamily) : "Inter",
            guestNameX: typeof tsObj.guestNameX === "number" ? tsObj.guestNameX : 50,
            guestNameY: typeof tsObj.guestNameY === "number" ? tsObj.guestNameY : 50,
            guestNameSize: typeof tsObj.guestNameSize === "number" ? tsObj.guestNameSize : 24,
            guestNameColor: tsObj.guestNameColor ? String(tsObj.guestNameColor) : null,
            qrCodeX: typeof tsObj.qrCodeX === "number" ? tsObj.qrCodeX : 50,
            qrCodeY: typeof tsObj.qrCodeY === "number" ? tsObj.qrCodeY : 70,
            qrCodeSize: typeof tsObj.qrCodeSize === "number" ? tsObj.qrCodeSize : 120,
            qrCodeColor: tsObj.qrCodeColor ? String(tsObj.qrCodeColor) : null,
            cardTypeX: typeof tsObj.cardTypeX === "number" ? tsObj.cardTypeX : 50,
            cardTypeY: typeof tsObj.cardTypeY === "number" ? tsObj.cardTypeY : 25,
            cardTypeSize: typeof tsObj.cardTypeSize === "number" ? tsObj.cardTypeSize : 16,
            cardTypeColor: tsObj.cardTypeColor ? String(tsObj.cardTypeColor) : null,
          }
        });
      }
    }

    // 3.7. Save SMS Settings
    if (data.smsGatewaySettings && typeof data.smsGatewaySettings === "object") {
      const s = data.smsGatewaySettings;
      await db.insert(schema.smsGatewaySettings).values({
        id: "settings",
        provider: s.provider ? String(s.provider) : "simulation",
        url: s.url ? String(s.url) : null,
        apiKey: s.apiKey ? String(s.apiKey) : null,
        apiSecret: s.apiSecret ? String(s.apiSecret) : null,
        senderId: s.senderId ? String(s.senderId) : null,
        senderIdStatus: s.senderIdStatus ? String(s.senderIdStatus) : "approved",
        whatsappUrl: s.whatsappUrl ? String(s.whatsappUrl) : null,
        customHeaders: s.customHeaders ? String(s.customHeaders) : "{}",
        customBody: s.customBody ? String(s.customBody) : "{}",
      }).onConflictDoUpdate({
        target: schema.smsGatewaySettings.id,
        set: {
          provider: s.provider ? String(s.provider) : "simulation",
          url: s.url ? String(s.url) : null,
          apiKey: s.apiKey ? String(s.apiKey) : null,
          apiSecret: s.apiSecret ? String(s.apiSecret) : null,
          senderId: s.senderId ? String(s.senderId) : null,
          senderIdStatus: s.senderIdStatus ? String(s.senderIdStatus) : "approved",
          whatsappUrl: s.whatsappUrl ? String(s.whatsappUrl) : null,
          customHeaders: s.customHeaders ? String(s.customHeaders) : "{}",
          customBody: s.customBody ? String(s.customBody) : "{}",
        }
      });
    }

    // 3.8. Save Committee Members
    if (data.committee_members && Array.isArray(data.committee_members)) {
      for (const m of data.committee_members) {
        if (!m.id) continue;
        await db.insert(schema.committeeMembers).values({
          id: String(m.id),
          name: String(m.name || ""),
          phone: String(m.phone || ""),
          email: m.email ? String(m.email) : null,
          position: m.position ? String(m.position) : "Committee Member",
          permissionLevel: m.permissionLevel ? String(m.permissionLevel) : "Summary Access",
          token: m.token ? String(m.token) : null,
        }).onConflictDoUpdate({
          target: schema.committeeMembers.id,
          set: {
            name: String(m.name || ""),
            phone: String(m.phone || ""),
            email: m.email ? String(m.email) : null,
            position: m.position ? String(m.position) : "Committee Member",
            permissionLevel: m.permissionLevel ? String(m.permissionLevel) : "Summary Access",
            token: m.token ? String(m.token) : null,
          }
        });
      }
    }

    // 3.9. Save Committee Roles
    if (data.committee_roles && Array.isArray(data.committee_roles)) {
      for (const r of data.committee_roles) {
        if (!r.id) continue;
        await db.insert(schema.committeeRoles).values({
          id: String(r.id),
          name: String(r.name || ""),
          permissionLevel: String(r.permissionLevel || ""),
          description: r.description ? String(r.description) : null,
        }).onConflictDoUpdate({
          target: schema.committeeRoles.id,
          set: {
            name: String(r.name || ""),
            permissionLevel: String(r.permissionLevel || ""),
            description: r.description ? String(r.description) : null,
          }
        });
      }
    }

    // 3.10. Save Audit Logs
    if (data.auditLogs && Array.isArray(data.auditLogs)) {
      for (const l of data.auditLogs) {
        if (!l.id) continue;
        await db.insert(schema.auditLogs).values({
          id: String(l.id),
          timestamp: String(l.timestamp || new Date().toISOString()),
          user: String(l.user || "System"),
          action: String(l.action || ""),
          details: String(l.details || ""),
          ipAddress: l.ipAddress ? String(l.ipAddress) : null,
        }).onConflictDoUpdate({
          target: schema.auditLogs.id,
          set: {
            timestamp: String(l.timestamp || new Date().toISOString()),
            user: String(l.user || "System"),
            action: String(l.action || ""),
            details: String(l.details || ""),
            ipAddress: l.ipAddress ? String(l.ipAddress) : null,
          }
        });
      }
    }

    // 3.11. Save User Account
    if (data.userAccount && typeof data.userAccount === "object") {
      const u = data.userAccount;
      await db.insert(schema.userAccount).values({
        id: "account",
        username: u.username ? String(u.username) : null,
        phone: u.phone ? String(u.phone) : null,
        email: u.email ? String(u.email) : null,
        walletBalance: typeof u.walletBalance === "number" ? u.walletBalance : 0,
        transactions: u.transactions || null,
      }).onConflictDoUpdate({
        target: schema.userAccount.id,
        set: {
          username: u.username ? String(u.username) : null,
          phone: u.phone ? String(u.phone) : null,
          email: u.email ? String(u.email) : null,
          walletBalance: typeof u.walletBalance === "number" ? u.walletBalance : 0,
          transactions: u.transactions || null,
        }
      });
    }

    console.log("[CloudSQL Core] State was successfully synchronized and written to PostgreSQL.");
  });
}
