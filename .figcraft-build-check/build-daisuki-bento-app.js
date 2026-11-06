// @bun
// scripts/figcraft-helper.ts
import { spawn } from "child_process";
var activeClient = null;

class FigCraftClient {
  proc;
  msgId = 1;
  pending = new Map;
  async connect() {
    activeClient = this;
    this.proc = spawn("D:/FigCraft/figcraft-cli.exe", ["mcp", "--attach", "7979"]);
    let buffer = "";
    this.proc.stderr?.on("data", (chunk) => {
      const msg = chunk.toString();
      if (msg.includes("can't reach") || msg.includes("error")) {
        console.error("FigCraft CLI Error:", msg.trim());
      }
    });
    this.proc.on("exit", (code) => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`FigCraft process exited with code ${code}. Pastikan aplikasi FigCraft sudah dibuka dengan \`figcraft --control 7979\``));
      }
      this.pending.clear();
    });
    this.proc.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(`
`);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim())
          continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error)
              reject(new Error(JSON.stringify(msg.error)));
            else
              resolve(msg.result);
          }
        } catch (e) {}
      }
    });
    const initPromise = this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "moodly-builder", version: "1.0.0" }
    });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Gagal terhubung ke FigCraft di port 7979 (Connection Timeout).
Pastikan aplikasi FigCraft sudah berjalan dengan perintah:
  D:\\FigCraft\\FigCraft.exe --control 7979`)), 4000));
    await Promise.race([initPromise, timeoutPromise]);
  }
  request(method, params) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + `
`);
    });
  }
  async callTool(name, args) {
    const res = await this.request("tools/call", { name, arguments: args });
    if (res.isError)
      throw new Error(JSON.stringify(res.content));
    const text = res.content?.[0]?.text;
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    return res;
  }
  async runCommand(command, params) {
    return this.callTool("run_command", { command, params });
  }
  async createNode(params) {
    return this.callTool("create_node", params);
  }
  async setProperties(ids, props) {
    return this.callTool("set_properties", { ids, props });
  }
  close() {
    if (this.proc)
      this.proc.kill();
  }
}
async function createAutoFrame(a, b, c, d, e, f) {
  let client;
  let parent;
  let name;
  let width;
  let height;
  let opts;
  if (a && typeof a === "object" && "createNode" in a) {
    client = a;
    parent = b;
    name = c;
    width = d;
    height = e;
    opts = f || {};
  } else {
    client = activeClient;
    parent = a;
    name = b;
    width = c;
    height = d;
    opts = e || {};
  }
  const layout = opts.layout !== undefined ? opts.layout : "vertical";
  const props = {
    name,
    fill: opts.fill || "none"
  };
  if (layout !== null)
    props.layout = layout;
  if (opts.gap !== undefined)
    props.gap = opts.gap;
  if (opts.padding !== undefined)
    props.padding = opts.padding;
  if (opts.stroke) {
    props.stroke = opts.stroke;
    props.strokeWeight = opts.strokeWeight ?? 1;
  }
  if (opts.dashes)
    props.dashes = opts.dashes;
  if (opts.cornerRadius !== undefined)
    props.cornerRadius = opts.cornerRadius;
  if (layout !== null) {
    if (opts.sizingH)
      props.sizingH = opts.sizingH;
    if (opts.sizingV)
      props.sizingV = opts.sizingV;
    if (opts.mainAlign)
      props.mainAlign = opts.mainAlign;
    if (opts.crossAlign)
      props.crossAlign = opts.crossAlign;
  }
  if (opts.clip !== undefined)
    props.clip = opts.clip;
  const res = await client.createNode({
    type: "frame",
    name,
    parent,
    width,
    height,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    props
  });
  return res.id;
}
async function createText(a, b, c, d, e) {
  let client;
  let parent;
  let name;
  let text;
  let opts;
  if (a && typeof a === "object" && "createNode" in a) {
    client = a;
    parent = b;
    name = c;
    text = d;
    opts = e || {};
  } else {
    client = activeClient;
    parent = a;
    name = b;
    text = c;
    opts = d || {};
  }
  const props = {
    name,
    fontSize: opts.fontSize ?? 13,
    fontFamily: opts.fontFamily ?? "Figtree",
    fontStyle: opts.fontStyle ?? "Regular",
    fill: opts.fill ?? "#141B3D"
  };
  if (opts.textAlign)
    props.textAlign = opts.textAlign;
  if (opts.sizingH)
    props.sizingH = opts.sizingH;
  const res = await client.createNode({
    type: "text",
    name,
    parent,
    text,
    props
  });
  return res.id;
}
async function createBadge(a, b, c, d, e, f) {
  let client;
  let parent;
  let label;
  let bg;
  let textCol;
  let fontSize = 11;
  if (typeof a === "object" && a !== null) {
    client = a;
    parent = b;
    label = c;
    bg = d;
    textCol = e;
    if (f !== undefined)
      fontSize = f;
  } else {
    client = activeClient;
    parent = a;
    label = b;
    bg = c;
    textCol = d;
    if (typeof e === "number")
      fontSize = e;
  }
  const frameId = await createAutoFrame(client, parent, `Badge_${label}`, 50, 22, {
    layout: "horizontal",
    padding: [3, 8],
    cornerRadius: 6,
    fill: bg,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "hug",
    sizingV: "hug"
  });
  await createText(client, frameId, `txt_${label}`, label, {
    fontSize,
    fontStyle: "Bold",
    fill: textCol
  });
  return frameId;
}

// scripts/build-daisuki-bento-app.ts
var C = {
  bgApp: "#F6F7F9",
  bgWhite: "#FFFFFF",
  textBlack: "#141B3D",
  textGray: "#5B6272",
  textSubtle: "#6B7280",
  bezel: "#0A0A0A",
  navBlack: "#141B3D",
  brandUme: "#B83A6A",
  mint: "#E3F4EA",
  mintDark: "#14653A",
  peach: "#FFFFFF",
  lavender: "#E1EDFB",
  pink: "#FFF3CC",
  sky: "#F2F4FA",
  yellow: "#FFF3CC",
  coral: "#FDE7E7",
  coralDark: "#9B1C1C"
};
async function buildDaisukiBento(client) {
  console.log("Building Daisuki Mitra FigCraft prototype...");
  await client.runCommand("page.setBackground", { color: "#F6F7F9" });
  const phoneW = 464;
  const phoneH = 980;
  const gapX = 80;
  const gapY = 100;
  const startX = 60;
  const startY = 80;
  const screenCoords = [
    { x: startX + 0 * (phoneW + gapX), y: startY, label: "01_Onboarding_B2B" },
    { x: startX + 1 * (phoneW + gapX), y: startY, label: "02_Dashboard_Mitra" },
    { x: startX + 2 * (phoneW + gapX), y: startY, label: "03_Catat_Stok_Fisik" },
    { x: startX + 0 * (phoneW + gapX), y: startY + phoneH + gapY, label: "04_Pemesanan_Restock" },
    { x: startX + 1 * (phoneW + gapX), y: startY + phoneH + gapY, label: "05_Lacak_Pengiriman" },
    { x: startX + 2 * (phoneW + gapX), y: startY + phoneH + gapY, label: "06_Profil_Cabang" }
  ];
  const screens = [];
  async function createDeviceWrapper(name, x, y, label, screenBg) {
    await createText(client, undefined, `Label_${name}`, label, {
      x,
      y: y - 36,
      fontSize: 20,
      fontFamily: "Bricolage Grotesque",
      fontStyle: "Bold",
      fill: C.textBlack
    });
    const deviceId = await createAutoFrame(client, undefined, name, 464, 980, {
      x,
      y,
      layout: null,
      fill: C.bezel,
      cornerRadius: 62,
      clip: true,
      sizingH: "fixed",
      sizingV: "fixed"
    });
    const screenId = await createAutoFrame(client, deviceId, "Screen_Canvas", 440, 956, {
      x: 12,
      y: 12,
      layout: null,
      fill: screenBg,
      cornerRadius: 50,
      clip: true,
      sizingH: "fixed",
      sizingV: "fixed"
    });
    const statusBar = await createAutoFrame(client, screenId, "Status_Bar", 440, 62, {
      x: 0,
      y: 0,
      layout: "horizontal",
      padding: [18, 32, 0, 32],
      mainAlign: "spaceBetween",
      crossAlign: "center",
      fill: "none"
    });
    await createText(client, statusBar, "time", "09:41", {
      fontSize: 15,
      fontFamily: "Bricolage Grotesque",
      fontStyle: "Bold",
      fill: C.textBlack
    });
    await createText(client, statusBar, "icons", "5G  \u25B2  \u25FC", {
      fontSize: 13,
      fontStyle: "Bold",
      fill: C.textBlack
    });
    const island = await createAutoFrame(client, screenId, "Dynamic_Island", 126, 37, {
      x: 157,
      y: 11,
      cornerRadius: 19,
      fill: "#000000",
      layout: "horizontal",
      mainAlign: "center",
      crossAlign: "center"
    });
    await createAutoFrame(client, island, "Sensor", 10, 10, {
      cornerRadius: 5,
      fill: "#141414"
    });
    await createAutoFrame(client, screenId, "Home_Indicator", 140, 5, {
      x: 150,
      y: 943,
      cornerRadius: 3,
      fill: C.textBlack
    });
    return { deviceId, screenId };
  }
  const navTabButtons = [];
  async function attachDaisukiNav(screenId, activeTabName) {
    const navBar = await createAutoFrame(client, screenId, "BottomNav", 400, 68, {
      x: 20,
      y: 832,
      layout: "horizontal",
      padding: [10, 16],
      cornerRadius: 34,
      fill: C.navBlack,
      mainAlign: "spaceAround",
      crossAlign: "center",
      sizingH: "fixed",
      sizingV: "fixed"
    });
    const tabs = [
      { name: "Stok", glyph: "\u2302" },
      { name: "Pesan", glyph: "\u2637" },
      { name: "Lacak", glyph: "\u21F6" },
      { name: "Profil", glyph: "\u25EB" }
    ];
    let tStok = 0;
    let tPesan = 0;
    let tLacak = 0;
    let tProfil = 0;
    for (const tab of tabs) {
      const isActive = tab.name === activeTabName;
      if (isActive) {
        const activeCircle = await createAutoFrame(client, navBar, `Tab_${tab.name}_Active`, 48, 48, {
          cornerRadius: 24,
          fill: "#FFFFFF",
          mainAlign: "center",
          crossAlign: "center",
          sizingH: "fixed",
          sizingV: "fixed"
        });
        await createText(client, activeCircle, "ic", tab.glyph, {
          fontSize: 20,
          fontStyle: "Bold",
          fill: C.textBlack
        });
        if (tab.name === "Stok")
          tStok = activeCircle;
        if (tab.name === "Pesan")
          tPesan = activeCircle;
        if (tab.name === "Lacak")
          tLacak = activeCircle;
        if (tab.name === "Profil")
          tProfil = activeCircle;
      } else {
        const inactiveTab = await createAutoFrame(client, navBar, `Tab_${tab.name}`, 48, 48, {
          fill: "none",
          mainAlign: "center",
          crossAlign: "center",
          sizingH: "fixed",
          sizingV: "fixed"
        });
        await createText(client, inactiveTab, "ic", tab.glyph, {
          fontSize: 20,
          fill: "#8E8E93"
        });
        if (tab.name === "Stok")
          tStok = inactiveTab;
        if (tab.name === "Pesan")
          tPesan = inactiveTab;
        if (tab.name === "Lacak")
          tLacak = inactiveTab;
        if (tab.name === "Profil")
          tProfil = inactiveTab;
      }
    }
    navTabButtons.push({
      screenId,
      tabStokId: tStok,
      tabPesanId: tPesan,
      tabLacakId: tLacak,
      tabProfilId: tProfil
    });
    return navBar;
  }
  console.log("Creating Screen 1: 01_Onboarding_B2B...");
  const dev1 = await createDeviceWrapper("01_Onboarding_B2B", screenCoords[0].x, screenCoords[0].y, screenCoords[0].label, "#FFFFFF");
  screens.push(dev1.deviceId);
  const s1Content = await createAutoFrame(client, dev1.screenId, "Content", 400, 850, {
    x: 20,
    y: 70,
    layout: "vertical",
    gap: 24,
    fill: "none",
    sizingH: "fixed",
    sizingV: "fixed"
  });
  const s1HeadWrap = await createAutoFrame(client, s1Content, "Headline_Wrap", 400, 180, {
    layout: "vertical",
    gap: 12,
    fill: "none",
    sizingH: "fill"
  });
  const s1Badge = await createAutoFrame(client, s1HeadWrap, "Daisuki_Chip", 140, 32, {
    layout: "horizontal",
    gap: 6,
    padding: [4, 10],
    cornerRadius: 16,
    fill: "#FDF2F4",
    crossAlign: "center"
  });
  await createText(client, s1Badge, "dot", "\u25CF", { fontSize: 10, fill: C.brandUme });
  await createText(client, s1Badge, "txt", "Daisuki B2B Mitra", { fontSize: 12, fontStyle: "Bold", fill: C.brandUme });
  await createText(client, s1HeadWrap, "h", `Pantau Stok,
Pasokan Siap
Tanpa Ribet.`, {
    fontSize: 42,
    fontFamily: "Bricolage Grotesque",
    fontStyle: "Bold",
    fill: C.textBlack
  });
  const s1Pill = await createAutoFrame(client, s1Content, "btn_mulai_jelajahi", 240, 56, {
    layout: "horizontal",
    padding: [4, 6, 4, 20],
    cornerRadius: 28,
    fill: "#EFEFEF",
    crossAlign: "center",
    mainAlign: "spaceBetween",
    sizingH: "fixed",
    sizingV: "fixed"
  });
  await createText(client, s1Pill, "lbl", "Mulai Jelajahi!", {
    fontSize: 16,
    fontStyle: "Bold",
    fill: C.textBlack
  });
  const s1Arrow = await createAutoFrame(client, s1Pill, "Arrow_Circle", 48, 48, {
    cornerRadius: 24,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "fixed",
    sizingV: "fixed"
  });
  await createText(client, s1Arrow, "ic", "\u2192", {
    fontSize: 20,
    fontStyle: "Bold",
    fill: "#FFFFFF"
  });
  const s1Cluster = await createAutoFrame(client, dev1.screenId, "Daisuki_Visual_Cluster", 440, 520, {
    x: 0,
    y: 436,
    layout: null,
    fill: "none",
    clip: true
  });
  const mBasreng = await createAutoFrame(client, s1Cluster, "Tile_Basreng", 150, 150, {
    x: 20,
    y: 20,
    cornerRadius: 38,
    fill: C.peach,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
    gap: 8
  });
  const icB1 = await createAutoFrame(client, mBasreng, "IconWrap", 50, 50, {
    cornerRadius: 25,
    fill: "#FFFFFF",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, icB1, "sym", "\u25B2", { fontSize: 22, fill: "#EA580C" });
  await createText(client, mBasreng, "t", "Basreng Daun Jeruk", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  const mSeblak = await createAutoFrame(client, s1Cluster, "Tile_Seblak", 140, 140, {
    x: 240,
    y: 10,
    cornerRadius: 70,
    fill: C.yellow,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
    gap: 8
  });
  const icS1 = await createAutoFrame(client, mSeblak, "IconWrap", 46, 46, {
    cornerRadius: 23,
    fill: "#FFFFFF",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, icS1, "sym", "\u25C6", { fontSize: 22, fill: "#D97706" });
  await createText(client, mSeblak, "t", "Seblak Jadul Instan", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  const mKeju = await createAutoFrame(client, s1Cluster, "Tile_Keju", 140, 140, {
    x: -15,
    y: 175,
    cornerRadius: 50,
    fill: C.sky,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
    gap: 8
  });
  const icK1 = await createAutoFrame(client, mKeju, "IconWrap", 46, 46, {
    cornerRadius: 23,
    fill: "#FFFFFF",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, icK1, "sym", "", { fontSize: 20 });
  await createText(client, mKeju, "t", "Makaroni Daun Jeruk", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  const mTruk = await createAutoFrame(client, s1Cluster, "Tile_Truk", 160, 160, {
    x: 135,
    y: 165,
    cornerRadius: 36,
    fill: C.lavender,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
    gap: 8
  });
  const icTr = await createAutoFrame(client, mTruk, "IconWrap", 56, 56, {
    cornerRadius: 28,
    fill: "#FFFFFF",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, icTr, "sym", "\u21F6", { fontSize: 28, fontStyle: "Bold", fill: "#4338CA" });
  await createText(client, mTruk, "t", "Daisuki Express", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  const mKardus = await createAutoFrame(client, s1Cluster, "Tile_Kardus", 140, 140, {
    x: 300,
    y: 175,
    cornerRadius: 32,
    fill: C.mint,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
    gap: 8
  });
  const icKd = await createAutoFrame(client, mKardus, "IconWrap", 46, 46, {
    cornerRadius: 23,
    fill: "#FFFFFF",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, icKd, "sym", "\u2713", { fontSize: 22, fontStyle: "Bold", fill: C.mintDark });
  await createText(client, mKardus, "t", "PO Terverifikasi", { fontSize: 12, fontStyle: "Bold", fill: C.mintDark });
  const mAlert = await createAutoFrame(client, s1Cluster, "Tile_Alert", 140, 140, {
    x: 30,
    y: 335,
    cornerRadius: 38,
    fill: C.coral,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
    gap: 8
  });
  const icAl = await createAutoFrame(client, mAlert, "IconWrap", 46, 46, {
    cornerRadius: 23,
    fill: "#FFFFFF",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, icAl, "sym", "!", { fontSize: 24, fontStyle: "Bold", fill: C.coralDark });
  await createText(client, mAlert, "t", "Sisa 4 pcs (Kritis)", { fontSize: 12, fontStyle: "Bold", fill: C.coralDark });
  const mSerah = await createAutoFrame(client, s1Cluster, "Tile_SerahTerima", 150, 150, {
    x: 220,
    y: 335,
    cornerRadius: 40,
    fill: "#FED7AA",
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
    gap: 6
  });
  await createText(client, mSerah, "v", "+50 pcs", { fontSize: 26, fontStyle: "Bold", fill: "#9A3412" });
  await createText(client, mSerah, "t", "Stok Langsung Masuk", { fontSize: 12, fontStyle: "Bold", fill: "#9A3412" });
  console.log("Creating Screen 2: 02_Dashboard_Mitra...");
  const dev2 = await createDeviceWrapper("02_Dashboard_Mitra", screenCoords[1].x, screenCoords[1].y, screenCoords[1].label, C.bgApp);
  screens.push(dev2.deviceId);
  const s2Content = await createAutoFrame(client, dev2.screenId, "Content", 400, 750, {
    x: 20,
    y: 70,
    layout: "vertical",
    gap: 16,
    fill: "none",
    sizingH: "fixed",
    sizingV: "hug"
  });
  const s2Header = await createAutoFrame(client, s2Content, "Header", 400, 48, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill"
  });
  const s2MitraInfo = await createAutoFrame(client, s2Header, "btn_header_profile", 260, 44, {
    layout: "horizontal",
    gap: 12,
    crossAlign: "center",
    fill: "none"
  });
  const s2Av = await createAutoFrame(client, s2MitraInfo, "Logo_KS", 44, 44, {
    cornerRadius: 22,
    fill: C.brandUme,
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, s2Av, "t", "KS", { fontSize: 16, fontStyle: "Bold", fill: "#FFFFFF" });
  const s2MitraMeta = await createAutoFrame(client, s2MitraInfo, "Meta", 200, 40, {
    layout: "vertical",
    gap: 2,
    fill: "none"
  });
  await createText(client, s2MitraMeta, "sub", "Mitra Resmi \u2022 Surabaya", { fontSize: 12, fill: C.textGray });
  await createText(client, s2MitraMeta, "name", "Kafe Sejuk Kenjeran", { fontSize: 16, fontStyle: "Bold", fill: C.textBlack });
  const s2Bell = await createAutoFrame(client, s2Header, "btn_bell", 44, 44, {
    cornerRadius: 22,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, s2Bell, "ic", "\u25EC", { fontSize: 20, fontStyle: "Bold", fill: C.textBlack });
  const s2Greeting = await createAutoFrame(client, s2Content, "Greeting", 400, 80, {
    layout: "vertical",
    gap: 4,
    fill: "none",
    sizingH: "fill"
  });
  await createText(client, s2Greeting, "date", "Kamis, 06 Nov 2026 \u2022 Live Sync Neon", {
    fontSize: 13,
    fontStyle: "Medium",
    fill: C.textGray
  });
  await createText(client, s2Greeting, "h", `Halo Kafe Sejuk!
Semua stok terpantau.`, {
    fontSize: 32,
    fontFamily: "Bricolage Grotesque",
    fontStyle: "Bold",
    fill: C.textBlack
  });
  const s2Chips = await createAutoFrame(client, s2Content, "Quick_Chips", 400, 44, {
    layout: "horizontal",
    gap: 10,
    fill: "none",
    sizingH: "fill"
  });
  const btnChipStok = await createAutoFrame(client, s2Chips, "Chip_Hitung_Stok", 92, 44, {
    layout: "horizontal",
    gap: 6,
    padding: [8, 10],
    cornerRadius: 22,
    fill: C.bgWhite,
    crossAlign: "center",
    mainAlign: "center",
    sizingH: "fill"
  });
  await createText(client, btnChipStok, "ic", "\u2317", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, btnChipStok, "lbl", "Hitung Stok", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  const btnChipPesan = await createAutoFrame(client, s2Chips, "Chip_Pesan_PO", 92, 44, {
    layout: "horizontal",
    gap: 6,
    padding: [8, 10],
    cornerRadius: 22,
    fill: C.bgWhite,
    crossAlign: "center",
    mainAlign: "center",
    sizingH: "fill"
  });
  await createText(client, btnChipPesan, "ic", "\u2637", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, btnChipPesan, "lbl", "Pesan PO", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  const btnChipKurir = await createAutoFrame(client, s2Chips, "Chip_Kurir_Armada", 92, 44, {
    layout: "horizontal",
    gap: 6,
    padding: [8, 10],
    cornerRadius: 22,
    fill: C.bgWhite,
    crossAlign: "center",
    mainAlign: "center",
    sizingH: "fill"
  });
  await createText(client, btnChipKurir, "ic", "\u21F6", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, btnChipKurir, "lbl", "Kurir Armada", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  const btnChipAi = await createAutoFrame(client, s2Chips, "Chip_AI_Rekom", 92, 44, {
    layout: "horizontal",
    gap: 6,
    padding: [8, 10],
    cornerRadius: 22,
    fill: C.bgWhite,
    crossAlign: "center",
    mainAlign: "center",
    sizingH: "fill"
  });
  await createText(client, btnChipAi, "ic", "\u2726", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, btnChipAi, "lbl", "Saran Stok", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  const s2BentoRow = await createAutoFrame(client, s2Content, "Bento_Row", 400, 170, {
    layout: "horizontal",
    gap: 16,
    fill: "none",
    sizingH: "fill"
  });
  const bPusat = await createAutoFrame(client, s2BentoRow, "Card_Pusat", 192, 170, {
    layout: "vertical",
    padding: 18,
    gap: 10,
    cornerRadius: 28,
    fill: C.peach,
    sizingH: "fill",
    mainAlign: "spaceBetween"
  });
  const bPusatTop = await createAutoFrame(client, bPusat, "Top", 156, 22, {
    layout: "horizontal",
    gap: 8,
    crossAlign: "center",
    fill: "none"
  });
  await createText(client, bPusatTop, "ic", "\u2302", { fontSize: 15, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, bPusatTop, "t", "Gudang Pusat", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, bPusat, "val", "850 pcs", {
    fontSize: 26,
    fontFamily: "Bricolage Grotesque",
    fontStyle: "Bold",
    fill: C.textBlack
  });
  await createText(client, bPusat, "sub", "Basreng Daun Jeruk siap kirim hari ini", { fontSize: 12, fill: C.textBlack });
  const bKurir = await createAutoFrame(client, s2BentoRow, "Card_Kurir", 192, 170, {
    layout: "vertical",
    padding: 18,
    gap: 10,
    cornerRadius: 28,
    fill: C.lavender,
    sizingH: "fill",
    mainAlign: "spaceBetween"
  });
  const bKurirTop = await createAutoFrame(client, bKurir, "Top", 156, 22, {
    layout: "horizontal",
    gap: 8,
    crossAlign: "center",
    fill: "none"
  });
  await createText(client, bKurirTop, "ic", "\u21F6", { fontSize: 16, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, bKurirTop, "t", "Truk Daisuki", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, bKurir, "val", "PO-2611", {
    fontSize: 24,
    fontFamily: "Bricolage Grotesque",
    fontStyle: "Bold",
    fill: C.textBlack
  });
  await createText(client, bKurir, "sub", "80 pcs dalam pengiriman", { fontSize: 12, fill: C.textBlack });
  const bStokToko = await createAutoFrame(client, s2Content, "Card_Stok_Toko", 400, 165, {
    layout: "vertical",
    padding: 18,
    gap: 12,
    cornerRadius: 28,
    fill: C.mint,
    sizingH: "fill"
  });
  const bStokTop = await createAutoFrame(client, bStokToko, "Top", 364, 20, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none"
  });
  await createText(client, bStokTop, "t", "Sisa Stok Toko", { fontSize: 13, fontStyle: "Bold", fill: C.mintDark });
  await createText(client, bStokTop, "status", "Status: 1 Kritis, 2 Aman", { fontSize: 12, fontStyle: "Bold", fill: C.mintDark });
  await createText(client, bStokToko, "msg", "Makaroni Daun Jeruk sisa 4 pcs. Perlu restock.", {
    fontSize: 16,
    fontStyle: "Bold",
    fill: C.textBlack
  });
  const bStokBtns = await createAutoFrame(client, bStokToko, "Btns", 364, 46, {
    layout: "horizontal",
    gap: 14,
    fill: "none",
    sizingH: "fill"
  });
  const btnCatat = await createAutoFrame(client, bStokBtns, "btn_catat", 175, 46, {
    cornerRadius: 16,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "fill"
  });
  await createText(client, btnCatat, "t", "Hitung Fisik", { fontSize: 15, fontStyle: "Bold", fill: "#FFFFFF" });
  const btnPesan = await createAutoFrame(client, bStokBtns, "btn_pesan", 175, 46, {
    cornerRadius: 16,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "fill"
  });
  await createText(client, btnPesan, "t", "Pesan Restock", { fontSize: 15, fontStyle: "Bold", fill: "#FFFFFF" });
  await attachDaisukiNav(dev2.screenId, "Stok");
  console.log("Creating Screen 3: 03_Catat_Stok_Fisik...");
  const dev3 = await createDeviceWrapper("03_Catat_Stok_Fisik", screenCoords[2].x, screenCoords[2].y, screenCoords[2].label, C.bgWhite);
  screens.push(dev3.deviceId);
  const s3Content = await createAutoFrame(client, dev3.screenId, "Content", 400, 750, {
    x: 20,
    y: 70,
    layout: "vertical",
    gap: 14,
    fill: "none",
    sizingH: "fixed",
    sizingV: "hug"
  });
  const s3Header = await createAutoFrame(client, s3Content, "Header", 400, 44, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill"
  });
  const s3Back = await createAutoFrame(client, s3Header, "btn_back_s3", 40, 40, {
    cornerRadius: 20,
    fill: "#F4F4F5",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, s3Back, "t", "\u2039", { fontSize: 22, fontStyle: "Bold", fill: C.textBlack });
  const s3TitleWrap = await createAutoFrame(client, s3Header, "Title_Wrap", 240, 40, {
    layout: "vertical",
    crossAlign: "center",
    fill: "none"
  });
  await createText(client, s3TitleWrap, "t", "Laporan Stok Fisik", { fontSize: 17, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, s3TitleWrap, "s", "Input sisa di rak toko sekarang", { fontSize: 12, fill: C.textGray });
  const s3SaveIcon = await createAutoFrame(client, s3Header, "btn_sync", 40, 40, {
    cornerRadius: 20,
    fill: "#F4F4F5",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, s3SaveIcon, "t", "\u2713", { fontSize: 18, fontStyle: "Bold", fill: C.textBlack });
  const s3Banner = await createAutoFrame(client, s3Content, "Banner_Policy", 400, 52, {
    layout: "horizontal",
    padding: [10, 14],
    gap: 8,
    cornerRadius: 16,
    fill: "#EFF6FF",
    crossAlign: "center",
    sizingH: "fill"
  });
  await createText(client, s3Banner, "i", "\u2139", { fontSize: 15, fontStyle: "Bold", fill: "#1E40AF" });
  await createText(client, s3Banner, "t", "Stok bebas bertambah tanpa batas rak maksimal.", {
    fontSize: 12,
    fontStyle: "Medium",
    fill: "#1E40AF"
  });
  const pCard1 = await createAutoFrame(client, s3Content, "Card_Basreng", 400, 110, {
    layout: "horizontal",
    padding: 16,
    cornerRadius: 24,
    fill: "#F8FAFC",
    stroke: "#E2E8F0",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    sizingH: "fill"
  });
  const p1Left = await createAutoFrame(client, pCard1, "Left", 200, 70, { layout: "vertical", gap: 4, fill: "none" });
  await createBadge(p1Left, "Aman (>50%)", "#E3F4EA", "#14653A", 10);
  await createText(client, p1Left, "n", "Basreng Daun Jeruk", { fontSize: 15, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, p1Left, "s", "Buffer minimal: 20 pcs", { fontSize: 12, fill: C.textGray });
  const p1Stepper = await createAutoFrame(client, pCard1, "Stepper", 140, 48, {
    layout: "horizontal",
    padding: 4,
    cornerRadius: 24,
    fill: "#FFFFFF",
    stroke: "#CBD5E1",
    mainAlign: "spaceBetween",
    crossAlign: "center"
  });
  const btnMinus1 = await createAutoFrame(client, p1Stepper, "minus", 40, 40, { cornerRadius: 20, fill: "#F1F5F9", mainAlign: "center", crossAlign: "center" });
  await createText(client, btnMinus1, "t", "\u2212", { fontSize: 18, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, p1Stepper, "qty", "58 pcs", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  const btnPlus1 = await createAutoFrame(client, p1Stepper, "plus", 40, 40, { cornerRadius: 20, fill: C.textBlack, mainAlign: "center", crossAlign: "center" });
  await createText(client, btnPlus1, "t", "+", { fontSize: 18, fontStyle: "Bold", fill: "#FFFFFF" });
  const pCard2 = await createAutoFrame(client, s3Content, "Card_SausKeju", 400, 110, {
    layout: "horizontal",
    padding: 16,
    cornerRadius: 24,
    fill: "#FFF5F5",
    stroke: "#FCA5A5",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    sizingH: "fill"
  });
  const p2Left = await createAutoFrame(client, pCard2, "Left", 200, 70, { layout: "vertical", gap: 4, fill: "none" });
  await createBadge(p2Left, "Kritis (<=20%)", "#FDE7E7", "#9B1C1C", 10);
  await createText(client, p2Left, "n", "Makaroni Daun Jeruk", { fontSize: 15, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, p2Left, "s", "Buffer minimal: 10 pcs", { fontSize: 12, fill: "#9B1C1C" });
  const p2Stepper = await createAutoFrame(client, pCard2, "Stepper", 140, 48, {
    layout: "horizontal",
    padding: 4,
    cornerRadius: 24,
    fill: "#FFFFFF",
    stroke: "#FCA5A5",
    mainAlign: "spaceBetween",
    crossAlign: "center"
  });
  const btnMinus2 = await createAutoFrame(client, p2Stepper, "minus", 40, 40, { cornerRadius: 20, fill: "#FEE2E2", mainAlign: "center", crossAlign: "center" });
  await createText(client, btnMinus2, "t", "\u2212", { fontSize: 18, fontStyle: "Bold", fill: "#9B1C1C" });
  await createText(client, p2Stepper, "qty", "4 pcs", { fontSize: 14, fontStyle: "Bold", fill: "#9B1C1C" });
  const btnPlus2 = await createAutoFrame(client, p2Stepper, "plus", 40, 40, { cornerRadius: 20, fill: C.textBlack, mainAlign: "center", crossAlign: "center" });
  await createText(client, btnPlus2, "t", "+", { fontSize: 18, fontStyle: "Bold", fill: "#FFFFFF" });
  const pCard3 = await createAutoFrame(client, s3Content, "Card_Seblak", 400, 110, {
    layout: "horizontal",
    padding: 16,
    cornerRadius: 24,
    fill: "#FEFCE8",
    stroke: "#FDE047",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    sizingH: "fill"
  });
  const p3Left = await createAutoFrame(client, pCard3, "Left", 200, 70, { layout: "vertical", gap: 4, fill: "none" });
  await createBadge(p3Left, "Waspada (20-50%)", "#FFF3CC", "#7A5200", 10);
  await createText(client, p3Left, "n", "Seblak Jadul Instan", { fontSize: 15, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, p3Left, "s", "Buffer minimal: 15 pcs", { fontSize: 12, fill: "#7A5200" });
  const p3Stepper = await createAutoFrame(client, pCard3, "Stepper", 140, 48, {
    layout: "horizontal",
    padding: 4,
    cornerRadius: 24,
    fill: "#FFFFFF",
    stroke: "#FDE047",
    mainAlign: "spaceBetween",
    crossAlign: "center"
  });
  const btnMinus3 = await createAutoFrame(client, p3Stepper, "minus", 40, 40, { cornerRadius: 20, fill: "#FEF9C3", mainAlign: "center", crossAlign: "center" });
  await createText(client, btnMinus3, "t", "\u2212", { fontSize: 18, fontStyle: "Bold", fill: "#7A5200" });
  await createText(client, p3Stepper, "qty", "18 pcs", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  const btnPlus3 = await createAutoFrame(client, p3Stepper, "plus", 40, 40, { cornerRadius: 20, fill: C.textBlack, mainAlign: "center", crossAlign: "center" });
  await createText(client, btnPlus3, "t", "+", { fontSize: 18, fontStyle: "Bold", fill: "#FFFFFF" });
  const pCard4 = await createAutoFrame(client, s3Content, "Card_Keripik_Pisang", 400, 100, {
    layout: "horizontal",
    padding: 16,
    cornerRadius: 12,
    fill: C.bgWhite,
    stroke: "#DDE1E8",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    sizingH: "fill"
  });
  const p4Left = await createAutoFrame(client, pCard4, "Left", 200, 64, { layout: "vertical", gap: 4, fill: "none" });
  await createBadge(p4Left, "Aman", "#E3F4EA", "#14653A", 10);
  await createText(client, p4Left, "name", "Keripik Pisang Rasa Coklat", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, p4Left, "buffer", "Buffer minimal: 18 pcs", { fontSize: 12, fill: C.textGray });
  const p4Stepper = await createAutoFrame(client, pCard4, "Stepper", 140, 48, {
    layout: "horizontal",
    padding: 4,
    cornerRadius: 10,
    fill: C.bgWhite,
    stroke: "#DDE1E8",
    mainAlign: "spaceBetween",
    crossAlign: "center"
  });
  const btnMinus4 = await createAutoFrame(client, p4Stepper, "minus", 44, 44, { cornerRadius: 8, fill: "#F6F7F9", mainAlign: "center", crossAlign: "center" });
  await createText(client, btnMinus4, "label", "\u2212", { fontSize: 18, fill: C.textBlack });
  await createText(client, p4Stepper, "qty", "42 pcs", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  const btnPlus4 = await createAutoFrame(client, p4Stepper, "plus", 44, 44, { cornerRadius: 8, fill: C.textBlack, mainAlign: "center", crossAlign: "center" });
  await createText(client, btnPlus4, "label", "+", { fontSize: 18, fill: C.bgWhite });
  const btnSaveStok = await createAutoFrame(client, s3Content, "btn_simpan_stok", 400, 56, {
    cornerRadius: 28,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "fill",
    sizingV: "fixed"
  });
  await createText(client, btnSaveStok, "t", "Simpan Laporan Stok Fisik \u2794", {
    fontSize: 16,
    fontStyle: "Bold",
    fill: "#FFFFFF"
  });
  await attachDaisukiNav(dev3.screenId, "Stok");
  console.log("Creating Screen 4: 04_Pemesanan_Restock...");
  const dev4 = await createDeviceWrapper("04_Pemesanan_Restock", screenCoords[3].x, screenCoords[3].y, screenCoords[3].label, C.bgApp);
  screens.push(dev4.deviceId);
  const s4Content = await createAutoFrame(client, dev4.screenId, "Content", 400, 750, {
    x: 20,
    y: 70,
    layout: "vertical",
    gap: 14,
    fill: "none",
    sizingH: "fixed",
    sizingV: "hug"
  });
  const s4Header = await createAutoFrame(client, s4Content, "Header", 400, 40, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill"
  });
  const s4Close = await createAutoFrame(client, s4Header, "btn_close_s4", 40, 40, {
    cornerRadius: 20,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, s4Close, "t", "\u2715", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, s4Header, "t", "Pengajuan Restock", { fontSize: 16, fontStyle: "Bold", fill: C.textBlack });
  const s4Help = await createAutoFrame(client, s4Header, "btn_help", 40, 40, {
    cornerRadius: 20,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, s4Help, "t", "?", { fontSize: 15, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, s4Content, "headline", `Kirim pesanan pasokan
langsung ke gudang pusat.`, {
    fontSize: 28,
    fontFamily: "Bricolage Grotesque",
    fontStyle: "Bold",
    fill: C.textBlack
  });
  const s4AiAlert = await createAutoFrame(client, s4Content, "Card_AI_Alert", 400, 85, {
    layout: "horizontal",
    padding: 16,
    gap: 12,
    cornerRadius: 24,
    fill: "#FEE2E2",
    crossAlign: "center",
    sizingH: "fill"
  });
  const aiBadgeWrap = await createAutoFrame(client, s4AiAlert, "AiIconWrap", 44, 44, {
    cornerRadius: 22,
    fill: "#FECACA",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, aiBadgeWrap, "ic", "\u2726", { fontSize: 20, fontStyle: "Bold", fill: "#991B1B" });
  const aiTxt = await createAutoFrame(client, s4AiAlert, "Txt", 310, 50, { layout: "vertical", gap: 3, fill: "none" });
  await createText(client, aiTxt, "title", "Saran pasokan dari buffer stok", { fontSize: 13, fontStyle: "Bold", fill: "#991B1B" });
  await createText(client, aiTxt, "sub", "Makaroni tersisa 4 pcs. Selisih dari buffer 10 pcs adalah 6 pcs.", { fontSize: 12, fill: "#7F1D1D" });
  const oCard1 = await createAutoFrame(client, s4Content, "Order_Item_1", 400, 85, {
    layout: "horizontal",
    padding: 16,
    cornerRadius: 24,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    sizingH: "fill"
  });
  const o1L = await createAutoFrame(client, oCard1, "L", 220, 48, { layout: "vertical", gap: 2, fill: "none" });
  await createText(client, o1L, "n", "Makaroni Daun Jeruk", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  await createBadge(o1L, "Prioritas Kritis", "#FEE2E2", "#991B1B", 9);
  const o1R = await createAutoFrame(client, oCard1, "R", 110, 40, {
    cornerRadius: 12,
    fill: "#F4F4F5",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, o1R, "qty", "30 pcs", { fontSize: 16, fontStyle: "Bold", fill: C.textBlack });
  const oCard2 = await createAutoFrame(client, s4Content, "Order_Item_2", 400, 85, {
    layout: "horizontal",
    padding: 16,
    cornerRadius: 24,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    sizingH: "fill"
  });
  const o2L = await createAutoFrame(client, oCard2, "L", 220, 48, { layout: "vertical", gap: 2, fill: "none" });
  await createText(client, o2L, "n", "Basreng Daun Jeruk", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  await createBadge(o2L, "Restock Rutin", "#E0F2FE", "#0369A1", 9);
  const o2R = await createAutoFrame(client, oCard2, "R", 110, 40, {
    cornerRadius: 12,
    fill: "#F4F4F5",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, o2R, "qty", "50 pcs", { fontSize: 16, fontStyle: "Bold", fill: C.textBlack });
  const otherProducts = [
    { name: "Seblak Jadul Instan", available: "720 pcs tersedia di pusat" },
    { name: "Keripik Pisang Rasa Coklat", available: "640 pcs tersedia di pusat" }
  ];
  for (const product of otherProducts) {
    const row = await createAutoFrame(client, s4Content, `Order_Option_${product.name}`, 400, 54, {
      layout: "horizontal",
      padding: [8, 14],
      cornerRadius: 10,
      fill: C.bgWhite,
      stroke: "#DDE1E8",
      mainAlign: "spaceBetween",
      crossAlign: "center",
      sizingH: "fill"
    });
    const info = await createAutoFrame(client, row, "Info", 290, 44, { layout: "vertical", gap: 2, fill: "none" });
    await createText(client, info, "name", product.name, { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
    await createText(client, info, "available", product.available, { fontSize: 11, fill: C.textGray });
    await createText(client, row, "add", "Tambah", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  }
  const s4Note = await createAutoFrame(client, s4Content, "Card_Catatan", 400, 85, {
    layout: "vertical",
    padding: 14,
    gap: 6,
    cornerRadius: 22,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    sizingH: "fill"
  });
  await createText(client, s4Note, "lbl", "Catatan Pesanan Pengiriman", { fontSize: 12, fontStyle: "Bold", fill: C.textGray });
  await createText(client, s4Note, "txt", "Mohon kirim armada kurir sebelum jam 11:00 siang.", { fontSize: 13, fill: C.textBlack });
  const btnKirimRestock = await createAutoFrame(client, s4Content, "btn_kirim_restock", 400, 56, {
    cornerRadius: 28,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "fill",
    sizingV: "fixed"
  });
  await createText(client, btnKirimRestock, "t", "Kirim Pengajuan (Total 80 pcs) \u2794", {
    fontSize: 16,
    fontStyle: "Bold",
    fill: "#FFFFFF"
  });
  await attachDaisukiNav(dev4.screenId, "Pesan");
  console.log("Creating Screen 5: 05_Lacak_Pengiriman...");
  const dev5 = await createDeviceWrapper("05_Lacak_Pengiriman", screenCoords[4].x, screenCoords[4].y, screenCoords[4].label, C.bgApp);
  screens.push(dev5.deviceId);
  const s5Content = await createAutoFrame(client, dev5.screenId, "Content", 400, 750, {
    x: 20,
    y: 70,
    layout: "vertical",
    gap: 16,
    fill: "none",
    sizingH: "fixed",
    sizingV: "hug"
  });
  const s5Header = await createAutoFrame(client, s5Content, "Header", 400, 40, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill"
  });
  await createText(client, s5Header, "t", "Status Pengiriman", {
    fontSize: 24,
    fontFamily: "Bricolage Grotesque",
    fontStyle: "Bold",
    fill: C.textBlack
  });
  const btnAjukanBaru = await createAutoFrame(client, s5Header, "btn_ajukan_baru", 120, 36, {
    cornerRadius: 18,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, btnAjukanBaru, "t", "+ Restock Baru", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  const statusFilters = await createAutoFrame(client, s5Content, "Status_Filters", 400, 92, {
    layout: "vertical",
    gap: 6,
    fill: "none",
    sizingH: "fill"
  });
  for (const labels of [["Semua", "Menunggu", "Disetujui"], ["Dalam Pengiriman", "Selesai"]]) {
    const row = await createAutoFrame(client, statusFilters, `Filter_Row_${labels[0]}`, 400, 42, {
      layout: "horizontal",
      gap: 6,
      fill: "none",
      crossAlign: "center",
      sizingH: "fill"
    });
    for (const label of labels) {
      const active = label === "Semua";
      const filter = await createAutoFrame(client, row, `Filter_${label}`, label === "Dalam Pengiriman" ? 158 : label === "Menunggu" ? 108 : 92, 42, {
        layout: "horizontal",
        padding: [8, 12],
        cornerRadius: 8,
        fill: active ? C.textBlack : C.bgWhite,
        stroke: active ? C.textBlack : "#DDE1E8",
        mainAlign: "center",
        crossAlign: "center"
      });
      await createText(client, filter, "label", label, { fontSize: 11, fontStyle: "Bold", fill: active ? C.bgWhite : C.textBlack });
    }
  }
  const s5PoCard = await createAutoFrame(client, s5Content, "Card_PO_Aktif", 400, 220, {
    layout: "vertical",
    padding: 18,
    gap: 12,
    cornerRadius: 28,
    fill: C.lavender,
    sizingH: "fill"
  });
  const poTop = await createAutoFrame(client, s5PoCard, "Top", 364, 24, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none"
  });
  await createText(client, poTop, "po", "#PO-20261105-01", { fontSize: 16, fontStyle: "Bold", fill: C.textBlack });
  await createBadge(poTop, "Dalam Pengiriman", "#26336B", "#FFFFFF", 10);
  const kurirInfo = await createAutoFrame(client, s5PoCard, "Kurir_Row", 364, 48, {
    layout: "horizontal",
    gap: 10,
    crossAlign: "center",
    fill: "none"
  });
  const kurirIcon = await createAutoFrame(client, kurirInfo, "Icon", 44, 44, {
    cornerRadius: 22,
    fill: "#FFFFFF",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, kurirIcon, "ic", "\u21F6", { fontSize: 22, fontStyle: "Bold", fill: "#4338CA" });
  const kurirMeta = await createAutoFrame(client, kurirInfo, "Meta", 290, 42, { layout: "vertical", gap: 2, fill: "none" });
  await createText(client, kurirMeta, "t", "Detail armada belum tersedia", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, kurirMeta, "s", "Identitas kurir dan estimasi tiba belum tersedia", { fontSize: 12, fill: "#4B5563" });
  const rincianBox = await createAutoFrame(client, s5PoCard, "Rincian", 364, 40, {
    layout: "horizontal",
    padding: [8, 12],
    cornerRadius: 12,
    fill: "#FFFFFF",
    crossAlign: "center",
    mainAlign: "spaceBetween"
  });
  await createText(client, rincianBox, "i1", "\u25A0 50 pcs Basreng Daun Jeruk", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, rincianBox, "i2", "\u25A0 30 pcs Makaroni Daun Jeruk", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  const btnKonfirm = await createAutoFrame(client, s5PoCard, "btn_konfirmasi_terima", 364, 44, {
    cornerRadius: 14,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, btnKonfirm, "t", "Pindai Barcode Kardus & Terima \u2794", {
    fontSize: 14,
    fontStyle: "Bold",
    fill: "#FFFFFF"
  });
  const s5DoneCard = await createAutoFrame(client, s5Content, "Card_PO_Selesai", 400, 110, {
    layout: "vertical",
    padding: 16,
    gap: 8,
    cornerRadius: 26,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    sizingH: "fill"
  });
  const doneTop = await createAutoFrame(client, s5DoneCard, "Top", 368, 22, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none"
  });
  await createText(client, doneTop, "po", "#PO-20261101-04", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  await createBadge(doneTop, "Selesai Diterima", "#E3F4EA", "#14653A", 10);
  await createText(client, s5DoneCard, "sub", "Diterima 01 Nov 2026 \u2022 Total 120 pcs berhasil masuk ke stok toko.", {
    fontSize: 12,
    fill: C.textGray
  });
  await attachDaisukiNav(dev5.screenId, "Lacak");
  console.log("Creating Screen 6: 06_Profil_Cabang...");
  const dev6 = await createDeviceWrapper("06_Profil_Cabang", screenCoords[5].x, screenCoords[5].y, screenCoords[5].label, C.bgApp);
  screens.push(dev6.deviceId);
  const s6Content = await createAutoFrame(client, dev6.screenId, "Content", 400, 750, {
    x: 20,
    y: 70,
    layout: "vertical",
    gap: 16,
    fill: "none",
    sizingH: "fixed",
    sizingV: "hug"
  });
  const s6Header = await createAutoFrame(client, s6Content, "Header", 400, 40, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill"
  });
  await createText(client, s6Header, "t", "Profil Cabang", {
    fontSize: 24,
    fontFamily: "Bricolage Grotesque",
    fontStyle: "Bold",
    fill: C.textBlack
  });
  const btnLogout = await createAutoFrame(client, s6Header, "btn_logout", 90, 36, {
    cornerRadius: 18,
    fill: "#FEE2E2",
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, btnLogout, "t", "Keluar", { fontSize: 12, fontStyle: "Bold", fill: "#991B1B" });
  const s6UserCard = await createAutoFrame(client, s6Content, "Card_Branch_Detail", 400, 115, {
    layout: "horizontal",
    padding: 18,
    gap: 16,
    cornerRadius: 28,
    fill: C.lavender,
    crossAlign: "center",
    sizingH: "fill"
  });
  const s6Av = await createAutoFrame(client, s6UserCard, "Big_Logo", 68, 68, {
    cornerRadius: 34,
    fill: C.brandUme,
    mainAlign: "center",
    crossAlign: "center"
  });
  await createText(client, s6Av, "ic", "KS", { fontSize: 24, fontStyle: "Bold", fill: "#FFFFFF" });
  const s6UserMeta = await createAutoFrame(client, s6UserCard, "Meta", 260, 68, {
    layout: "vertical",
    gap: 4,
    fill: "none"
  });
  await createText(client, s6UserMeta, "n", "Kafe Sejuk Kenjeran", {
    fontSize: 20,
    fontFamily: "Bricolage Grotesque",
    fontStyle: "Bold",
    fill: C.textBlack
  });
  await createText(client, s6UserMeta, "id", "ID Mitra: DSK-MTR-0042 \u2022 Surabaya", { fontSize: 12, fill: "#4B5563" });
  await createBadge(s6UserMeta, "Akun Resmi Terverifikasi", "#E0F2FE", "#0369A1", 11);
  const s6DbCard = await createAutoFrame(client, s6Content, "Card_Database_Info", 400, 115, {
    layout: "vertical",
    padding: 16,
    gap: 8,
    cornerRadius: 28,
    fill: C.peach,
    sizingH: "fill"
  });
  const dbTop = await createAutoFrame(client, s6DbCard, "Top", 368, 20, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none"
  });
  await createText(client, dbTop, "t", "Neon DB Cloud Synchronized", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  await createBadge(dbTop, "Status contoh", "#E3F4EA", "#14653A", 10);
  await createText(client, s6DbCard, "desc", "Stok dan pengiriman terhubung otomatis ke sistem sentral Daisuki tanpa delay pencatatan manual.", {
    fontSize: 12,
    fill: C.textBlack
  });
  const s6Settings = await createAutoFrame(client, s6Content, "Card_Settings_Toggles", 400, 180, {
    layout: "vertical",
    padding: [10, 18],
    gap: 8,
    cornerRadius: 28,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    sizingH: "fill"
  });
  const t1 = await createAutoFrame(client, s6Settings, "Toggle_Restock", 364, 46, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill"
  });
  const t1L = await createAutoFrame(client, t1, "L", 280, 40, { layout: "vertical", fill: "none" });
  await createText(client, t1L, "t", "Peringatan Stok Kritis (Push)", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, t1L, "s", "Beri tahu jika sisa stok <= 20%", { fontSize: 11, fill: C.textGray });
  const sw1 = await createAutoFrame(client, t1, "Sw_On", 48, 28, {
    cornerRadius: 14,
    fill: C.textBlack,
    layout: "horizontal",
    padding: 3,
    mainAlign: "max",
    crossAlign: "center"
  });
  await createAutoFrame(client, sw1, "k", 22, 22, { cornerRadius: 11, fill: "#FFFFFF" });
  const t2 = await createAutoFrame(client, s6Settings, "Toggle_Kurir", 364, 46, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill"
  });
  const t2L = await createAutoFrame(client, t2, "L", 280, 40, { layout: "vertical", fill: "none" });
  await createText(client, t2L, "t", "Pelacakan Armada Kurir", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, t2L, "s", "Info real-time saat truk mendekati toko", { fontSize: 11, fill: C.textGray });
  const sw2 = await createAutoFrame(client, t2, "Sw_On2", 48, 28, {
    cornerRadius: 14,
    fill: C.textBlack,
    layout: "horizontal",
    padding: 3,
    mainAlign: "max",
    crossAlign: "center"
  });
  await createAutoFrame(client, sw2, "k", 22, 22, { cornerRadius: 11, fill: "#FFFFFF" });
  const t3 = await createAutoFrame(client, s6Settings, "Toggle_Theme", 364, 46, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill"
  });
  const t3L = await createAutoFrame(client, t3, "L", 280, 40, { layout: "vertical", fill: "none" });
  await createText(client, t3L, "t", "Tema Terang", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, t3L, "s", "Preferensi tampilan prototipe", { fontSize: 11, fill: C.textGray });
  const sw3 = await createAutoFrame(client, t3, "Sw_Off", 48, 28, {
    cornerRadius: 14,
    fill: "#E4E4E7",
    layout: "horizontal",
    padding: 3,
    mainAlign: "min",
    crossAlign: "center"
  });
  await createAutoFrame(client, sw3, "k", 22, 22, { cornerRadius: 11, fill: "#FFFFFF" });
  await attachDaisukiNav(dev6.screenId, "Profil");
  console.log(" Wiring Interactive Buttons and Prototype Connections...");
  await client.runCommand("proto.interaction.add", {
    id: s1Pill,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev2.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: s2MitraInfo,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev6.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: btnChipStok,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev3.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: btnChipPesan,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev4.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: btnChipKurir,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev5.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: btnChipAi,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev4.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: bKurir,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev5.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: btnCatat,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev3.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: btnPesan,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev4.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: s3Back,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev2.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: btnSaveStok,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev2.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: s4Close,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev2.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: btnKirimRestock,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev5.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: btnAjukanBaru,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev4.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: btnKonfirm,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev2.screenId },
    transition: { type: "smartAnimate" }
  });
  await client.runCommand("proto.interaction.add", {
    id: btnLogout,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev1.screenId },
    transition: { type: "smartAnimate" }
  });
  for (const nav of navTabButtons) {
    if (nav.screenId !== dev2.screenId && nav.tabStokId) {
      await client.runCommand("proto.interaction.add", {
        id: nav.tabStokId,
        trigger: { type: "onClick" },
        action: { type: "navigate", dest: dev2.screenId },
        transition: { type: "smartAnimate" }
      });
    }
    if (nav.screenId !== dev4.screenId && nav.tabPesanId) {
      await client.runCommand("proto.interaction.add", {
        id: nav.tabPesanId,
        trigger: { type: "onClick" },
        action: { type: "navigate", dest: dev4.screenId },
        transition: { type: "smartAnimate" }
      });
    }
    if (nav.screenId !== dev5.screenId && nav.tabLacakId) {
      await client.runCommand("proto.interaction.add", {
        id: nav.tabLacakId,
        trigger: { type: "onClick" },
        action: { type: "navigate", dest: dev5.screenId },
        transition: { type: "smartAnimate" }
      });
    }
    if (nav.screenId !== dev6.screenId && nav.tabProfilId) {
      await client.runCommand("proto.interaction.add", {
        id: nav.tabProfilId,
        trigger: { type: "onClick" },
        action: { type: "navigate", dest: dev6.screenId },
        transition: { type: "smartAnimate" }
      });
    }
  }
  await client.runCommand("proto.flow.add", {
    start: dev1.deviceId,
    name: "Daisuki B2B Mitra Interactive Experience"
  });
  await client.runCommand("view.set", {
    cx: 800,
    cy: 1000,
    zoom: 0.35
  });
  console.log(" ALL MITRA SCREENS GENERATED & FULLY WIRED FOR PROTOTYPING!");
  return { screens };
}
if (import.meta.main) {
  const client = new FigCraftClient;
  client.connect().then(async () => {
    await buildDaisukiBento(client);
    client.close();
    process.exit(0);
  }).catch((err) => {
    console.error("FigCraft Connection Error:", err.message);
    process.exit(1);
  });
}
export {
  buildDaisukiBento
};
