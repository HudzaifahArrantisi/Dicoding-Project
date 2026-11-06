import { FigCraftClient, createAutoFrame, createText, createBadge } from "./figcraft-helper";

/**
 * MoodLy - Playful Mood Tracking & Wellbeing App
 * 6 Mobile Screens wrapped in iPhone 17 Pro Max frames (440x956)
 * Grid of 6 phones (3 per row, 80px gap) with labels above each phone
 */

// Design System Tokens
const C = {
  bgApp: "#EDE9F5",      // Light Lavender App Background
  bgWhite: "#FFFFFF",    // White Card Surface
  textBlack: "#0A0A0A",  // Deep Charcoal Black
  textGray: "#6B6B76",   // Neutral Gray Captions
  textSubtle: "#9CA3AF", // Light Gray
  bezel: "#0A0A0A",      // iPhone Titanium / Black Bezel
  navBlack: "#0A0A0A",   // Black Pill Nav Bar

  // Pastel Color Palette
  mint: "#B6F5A0",       // Calm / Happy / Steps
  peach: "#FFB38A",      // Sleep / Warm / Angry
  lavender: "#D4B8FF",   // Stress / Calm / User
  pink: "#FFB3D9",       // Bored / Sad / Streak
  sky: "#9CC4FF",        // Sleepy / Serene
  yellow: "#FFD84D",     // Energy / Joy / Radiant
  coral: "#FF7F7F",      // Stressed / High Alert
};

export async function buildMoodly(client: FigCraftClient) {
  console.log("🎨 Building MoodLy 6-Screen Suite in iPhone 17 Pro Max Device Frames...");

  // Canvas Paper Background
  await client.runCommand("page.setBackground", { color: "#F0EDF7" });

  // Grid coordinates: 3 phones per row, 80px gap
  // Phone outer frame: 464 x 980 (Bezel 12px around 440x956 screen)
  const phoneW = 464;
  const phoneH = 980;
  const gapX = 80;
  const gapY = 100;
  const startX = 60;
  const startY = 80; // leaves space for labels above at y=30 and y=1160

  const screenCoords = [
    { x: startX + 0 * (phoneW + gapX), y: startY, label: "01_Onboarding" },
    { x: startX + 1 * (phoneW + gapX), y: startY, label: "02_Dashboard" },
    { x: startX + 2 * (phoneW + gapX), y: startY, label: "03_Calendar" },
    { x: startX + 0 * (phoneW + gapX), y: startY + phoneH + gapY, label: "04_CheckIn" },
    { x: startX + 1 * (phoneW + gapX), y: startY + phoneH + gapY, label: "05_Insights" },
    { x: startX + 2 * (phoneW + gapX), y: startY + phoneH + gapY, label: "06_Profile" },
  ];

  const screens: number[] = [];

  // =========================================================================
  // HELPER: Create iPhone 17 Pro Max Mockup Wrapper
  // =========================================================================
  async function createDeviceWrapper(
    name: string,
    x: number,
    y: number,
    label: string,
    screenBg: string
  ): Promise<{ deviceId: number; screenId: number }> {
    // 1. Text label above phone
    await createText(client, undefined as any, `Label_${name}`, label, {
      x,
      y: y - 36,
      fontSize: 20,
      fontFamily: "Plus Jakarta Sans",
      fontStyle: "Bold",
      fill: C.textBlack,
    });

    // 2. Outer Device Bezel Frame (464 x 980, outer corner radius 62px)
    const deviceId = await createAutoFrame(client, undefined, name, 464, 980, {
      x,
      y,
      layout: null, // manual coordinate layout for overlays (Island, status bar, screen, home indicator)
      fill: C.bezel,
      cornerRadius: 62,
      clip: true,
      sizingH: "fixed",
      sizingV: "fixed",
    });

    // 3. Inner Screen Frame (440 x 956, inner corner radius 50px, placed at 12, 12)
    const screenId = await createAutoFrame(client, deviceId, "Screen_Canvas", 440, 956, {
      x: 12,
      y: 12,
      layout: null,
      fill: screenBg,
      cornerRadius: 50,
      clip: true,
      sizingH: "fixed",
      sizingV: "fixed",
    });

    // 4. Status Bar (Height 62px, starts at top of screen)
    const statusBar = await createAutoFrame(client, screenId, "Status_Bar", 440, 62, {
      x: 0,
      y: 0,
      layout: "horizontal",
      padding: [18, 32, 0, 32],
      mainAlign: "spaceBetween",
      crossAlign: "center",
      fill: "none",
    });
    // Time Left (9:41)
    await createText(client, statusBar, "time", "9:41", {
      fontSize: 15,
      fontFamily: "Plus Jakarta Sans",
      fontStyle: "Bold",
      fill: C.textBlack,
    });
    // Icons Right (Signal, Wifi, Battery)
    await createText(client, statusBar, "icons", "􀙇  􀺸  􀛨", {
      fontSize: 14,
      fontStyle: "Bold",
      fill: C.textBlack,
    });

    // 5. Dynamic Island (126 x 37, centered at x=157, 11px from top)
    const island = await createAutoFrame(client, screenId, "Dynamic_Island", 126, 37, {
      x: 157,
      y: 11,
      cornerRadius: 19,
      fill: "#000000",
      layout: "horizontal",
      mainAlign: "center",
      crossAlign: "center",
    });
    // Small camera sensor dot
    await createAutoFrame(client, island, "Sensor", 10, 10, {
      cornerRadius: 5,
      fill: "#141414",
    });

    // 6. Home Indicator (140 x 5, radius 3, centered at x=150, 8px from bottom -> y=943)
    await createAutoFrame(client, screenId, "Home_Indicator", 140, 5, {
      x: 150,
      y: 943,
      cornerRadius: 3,
      fill: C.textBlack,
    });

    return { deviceId, screenId };
  }

  // =========================================================================
  // HELPER: Reusable Identical Bottom Navigation Component
  // Position: x=20, width 400, height 68, bottom edge at y=900 (y = 832)
  // Black pill (#0A0A0A), radius 34px, active tab: white circle 48x48
  // =========================================================================
  async function attachBottomNav(screenId: number, activeTabName: "Home" | "Stats" | "Calendar" | "Menu") {
    const navBar = await createAutoFrame(client, screenId, "BottomNav", 400, 68, {
      x: 20,
      y: 832, // y=832 to y=900
      layout: "horizontal",
      padding: [10, 16],
      cornerRadius: 34,
      fill: C.navBlack,
      mainAlign: "spaceAround",
      crossAlign: "center",
      sizingH: "fixed",
      sizingV: "fixed",
    });

    const tabs: Array<{ name: "Home" | "Stats" | "Calendar" | "Menu"; icon: string }> = [
      { name: "Home", icon: "⌂" },
      { name: "Stats", icon: "◔" },
      { name: "Calendar", icon: "📅" },
      { name: "Menu", icon: "⠶" },
    ];

    for (const tab of tabs) {
      const isActive = tab.name === activeTabName;
      if (isActive) {
        // Active Tab: white circle 48x48 with black icon
        const activeCircle = await createAutoFrame(client, navBar, `Tab_${tab.name}_Active`, 48, 48, {
          cornerRadius: 24,
          fill: "#FFFFFF",
          mainAlign: "center",
          crossAlign: "center",
          sizingH: "fixed",
          sizingV: "fixed",
        });
        await createText(client, activeCircle, "ic", tab.icon, {
          fontSize: 18,
          fontStyle: "Bold",
          fill: C.textBlack,
        });
      } else {
        // Inactive Tab: white icon at 60% opacity
        const inactiveTab = await createAutoFrame(client, navBar, `Tab_${tab.name}`, 48, 48, {
          fill: "none",
          mainAlign: "center",
          crossAlign: "center",
          sizingH: "fixed",
          sizingV: "fixed",
        });
        await createText(client, inactiveTab, "ic", tab.icon, {
          fontSize: 18,
          fill: "#9898A0",
        });
      }
    }
    return navBar;
  }


  // =========================================================================
  // SCREEN 1: 01_Onboarding (White background, NO bottom nav)
  // =========================================================================
  console.log("Creating Screen 1: 01_Onboarding...");
  const dev1 = await createDeviceWrapper("01_Onboarding", screenCoords[0].x, screenCoords[0].y, screenCoords[0].label, "#FFFFFF");
  screens.push(dev1.deviceId);

  // Content Area starts at y=70, padding 20
  const s1Content = await createAutoFrame(client, dev1.screenId, "Content", 400, 850, {
    x: 20,
    y: 70,
    layout: "vertical",
    gap: 24,
    fill: "none",
    sizingH: "fixed",
    sizingV: "fixed",
  });

  // Headline: "Not Sure About Your Mood?" 44px bold, left-aligned, starts y=110
  const s1HeadWrap = await createAutoFrame(client, s1Content, "Headline_Wrap", 400, 160, {
    layout: "vertical",
    gap: 8,
    fill: "none",
    sizingH: "fill",
  });
  await createText(client, s1HeadWrap, "h", "Not Sure\nAbout Your\nMood?", {
    fontSize: 44,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });

  // Pill button "Let Us Help!" full text visible, light gray #EFEFEF, height 56, width 240
  // Directly 24px below headline, with black 48px circle arrow inside right end
  const s1Pill = await createAutoFrame(client, s1Content, "btn_let_us_help", 240, 56, {
    layout: "horizontal",
    padding: [4, 6, 4, 20],
    cornerRadius: 28,
    fill: "#EFEFEF",
    crossAlign: "center",
    mainAlign: "spaceBetween",
    sizingH: "fixed",
    sizingV: "fixed",
  });
  await createText(client, s1Pill, "lbl", "Let Us Help!", {
    fontSize: 16,
    fontStyle: "Bold",
    fill: C.textBlack,
  });
  const s1Arrow = await createAutoFrame(client, s1Pill, "Arrow_Circle", 48, 48, {
    cornerRadius: 24,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "fixed",
    sizingV: "fixed",
  });
  await createText(client, s1Arrow, "ic", "→", {
    fontSize: 20,
    fontStyle: "Bold",
    fill: "#FFFFFF",
  });

  // Bottom 55% of screen: cluster of 7 large mascot faces (130-170px) overlapping slightly
  const s1Cluster = await createAutoFrame(client, dev1.screenId, "Mascot_Cluster", 440, 530, {
    x: 0,
    y: 426,
    layout: null,
    fill: "none",
    clip: true,
  });

  // 1. Calm: Mint Circle (150x150)
  const mCalm = await createAutoFrame(client, s1Cluster, "Mascot_Calm_Circle", 150, 150, {
    x: 20,
    y: 20,
    cornerRadius: 75,
    fill: C.mint,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mCalm, "f", "◠ ‿ ◠", { fontSize: 32, fontStyle: "Bold", fill: C.textBlack });

  // 2. Dizzy: Purple Spiral (140x140)
  const mDizzy = await createAutoFrame(client, s1Cluster, "Mascot_Dizzy_Spiral", 140, 140, {
    x: 230,
    y: 10,
    cornerRadius: 50,
    fill: C.lavender,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mDizzy, "f", "◎ _ ◎", { fontSize: 28, fontStyle: "Bold", fill: C.textBlack });

  // 3. Sad: Pink Blob (140x140)
  const mSad = await createAutoFrame(client, s1Cluster, "Mascot_Sad_Blob", 140, 140, {
    x: -20,
    y: 170,
    cornerRadius: 55,
    fill: C.pink,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mSad, "f", "• ︵ •", { fontSize: 30, fontStyle: "Bold", fill: C.textBlack });

  // 4. Happy: Yellow Lightning (160x160)
  const mHappy = await createAutoFrame(client, s1Cluster, "Mascot_Happy_Lightning", 160, 160, {
    x: 130,
    y: 160,
    cornerRadius: 42,
    fill: C.yellow,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mHappy, "f", "★ ‿ ★", { fontSize: 36, fontStyle: "Bold", fill: C.textBlack });

  // 5. Angry: Peach Rounded Square (140x140)
  const mAngry = await createAutoFrame(client, s1Cluster, "Mascot_Angry_Square", 140, 140, {
    x: 290,
    y: 170,
    cornerRadius: 36,
    fill: C.peach,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mAngry, "f", "ˋ ︿ ˊ", { fontSize: 30, fontStyle: "Bold", fill: C.textBlack });

  // 6. Sleepy: Blue Dome (140x140)
  const mSleepy = await createAutoFrame(client, s1Cluster, "Mascot_Sleepy_Dome", 140, 140, {
    x: 30,
    y: 330,
    cornerRadius: 65,
    fill: C.sky,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mSleepy, "f", "◡ ｡ ◡", { fontSize: 28, fontStyle: "Bold", fill: C.textBlack });

  // 7. Stressed: Coral Triangle (150x150)
  const mStressed = await createAutoFrame(client, s1Cluster, "Mascot_Stressed_Triangle", 150, 150, {
    x: 220,
    y: 330,
    cornerRadius: 38,
    fill: C.coral,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mStressed, "f", "> ﹏ <", { fontSize: 30, fontStyle: "Bold", fill: C.textBlack });


  // =========================================================================
  // SCREEN 2: 02_Dashboard (Lavender background, Active Tab: Home)
  // =========================================================================
  console.log("Creating Screen 2: 02_Dashboard...");
  const dev2 = await createDeviceWrapper("02_Dashboard", screenCoords[1].x, screenCoords[1].y, screenCoords[1].label, C.bgApp);
  screens.push(dev2.deviceId);

  const s2Content = await createAutoFrame(client, dev2.screenId, "Content", 400, 750, {
    x: 20,
    y: 70,
    layout: "vertical",
    gap: 16,
    fill: "none",
    sizingH: "fixed",
    sizingV: "hug",
  });

  // Header row: avatar 44px, "Welcome back" caption + "Alex Miller" bold, round menu button right
  const s2Header = await createAutoFrame(client, s2Content, "Header", 400, 48, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  const s2User = await createAutoFrame(client, s2Header, "User_Info", 240, 44, {
    layout: "horizontal",
    gap: 12,
    crossAlign: "center",
    fill: "none",
  });
  const s2Av = await createAutoFrame(client, s2User, "Avatar", 44, 44, {
    cornerRadius: 22,
    fill: C.yellow,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s2Av, "ic", "🧑‍🦱", { fontSize: 22 });
  const s2UserMeta = await createAutoFrame(client, s2User, "Meta", 180, 40, {
    layout: "vertical",
    gap: 2,
    fill: "none",
  });
  await createText(client, s2UserMeta, "c", "Welcome back", { fontSize: 12, fill: C.textGray });
  await createText(client, s2UserMeta, "n", "Alex Miller", { fontSize: 16, fontStyle: "Bold", fill: C.textBlack });

  const s2MenuBtn = await createAutoFrame(client, s2Header, "btn_menu", 44, 44, {
    cornerRadius: 22,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s2MenuBtn, "ic", "☰", { fontSize: 18, fill: C.textBlack });

  // Date caption + Headline 32px bold
  const s2Greeting = await createAutoFrame(client, s2Content, "Greeting", 400, 80, {
    layout: "vertical",
    gap: 4,
    fill: "none",
    sizingH: "fill",
  });
  await createText(client, s2Greeting, "date", "Sep 14, 2025", { fontSize: 13, fontStyle: "Medium", fill: C.textGray });
  await createText(client, s2Greeting, "h", "Hello Alex! How are\nyou feeling today?", {
    fontSize: 32,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });

  // Mood chips row (horizontal, height 44)
  const s2Chips = await createAutoFrame(client, s2Content, "Mood_Chips_Row", 400, 44, {
    layout: "horizontal",
    gap: 10,
    fill: "none",
    sizingH: "fill",
  });
  const moodList = [
    { label: "Happy", icon: "◡‿◡", bg: C.mint },
    { label: "Angry", icon: "ˋ︿ˊ", bg: C.peach },
    { label: "Sleepy", icon: "• ｡ •", bg: C.sky },
    { label: "Bored", icon: "• ─ •", bg: C.pink },
  ];
  for (const m of moodList) {
    const chip = await createAutoFrame(client, s2Chips, `Chip_${m.label}`, 92, 44, {
      layout: "horizontal",
      gap: 8,
      padding: [8, 12],
      cornerRadius: 22,
      fill: C.bgWhite,
      crossAlign: "center",
      mainAlign: "center",
      sizingH: "fill",
    });
    const chipFace = await createAutoFrame(client, chip, "Face", 24, 24, {
      cornerRadius: 12,
      fill: m.bg,
      mainAlign: "center",
      crossAlign: "center",
    });
    await createText(client, chipFace, "e", "•", { fontSize: 11, fontStyle: "Bold", fill: C.textBlack });
    await createText(client, chip, "t", m.label, { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  }

  // Bento row: 2 cards each 192x170, gap 16
  const s2BentoRow = await createAutoFrame(client, s2Content, "Bento_Row", 400, 170, {
    layout: "horizontal",
    gap: 16,
    fill: "none",
    sizingH: "fill",
  });

  // Peach "Sleep Duration" with bar chart + "7h 20min"
  const cardSleep = await createAutoFrame(client, s2BentoRow, "Card_Sleep", 192, 170, {
    layout: "vertical",
    padding: 18,
    gap: 10,
    cornerRadius: 28,
    fill: C.peach,
    sizingH: "fill",
    mainAlign: "spaceBetween",
  });
  const slpTop = await createAutoFrame(client, cardSleep, "Top", 156, 22, {
    layout: "horizontal",
    gap: 8,
    crossAlign: "center",
    fill: "none",
  });
  await createText(client, slpTop, "ic", "🛏", { fontSize: 14 });
  await createText(client, slpTop, "t", "Sleep Duration", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });

  const slpBars = await createAutoFrame(client, cardSleep, "Bars", 156, 50, {
    layout: "horizontal",
    gap: 8,
    crossAlign: "max",
    fill: "none",
  });
  const bHeights1 = [24, 42, 32, 48, 38, 44];
  for (const h of bHeights1) {
    await createAutoFrame(client, slpBars, "bar", 16, h, { cornerRadius: 8, fill: "#E09068" });
  }
  await createText(client, cardSleep, "val", "7h 20min", {
    fontSize: 24,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });

  // Lavender "Stress Indicator" with ascending bars + "High"
  const cardStress = await createAutoFrame(client, s2BentoRow, "Card_Stress", 192, 170, {
    layout: "vertical",
    padding: 18,
    gap: 10,
    cornerRadius: 28,
    fill: C.lavender,
    sizingH: "fill",
    mainAlign: "spaceBetween",
  });
  const strTop = await createAutoFrame(client, cardStress, "Top", 156, 22, {
    layout: "horizontal",
    gap: 8,
    crossAlign: "center",
    fill: "none",
  });
  await createText(client, strTop, "ic", "⚡", { fontSize: 14 });
  await createText(client, strTop, "t", "Stress Indicator", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });

  const strBars = await createAutoFrame(client, cardStress, "Bars", 156, 50, {
    layout: "horizontal",
    gap: 8,
    crossAlign: "max",
    fill: "none",
  });
  const bHeights2 = [16, 22, 28, 36, 44, 50];
  for (const h of bHeights2) {
    await createAutoFrame(client, strBars, "bar", 16, h, { cornerRadius: 8, fill: "#BA98F0" });
  }
  await createText(client, cardStress, "val", "High", {
    fontSize: 24,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });

  // Full-width mint card (400x165) "Yes or No Quiz"
  const cardQuiz = await createAutoFrame(client, s2Content, "Card_Quiz", 400, 165, {
    layout: "vertical",
    padding: 18,
    gap: 12,
    cornerRadius: 28,
    fill: C.mint,
    sizingH: "fill",
  });
  const qTop = await createAutoFrame(client, cardQuiz, "Top", 364, 20, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none",
  });
  await createText(client, qTop, "t", "✿ Yes or No Quiz", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, qTop, "s", "Question 1/8", { fontSize: 12, fill: C.textBlack });

  await createText(client, cardQuiz, "q", "Have you been sleeping well recently?", {
    fontSize: 16,
    fontStyle: "Bold",
    fill: C.textBlack,
  });

  const qBtns = await createAutoFrame(client, cardQuiz, "Btns", 364, 46, {
    layout: "horizontal",
    gap: 14,
    fill: "none",
    sizingH: "fill",
  });
  const btnYes = await createAutoFrame(client, qBtns, "btn_yes", 175, 46, {
    cornerRadius: 16,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "fill",
  });
  await createText(client, btnYes, "t", "Yes", { fontSize: 15, fontStyle: "Bold", fill: "#FFFFFF" });
  const btnNo = await createAutoFrame(client, qBtns, "btn_no", 175, 46, {
    cornerRadius: 16,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "fill",
  });
  await createText(client, btnNo, "t", "No", { fontSize: 15, fontStyle: "Bold", fill: "#FFFFFF" });

  // Attach Bottom Navigation (Active: Home)
  await attachBottomNav(dev2.screenId, "Home");


  // =========================================================================
  // SCREEN 3: 03_Calendar (White background, Active Tab: Calendar)
  // =========================================================================
  console.log("Creating Screen 3: 03_Calendar...");
  const dev3 = await createDeviceWrapper("03_Calendar", screenCoords[2].x, screenCoords[2].y, screenCoords[2].label, C.bgWhite);
  screens.push(dev3.deviceId);

  const s3Content = await createAutoFrame(client, dev3.screenId, "Content", 400, 750, {
    x: 20,
    y: 70,
    layout: "vertical",
    gap: 14,
    fill: "none",
    sizingH: "fixed",
    sizingV: "hug",
  });

  // Header: back button left, centered title "Mood Calendar" + "September, 2025" caption, calendar icon right
  const s3Header = await createAutoFrame(client, s3Content, "Header", 400, 44, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  const s3Back = await createAutoFrame(client, s3Header, "btn_back", 40, 40, {
    cornerRadius: 20,
    fill: "#F4F4F5",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s3Back, "t", "‹", { fontSize: 22, fontStyle: "Bold", fill: C.textBlack });

  const s3TitleWrap = await createAutoFrame(client, s3Header, "Title_Wrap", 240, 40, {
    layout: "vertical",
    crossAlign: "center",
    fill: "none",
  });
  await createText(client, s3TitleWrap, "t", "Mood Calendar", { fontSize: 17, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, s3TitleWrap, "s", "September, 2025", { fontSize: 12, fill: C.textGray });

  const s3CalIcon = await createAutoFrame(client, s3Header, "btn_cal", 40, 40, {
    cornerRadius: 20,
    fill: "#F4F4F5",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s3CalIcon, "t", "📅", { fontSize: 16 });

  // Weekday labels Sun-Sat
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const s3Days = await createAutoFrame(client, s3Content, "Weekday_Labels", 400, 18, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none",
    sizingH: "fill",
  });
  for (const d of dayNames) {
    const col = await createAutoFrame(client, s3Days, `col_${d}`, 48, 18, {
      fill: "none",
      mainAlign: "center",
      sizingH: "fill",
    });
    await createText(client, col, "t", d, { fontSize: 12, fontStyle: "Bold", fill: C.textGray, textAlign: "center" });
  }

  // Grid of 7 columns, squares 48x48, gap 6, radius 14 (Total 30 days of September 2025 = 5 rows)
  const s3Grid = await createAutoFrame(client, s3Content, "Calendar_Grid", 400, 240, {
    layout: "vertical",
    gap: 6,
    fill: "none",
    sizingH: "fill",
  });

  const calColors = [
    [C.mint, C.peach, C.peach, C.peach, C.mint, C.sky, C.lavender],
    [C.yellow, C.yellow, C.lavender, C.sky, C.mint, C.mint, C.mint],
    [C.lavender, C.coral, C.peach, C.yellow, C.yellow, C.sky, C.mint],
    [C.mint, C.mint, C.sky, C.peach, C.mint, C.sky, C.mint],
    [C.pink, C.coral, C.peach, C.pink, C.yellow, C.sky, C.mint],
  ];

  for (let w = 0; w < 5; w++) {
    const wRow = await createAutoFrame(client, s3Grid, `Week_${w + 1}`, 400, 42, {
      layout: "horizontal",
      gap: 6,
      fill: "none",
      sizingH: "fill",
    });
    for (let c = 0; c < 7; c++) {
      const dayCell = await createAutoFrame(client, wRow, `Day_${w}_${c}`, 48, 42, {
        cornerRadius: 14,
        fill: calColors[w][c],
        mainAlign: "center",
        crossAlign: "center",
        sizingH: "fill",
      });
      await createText(client, dayCell, "f", "◡", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
    }
  }

  // Mint card "Monthly Mood Summary": "Happy" 36px bold, sleeping-smile face illustration right
  const s3Summary = await createAutoFrame(client, s3Content, "Monthly_Summary_Card", 400, 140, {
    layout: "horizontal",
    padding: 18,
    cornerRadius: 28,
    fill: C.mint,
    mainAlign: "spaceBetween",
    crossAlign: "center",
    sizingH: "fill",
  });
  const sumLeft = await createAutoFrame(client, s3Summary, "Left", 240, 104, {
    layout: "vertical",
    gap: 6,
    fill: "none",
    sizingH: "fill",
  });
  await createText(client, sumLeft, "c", "Monthly Mood Summary", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, sumLeft, "h", "Happy", {
    fontSize: 36,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });
  await createText(client, sumLeft, "d", "You're feeling calm and optimistic.\nKeep up the good vibes!", {
    fontSize: 12,
    fill: C.textBlack,
  });

  const sumMascot = await createAutoFrame(client, s3Summary, "Mascot", 84, 84, {
    cornerRadius: 42,
    fill: "#A3EB8A",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, sumMascot, "f", "◠ ‿ ◠", { fontSize: 20, fontStyle: "Bold", fill: C.textBlack });

  // 3 stat cards in a row: Activity 101,513 Steps / Therapy 10/30 Sessions / Discipline 88% Focus score
  const s3Stats = await createAutoFrame(client, s3Content, "Stats_Row", 400, 85, {
    layout: "horizontal",
    gap: 10,
    fill: "none",
    sizingH: "fill",
  });

  const statList = [
    { label: "Activity", val: "101,513", sub: "Steps" },
    { label: "Therapy", val: "10/30", sub: "Sessions" },
    { label: "Discipline", val: "88%", sub: "Focus score" },
  ];
  for (const st of statList) {
    const card = await createAutoFrame(client, s3Stats, `Card_${st.label}`, 126, 85, {
      layout: "vertical",
      padding: 12,
      gap: 3,
      cornerRadius: 20,
      fill: "#F8FAFC",
      stroke: "#E4E4E7",
      sizingH: "fill",
      mainAlign: "center",
    });
    await createText(client, card, "l", st.label, { fontSize: 12, fill: C.textGray });
    await createText(client, card, "v", st.val, {
      fontSize: 18,
      fontFamily: "Plus Jakarta Sans",
      fontStyle: "Bold",
      fill: C.textBlack,
    });
    await createText(client, card, "s", st.sub, { fontSize: 11, fill: C.textSubtle });
  }

  // Attach Bottom Navigation (Active: Calendar)
  await attachBottomNav(dev3.screenId, "Calendar");


  // =========================================================================
  // SCREEN 4: 04_CheckIn (Lavender background, Active Tab: Home)
  // All content fits neatly above nav (no cut-off)
  // =========================================================================
  console.log("Creating Screen 4: 04_CheckIn...");
  const dev4 = await createDeviceWrapper("04_CheckIn", screenCoords[3].x, screenCoords[3].y, screenCoords[3].label, C.bgApp);
  screens.push(dev4.deviceId);

  const s4Content = await createAutoFrame(client, dev4.screenId, "Content", 400, 750, {
    x: 20,
    y: 70,
    layout: "vertical",
    gap: 14,
    fill: "none",
    sizingH: "fixed",
    sizingV: "hug",
  });

  // Header: close X left, title "Daily Mood Check-in", help "?" right
  const s4Header = await createAutoFrame(client, s4Content, "Header", 400, 40, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  const s4Close = await createAutoFrame(client, s4Header, "btn_close", 40, 40, {
    cornerRadius: 20,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s4Close, "t", "✕", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });

  await createText(client, s4Header, "t", "Daily Mood Check-in", { fontSize: 16, fontStyle: "Bold", fill: C.textBlack });

  const s4Help = await createAutoFrame(client, s4Header, "btn_help", 40, 40, {
    cornerRadius: 20,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s4Help, "t", "❓", { fontSize: 14 });

  // Headline "What best describes your feeling right now?" 28px bold
  await createText(client, s4Content, "headline", "What best describes\nyour feeling right now?", {
    fontSize: 28,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });

  // 4 tall mood cards in a row (Radiant yellow, Peaceful mint selected with black 3px border, Tired blue, Anxious peach)
  const s4MoodCards = await createAutoFrame(client, s4Content, "Mood_Cards_Row", 400, 140, {
    layout: "horizontal",
    gap: 10,
    fill: "none",
    sizingH: "fill",
  });

  const checkMoods = [
    { name: "Radiant", emoji: "★ ‿ ★", bg: C.yellow, sel: false },
    { name: "Peaceful", emoji: "◠ ‿ ◠", bg: C.mint, sel: true },
    { name: "Tired", emoji: "• ｡ •", bg: C.sky, sel: false },
    { name: "Anxious", emoji: "ˋ ︿ ˊ", bg: C.peach, sel: false },
  ];

  for (const cm of checkMoods) {
    const card = await createAutoFrame(client, s4MoodCards, `Card_${cm.name}`, 92, 140, {
      layout: "vertical",
      padding: 10,
      cornerRadius: 24,
      fill: cm.bg,
      stroke: cm.sel ? C.textBlack : "none",
      strokeWeight: cm.sel ? 3 : 0,
      mainAlign: "spaceBetween",
      crossAlign: "center",
      sizingH: "fill",
    });
    await createText(client, card, "radio", cm.sel ? "●" : "○", { fontSize: 13, fill: C.textBlack });
    await createText(client, card, "face", cm.emoji, { fontSize: 22, fontStyle: "Bold", fill: C.textBlack });
    await createText(client, card, "lbl", cm.name, { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  }

  // Card "Mood Intensity": slider with label "Level 6 of 10 (Deeply Calm)"
  const s4IntCard = await createAutoFrame(client, s4Content, "Card_Intensity", 400, 95, {
    layout: "vertical",
    padding: 16,
    gap: 10,
    cornerRadius: 26,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    sizingH: "fill",
  });
  const intTop = await createAutoFrame(client, s4IntCard, "Top", 368, 20, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none",
  });
  await createText(client, intTop, "l", "Mood Intensity", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, intTop, "v", "Level 6 of 10 (Deeply Calm)", {
    fontSize: 12,
    fontStyle: "Bold",
    fill: "#7C3AED",
  });

  const s4Track = await createAutoFrame(client, s4IntCard, "Slider_Track", 368, 14, {
    cornerRadius: 7,
    fill: "#F4F4F5",
    layout: "horizontal",
  });
  const s4Filled = await createAutoFrame(client, s4Track, "Filled", 220, 14, {
    cornerRadius: 7,
    fill: C.lavender,
    layout: "horizontal",
    mainAlign: "max",
    crossAlign: "center",
  });
  await createAutoFrame(client, s4Filled, "Thumb", 22, 22, { cornerRadius: 11, fill: C.textBlack });

  // Card "Add a note" with text field placeholder
  const s4NoteCard = await createAutoFrame(client, s4Content, "Card_Note", 400, 95, {
    layout: "vertical",
    padding: 14,
    gap: 8,
    cornerRadius: 24,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    sizingH: "fill",
  });
  await createText(client, s4NoteCard, "l", "Add a reflection note (Optional)", {
    fontSize: 12,
    fontStyle: "Bold",
    fill: C.textGray,
  });
  const s4Input = await createAutoFrame(client, s4NoteCard, "Input", 372, 44, {
    cornerRadius: 14,
    fill: "#F9FAFB",
    padding: [12, 14],
  });
  await createText(client, s4Input, "ph", "Had a peaceful morning walk in the park...", { fontSize: 13, fill: C.textSubtle });

  // Black full-width "Save Check-in" button (height 56, radius 28) above the nav
  const btnSave = await createAutoFrame(client, s4Content, "btn_save_checkin", 400, 56, {
    cornerRadius: 28,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "fill",
    sizingV: "fixed",
  });
  await createText(client, btnSave, "t", "Save Check-in ➔", {
    fontSize: 16,
    fontStyle: "Bold",
    fill: "#FFFFFF",
  });

  // Attach Bottom Navigation (Active: Home)
  await attachBottomNav(dev4.screenId, "Home");


  // =========================================================================
  // SCREEN 5: 05_Insights (Lavender background, Active Tab: Stats)
  // All content fits neatly above nav (no cut-off)
  // =========================================================================
  console.log("Creating Screen 5: 05_Insights...");
  const dev5 = await createDeviceWrapper("05_Insights", screenCoords[4].x, screenCoords[4].y, screenCoords[4].label, C.bgApp);
  screens.push(dev5.deviceId);

  const s5Content = await createAutoFrame(client, dev5.screenId, "Content", 400, 750, {
    x: 20,
    y: 70,
    layout: "vertical",
    gap: 16,
    fill: "none",
    sizingH: "fixed",
    sizingV: "hug",
  });

  // Header: title "Mind & Mood Insights" + dropdown "Weekly"
  const s5Header = await createAutoFrame(client, s5Content, "Header", 400, 40, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  await createText(client, s5Header, "t", "Mind & Mood Insights", {
    fontSize: 24,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });
  const s5Pill = await createAutoFrame(client, s5Header, "Dropdown", 90, 36, {
    cornerRadius: 18,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s5Pill, "t", "Weekly ▼", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });

  // Pink card "14-Day Streak" with badge icon (compact height 90)
  const s5Streak = await createAutoFrame(client, s5Content, "Card_Streak", 400, 90, {
    layout: "horizontal",
    padding: 16,
    cornerRadius: 26,
    fill: C.pink,
    mainAlign: "spaceBetween",
    crossAlign: "center",
    sizingH: "fill",
  });
  const strkLeft = await createAutoFrame(client, s5Streak, "Left", 280, 56, {
    layout: "vertical",
    gap: 4,
    fill: "none",
  });
  await createText(client, strkLeft, "b", "🔥 14-DAY STREAK", { fontSize: 12, fontStyle: "Bold", fill: "#9D174D" });
  await createText(client, strkLeft, "d", "You've logged moods consistently!\nSelf-awareness +34% this week.", {
    fontSize: 13,
    fill: C.textBlack,
  });
  const strkBadge = await createAutoFrame(client, s5Streak, "Badge", 52, 52, {
    cornerRadius: 26,
    fill: "#FFFFFF",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, strkBadge, "ic", "🏆", { fontSize: 24 });

  // White card "Weekly Mood Flow": 7 colored pill bars Mon-Sun with mini faces, "Avg: 8.2 (Very Positive)"
  const s5Flow = await createAutoFrame(client, s5Content, "Card_Weekly_Flow", 400, 180, {
    layout: "vertical",
    padding: 18,
    gap: 12,
    cornerRadius: 28,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    sizingH: "fill",
  });
  const flowTop = await createAutoFrame(client, s5Flow, "Top", 364, 20, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none",
  });
  await createText(client, flowTop, "t", "Weekly Mood Flow", { fontSize: 15, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, flowTop, "avg", "Avg: 8.2 (Very Positive)", { fontSize: 12, fill: "#059669" });

  const flowBars = await createAutoFrame(client, s5Flow, "Bars", 364, 85, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "max",
    fill: "none",
  });
  const daysWeek = [
    { day: "Mon", h: 48, col: C.mint, face: "◡" },
    { day: "Tue", h: 68, col: C.yellow, face: "★" },
    { day: "Wed", h: 36, col: C.peach, face: "︿" },
    { day: "Thu", h: 58, col: C.sky, face: "｡" },
    { day: "Fri", h: 72, col: C.mint, face: "◡" },
    { day: "Sat", h: 76, col: C.yellow, face: "★" },
    { day: "Sun", h: 64, col: C.lavender, face: "◡" },
  ];
  for (const dw of daysWeek) {
    const col = await createAutoFrame(client, flowBars, `col_${dw.day}`, 42, 85, {
      layout: "vertical",
      gap: 6,
      crossAlign: "center",
      mainAlign: "max",
      fill: "none",
    });
    const bar = await createAutoFrame(client, col, "bar", 32, dw.h, {
      cornerRadius: 16,
      fill: dw.col,
      mainAlign: "center",
      crossAlign: "center",
    });
    await createText(client, bar, "f", dw.face, { fontSize: 11, fontStyle: "Bold", fill: C.textBlack });
    await createText(client, col, "l", dw.day, { fontSize: 11, fill: C.textGray });
  }

  // Mint card "Sleep vs. Stress Correlation": compact height 140
  const s5Corr = await createAutoFrame(client, s5Content, "Card_Correlation", 400, 140, {
    layout: "vertical",
    padding: 16,
    gap: 10,
    cornerRadius: 28,
    fill: C.mint,
    sizingH: "fill",
  });
  await createText(client, s5Corr, "t", "Sleep vs. Stress Correlation", { fontSize: 15, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, s5Corr, "d", "On days you slept > 7.5 hrs, reported stress levels dropped by 42%.", {
    fontSize: 12,
    fill: C.textBlack,
  });

  const corrBars = await createAutoFrame(client, s5Corr, "Bars", 368, 45, {
    layout: "vertical",
    gap: 8,
    fill: "none",
  });
  const cr1 = await createAutoFrame(client, corrBars, "R1", 368, 16, { layout: "horizontal", gap: 10, crossAlign: "center", fill: "none" });
  await createText(client, cr1, "l", "Sleep 7.5h", { fontSize: 11, fontStyle: "Bold", fill: C.textBlack });
  await createAutoFrame(client, cr1, "p", 230, 14, { cornerRadius: 7, fill: "#7CD663" });

  const cr2 = await createAutoFrame(client, corrBars, "R2", 368, 16, { layout: "horizontal", gap: 10, crossAlign: "center", fill: "none" });
  await createText(client, cr2, "l", "Low Stress", { fontSize: 11, fontStyle: "Bold", fill: C.textBlack });
  await createAutoFrame(client, cr2, "p", 180, 14, { cornerRadius: 7, fill: C.lavender });

  // Attach Bottom Navigation (Active: Stats)
  await attachBottomNav(dev5.screenId, "Stats");


  // =========================================================================
  // SCREEN 6: 06_Profile (Lavender background, Active Tab: Menu)
  // All content fits neatly above nav (no cut-off)
  // =========================================================================
  console.log("Creating Screen 6: 06_Profile...");
  const dev6 = await createDeviceWrapper("06_Profile", screenCoords[5].x, screenCoords[5].y, screenCoords[5].label, C.bgApp);
  screens.push(dev6.deviceId);

  const s6Content = await createAutoFrame(client, dev6.screenId, "Content", 400, 750, {
    x: 20,
    y: 70,
    layout: "vertical",
    gap: 16,
    fill: "none",
    sizingH: "fixed",
    sizingV: "hug",
  });

  // Header: title "Profile & Goals" + settings icon
  const s6Header = await createAutoFrame(client, s6Content, "Header", 400, 40, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  await createText(client, s6Header, "t", "Profile & Goals", {
    fontSize: 24,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });
  const s6Gear = await createAutoFrame(client, s6Header, "btn_gear", 40, 40, {
    cornerRadius: 20,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s6Gear, "ic", "⚙", { fontSize: 18, fill: C.textBlack });

  // Lavender card: avatar, "Alex Miller", "Mindfulness Pro Member", "Active Goal: Sleep 8h"
  const s6UserCard = await createAutoFrame(client, s6Content, "Card_User", 400, 115, {
    layout: "horizontal",
    padding: 18,
    gap: 16,
    cornerRadius: 28,
    fill: C.lavender,
    crossAlign: "center",
    sizingH: "fill",
  });
  const s6Av = await createAutoFrame(client, s6UserCard, "Big_Avatar", 68, 68, {
    cornerRadius: 34,
    fill: C.yellow,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s6Av, "ic", "🧑‍🦱", { fontSize: 34 });

  const s6UserMeta = await createAutoFrame(client, s6UserCard, "Meta", 260, 68, {
    layout: "vertical",
    gap: 4,
    fill: "none",
  });
  await createText(client, s6UserMeta, "n", "Alex Miller", {
    fontSize: 20,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });
  await createText(client, s6UserMeta, "m", "Mindfulness Pro Member", { fontSize: 13, fill: "#5B21B6" });
  await createBadge(s6UserMeta, "Active Goal: Sleep 8h", "#EDE9FE", "#6D28D9", 11);

  // Peach card "Therapy Sessions" with progress bar "10 / 30 Completed"
  const s6Therapy = await createAutoFrame(client, s6Content, "Card_Therapy", 400, 115, {
    layout: "vertical",
    padding: 16,
    gap: 10,
    cornerRadius: 28,
    fill: C.peach,
    sizingH: "fill",
  });
  const thTop = await createAutoFrame(client, s6Therapy, "Top", 368, 20, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none",
  });
  await createText(client, thTop, "t", "Therapy Sessions", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, thTop, "v", "10 / 30 Completed", { fontSize: 13, fontStyle: "Bold", fill: "#9A3412" });

  const thTrack = await createAutoFrame(client, s6Therapy, "Track", 368, 14, {
    cornerRadius: 7,
    fill: "#FCD34D",
    layout: "horizontal",
  });
  await createAutoFrame(client, thTrack, "Fill", 122, 14, { cornerRadius: 7, fill: C.textBlack });

  await createText(client, s6Therapy, "sub", "Next scheduled session: Tomorrow at 4:00 PM with Dr. Harris", {
    fontSize: 12,
    fill: C.textBlack,
  });

  // White settings card with 3 toggle rows
  const s6Settings = await createAutoFrame(client, s6Content, "Card_Settings", 400, 180, {
    layout: "vertical",
    padding: [10, 18],
    gap: 8,
    cornerRadius: 28,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    sizingH: "fill",
  });

  // Toggle 1
  const row1 = await createAutoFrame(client, s6Settings, "Row_Reminder", 364, 46, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  const r1L = await createAutoFrame(client, row1, "L", 280, 40, { layout: "vertical", fill: "none" });
  await createText(client, r1L, "t", "Daily Check-in Reminder", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, r1L, "s", "Notify at 8:00 PM every evening", { fontSize: 11, fill: C.textGray });
  const sw1 = await createAutoFrame(client, row1, "Sw_On", 48, 28, {
    cornerRadius: 14,
    fill: C.textBlack,
    layout: "horizontal",
    padding: 3,
    mainAlign: "max",
    crossAlign: "center",
  });
  await createAutoFrame(client, sw1, "k", 22, 22, { cornerRadius: 11, fill: "#FFFFFF" });

  // Toggle 2
  const row2 = await createAutoFrame(client, s6Settings, "Row_Appearance", 364, 46, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  const r2L = await createAutoFrame(client, row2, "L", 280, 40, { layout: "vertical", fill: "none" });
  await createText(client, r2L, "t", "App Appearance", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, r2L, "s", "Currently set to Soft Lavender Light", { fontSize: 11, fill: C.textGray });
  const sw2 = await createAutoFrame(client, row2, "Sw_Off", 48, 28, {
    cornerRadius: 14,
    fill: "#E4E4E7",
    layout: "horizontal",
    padding: 3,
    mainAlign: "min",
    crossAlign: "center",
  });
  await createAutoFrame(client, sw2, "k", 22, 22, { cornerRadius: 11, fill: "#FFFFFF" });

  // Toggle 3
  const row3 = await createAutoFrame(client, s6Settings, "Row_Health", 364, 46, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  const r3L = await createAutoFrame(client, row3, "L", 280, 40, { layout: "vertical", fill: "none" });
  await createText(client, r3L, "t", "Sync with Apple Health", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, r3L, "s", "Export steps, sleep & mood metrics", { fontSize: 11, fill: C.textGray });
  const sw3 = await createAutoFrame(client, row3, "Sw_On", 48, 28, {
    cornerRadius: 14,
    fill: C.textBlack,
    layout: "horizontal",
    padding: 3,
    mainAlign: "max",
    crossAlign: "center",
  });
  await createAutoFrame(client, sw3, "k", 22, 22, { cornerRadius: 11, fill: "#FFFFFF" });

  // Attach Bottom Navigation (Active: Menu)
  await attachBottomNav(dev6.screenId, "Menu");

  // Prototyping Wiring
  console.log("Connecting prototype interactions for MoodLy...");
  await client.runCommand("proto.interaction.add", {
    id: s1Pill,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: dev2.screenId },
    transition: { type: "smartAnimate" },
  });

  await client.runCommand("proto.flow.add", {
    start: dev1.deviceId,
    name: "MoodLy App Experience",
  });

  // Center view on canvas
  await client.runCommand("view.set", {
    cx: 800,
    cy: 1000,
    zoom: 0.35,
  });

  console.log("✨ ALL 6 IPHONE 17 PRO MAX MOODLY SCREENS SUCCESSFULLY GENERATED!");
  return { screens };
}

// Direct Execution Entrypoint
declare const process: any;

if ((import.meta as any).main) {
  const client = new FigCraftClient();
  client.connect().then(async () => {
    await buildMoodly(client);
    client.close();
    process.exit(0);
  }).catch((err: any) => {
    console.error("FigCraft Connection Error:", err.message);
    process.exit(1);
  });
}
