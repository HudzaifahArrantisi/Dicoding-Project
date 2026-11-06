import { FigCraftClient, createAutoFrame, createText, createBadge } from "./figcraft-helper";

/**
 * MoodLy - Playful Mood Tracking & Wellbeing App
 * 6 Screens (iOS 390x844 px) in FigCraft
 */

// Design System Tokens
const C = {
  bgApp: "#EDE9F5",      // Light Lavender App Background
  bgWhite: "#FFFFFF",    // White Card Surface
  textBlack: "#0A0A0A",  // Deep Charcoal Black
  textGray: "#71717A",   // Zinc Muted Gray
  textSubtle: "#A1A1AA", // Light Gray
  navBlack: "#0A0A0A",   // Black Floating Nav Bar

  // Pastel Color Palette
  mint: "#B6F5A0",       // Calm / Happy / Steps
  peach: "#FFB38A",      // Sleep / Warm
  lavender: "#D4B8FF",   // Stress / Calm
  pink: "#FFB3D9",       // Bored / Sad / Love
  sky: "#9CC4FF",        // Sleepy / Serene
  yellow: "#FFD84D",     // Energy / Joy
  coral: "#FF7F7F",      // Stressed / High Alert
};

export async function buildMoodly(client: FigCraftClient) {
  console.log("🎨 Building MoodLy 6-Screen Suite in FigCraft...");

  // Set canvas paper background
  await client.runCommand("page.setBackground", { color: "#F0EDF7" });

  const screens: number[] = [];

  // =========================================================================
  // SCREEN 1: Onboarding / Welcome (390 x 844)
  // =========================================================================
  console.log("Creating Screen 1: 01_MoodLy_Onboarding...");
  const s1 = await createAutoFrame(client, undefined, "01_MoodLy_Onboarding", 390, 844, {
    x: 0,
    y: 0,
    layout: "vertical",
    fill: "#FFFFFF",
    padding: [48, 24, 32, 24],
    gap: 20,
    clip: true,
  });
  screens.push(s1);

  // Top Title Section
  const s1Header = await createAutoFrame(client, s1, "Header_Section", 342, 180, {
    layout: "vertical",
    gap: 16,
    fill: "none",
    sizingH: "fill",
  });

  await createText(client, s1Header, "title", "Not Sure\nAbout Your\nMood?", {
    fontSize: 40,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });

  // Pill CTA Button "Let Us Help! →"
  const s1Pill = await createAutoFrame(client, s1Header, "Pill_CTA", 160, 48, {
    layout: "horizontal",
    gap: 8,
    padding: [6, 8, 6, 16],
    cornerRadius: 24,
    fill: "#F4F4F5",
    crossAlign: "center",
    mainAlign: "spaceBetween",
    sizingH: "hug",
  });
  await createText(client, s1Pill, "lbl", "Let Us Help!", {
    fontSize: 14,
    fontStyle: "Bold",
    fill: C.textBlack,
  });
  const s1ArrowCircle = await createAutoFrame(client, s1Pill, "Arrow_Circle", 36, 36, {
    cornerRadius: 18,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s1ArrowCircle, "arrow", "→", {
    fontSize: 16,
    fill: "#FFFFFF",
    fontStyle: "Bold",
  });

  // Mascot Blobs Cluster (Visual Art Canvas)
  const s1MascotCluster = await createAutoFrame(client, s1, "Mascots_Cluster", 342, 450, {
    layout: null, // Free positioning for playful overlap
    fill: "none",
    sizingH: "fill",
    sizingV: "fill",
    clip: false,
  });

  // Green Circle (Calm Smile)
  const mGreen = await createAutoFrame(client, s1MascotCluster, "Mascot_Green_Calm", 110, 110, {
    x: 20,
    y: 40,
    cornerRadius: 55,
    fill: C.mint,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mGreen, "face", "◠ ‿ ◠", { fontSize: 24, fontStyle: "Bold", fill: C.textBlack });

  // Purple Spiral / Dizzy Blob
  const mPurple = await createAutoFrame(client, s1MascotCluster, "Mascot_Purple_Dizzy", 100, 100, {
    x: 180,
    y: 20,
    cornerRadius: 38,
    fill: C.lavender,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mPurple, "face", "◎ _ ◎", { fontSize: 22, fontStyle: "Bold", fill: C.textBlack });

  // Pink Blob (Sad / Thoughtful)
  const mPink = await createAutoFrame(client, s1MascotCluster, "Mascot_Pink_Sad", 95, 95, {
    x: 10,
    y: 170,
    cornerRadius: 40,
    fill: C.pink,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mPink, "face", "• ︵ •", { fontSize: 22, fontStyle: "Bold", fill: C.textBlack });

  // Yellow Lightning / Joy (Squarish Star)
  const mYellow = await createAutoFrame(client, s1MascotCluster, "Mascot_Yellow_Happy", 105, 105, {
    x: 120,
    y: 150,
    cornerRadius: 28,
    fill: C.yellow,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mYellow, "face", "★ ‿ ★", { fontSize: 22, fontStyle: "Bold", fill: C.textBlack });

  // Orange Rounded Square (Grumpy / Angry)
  const mOrange = await createAutoFrame(client, s1MascotCluster, "Mascot_Orange_Angry", 95, 95, {
    x: 230,
    y: 140,
    cornerRadius: 24,
    fill: C.peach,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mOrange, "face", "ˋ ︿ ˊ", { fontSize: 22, fontStyle: "Bold", fill: C.textBlack });

  // Blue Dome (Sleepy)
  const mBlue = await createAutoFrame(client, s1MascotCluster, "Mascot_Blue_Sleepy", 90, 90, {
    x: 40,
    y: 280,
    cornerRadius: 45,
    fill: C.sky,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mBlue, "face", "◡ ｡ ◡", { fontSize: 20, fontStyle: "Bold", fill: C.textBlack });

  // Coral Triangle / Stressed
  const mCoral = await createAutoFrame(client, s1MascotCluster, "Mascot_Coral_Stressed", 95, 95, {
    x: 170,
    y: 270,
    cornerRadius: 26,
    fill: C.coral,
    layout: "vertical",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, mCoral, "face", "> ﹏ <", { fontSize: 20, fontStyle: "Bold", fill: C.textBlack });


  // =========================================================================
  // SCREEN 2: Home / Dashboard (390 x 844)
  // =========================================================================
  console.log("Creating Screen 2: 02_MoodLy_Dashboard...");
  const s2 = await createAutoFrame(client, undefined, "02_MoodLy_Dashboard", 390, 844, {
    x: 430,
    y: 0,
    layout: "vertical",
    fill: C.bgApp,
    padding: [48, 20, 20, 20],
    gap: 16,
    clip: true,
  });
  screens.push(s2);

  // Top User Row
  const s2Top = await createAutoFrame(client, s2, "Top_User_Bar", 350, 48, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  const s2UserInfo = await createAutoFrame(client, s2Top, "User_Info", 200, 40, {
    layout: "horizontal",
    gap: 10,
    crossAlign: "center",
    fill: "none",
  });
  const s2Avatar = await createAutoFrame(client, s2UserInfo, "Avatar", 40, 40, {
    cornerRadius: 20,
    fill: C.yellow,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s2Avatar, "av", "🧑‍🦱", { fontSize: 20 });

  const s2UserTxt = await createAutoFrame(client, s2UserInfo, "Txt", 140, 36, {
    layout: "vertical",
    gap: 2,
    fill: "none",
  });
  await createText(client, s2UserTxt, "w", "Welcome back", { fontSize: 11, fill: C.textGray });
  await createText(client, s2UserTxt, "name", "Alex Miller", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });

  const s2MenuBtn = await createAutoFrame(client, s2Top, "Menu_Btn", 40, 40, {
    cornerRadius: 20,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s2MenuBtn, "icon", "☰", { fontSize: 16, fill: C.textBlack });

  // Main Greeting
  const s2Greet = await createAutoFrame(client, s2, "Greeting", 350, 70, {
    layout: "vertical",
    gap: 4,
    fill: "none",
    sizingH: "fill",
  });
  await createText(client, s2Greet, "date", "Sep 14, 2025", { fontSize: 12, fill: C.textGray });
  await createText(client, s2Greet, "h", "Hello Alex! How are\nyou feeling today?", {
    fontSize: 22,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });

  // Mood Chips Carousel
  const s2Chips = await createAutoFrame(client, s2, "Mood_Chips_Row", 350, 44, {
    layout: "horizontal",
    gap: 8,
    fill: "none",
    sizingH: "fill",
  });

  const moods = [
    { label: "Happy", icon: "◡‿◡", bg: C.mint },
    { label: "Angry", icon: "ˋ︿ˊ", bg: C.peach },
    { label: "Sleepy", icon: "• ｡ •", bg: C.sky },
    { label: "Bored", icon: "• ─ •", bg: C.pink },
  ];
  for (const m of moods) {
    const chip = await createAutoFrame(client, s2Chips, `Chip_${m.label}`, 80, 40, {
      layout: "horizontal",
      gap: 6,
      padding: [8, 10],
      cornerRadius: 20,
      fill: C.bgWhite,
      crossAlign: "center",
      mainAlign: "center",
      sizingH: "fill",
    });
    const chipFace = await createAutoFrame(client, chip, "Face", 22, 22, {
      cornerRadius: 11,
      fill: m.bg,
      mainAlign: "center",
      crossAlign: "center",
    });
    await createText(client, chipFace, "e", "•", { fontSize: 10, fontStyle: "Bold", fill: C.textBlack });
    await createText(client, chip, "t", m.label, { fontSize: 11, fontStyle: "Bold", fill: C.textBlack });
  }

  // Bento Grid Row (Sleep & Stress)
  const s2BentoRow = await createAutoFrame(client, s2, "Bento_Row", 350, 150, {
    layout: "horizontal",
    gap: 12,
    fill: "none",
    sizingH: "fill",
  });

  // Peach Card: Sleep Duration
  const bSleep = await createAutoFrame(client, s2BentoRow, "Card_Sleep", 168, 150, {
    layout: "vertical",
    padding: 16,
    gap: 8,
    cornerRadius: 26,
    fill: C.peach,
    sizingH: "fill",
    mainAlign: "spaceBetween",
  });
  const bSleepTop = await createAutoFrame(client, bSleep, "Top", 136, 20, {
    layout: "horizontal",
    gap: 6,
    crossAlign: "center",
    fill: "none",
  });
  await createText(client, bSleepTop, "i", "🛏", { fontSize: 12 });
  await createText(client, bSleepTop, "t", "Sleep Duration", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });

  // Mini Bar Chart
  const bSleepBars = await createAutoFrame(client, bSleep, "Bars", 136, 46, {
    layout: "horizontal",
    gap: 8,
    crossAlign: "max",
    fill: "none",
  });
  const barHeights1 = [24, 38, 30, 44, 36, 42];
  for (const h of barHeights1) {
    await createAutoFrame(client, bSleepBars, "bar", 14, h, {
      cornerRadius: 7,
      fill: "#E09068",
    });
  }
  await createText(client, bSleep, "val", "7h 20min", {
    fontSize: 22,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });

  // Purple Card: Stress Indicator
  const bStress = await createAutoFrame(client, s2BentoRow, "Card_Stress", 168, 150, {
    layout: "vertical",
    padding: 16,
    gap: 8,
    cornerRadius: 26,
    fill: C.lavender,
    sizingH: "fill",
    mainAlign: "spaceBetween",
  });
  const bStressTop = await createAutoFrame(client, bStress, "Top", 136, 20, {
    layout: "horizontal",
    gap: 6,
    crossAlign: "center",
    fill: "none",
  });
  await createText(client, bStressTop, "i", "⚡", { fontSize: 12 });
  await createText(client, bStressTop, "t", "Stress Indicator", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });

  // Ascending Bar Chart
  const bStressBars = await createAutoFrame(client, bStress, "Bars", 136, 46, {
    layout: "horizontal",
    gap: 8,
    crossAlign: "max",
    fill: "none",
  });
  const barHeights2 = [14, 18, 24, 30, 38, 44];
  for (const h of barHeights2) {
    await createAutoFrame(client, bStressBars, "bar", 14, h, {
      cornerRadius: 7,
      fill: "#BA98F0",
    });
  }
  await createText(client, bStress, "val", "High", {
    fontSize: 22,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });

  // Full-Width Mint Card: Yes or No Quiz
  const bQuiz = await createAutoFrame(client, s2, "Card_Quiz", 350, 150, {
    layout: "vertical",
    padding: 16,
    gap: 12,
    cornerRadius: 26,
    fill: C.mint,
    sizingH: "fill",
  });
  const bQuizTop = await createAutoFrame(client, bQuiz, "Top", 318, 20, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
  });
  await createText(client, bQuizTop, "lbl", "✿ Yes or No Quiz", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, bQuizTop, "step", "Question 1/8", { fontSize: 11, fill: C.textBlack });

  await createText(client, bQuiz, "q", "Have you been sleeping well recently?", {
    fontSize: 15,
    fontStyle: "Bold",
    fill: C.textBlack,
  });

  const bQuizBtns = await createAutoFrame(client, bQuiz, "Btns_Row", 318, 42, {
    layout: "horizontal",
    gap: 12,
    fill: "none",
    sizingH: "fill",
  });
  const btnYes = await createAutoFrame(client, bQuizBtns, "btn_yes", 150, 42, {
    cornerRadius: 14,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "fill",
  });
  await createText(client, btnYes, "t", "Yes", { fontSize: 14, fontStyle: "Bold", fill: "#FFFFFF" });

  const btnNo = await createAutoFrame(client, bQuizBtns, "btn_no", 150, 42, {
    cornerRadius: 14,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "fill",
  });
  await createText(client, btnNo, "t", "No", { fontSize: 14, fontStyle: "Bold", fill: "#FFFFFF" });

  // Floating Bottom Nav Bar (Black Pill)
  await createBottomNav(client, s2, 0);


  // =========================================================================
  // SCREEN 3: Mood Calendar (390 x 844)
  // =========================================================================
  console.log("Creating Screen 3: 03_MoodLy_Calendar...");
  const s3 = await createAutoFrame(client, undefined, "03_MoodLy_Calendar", 390, 844, {
    x: 860,
    y: 0,
    layout: "vertical",
    fill: C.bgWhite,
    padding: [48, 20, 20, 20],
    gap: 14,
    clip: true,
  });
  screens.push(s3);

  // Calendar Header
  const s3Top = await createAutoFrame(client, s3, "Cal_Header", 350, 44, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  const s3Back = await createAutoFrame(client, s3Top, "btn_back", 36, 36, {
    cornerRadius: 18,
    fill: "#F4F4F5",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s3Back, "t", "‹", { fontSize: 20, fontStyle: "Bold", fill: C.textBlack });

  const s3TitleWrap = await createAutoFrame(client, s3Top, "Title_Wrap", 200, 36, {
    layout: "vertical",
    crossAlign: "center",
    fill: "none",
  });
  await createText(client, s3TitleWrap, "title", "Mood Calendar", { fontSize: 15, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, s3TitleWrap, "sub", "September, 2025", { fontSize: 11, fill: C.textGray });

  const s3CalIcon = await createAutoFrame(client, s3Top, "btn_cal", 36, 36, {
    cornerRadius: 18,
    fill: "#F4F4F5",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s3CalIcon, "t", "📅", { fontSize: 14 });

  // Day Name Labels (Sun - Sat)
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const s3DaysRow = await createAutoFrame(client, s3, "Days_Name_Row", 350, 20, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none",
    sizingH: "fill",
  });
  for (const d of dayNames) {
    const col = await createAutoFrame(client, s3DaysRow, `d_${d}`, 42, 18, {
      fill: "none",
      mainAlign: "center",
      sizingH: "fill",
    });
    await createText(client, col, "t", d, { fontSize: 10, fontStyle: "Bold", fill: C.textSubtle, textAlign: "center" });
  }

  // Monthly Calendar Mini Matrix (5 Weeks)
  const s3Grid = await createAutoFrame(client, s3, "Calendar_Grid", 350, 160, {
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
    const wRow = await createAutoFrame(client, s3Grid, `Week_${w + 1}`, 350, 26, {
      layout: "horizontal",
      gap: 6,
      fill: "none",
      sizingH: "fill",
    });
    for (let c = 0; c < 7; c++) {
      const dayCell = await createAutoFrame(client, wRow, `Cell_${w}_${c}`, 42, 26, {
        cornerRadius: 8,
        fill: calColors[w][c],
        mainAlign: "center",
        crossAlign: "center",
        sizingH: "fill",
      });
      await createText(client, dayCell, "face", "◡", { fontSize: 10, fontStyle: "Bold", fill: C.textBlack });
    }
  }

  // Mint Card: Monthly Mood Summary
  const s3SummaryCard = await createAutoFrame(client, s3, "Monthly_Summary_Card", 350, 140, {
    layout: "horizontal",
    padding: 18,
    cornerRadius: 26,
    fill: C.mint,
    mainAlign: "spaceBetween",
    crossAlign: "center",
    sizingH: "fill",
  });
  const s3SumLeft = await createAutoFrame(client, s3SummaryCard, "Left_Text", 210, 100, {
    layout: "vertical",
    gap: 6,
    fill: "none",
    sizingH: "fill",
  });
  await createText(client, s3SumLeft, "lbl", "Monthly Mood Summary", { fontSize: 11, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, s3SumLeft, "mood", "Happy", {
    fontSize: 28,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });
  await createText(client, s3SumLeft, "desc", "You're feeling calm and optimistic.\nKeep up the good vibes!", {
    fontSize: 11,
    fill: C.textBlack,
  });

  // Mascot Happy Sleeping Smile
  const s3SumFace = await createAutoFrame(client, s3SummaryCard, "Mascot_Face", 80, 80, {
    cornerRadius: 40,
    fill: "#A3EB8A",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s3SumFace, "f", "◠ ‿ ◠", { fontSize: 18, fontStyle: "Bold", fill: C.textBlack });

  // 3 Mini Stat Cards (Activity, Therapy, Discipline)
  const s3StatsRow = await createAutoFrame(client, s3, "Stats_Row", 350, 95, {
    layout: "horizontal",
    gap: 10,
    fill: "none",
    sizingH: "fill",
  });

  const miniStats = [
    { label: "Activity", val: "101,513", sub: "Steps", bg: "#F8FAFC" },
    { label: "Therapy", val: "10/30", sub: "Sessions", bg: "#F8FAFC" },
    { label: "Discipline", val: "88%", sub: "Focus score", bg: "#F8FAFC" },
  ];
  for (const st of miniStats) {
    const stCard = await createAutoFrame(client, s3StatsRow, `Stat_${st.label}`, 110, 95, {
      layout: "vertical",
      padding: 12,
      gap: 4,
      cornerRadius: 18,
      fill: st.bg,
      stroke: "#E4E4E7",
      sizingH: "fill",
      mainAlign: "center",
    });
    await createText(client, stCard, "lbl", st.label, { fontSize: 11, fill: C.textGray });
    await createText(client, stCard, "val", st.val, {
      fontSize: 16,
      fontFamily: "Plus Jakarta Sans",
      fontStyle: "Bold",
      fill: C.textBlack,
    });
    await createText(client, stCard, "sub", st.sub, { fontSize: 10, fill: C.textSubtle });
  }

  // Floating Bottom Nav Bar (Black Pill, Calendar Active)
  await createBottomNav(client, s3, 2);


  // =========================================================================
  // SCREEN 4: Mood Check-in (NEW) (390 x 844)
  // =========================================================================
  console.log("Creating Screen 4: 04_MoodLy_CheckIn...");
  const s4 = await createAutoFrame(client, undefined, "04_MoodLy_CheckIn", 390, 844, {
    x: 0,
    y: 920,
    layout: "vertical",
    fill: C.bgApp,
    padding: [48, 20, 20, 20],
    gap: 16,
    clip: true,
  });
  screens.push(s4);

  // Top Nav
  const s4Top = await createAutoFrame(client, s4, "CheckIn_Header", 350, 40, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  const s4Close = await createAutoFrame(client, s4Top, "btn_close", 36, 36, {
    cornerRadius: 18,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s4Close, "t", "✕", { fontSize: 14, fontStyle: "Bold", fill: C.textBlack });

  await createText(client, s4Top, "title", "Daily Mood Check-in", {
    fontSize: 15,
    fontStyle: "Bold",
    fill: C.textBlack,
  });
  const s4Help = await createAutoFrame(client, s4Top, "btn_help", 36, 36, {
    cornerRadius: 18,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s4Help, "t", "❓", { fontSize: 13 });

  // Headline
  const s4Head = await createAutoFrame(client, s4, "Headline", 350, 48, {
    layout: "vertical",
    gap: 2,
    fill: "none",
    sizingH: "fill",
  });
  await createText(client, s4Head, "h", "What best describes\nyour feeling right now?", {
    fontSize: 20,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });

  // Big Mood Face Selection Grid (4 Big Cards)
  const s4FaceGrid = await createAutoFrame(client, s4, "Face_Cards_Grid", 350, 160, {
    layout: "horizontal",
    gap: 10,
    fill: "none",
    sizingH: "fill",
  });

  const bigMoods = [
    { name: "Radiant", emoji: "★ ‿ ★", bg: C.yellow, selected: false },
    { name: "Peaceful", emoji: "◠ ‿ ◠", bg: C.mint, selected: true },
    { name: "Tired", emoji: "• ｡ •", bg: C.sky, selected: false },
    { name: "Anxious", emoji: "ˋ ︿ ˊ", bg: C.peach, selected: false },
  ];

  for (const bm of bigMoods) {
    const card = await createAutoFrame(client, s4FaceGrid, `Card_${bm.name}`, 80, 150, {
      layout: "vertical",
      padding: 10,
      cornerRadius: 22,
      fill: bm.bg,
      stroke: bm.selected ? C.textBlack : "none",
      strokeWeight: bm.selected ? 3 : 0,
      mainAlign: "spaceBetween",
      crossAlign: "center",
      sizingH: "fill",
    });
    await createText(client, card, "radio", bm.selected ? "●" : "○", { fontSize: 12, fill: C.textBlack });
    await createText(client, card, "face", bm.emoji, { fontSize: 20, fontStyle: "Bold", fill: C.textBlack });
    await createText(client, card, "lbl", bm.name, { fontSize: 11, fontStyle: "Bold", fill: C.textBlack });
  }

  // Intensity Slider Card (Lavender)
  const s4Intensity = await createAutoFrame(client, s4, "Intensity_Card", 350, 100, {
    layout: "vertical",
    padding: 16,
    gap: 10,
    cornerRadius: 24,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    sizingH: "fill",
  });
  const s4IntTop = await createAutoFrame(client, s4Intensity, "Top", 318, 20, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none",
  });
  await createText(client, s4IntTop, "lbl", "Mood Intensity", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, s4IntTop, "val", "Level 8 of 10 (Deeply Calm)", {
    fontSize: 11,
    fontStyle: "Bold",
    fill: "#7C3AED",
  });

  // Slider Track & Thumb
  const sliderTrack = await createAutoFrame(client, s4Intensity, "Slider_Track", 318, 12, {
    cornerRadius: 6,
    fill: "#F4F4F5",
    layout: "horizontal",
  });
  const sliderFilled = await createAutoFrame(client, sliderTrack, "Filled", 240, 12, {
    cornerRadius: 6,
    fill: C.lavender,
    layout: "horizontal",
    mainAlign: "max",
    crossAlign: "center",
  });
  const sliderThumb = await createAutoFrame(client, sliderFilled, "Thumb", 20, 20, {
    cornerRadius: 10,
    fill: C.textBlack,
  });

  // Note Field Card
  const s4NoteCard = await createAutoFrame(client, s4, "Note_Card", 350, 110, {
    layout: "vertical",
    padding: 14,
    gap: 6,
    cornerRadius: 22,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    sizingH: "fill",
  });
  await createText(client, s4NoteCard, "lbl", "Add a brief reflection (Optional)", {
    fontSize: 11,
    fontStyle: "Bold",
    fill: C.textGray,
  });
  const s4InputBox = await createAutoFrame(client, s4NoteCard, "Input_Box", 322, 60, {
    layout: "horizontal",
    padding: 10,
    cornerRadius: 12,
    fill: "#F9FAFB",
    sizingH: "fill",
  });
  await createText(client, s4InputBox, "ph", "Had a peaceful morning walk in the park...", {
    fontSize: 12,
    fill: C.textSubtle,
  });

  // Save Mood Button (Solid Black Neo-Brutalist)
  const s4SaveBtn = await createAutoFrame(client, s4, "btn_save_mood", 350, 52, {
    cornerRadius: 26,
    fill: C.textBlack,
    mainAlign: "center",
    crossAlign: "center",
    sizingH: "fill",
  });
  await createText(client, s4SaveBtn, "t", "Save Mood Entry ➔", {
    fontSize: 15,
    fontStyle: "Bold",
    fill: "#FFFFFF",
  });


  // =========================================================================
  // SCREEN 5: Insights & Wellbeing Stats (NEW) (390 x 844)
  // =========================================================================
  console.log("Creating Screen 5: 05_MoodLy_Insights...");
  const s5 = await createAutoFrame(client, undefined, "05_MoodLy_Insights", 390, 844, {
    x: 430,
    y: 920,
    layout: "vertical",
    fill: C.bgApp,
    padding: [48, 20, 20, 20],
    gap: 14,
    clip: true,
  });
  screens.push(s5);

  // Top Title
  const s5Top = await createAutoFrame(client, s5, "Top_Insights_Bar", 350, 36, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  await createText(client, s5Top, "title", "Mind & Mood Insights", {
    fontSize: 20,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });
  const s5Filter = await createAutoFrame(client, s5Top, "Filter_Pill", 80, 30, {
    cornerRadius: 15,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s5Filter, "t", "Weekly ▼", { fontSize: 11, fontStyle: "Bold", fill: C.textBlack });

  // Streak & Milestone Bento Card (Soft Pink)
  const s5Streak = await createAutoFrame(client, s5, "Card_Streak", 350, 85, {
    layout: "horizontal",
    padding: 16,
    cornerRadius: 24,
    fill: C.pink,
    mainAlign: "spaceBetween",
    crossAlign: "center",
    sizingH: "fill",
  });
  const s5StrkTxt = await createAutoFrame(client, s5Streak, "Txt", 220, 55, {
    layout: "vertical",
    gap: 4,
    fill: "none",
  });
  await createText(client, s5StrkTxt, "badge", "🔥 14-DAY STREAK", { fontSize: 11, fontStyle: "Bold", fill: "#9D174D" });
  await createText(client, s5StrkTxt, "msg", "You've logged moods consistently!\nSelf-awareness +34% this week.", {
    fontSize: 11,
    fill: C.textBlack,
  });
  const s5StrkBadge = await createAutoFrame(client, s5Streak, "Badge_Icon", 48, 48, {
    cornerRadius: 24,
    fill: "#FFFFFF",
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s5StrkBadge, "ic", "🏆", { fontSize: 22 });

  // Mood Trend Chart Card (White)
  const s5TrendCard = await createAutoFrame(client, s5, "Card_Trend_Chart", 350, 180, {
    layout: "vertical",
    padding: 16,
    gap: 12,
    cornerRadius: 26,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    sizingH: "fill",
  });
  const s5TrendTop = await createAutoFrame(client, s5TrendCard, "Top", 318, 20, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none",
  });
  await createText(client, s5TrendTop, "t", "Weekly Mood Flow", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, s5TrendTop, "avg", "Avg: 8.2 (Very Positive)", { fontSize: 11, fill: "#059669" });

  // Visual Multi-bar / Wave Graph
  const s5ChartBars = await createAutoFrame(client, s5TrendCard, "Trend_Bars", 318, 80, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "max",
    fill: "none",
  });
  const daysWeek = [
    { day: "Mon", h: 45, col: C.mint, face: "◡" },
    { day: "Tue", h: 65, col: C.yellow, face: "★" },
    { day: "Wed", h: 30, col: C.peach, face: "︿" },
    { day: "Thu", h: 55, col: C.sky, face: "｡" },
    { day: "Fri", h: 70, col: C.mint, face: "◡" },
    { day: "Sat", h: 75, col: C.yellow, face: "★" },
    { day: "Sun", h: 60, col: C.lavender, face: "◡" },
  ];
  for (const dw of daysWeek) {
    const colWrap = await createAutoFrame(client, s5ChartBars, `col_${dw.day}`, 36, 80, {
      layout: "vertical",
      gap: 4,
      crossAlign: "center",
      mainAlign: "max",
      fill: "none",
    });
    const bar = await createAutoFrame(client, colWrap, "bar", 28, dw.h, {
      cornerRadius: 14,
      fill: dw.col,
      mainAlign: "center",
      crossAlign: "center",
    });
    await createText(client, bar, "f", dw.face, { fontSize: 9, fontStyle: "Bold", fill: C.textBlack });
    await createText(client, colWrap, "lbl", dw.day, { fontSize: 10, fill: C.textGray });
  }

  // Sleep vs Stress Correlation Bento
  const s5CorrCard = await createAutoFrame(client, s5, "Card_Correlation", 350, 150, {
    layout: "vertical",
    padding: 16,
    gap: 10,
    cornerRadius: 26,
    fill: C.mint,
    sizingH: "fill",
  });
  await createText(client, s5CorrCard, "t", "Sleep vs. Stress Correlation", {
    fontSize: 13,
    fontStyle: "Bold",
    fill: C.textBlack,
  });
  await createText(client, s5CorrCard, "sub", "On days you slept > 7.5 hrs, reported stress levels dropped by 42%.", {
    fontSize: 11,
    fill: C.textBlack,
  });

  const s5CorrBars = await createAutoFrame(client, s5CorrCard, "Bars_Compare", 318, 50, {
    layout: "vertical",
    gap: 8,
    fill: "none",
  });
  // Bar 1 Sleep
  const b1Wrap = await createAutoFrame(client, s5CorrBars, "B1", 318, 18, {
    layout: "horizontal",
    gap: 8,
    crossAlign: "center",
    fill: "none",
  });
  await createText(client, b1Wrap, "l", "Sleep 7.5h", { fontSize: 10, fontStyle: "Bold", fill: C.textBlack });
  const b1Pill = await createAutoFrame(client, b1Wrap, "pill", 200, 14, { cornerRadius: 7, fill: "#7CD663" });

  // Bar 2 Stress
  const b2Wrap = await createAutoFrame(client, s5CorrBars, "B2", 318, 18, {
    layout: "horizontal",
    gap: 8,
    crossAlign: "center",
    fill: "none",
  });
  await createText(client, b2Wrap, "l", "Low Stress", { fontSize: 10, fontStyle: "Bold", fill: C.textBlack });
  const b2Pill = await createAutoFrame(client, b2Wrap, "pill", 160, 14, { cornerRadius: 7, fill: C.lavender });

  // Floating Bottom Nav Bar (Stats Tab Active)
  await createBottomNav(client, s5, 1);


  // =========================================================================
  // SCREEN 6: Profile & Wellbeing Settings (NEW) (390 x 844)
  // =========================================================================
  console.log("Creating Screen 6: 06_MoodLy_Profile...");
  const s6 = await createAutoFrame(client, undefined, "06_MoodLy_Profile", 390, 844, {
    x: 860,
    y: 920,
    layout: "vertical",
    fill: C.bgApp,
    padding: [48, 20, 20, 20],
    gap: 14,
    clip: true,
  });
  screens.push(s6);

  // Top Header
  const s6Top = await createAutoFrame(client, s6, "Top_Profile_Bar", 350, 36, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  await createText(client, s6Top, "title", "Profile & Goals", {
    fontSize: 20,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });
  const s6Gear = await createAutoFrame(client, s6Top, "Gear_Btn", 36, 36, {
    cornerRadius: 18,
    fill: C.bgWhite,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s6Gear, "t", "⚙", { fontSize: 16, fill: C.textBlack });

  // User Profile Big Bento Card (Lavender Purple)
  const s6UserCard = await createAutoFrame(client, s6, "Card_User_Badge", 350, 110, {
    layout: "horizontal",
    padding: 16,
    gap: 14,
    cornerRadius: 26,
    fill: C.lavender,
    crossAlign: "center",
    sizingH: "fill",
  });
  const s6BigAvatar = await createAutoFrame(client, s6UserCard, "Big_Avatar", 64, 64, {
    cornerRadius: 32,
    fill: C.yellow,
    mainAlign: "center",
    crossAlign: "center",
  });
  await createText(client, s6BigAvatar, "av", "🧑‍🦱", { fontSize: 32 });

  const s6UserMeta = await createAutoFrame(client, s6UserCard, "Meta", 220, 60, {
    layout: "vertical",
    gap: 3,
    fill: "none",
  });
  await createText(client, s6UserMeta, "name", "Alex Miller", {
    fontSize: 18,
    fontFamily: "Plus Jakarta Sans",
    fontStyle: "Bold",
    fill: C.textBlack,
  });
  await createText(client, s6UserMeta, "plan", "Mindfulness Pro Member", { fontSize: 12, fill: "#5B21B6" });
  await createBadge(s6UserMeta, "Active Goal: Sleep 8h", "#EDE9FE", "#6D28D9", 10);

  // Therapy Sessions Progress Card (Peach)
  const s6TherapyCard = await createAutoFrame(client, s6, "Card_Therapy_Progress", 350, 115, {
    layout: "vertical",
    padding: 16,
    gap: 8,
    cornerRadius: 26,
    fill: C.peach,
    sizingH: "fill",
  });
  const s6TherapyTop = await createAutoFrame(client, s6TherapyCard, "Top", 318, 20, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    fill: "none",
  });
  await createText(client, s6TherapyTop, "lbl", "Therapy Sessions", { fontSize: 13, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, s6TherapyTop, "val", "10 / 30 Completed", { fontSize: 12, fontStyle: "Bold", fill: "#9A3412" });

  // Progress Bar
  const progTrack = await createAutoFrame(client, s6TherapyCard, "Track", 318, 12, {
    cornerRadius: 6,
    fill: "#FCD34D",
    layout: "horizontal",
  });
  await createAutoFrame(client, progTrack, "Fill", 106, 12, { cornerRadius: 6, fill: C.textBlack });

  await createText(client, s6TherapyCard, "sub", "Next scheduled session: Tomorrow at 4:00 PM with Dr. Harris", {
    fontSize: 11,
    fill: C.textBlack,
  });

  // Settings Toggles List (White Card Container)
  const s6SettingsCard = await createAutoFrame(client, s6, "Card_Settings_Toggles", 350, 170, {
    layout: "vertical",
    padding: [8, 16],
    gap: 6,
    cornerRadius: 24,
    fill: C.bgWhite,
    stroke: "#E4E4E7",
    sizingH: "fill",
  });

  // Toggle 1: Daily Mood Reminder
  const t1 = await createAutoFrame(client, s6SettingsCard, "Toggle_Reminders", 318, 42, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  const t1Left = await createAutoFrame(client, t1, "L", 220, 36, { layout: "vertical", fill: "none" });
  await createText(client, t1Left, "t", "Daily Check-in Reminder", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, t1Left, "s", "Notify at 8:00 PM every evening", { fontSize: 10, fill: C.textGray });
  // Switch Active
  const sw1 = await createAutoFrame(client, t1, "Switch_On", 44, 26, {
    cornerRadius: 13,
    fill: C.textBlack,
    layout: "horizontal",
    padding: 3,
    mainAlign: "max",
    crossAlign: "center",
  });
  await createAutoFrame(client, sw1, "knob", 20, 20, { cornerRadius: 10, fill: "#FFFFFF" });

  // Toggle 2: Appearance (Dark / Light Mode)
  const t2 = await createAutoFrame(client, s6SettingsCard, "Toggle_Appearance", 318, 42, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  const t2Left = await createAutoFrame(client, t2, "L", 220, 36, { layout: "vertical", fill: "none" });
  await createText(client, t2Left, "t", "App Appearance", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, t2Left, "s", "Currently set to Soft Lavender Light", { fontSize: 10, fill: C.textGray });
  const sw2 = await createAutoFrame(client, t2, "Switch_Off", 44, 26, {
    cornerRadius: 13,
    fill: "#E4E4E7",
    layout: "horizontal",
    padding: 3,
    mainAlign: "min",
    crossAlign: "center",
  });
  await createAutoFrame(client, sw2, "knob", 20, 20, { cornerRadius: 10, fill: "#FFFFFF" });

  // Toggle 3: Export Data to Apple Health
  const t3 = await createAutoFrame(client, s6SettingsCard, "Toggle_Health", 318, 42, {
    layout: "horizontal",
    mainAlign: "spaceBetween",
    crossAlign: "center",
    fill: "none",
    sizingH: "fill",
  });
  const t3Left = await createAutoFrame(client, t3, "L", 220, 36, { layout: "vertical", fill: "none" });
  await createText(client, t3Left, "t", "Sync with Apple Health", { fontSize: 12, fontStyle: "Bold", fill: C.textBlack });
  await createText(client, t3Left, "s", "Export steps, sleep & mood metrics", { fontSize: 10, fill: C.textGray });
  const sw3 = await createAutoFrame(client, t3, "Switch_On2", 44, 26, {
    cornerRadius: 13,
    fill: C.textBlack,
    layout: "horizontal",
    padding: 3,
    mainAlign: "max",
    crossAlign: "center",
  });
  await createAutoFrame(client, sw3, "knob", 20, 20, { cornerRadius: 10, fill: "#FFFFFF" });

  // Floating Bottom Nav Bar (Menu / Profile Active)
  await createBottomNav(client, s6, 3);

  // Prototyping Wiring
  console.log("Connecting prototype interactions for MoodLy...");
  // Onboarding Pill -> Screen 2 Dashboard
  await client.runCommand("proto.interaction.add", {
    id: s1Pill,
    trigger: { type: "onClick" },
    action: { type: "navigate", dest: s2 },
    transition: { type: "smartAnimate" },
  });

  // Flow Starting Point on Onboarding
  await client.runCommand("proto.flow.add", {
    start: s1,
    name: "MoodLy App Experience",
  });

  // Center view on canvas
  await client.runCommand("view.set", {
    cx: 650,
    cy: 700,
    zoom: 0.45,
  });

  console.log("✨ MOODLY 6-SCREEN APP DESIGN SYSTEM COMPLETE IN FIGCRAFT!");
  return { screens };
}

// Helper: Reusable Black Floating Pill Bottom Navigation Bar
async function createBottomNav(client: FigCraftClient, parent: number, activeIndex: number) {
  const navBar = await createAutoFrame(client, parent, "Floating_Bottom_Nav", 350, 60, {
    layout: "horizontal",
    padding: [10, 20],
    cornerRadius: 30,
    fill: C.navBlack,
    mainAlign: "spaceBetween",
    crossAlign: "center",
    sizingH: "fill",
    sizingV: "hug",
  });

  const tabs = [
    { name: "Home", icon: "⌂" },
    { name: "Stats", icon: "◔" },
    { name: "Calendar", icon: "📅" },
    { name: "Menu", icon: "⠶" },
  ];

  for (let i = 0; i < tabs.length; i++) {
    const isActive = i === activeIndex;
    const tabItem = await createAutoFrame(client, navBar, `Tab_${tabs[i].name}`, 44, 40, {
      layout: "vertical",
      cornerRadius: 20,
      fill: isActive ? "#27272A" : "none",
      mainAlign: "center",
      crossAlign: "center",
    });
    await createText(client, tabItem, "ic", tabs[i].icon, {
      fontSize: 16,
      fill: isActive ? "#FFFFFF" : "#A1A1AA",
      fontStyle: isActive ? "Bold" : "Regular",
    });
  }
}

// Direct Execution Entrypoint
if (import.meta.main) {
  const client = new FigCraftClient();
  client.connect().then(async () => {
    await buildMoodly(client);
    client.close();
    process.exit(0);
  }).catch((err) => {
    console.error("FigCraft Connection Error:", err.message);
    process.exit(1);
  });
}
