// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { getAnalytics } from "firebase/analytics";

// --- Global Variables & Configuration ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-aim-trainer-app';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// !! IMPORTANT: REPLACE THE PLACEHOLDER VALUES BELOW WITH YOUR ACTUAL        !!
// !! FIREBASE PROJECT CONFIGURATION WHEN DEPLOYING TO GITHUB PAGES OR       !!
// !! ANY ENVIRONMENT WHERE __firebase_config IS NOT AUTOMATICALLY PROVIDED. !!
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : { 
        apiKey: "AIzaSyCTx2FD1T1lZikmezvl8Eu_ETCpNpqyCsQ", 
        authDomain: "aim-grid.firebaseapp.com", 
        projectId: "aim-grid",
        storageBucket: "aim-grid.firebasestorage.app",
        messagingSenderId: "1:343812555641:web:b50726700d057247eb65a8",
        appId: "YOUR_ACTUAL_APP_ID"
        measurementId: "G-5PTNKM38EZ"
      }; 

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const HUD_OFFSET_Y = 70; 
const TARGET_SHAPES = ['circle', 'square', 'triangle', 'hexagon'];


let app;
let auth;
let db;
let userId;
let userDisplayName = "Player"; 
let pixiApp;
let gameContainer;
let crosshairElement; 

// Game State
let gameState = 'MENU'; 
let currentDrillType = null; 
let drillToConfigure = null; 
let currentScore = 0; 
let targetsHit = 0; 
let targetsMissed = 0; 
let earlyClicks = 0; 
let lateClicks = 0;  
let drillTimer = 0; 
let drillDuration = 0; 
let overallTimeLimit = 0; 
let targetsToHitGoal = 0; 
let targetsHitThisDrill = 0; 
let drillInterval;
let currentTarget = null; 
let currentTargetsArray = []; 
let activeTargetIndex = -1; 
let reactiveTargetChangeInterval;
let timerHasStarted = false;
let timeOnTarget = 0; 
let totalTrackingTime = 0; 

// Routine specific state
const dailyWarmupRoutine = ['FLICKING', 'TRACKING', 'TARGET_SWITCHING']; 
let currentRoutineIndex = -1;
let routineScores = [];

// XP and Leveling
let userXP = 0;
let userLevel = 1;
let userTier = "Bronze"; 
let drillsCompleted = 0; 

// Achievements
const achievements = {
    FIRST_BLOOD: { id: "FIRST_BLOOD", name: "First Blood!", description: "Successfully hit your first target.", unlocked: false },
    NOVICE_TRAINER: { id: "NOVICE_TRAINER", name: "Novice Trainer", description: "Complete 5 training drills.", unlocked: false },
    LEVEL_UP_2: { id: "LEVEL_UP_2", name: "Level Up!", description: "Reach Level 2.", unlocked: false },
    FLICK_MASTER_1: { id: "FLICK_MASTER_1", name: "Flick Ace", description: "Score 5000+ in Flick Shot Matrix.", unlocked: false },
    SWITCH_HITTER: { id: "SWITCH_HITTER", name: "Switch Hitter", description: "Complete a Switch Track drill.", unlocked: false },
    MICRO_MANAGER: { id: "MICRO_MANAGER", name: "Micro Manager", description: "Complete a Micro Flick drill.", unlocked: false },
    MACRO_MASTER: { id: "MACRO_MASTER", name: "Macro Master", description: "Complete a Macro Flick drill.", unlocked: false },
};
let unlockedAchievements = {}; 

// Sound Effects with Tone.js
let hitSound, missSound, clickSound, drillStartSound, drillEndSound, switchTargetSound, shieldBreakSound, bombExplodeSound;
let sfxVolumeNode;


// Default Settings
const defaultUserSettings = {
    sensitivity: 1.0,
    flickingDuration: 60, 
    trackingDuration: 30, 
    reactiveTrackingDuration: 30,
    dynamicFlickingDuration: 60,
    precisionTimingDuration: 45,
    recoilControlFlickDuration: 60,
    targetBlitzNumTargets: 20,
    targetBlitzTimeLimit: 60, 
    targetSwitchingDuration: 60,
    targetSwitchingMaxTargets: 3, 
    microFlickingDuration: 60,
    macroFlickingDuration: 60,
    recoilStrength: 15, 
    shieldProbability: 25, 
    bombProbability: 10,   
    bombPenalty: 250,
    crosshairType: 'cross', 
    crosshairColor: '#00FF00', 
    crosshairSize: 16, 
    crosshairThickness: 2, 
    crosshairGap: 5, 
    targetShape: 'circle', 
    flickingTargetColor: '#34D399', 
    trackingTargetColor: '#F472B6', 
    targetOutlineColor: '#00FFFF', 
    sfxVolume: 50, 
    currentTheme: 'theme-neon-grid',
    xp: 0,
    level: 1,
    drillsCompleted: 0,
    unlockedAchievements: {}
};
let userSettings = { ...defaultUserSettings };


// DOM Elements (Ensure all are correctly referenced from index.html)
const mainMenuModal = document.getElementById('mainMenuModal');
const configureDrillModal = document.getElementById('configureDrillModal');
const configureDrillTitle = document.getElementById('configureDrillTitle');
const drillDurationInput = document.getElementById('drillDurationInput');
const configDurationGroup = document.getElementById('configDurationGroup');
const drillNumTargetsInput = document.getElementById('drillNumTargetsInput');
const configNumTargetsGroup = document.getElementById('configNumTargetsGroup');
const drillTimeLimitInput = document.getElementById('drillTimeLimitInput');
const configTimeLimitGroup = document.getElementById('configTimeLimitGroup');
const confirmStartDrillButton = document.getElementById('confirmStartDrillButton');
const cancelDrillConfigButton = document.getElementById('cancelDrillConfigButton');
const routineSummaryModal = document.getElementById('routineSummaryModal');
const routineSummaryList = document.getElementById('routineSummaryList');
const routineOkButton = document.getElementById('routineOkButton');
const achievementsModal = document.getElementById('achievementsModal');
const achievementsList = document.getElementById('achievementsList');
const achievementsOkButton = document.getElementById('achievementsOkButton');
const leaderboardModal = document.getElementById('leaderboardModal');
const leaderboardTitle = document.getElementById('leaderboardTitle');
const leaderboardList = document.getElementById('leaderboardList');
const leaderboardOkButton = document.getElementById('leaderboardOkButton');
const leaderboardLoadingStatus = document.getElementById('leaderboardLoadingStatus');
const analyticsModal = document.getElementById('analyticsModal');
const analyticsSummaryList = document.getElementById('analyticsSummaryList');
const analyticsOkButton = document.getElementById('analyticsOkButton');
const analyticsLoadingStatus = document.getElementById('analyticsLoadingStatus');
const settingsModal = document.getElementById('settingsModal');
const scoreModal = document.getElementById('scoreModal');
const hudElement = document.getElementById('hud');
const awaitingInputMessage = document.getElementById('awaitingInputMessage');
const startDailyWarmupButton = document.getElementById('startDailyWarmupButton');
const startFlickingButton = document.getElementById('startFlickingButton');
const startRecoilFlickButton = document.getElementById('startRecoilFlickButton');
const startTrackingButton = document.getElementById('startTrackingButton');
const startReactiveTrackingButton = document.getElementById('startReactiveTrackingButton');
const startDynamicFlickButton = document.getElementById('startDynamicFlickButton');
const startPrecisionTimingButton = document.getElementById('startPrecisionTimingButton');
const startTargetBlitzButton = document.getElementById('startTargetBlitzButton');
const startTargetSwitchingButton = document.getElementById('startTargetSwitchingButton');
const startMicroFlickingButton = document.getElementById('startMicroFlickingButton');
const startMacroFlickingButton = document.getElementById('startMacroFlickingButton');
const settingsButton = document.getElementById('settingsButton');
const leaderboardButton = document.getElementById('leaderboardButton');
const achievementsButton = document.getElementById('achievementsButton');
const analyticsButton = document.getElementById('analyticsButton'); 
const saveSettingsButton = document.getElementById('saveSettingsButton');
const cancelSettingsButton = document.getElementById('cancelSettingsButton');
const sensitivityInput = document.getElementById('sensitivityInput');
const themeSelector = document.getElementById('themeSelector');
const sfxVolumeInput = document.getElementById('sfxVolumeInput');
const crosshairTypeInput = document.getElementById('crosshairTypeInput');
const crosshairColorInput = document.getElementById('crosshairColorInput');
const crosshairSizeInput = document.getElementById('crosshairSizeInput');
const crosshairThicknessInput = document.getElementById('crosshairThicknessInput');
const crosshairThicknessGroup = document.getElementById('crosshairThicknessGroup');
const crosshairGapInput = document.getElementById('crosshairGapInput');
const crosshairGapGroup = document.getElementById('crosshairGapGroup');
const targetShapeInput = document.getElementById('targetShapeInput');
const flickingTargetColorInput = document.getElementById('flickingTargetColorInput');
const trackingTargetColorInput = document.getElementById('trackingTargetColorInput');
const targetOutlineColorInput = document.getElementById('targetOutlineColorInput');
const recoilStrengthInput = document.getElementById('recoilStrengthInput');
const shieldProbabilityInput = document.getElementById('shieldProbabilityInput');
const bombProbabilityInput = document.getElementById('bombProbabilityInput');
const bombPenaltyInput = document.getElementById('bombPenaltyInput');
const playAgainButton = document.getElementById('playAgainButton');
const backToMenuButton = document.getElementById('backToMenuButton');
const loadingStatus = document.getElementById('loadingStatus');
const userIdDisplay = document.getElementById('userIdDisplay');
const userLevelDisplay = document.getElementById('userLevelDisplay');
const userXPDisplay = document.getElementById('userXPDisplay');
const userNextLevelXPDisplay = document.getElementById('userNextLevelXPDisplay');
const userTierDisplay = document.getElementById('userTierDisplay'); 
const finalScoreElement = document.getElementById('finalScore');
const scoreUnitElement = document.getElementById('scoreUnit');
const finalHitsLabel = document.getElementById('hitsLabel');
const finalMissesLabel = document.getElementById('missesLabel');
const hudScoreValue = document.getElementById('hudScoreValue');
const hudTimeLabel = document.getElementById('hudTimeLabel');
const hudTimeValue = document.getElementById('hudTimeValue');
const hudTargetCountLabel = document.getElementById('hudTargetCountLabel');
const hudTargetCountValue = document.getElementById('hudTargetCountValue');
const hudAccuracyValue = document.getElementById('hudAccuracyValue');
const endGameButton = document.getElementById('endGameButton');
const settingsErrorMessages = document.getElementById('settingsErrorMessages');
const drillConfigErrorMessages = document.getElementById('drillConfigErrorMessages');
const finalDrillTypeElement = document.getElementById('finalDrillType');
const achievementNotification = document.getElementById('achievementNotification');

// --- Sound Initialization ---
// (Sound functions remain the same as v2.3)
function initSounds() {
    sfxVolumeNode = new Tone.Volume().toDestination(); 
    setSfxVolume(userSettings.sfxVolume); 

    hitSound = new Tone.Synth({
        oscillator: { type: "triangle" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.05, release: 0.1 },
        volume: -10 
    }).connect(sfxVolumeNode);

    missSound = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.005, decay: 0.05, sustain: 0, release: 0.1 },
        volume: -15
    }).connect(sfxVolumeNode);
    
    clickSound = new Tone.MembraneSynth({
        pitchDecay: 0.008,
        octaves: 2,
        envelope: { attack: 0.001, decay: 0.1, sustain: 0 },
        volume: -18
    }).connect(sfxVolumeNode);

    drillStartSound = new Tone.Synth({
        oscillator: {type: "sawtooth"},
        envelope: {attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2},
        volume: -8
    }).connect(sfxVolumeNode);
    
    drillEndSound = new Tone.Synth({
        oscillator: {type: "sine"},
        envelope: {attack: 0.01, decay: 0.3, sustain: 0.05, release: 0.3},
        volume: -8
    }).connect(sfxVolumeNode);
    
    switchTargetSound = new Tone.Synth({ 
        oscillator: {type: "square"},
        envelope: {attack: 0.005, decay: 0.05, sustain: 0.02, release: 0.1},
        volume: -12
    }).connect(sfxVolumeNode);
    shieldBreakSound = new Tone.Synth({
        oscillator: { type: "square" },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
        volume: -12
    }).connect(sfxVolumeNode);
    bombExplodeSound = new Tone.NoiseSynth({
        noise: { type: "white", playbackRate: 0.5 },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 },
        volume: -5
    }).connect(sfxVolumeNode);
}

function playSound(sound, time = Tone.now(), note = 'C4', duration = '8n') {
    if (Tone.context.state !== 'running') {
        Tone.start().catch(e => console.warn("Tone.start() failed:", e));
    }
    try {
        if (sound instanceof Tone.NoiseSynth) {
            sound.triggerAttackRelease(duration, time);
        } else if (sound instanceof Tone.Synth || sound instanceof Tone.MembraneSynth) { // Check if it's a synth type that takes a note
             if (sound.triggerAttackRelease) { // Ensure method exists
                sound.triggerAttackRelease(note, duration, time);
            }
        }
    } catch (e) {
        console.warn("Error playing sound:", e);
    }
}
function setSfxVolume(value) { 
    userSettings.sfxVolume = parseInt(value);
    const dbValue = Tone.gainToDb(value / 100); 
    if (sfxVolumeNode) {
        sfxVolumeNode.volume.value = dbValue > -Infinity ? dbValue : -100; 
    }
}


// --- Theme Management ---
// (Theme functions remain the same as v2.3)
function applyTheme(themeName) {
    document.body.className = themeName; 
    userSettings.currentTheme = themeName;
    if (pixiApp) { 
         pixiApp.renderer.backgroundColor = themeName === 'theme-arcade-light' ? defaultUserSettings.pixiBgLight : (themeName === 'theme-cosmic-dark' ? defaultUserSettings.pixiBgCosmic : defaultUserSettings.pixiBgDark) ;
    }
    const selectArrows = document.querySelectorAll('.input-group select');
    selectArrows.forEach(sel => {
        let fillColor = '#00ffff'; 
        if (themeName === 'theme-arcade-light') fillColor = '#1f2937';
        else if (themeName === 'theme-cosmic-dark') fillColor = '#c084fc';
        sel.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='${encodeURIComponent(fillColor)}' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`;
    });
}
defaultUserSettings.pixiBgDark = 0x101214;
defaultUserSettings.pixiBgLight = 0xe0e7ff;
defaultUserSettings.pixiBgCosmic = 0x130f25; 


// --- Firebase Initialization & Auth ---
async function initFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        // setLogLevel('debug'); 

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                userId = user.uid;
                userDisplayName = user.displayName || `User-${userId.substring(0, 6)}`;
                userIdDisplay.textContent = `UserID: ${userDisplayName}`;
                await loadUserProfileData(); 
                enableButtons();
                loadingStatus.textContent = 'Grid Connection: Secure';
            } else {
                userIdDisplay.textContent = `UserID: Establishing Link...`;
                try {
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Error during sign-in:", error);
                    loadingStatus.textContent = 'Auth Uplink Failed. Refresh.';
                    userIdDisplay.textContent = `UserID: Link Error`;
                     // Attempt to enable some buttons even on auth failure for basic offline play?
                    // For now, buttons remain disabled as most features depend on user data.
                }
            }
        });
    } catch (error) {
        console.error("Firebase initialization error:", error);
        loadingStatus.textContent = 'Firebase Core Failure.';
        userIdDisplay.textContent = `UserID: Firebase Error`;
    }
}

function enableButtons() {
    startDailyWarmupButton.disabled = false;
    startFlickingButton.disabled = false;
    startRecoilFlickButton.disabled = false;
    startTrackingButton.disabled = false;
    startReactiveTrackingButton.disabled = false;
    startDynamicFlickButton.disabled = false;
    startPrecisionTimingButton.disabled = false;
    startTargetBlitzButton.disabled = false;
    startTargetSwitchingButton.disabled = false;
    startMicroFlickingButton.disabled = false;
    startMacroFlickingButton.disabled = false;
    settingsButton.disabled = false;
    leaderboardButton.disabled = false;
    achievementsButton.disabled = false;
    analyticsButton.disabled = false;
}

// --- User Settings, XP, Level, Achievements (Firestore & UI) ---
async function loadUserProfileData() { 
    if (!userId) {
        userSettings = { ...defaultUserSettings }; 
        applyCurrentSettingsToUI();
        updateProfileDisplay();
        return;
    }
    const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/aimTrainerData`);
    try {
        const docSnap = await getDoc(userProfileRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            userSettings = { ...defaultUserSettings, ...data }; 
            userXP = userSettings.xp || 0;
            userLevel = userSettings.level || 1;
            drillsCompleted = userSettings.drillsCompleted || 0;
            unlockedAchievements = userSettings.unlockedAchievements || {};
            console.log("User profile data loaded:", userSettings);
        } else {
            userSettings = { ...defaultUserSettings }; 
            userXP = userSettings.xp;
            userLevel = userSettings.level;
            drillsCompleted = userSettings.drillsCompleted;
            unlockedAchievements = userSettings.unlockedAchievements;
            console.log("No user profile data found, using defaults and saving.");
            await saveUserProfileData(); 
        }
        applyCurrentSettingsToUI(); 
        updateProfileDisplay();
    } catch (error) {
        console.error("Error loading user profile data:", error);
        userSettings = { ...defaultUserSettings }; 
        applyCurrentSettingsToUI();
        updateProfileDisplay();
    }
}

function applyCurrentSettingsToUI() {
    sensitivityInput.value = userSettings.sensitivity;
    themeSelector.value = userSettings.currentTheme;
    applyTheme(userSettings.currentTheme); 
    sfxVolumeInput.value = userSettings.sfxVolume;
    setSfxVolume(userSettings.sfxVolume); 
    crosshairTypeInput.value = userSettings.crosshairType;
    crosshairColorInput.value = userSettings.crosshairColor;
    crosshairSizeInput.value = userSettings.crosshairSize;
    crosshairThicknessInput.value = userSettings.crosshairThickness;
    crosshairGapInput.value = userSettings.crosshairGap;
    targetShapeInput.value = userSettings.targetShape;
    flickingTargetColorInput.value = userSettings.flickingTargetColor;
    trackingTargetColorInput.value = userSettings.trackingTargetColor;
    targetOutlineColorInput.value = userSettings.targetOutlineColor;
    recoilStrengthInput.value = userSettings.recoilStrength;
    shieldProbabilityInput.value = userSettings.shieldProbability;
    bombProbabilityInput.value = userSettings.bombProbability;
    bombPenaltyInput.value = userSettings.bombPenalty;
    updateCrosshairStyle();
    toggleCrosshairSettingsVisibility();
}

async function saveUserProfileData() { 
    if (!userId) return;
    
    userSettings.sensitivity = parseFloat(sensitivityInput.value) || defaultUserSettings.sensitivity;
    userSettings.currentTheme = themeSelector.value || defaultUserSettings.currentTheme;
    userSettings.sfxVolume = parseInt(sfxVolumeInput.value);
     if (isNaN(userSettings.sfxVolume) || userSettings.sfxVolume < 0 || userSettings.sfxVolume > 100) {
        userSettings.sfxVolume = defaultUserSettings.sfxVolume;
    }
    userSettings.crosshairType = crosshairTypeInput.value || defaultUserSettings.crosshairType;
    userSettings.crosshairColor = crosshairColorInput.value || defaultUserSettings.crosshairColor;
    userSettings.crosshairSize = parseInt(crosshairSizeInput.value) || defaultUserSettings.crosshairSize;
    userSettings.crosshairThickness = parseInt(crosshairThicknessInput.value) || defaultUserSettings.crosshairThickness;
    userSettings.crosshairGap = parseInt(crosshairGapInput.value); 
    if (isNaN(userSettings.crosshairGap)) userSettings.crosshairGap = defaultUserSettings.crosshairGap;
    userSettings.targetShape = targetShapeInput.value || defaultUserSettings.targetShape;
    userSettings.flickingTargetColor = flickingTargetColorInput.value || defaultUserSettings.flickingTargetColor;
    userSettings.trackingTargetColor = trackingTargetColorInput.value || defaultUserSettings.trackingTargetColor;
    userSettings.targetOutlineColor = targetOutlineColorInput.value || defaultUserSettings.targetOutlineColor;
    userSettings.recoilStrength = parseInt(recoilStrengthInput.value);
    if(isNaN(userSettings.recoilStrength)) userSettings.recoilStrength = defaultUserSettings.recoilStrength;
    userSettings.shieldProbability = parseInt(shieldProbabilityInput.value);
    if(isNaN(userSettings.shieldProbability) || userSettings.shieldProbability < 0 || userSettings.shieldProbability > 100) userSettings.shieldProbability = defaultUserSettings.shieldProbability;
    userSettings.bombProbability = parseInt(bombProbabilityInput.value);
    if(isNaN(userSettings.bombProbability) || userSettings.bombProbability < 0 || userSettings.bombProbability > 100) userSettings.bombProbability = defaultUserSettings.bombProbability;
    userSettings.bombPenalty = parseInt(bombPenaltyInput.value);
    if(isNaN(userSettings.bombPenalty) || userSettings.bombPenalty < 0) userSettings.bombPenalty = defaultUserSettings.bombPenalty;


    userSettings.xp = userXP;
    userSettings.level = userLevel;
    userSettings.drillsCompleted = drillsCompleted;
    userSettings.unlockedAchievements = unlockedAchievements;

    const userProfileRef = doc(db, `artifacts/${appId}/users/${userId}/profile/aimTrainerData`);
    try {
        await setDoc(userProfileRef, userSettings, { merge: true });
        console.log("User profile data saved:", userSettings);
        applyTheme(userSettings.currentTheme); 
        setSfxVolume(userSettings.sfxVolume); 
        updateCrosshairStyle(); 
        updateProfileDisplay();
    } catch (error) {
        console.error("Error saving user profile data:", error);
    }
}

function getSkillTier(level) {
    if (level >= 50) return "Grandmaster";
    if (level >= 40) return "Master";
    if (level >= 30) return "Diamond";
    if (level >= 20) return "Platinum";
    if (level >= 10) return "Gold";
    if (level >= 5) return "Silver";
    return "Bronze";
}

function updateProfileDisplay() {
    userLevelDisplay.textContent = userLevel;
    userTierDisplay.textContent = getSkillTier(userLevel);
    userXPDisplay.textContent = userXP;
    userNextLevelXPDisplay.textContent = calculateXPForNextLevel(userLevel);
}

function calculateXPForNextLevel(level) {
    return level * 750 + 250; 
}

function awardXP(amount) {
    if (!userId) return;
    userXP += Math.round(amount);
    console.log(`Awarded ${Math.round(amount)} XP. Total XP: ${userXP}`);
    checkLevelUp();
    updateProfileDisplay();
}

function checkLevelUp() {
    let xpForNext = calculateXPForNextLevel(userLevel);
    while (userXP >= xpForNext) {
        userLevel++;
        userXP -= xpForNext;
        console.log(`Leveled up to ${userLevel}! Remaining XP: ${userXP}`);
        checkAndUnlockAchievement('LEVEL_UP_' + userLevel); 
        xpForNext = calculateXPForNextLevel(userLevel);
    }
}

function checkAndUnlockAchievement(achievementId) {
    if (achievements[achievementId] && !unlockedAchievements[achievementId]) {
        unlockedAchievements[achievementId] = true;
        showAchievementNotification(achievements[achievementId].name);
        console.log(`Achievement Unlocked: ${achievements[achievementId].name}`);
        saveUserProfileData(); 
    }
}
        
function showAchievementNotification(achievementName) {
    achievementNotification.textContent = `Achievement Unlocked: ${achievementName}!`;
    achievementNotification.classList.remove('hidden');
    achievementNotification.style.opacity = 1;
    setTimeout(() => {
        achievementNotification.style.opacity = 0;
        setTimeout(() => achievementNotification.classList.add('hidden'), 500);
    }, 3000);
}
        
// --- Crosshair Customization --- 
function updateCrosshairStyle() {
    if (!crosshairElement) return;
    crosshairElement.innerHTML = ''; 
    crosshairElement.className = 'crosshair'; 
    crosshairElement.style.cssText = ''; 

    const type = userSettings.crosshairType;
    const color = userSettings.crosshairColor;
    const size = Math.max(1, userSettings.crosshairSize); 
    const thickness = Math.max(1, userSettings.crosshairThickness);
    const gap = Math.max(0, userSettings.crosshairGap);

    if (type === 'dot') {
        crosshairElement.classList.add('crosshair-dot');
        crosshairElement.style.width = `${size}px`;
        crosshairElement.style.height = `${size}px`;
        crosshairElement.style.backgroundColor = color;
    } else if (type === 'cross') {
        crosshairElement.classList.add('crosshair-cross');
        const lineLength = (size - gap) / 2; 
        
        if (lineLength > 0) {
            const top = document.createElement('div');
            top.className = 'line';
            top.style.width = `${thickness}px`;
            top.style.height = `${lineLength}px`;
            top.style.backgroundColor = color;
            top.style.position = 'absolute';
            top.style.left = `calc(50% - ${thickness/2}px)`;
            top.style.top = `0px`;
            crosshairElement.appendChild(top);

            const bottom = document.createElement('div');
            bottom.className = 'line';
            bottom.style.width = `${thickness}px`;
            bottom.style.height = `${lineLength}px`;
            bottom.style.backgroundColor = color;
            bottom.style.position = 'absolute';
            bottom.style.left = `calc(50% - ${thickness/2}px)`;
            bottom.style.bottom = `0px`;
            crosshairElement.appendChild(bottom);

            const left = document.createElement('div');
            left.className = 'line';
            left.style.width = `${lineLength}px`;
            left.style.height = `${thickness}px`;
            left.style.backgroundColor = color;
            left.style.position = 'absolute';
            left.style.left = `0px`;
            left.style.top = `calc(50% - ${thickness/2}px)`;
            crosshairElement.appendChild(left);

            const right = document.createElement('div');
            right.className = 'line';
            right.style.width = `${lineLength}px`;
            right.style.height = `${thickness}px`;
            right.style.backgroundColor = color;
            right.style.position = 'absolute';
            right.style.right = `0px`;
            right.style.top = `calc(50% - ${thickness/2}px)`;
            crosshairElement.appendChild(right);
        }
        crosshairElement.style.width = `${size}px`;
        crosshairElement.style.height = `${size}px`;

    } else if (type === 'circle') {
        crosshairElement.classList.add('crosshair-circle');
        crosshairElement.style.width = `${size}px`;
        crosshairElement.style.height = `${size}px`;
        crosshairElement.style.border = `${thickness}px solid ${color}`;
    }
}

function toggleCrosshairSettingsVisibility() {
    const type = crosshairTypeInput.value;
    crosshairThicknessGroup.classList.toggle('hidden', type === 'dot');
    crosshairGapGroup.classList.toggle('hidden', type !== 'cross');
}
if(crosshairTypeInput) crosshairTypeInput.addEventListener('change', toggleCrosshairSettingsVisibility);


// --- PixiJS Initialization & Game Logic --- 
function initPixi() {
    gameContainer = document.getElementById('gameContainer');
    pixiApp = new PIXI.Application({
        width: gameContainer.clientWidth,
        height: gameContainer.clientHeight,
        backgroundColor: userSettings.currentTheme === 'theme-arcade-light' ? defaultUserSettings.pixiBgLight : (userSettings.currentTheme === 'theme-cosmic-dark' ? defaultUserSettings.pixiBgCosmic : defaultUserSettings.pixiBgDark), 
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
    });
    document.getElementById('pixiCanvas').replaceWith(pixiApp.view); 
    pixiApp.view.style.cursor = 'none'; 

    crosshairElement = document.createElement('div');
    gameContainer.appendChild(crosshairElement);
    updateCrosshairStyle(); 
    
    pixiApp.view.addEventListener('mousemove', handleFirstInputListener); 
    pixiApp.view.addEventListener('click', handleFirstInputListener); 
    
    pixiApp.view.addEventListener('mousemove', (event) => {
        const rect = pixiApp.view.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        crosshairElement.style.left = `${x}px`;
        crosshairElement.style.top = `${y}px`;
    });

    pixiApp.view.addEventListener('click', handleCanvasClick);
    window.addEventListener('resize', resizePixi);
    resizePixi(); 
    pixiApp.ticker.add(gameLoop);
}

const handleFirstInputListener = (event) => { 
    if (gameState === 'AWAITING_INPUT' && !timerHasStarted) {
        timerHasStarted = true;
        awaitingInputMessage.classList.add('hidden');
        startDrillTimer(); 
        gameState = 'PLAYING'; 
        console.log("First input detected, timer started, gameState: PLAYING");
        playSound(drillStartSound, Tone.now(), 'C5', '4n');
        pixiApp.view.removeEventListener('mousemove', handleFirstInputListener);
        pixiApp.view.removeEventListener('click', handleFirstInputListener);
    }
};


function resizePixi() {
    if (pixiApp && gameContainer) {
        pixiApp.renderer.resize(gameContainer.clientWidth, gameContainer.clientHeight);
    }
}

function openDrillConfiguration(drillTypeToSet) {
    playSound(clickSound);
    drillToConfigure = drillTypeToSet;
    if (drillConfigErrorMessages) drillConfigErrorMessages.textContent = ''; 

    configDurationGroup.classList.remove('hidden');
    configNumTargetsGroup.classList.add('hidden');
    configTimeLimitGroup.classList.add('hidden');

    let durationSettingKey = `${drillTypeToSet.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase())}Duration`;
    if (drillTypeToSet === 'TARGET_BLITZ') durationSettingKey = null; 

    if (durationSettingKey && userSettings[durationSettingKey] !== undefined) {
         drillDurationInput.value = userSettings[durationSettingKey];
    } else if (drillTypeToSet !== 'TARGET_BLITZ') { 
        drillDurationInput.value = 60; 
    }


    if (drillTypeToSet === 'FLICKING') configureDrillTitle.textContent = "Configure Flick Shot Matrix";
    else if (drillTypeToSet === 'RECOIL_CONTROL_FLICK') configureDrillTitle.textContent = "Configure Recoil Control";
    else if (drillTypeToSet === 'TRACKING') configureDrillTitle.textContent = "Configure Vector Trace";
    else if (drillTypeToSet === 'REACTIVE_TRACKING') configureDrillTitle.textContent = "Configure Reactive Trace";
    else if (drillTypeToSet === 'DYNAMIC_FLICKING') configureDrillTitle.textContent = "Configure Dynamic Shift";
    else if (drillTypeToSet === 'PRECISION_TIMING') configureDrillTitle.textContent = "Configure Timing Window";
    else if (drillTypeToSet === 'TARGET_SWITCHING') configureDrillTitle.textContent = "Configure Switch Track";
    else if (drillTypeToSet === 'MICRO_FLICKING') configureDrillTitle.textContent = "Configure Micro Flick";
    else if (drillTypeToSet === 'MACRO_FLICKING') configureDrillTitle.textContent = "Configure Macro Flick";
    else if (drillTypeToSet === 'TARGET_BLITZ') {
        configureDrillTitle.textContent = "Configure Target Blitz";
        configDurationGroup.classList.add('hidden'); 
        configNumTargetsGroup.classList.remove('hidden');
        configTimeLimitGroup.classList.remove('hidden');
        drillNumTargetsInput.value = userSettings.targetBlitzNumTargets;
        drillTimeLimitInput.value = userSettings.targetBlitzTimeLimit;
    }
    mainMenuModal.classList.remove('active');
    mainMenuModal.classList.add('hidden');
    configureDrillModal.classList.remove('hidden');
    configureDrillModal.classList.add('active'); 
}

confirmStartDrillButton.addEventListener('click', async () => {
    playSound(clickSound);
    if (!drillConfigErrorMessages) { 
        console.error("drillConfigErrorMessages element not found");
        return;
    }
    drillConfigErrorMessages.textContent = ''; 
    let isValid = true;

    if (drillToConfigure !== 'TARGET_BLITZ') {
        const newDuration = parseInt(drillDurationInput.value);
        if (isNaN(newDuration) || newDuration < 15 || newDuration > 300) {
            drillConfigErrorMessages.textContent = "Duration: 15-300 seconds.";
            isValid = false;
        } else {
            let durationSettingKey = `${drillToConfigure.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase())}Duration`;
            userSettings[durationSettingKey] = newDuration;
        }
    } else { 
        const numTargets = parseInt(drillNumTargetsInput.value);
        const timeLimit = parseInt(drillTimeLimitInput.value);
        if (isNaN(numTargets) || numTargets < 5 || numTargets > 100) {
            drillConfigErrorMessages.textContent += " Targets: 5-100. ";
            isValid = false;
        }
        if (isNaN(timeLimit) || timeLimit < 10 || timeLimit > 300) {
            drillConfigErrorMessages.textContent += " Time Limit: 10-300s.";
            isValid = false;
        }
        if (isValid) {
            userSettings.targetBlitzNumTargets = numTargets;
            userSettings.targetBlitzTimeLimit = timeLimit;
        }
    }
    
    if (isValid) {
        await saveUserProfileData(); 
        if (drillToConfigure === 'FLICKING') startFlickingGame();
        else if (drillToConfigure === 'RECOIL_CONTROL_FLICK') startRecoilControlFlickGame();
        else if (drillToConfigure === 'TRACKING') startTrackingGame();
        else if (drillToConfigure === 'REACTIVE_TRACKING') startReactiveTrackingGame();
        else if (drillToConfigure === 'DYNAMIC_FLICKING') startDynamicFlickingGame();
        else if (drillToConfigure === 'PRECISION_TIMING') startPrecisionTimingGame();
        else if (drillToConfigure === 'TARGET_BLITZ') startTargetBlitzGame();
        else if (drillToConfigure === 'TARGET_SWITCHING') startTargetSwitchingGame();
        else if (drillToConfigure === 'MICRO_FLICKING') startMicroFlickingGame();
        else if (drillToConfigure === 'MACRO_FLICKING') startMacroFlickingGame();
        configureDrillModal.classList.remove('active');
        configureDrillModal.classList.add('hidden');
    }
});

cancelDrillConfigButton.addEventListener('click', () => {
    playSound(clickSound);
    configureDrillModal.classList.remove('active');
    configureDrillModal.classList.add('hidden');
    mainMenuModal.classList.remove('hidden');
    mainMenuModal.classList.add('active');
    drillToConfigure = null;
    if (drillConfigErrorMessages) drillConfigErrorMessages.textContent = ''; 
});


function commonStartGameSetup() {
    currentScore = 0;
    targetsHit = 0;
    targetsMissed = 0;
    earlyClicks = 0;
    lateClicks = 0;
    targetsHitThisDrill = 0; 
    timeOnTarget = 0; 
    totalTrackingTime = 0; 
    timerHasStarted = false; 
    currentTargetsArray = []; 
    activeTargetIndex = -1;   


    gameState = 'AWAITING_INPUT'; 
    awaitingInputMessage.classList.remove('hidden');
    
    updateHUD(); 
    mainMenuModal.classList.remove('active');
    mainMenuModal.classList.add('hidden');
    scoreModal.classList.remove('active');
    scoreModal.classList.add('hidden');
    settingsModal.classList.remove('active');
    settingsModal.classList.add('hidden');
    configureDrillModal.classList.remove('active');
    configureDrillModal.classList.add('hidden'); 
    routineSummaryModal.classList.remove('active');
    routineSummaryModal.classList.add('hidden'); 
    achievementsModal.classList.remove('active');
    achievementsModal.classList.add('hidden');
    leaderboardModal.classList.remove('active');
    leaderboardModal.classList.add('hidden');
    analyticsModal.classList.remove('active');
    analyticsModal.classList.add('hidden');
    hudElement.classList.remove('hidden');

    TWEEN.removeAll(); 
    pixiApp.stage.removeChildren(); 

    if (currentTarget && typeof currentTarget.destroy === 'function' && !currentTarget._destroyed) {
        currentTarget.destroy({ children: true, texture: true, baseTexture: true });
    }
    currentTarget = null; 
    
    pixiApp.view.removeEventListener('mousemove', handleFirstInputListener);
    pixiApp.view.removeEventListener('click', handleFirstInputListener);
    pixiApp.view.addEventListener('mousemove', handleFirstInputListener);
    pixiApp.view.addEventListener('click', handleFirstInputListener);
}

function startFlickingGame() {
    currentDrillType = 'FLICKING';
    drillDuration = userSettings.flickingDuration; 
    drillTimer = drillDuration; 
    commonStartGameSetup(); 
    spawnTarget_Flicking(); 
}
 function startRecoilControlFlickGame() {
    currentDrillType = 'RECOIL_CONTROL_FLICK';
    drillDuration = userSettings.recoilControlFlickDuration;
    drillTimer = drillDuration;
    commonStartGameSetup();
    spawnTarget_Flicking(); 
}

function startTrackingGame() {
    currentDrillType = 'TRACKING';
    drillDuration = userSettings.trackingDuration; 
    drillTimer = drillDuration;
    commonStartGameSetup(); 
    spawnTarget_Moving();
}
function startReactiveTrackingGame() {
    currentDrillType = 'REACTIVE_TRACKING';
    drillDuration = userSettings.reactiveTrackingDuration;
    drillTimer = drillDuration;
    commonStartGameSetup();
    spawnTarget_Moving(); 
}
function startDynamicFlickingGame() {
    currentDrillType = 'DYNAMIC_FLICKING';
    drillDuration = userSettings.dynamicFlickingDuration;
    drillTimer = drillDuration;
    commonStartGameSetup();
    spawnTarget_DynamicFlick();
}
function startPrecisionTimingGame() {
    currentDrillType = 'PRECISION_TIMING';
    drillDuration = userSettings.precisionTimingDuration;
    drillTimer = drillDuration;
    commonStartGameSetup();
    spawnTarget_PrecisionTiming();
}
function startTargetBlitzGame() {
    currentDrillType = 'TARGET_BLITZ';
    targetsToHitGoal = userSettings.targetBlitzNumTargets;
    overallTimeLimit = userSettings.targetBlitzTimeLimit;
    drillTimer = 0; 
    targetsHitThisDrill = 0;
    commonStartGameSetup();
    spawnTarget_Flicking(); 
}
function startTargetSwitchingGame() {
    currentDrillType = 'TARGET_SWITCHING';
    drillDuration = userSettings.targetSwitchingDuration;
    drillTimer = drillDuration;
    commonStartGameSetup();
    for (let i = 0; i < userSettings.targetSwitchingMaxTargets; i++) {
        spawnTarget_TargetSwitching(i);
    }
    if (currentTargetsArray.length > 0) {
        activateNextSwitchTarget();
    } else {
        console.error("Failed to spawn initial targets for Target Switching.");
        endGame(); 
    }
}
function startMicroFlickingGame() {
    currentDrillType = 'MICRO_FLICKING';
    drillDuration = userSettings.microFlickingDuration;
    drillTimer = drillDuration;
    commonStartGameSetup();
    spawnTarget_MicroFlick();
}
function startMacroFlickingGame() {
    currentDrillType = 'MACRO_FLICKING';
    drillDuration = userSettings.macroFlickingDuration;
    drillTimer = drillDuration;
    commonStartGameSetup();
    spawnTarget_MacroFlick();
}

function startDailyWarmup() {
    playSound(clickSound);
    currentRoutineIndex = 0;
    routineScores = [];
    gameState = 'IN_ROUTINE'; 
    startNextDrillInRoutine();
}

function startNextDrillInRoutine() {
    if (currentRoutineIndex >= dailyWarmupRoutine.length) {
        showRoutineSummary();
        return;
    }
    const nextDrill = dailyWarmupRoutine[currentRoutineIndex];
    if (nextDrill === 'FLICKING') startFlickingGame();
    else if (nextDrill === 'TRACKING') startTrackingGame();
    else if (nextDrill === 'DYNAMIC_FLICKING') startDynamicFlickingGame();
    else if (nextDrill === 'RECOIL_CONTROL_FLICK') startRecoilControlFlickGame();
    else if (nextDrill === 'REACTIVE_TRACKING') startReactiveTrackingGame();
    else if (nextDrill === 'PRECISION_TIMING') startPrecisionTimingGame();
    else if (nextDrill === 'TARGET_BLITZ') startTargetBlitzGame();
    else if (nextDrill === 'TARGET_SWITCHING') startTargetSwitchingGame();
    else if (nextDrill === 'MICRO_FLICKING') startMicroFlickingGame();
    else if (nextDrill === 'MACRO_FLICKING') startMacroFlickingGame();
}


// --- Target Spawning Logic for Different Modes --- 
function drawTargetShape(graphics, size, fillColor, outlineColor, targetData) {
    graphics.clear();
    let finalFillColor = fillColor;
    let finalOutlineColor = outlineColor;
    let lineWidth = 2;

    if (targetData.isBomb) {
        finalFillColor = PIXI.utils.rgb2hex([1, 0.2 + Math.sin(Date.now() / 150) * 0.1, 0.2 + Math.sin(Date.now() / 150) * 0.1]); 
        finalOutlineColor = 0xFF0000;
    } else if (targetData.isShielded) {
        graphics.beginFill(PIXI.utils.string2hex(userSettings.targetOutlineColor), 0.3); 
        graphics.lineStyle(1, PIXI.utils.string2hex(userSettings.targetOutlineColor), 0.5);
        if (userSettings.targetShape === 'square') graphics.drawRect(-size/2 - 3, -size/2 - 3, size + 6, size + 6);
        else graphics.drawCircle(0,0, size/2 + 3);
        graphics.endFill();
    }
    
    if (currentDrillType === 'TARGET_SWITCHING' && targetData.isActive) {
        finalFillColor = userSettings.targetOutlineColor; 
    }

    graphics.beginFill(PIXI.utils.string2hex(finalFillColor));
    graphics.lineStyle(lineWidth, PIXI.utils.string2hex(finalOutlineColor), 1);
    
    const s = size / 2; 
    let currentShape = userSettings.targetShape;
    if (currentShape === 'random') {
        currentShape = TARGET_SHAPES[Math.floor(Math.random() * TARGET_SHAPES.length)];
    }

    if (currentShape === 'square') {
        graphics.drawRect(-s, -s, size, size);
    } else if (currentShape === 'triangle') {
        graphics.moveTo(0, -s);
        graphics.lineTo(s * 0.866, s * 0.5); 
        graphics.lineTo(-s * 0.866, s * 0.5);
        graphics.closePath();
    } else if (currentShape === 'hexagon') {
        for (let i = 0; i < 6; i++) {
            graphics.lineTo(s * Math.cos(i * Math.PI / 3), s * Math.sin(i * Math.PI / 3));
        }
        graphics.closePath();
    }
    else { 
        graphics.drawCircle(0, 0, s);
    }
    graphics.endFill();
}

function initializeTargetData(size) {
    let isShielded = false;
    let isBomb = false;
    if (currentDrillType !== 'TRACKING' && currentDrillType !== 'REACTIVE_TRACKING' && currentDrillType !== 'PRECISION_TIMING') { 
        if (Math.random() * 100 < userSettings.shieldProbability) {
            isShielded = true;
        }
        if (!isShielded && Math.random() * 100 < userSettings.bombProbability) { 
            isBomb = true;
        }
    }
    return { 
        size: size, 
        vx: 0, vy: 0, 
        isMoving: false, 
        moveTimer: 0,
        state: 'idle', 
        stateTimer: 0, 
        isHittable: true, 
        isShielded: isShielded,
        shieldHP: isShielded ? 1 : 0,
        isBomb: isBomb,
    };
}


function spawnTarget_Flicking() { 
    const targetSize = 30 + Math.random() * 20; 
    const newTarget = new PIXI.Graphics();
    newTarget.targetData = initializeTargetData(targetSize);
    drawTargetShape(newTarget, targetSize, userSettings.flickingTargetColor, userSettings.targetOutlineColor, newTarget.targetData);
    
    const padding = targetSize / 2 + 10; 
    newTarget.x = padding + Math.random() * (pixiApp.screen.width - 2 * padding);
    newTarget.y = HUD_OFFSET_Y + padding + Math.random() * (pixiApp.screen.height - HUD_OFFSET_Y - 2 * padding); 
    
    pixiApp.stage.addChild(newTarget);
    currentTarget = newTarget; 
    currentTarget.interactive = true; 
}
function spawnTarget_MicroFlick() {
    const targetSize = 15 + Math.random() * 10; 
    const newTarget = new PIXI.Graphics();
    newTarget.targetData = initializeTargetData(targetSize);
    drawTargetShape(newTarget, targetSize, userSettings.flickingTargetColor, userSettings.targetOutlineColor, newTarget.targetData);
    
    const padding = targetSize / 2 + 10; 
    const spawnWidth = pixiApp.screen.width / 2;
    const spawnHeight = (pixiApp.screen.height - HUD_OFFSET_Y) / 2;
    const offsetX = pixiApp.screen.width / 4;
    const offsetY = HUD_OFFSET_Y + (pixiApp.screen.height - HUD_OFFSET_Y) / 4;

    newTarget.x = offsetX + padding + Math.random() * (spawnWidth - 2 * padding);
    newTarget.y = offsetY + padding + Math.random() * (spawnHeight - 2 * padding); 
    
    pixiApp.stage.addChild(newTarget);
    currentTarget = newTarget; 
    currentTarget.interactive = true; 
}
function spawnTarget_MacroFlick() {
    const targetSize = 40 + Math.random() * 20; 
    const newTarget = new PIXI.Graphics();
    newTarget.targetData = initializeTargetData(targetSize);
    drawTargetShape(newTarget, targetSize, userSettings.flickingTargetColor, userSettings.targetOutlineColor, newTarget.targetData);
    
    const padding = targetSize / 2 + 10; 
    newTarget.x = padding + Math.random() * (pixiApp.screen.width - 2 * padding);
    newTarget.y = HUD_OFFSET_Y + padding + Math.random() * (pixiApp.screen.height - HUD_OFFSET_Y - 2 * padding); 
    
    pixiApp.stage.addChild(newTarget);
    currentTarget = newTarget; 
    currentTarget.interactive = true; 
}


function spawnTarget_Moving() { 
    const targetSize = 40;
    const newTarget = new PIXI.Graphics();
    newTarget.targetData = initializeTargetData(targetSize); 
    newTarget.targetData.isShielded = false; newTarget.targetData.isBomb = false; 
    drawTargetShape(newTarget, targetSize, userSettings.trackingTargetColor, userSettings.targetOutlineColor, newTarget.targetData);

    newTarget.x = pixiApp.screen.width / 2;
    newTarget.y = HUD_OFFSET_Y + targetSize + Math.random() * (pixiApp.screen.height - HUD_OFFSET_Y - targetSize*2); 
    
    const speed = 2 + Math.random() * 2; 
    const angle = Math.random() * Math.PI * 2;
    
    pixiApp.stage.addChild(newTarget);
    currentTarget = newTarget;
    currentTarget.targetData.vx = Math.cos(angle) * speed;
    currentTarget.targetData.vy = Math.sin(angle) * speed;
    currentTarget.targetData.isMoving = true;
}

function spawnTarget_DynamicFlick() {
    const targetSize = 30 + Math.random() * 15;
    const newTarget = new PIXI.Graphics();
    newTarget.targetData = initializeTargetData(targetSize);
    drawTargetShape(newTarget, targetSize, userSettings.flickingTargetColor, userSettings.targetOutlineColor, newTarget.targetData);

    const padding = targetSize / 2 + 50; 
    newTarget.x = padding + Math.random() * (pixiApp.screen.width - 2 * padding);
    newTarget.y = HUD_OFFSET_Y + padding + Math.random() * (pixiApp.screen.height - HUD_OFFSET_Y - 2 * padding);

    pixiApp.stage.addChild(newTarget);
    currentTarget = newTarget;
    currentTarget.targetData.isMoving = true;
    currentTarget.targetData.moveTimer = 0.5 + Math.random() * 0.5; 
    currentTarget.targetData.vx = (Math.random() - 0.5) * 6; 
    currentTarget.targetData.vy = (Math.random() - 0.5) * 6; 
    currentTarget.targetData.timeSinceStop = 0; 
}

function spawnTarget_PrecisionTiming() {
    const targetSize = 40 + Math.random() * 20;
    const newTarget = new PIXI.Graphics();
    
    const padding = targetSize / 2 + 10;
    newTarget.x = padding + Math.random() * (pixiApp.screen.width - 2 * padding);
    newTarget.y = HUD_OFFSET_Y + padding + Math.random() * (pixiApp.screen.height - HUD_OFFSET_Y - 2 * padding);
    
    pixiApp.stage.addChild(newTarget);
    currentTarget = newTarget;
    currentTarget.targetData = {
        ...initializeTargetData(targetSize), 
        state: 'ARMING',
        armingDuration: 0.5 + Math.random() * 0.5, 
        activeDuration: 0.15 + Math.random() * 0.2, 
        stateTimer: 0,
        isHittable: false, 
    };
    currentTarget.targetData.stateTimer = currentTarget.targetData.armingDuration;
    updatePrecisionTargetAppearance(currentTarget);
}
        
function updatePrecisionTargetAppearance(target) {
    if (!target || target._destroyed || !target.targetData) return;
    
    let color = userSettings.targetOutlineColor; 
    if (target.targetData.state === 'ACTIVE') color = userSettings.flickingTargetColor; 
    else if (target.targetData.state === 'EXPIRED') color = '#FF0000'; 

    drawTargetShape(target, target.targetData.size, color, userSettings.targetOutlineColor, target.targetData);
}

function spawnTarget_TargetSwitching(index) {
    const targetSize = 35 + Math.random() * 10;
    const newTarget = new PIXI.Graphics();
    newTarget.targetData = initializeTargetData(targetSize);
    newTarget.targetData.isActive = false; 
    drawTargetShape(newTarget, targetSize, userSettings.flickingTargetColor, userSettings.targetOutlineColor, newTarget.targetData);
    
    const padding = targetSize / 2 + 10;
    newTarget.x = padding + Math.random() * (pixiApp.screen.width - 2 * padding);
    newTarget.y = HUD_OFFSET_Y + padding + Math.random() * (pixiApp.screen.height - HUD_OFFSET_Y - 2 * padding);
    
    pixiApp.stage.addChild(newTarget);
    newTarget.interactive = true; 
    currentTargetsArray[index] = newTarget;
}

function activateNextSwitchTarget() {
    if (currentTargetsArray.length === 0) return; 

    if (activeTargetIndex !== -1 && currentTargetsArray[activeTargetIndex] && !currentTargetsArray[activeTargetIndex]._destroyed) {
        currentTargetsArray[activeTargetIndex].targetData.isActive = false;
        drawTargetShape(currentTargetsArray[activeTargetIndex], currentTargetsArray[activeTargetIndex].targetData.size, userSettings.flickingTargetColor, userSettings.targetOutlineColor, currentTargetsArray[activeTargetIndex].targetData);
    }
    
    let newActiveIndex = Math.floor(Math.random() * currentTargetsArray.length);
    if (currentTargetsArray.length > 1 && newActiveIndex === activeTargetIndex) {
        newActiveIndex = (newActiveIndex + 1) % currentTargetsArray.length;
    }
    activeTargetIndex = newActiveIndex;
    
    if (currentTargetsArray[activeTargetIndex] && !currentTargetsArray[activeTargetIndex]._destroyed) {
        currentTargetsArray[activeTargetIndex].targetData.isActive = true;
        drawTargetShape(currentTargetsArray[activeTargetIndex], currentTargetsArray[activeTargetIndex].targetData.size, userSettings.flickingTargetColor, userSettings.targetOutlineColor, currentTargetsArray[activeTargetIndex].targetData); 
        playSound(switchTargetSound, Tone.now(), 'E5', '16n');
    } else {
        console.warn("Tried to activate an invalid target in Switch Track. Resetting.");
        currentTargetsArray.forEach(t => { if (t && !t._destroyed) t.destroy()});
        currentTargetsArray = [];
        for (let i = 0; i < userSettings.targetSwitchingMaxTargets; i++) {
            spawnTarget_TargetSwitching(i);
        }
        if (currentTargetsArray.length > 0) activateNextSwitchTarget();
    }
}


// --- Game Loop --- 
function gameLoop(delta) { 
    if (gameState !== 'PLAYING' || !timerHasStarted) return; 

    const elapsedSeconds = pixiApp.ticker.elapsedMS / 1000.0;

    // Pulsate bomb targets
    pixiApp.stage.children.forEach(child => {
        if (child.targetData && child.targetData.isBomb) {
            const scale = 1 + Math.sin(Date.now() / 150) * 0.05; 
            child.scale.set(scale);
        }
    });


    if ((currentDrillType === 'TRACKING' || currentDrillType === 'REACTIVE_TRACKING') && currentTarget && !currentTarget._destroyed && currentTarget.targetData) {
        currentTarget.x += currentTarget.targetData.vx * delta; 
        currentTarget.y += currentTarget.targetData.vy * delta;

        const targetRadius = currentTarget.targetData.size / 2; 
        if (currentTarget.x - targetRadius < 0 || currentTarget.x + targetRadius > pixiApp.screen.width) {
            currentTarget.targetData.vx *= -1;
            currentTarget.x = Math.max(targetRadius, Math.min(currentTarget.x, pixiApp.screen.width - targetRadius)); 
        }
        if (currentTarget.y - targetRadius < HUD_OFFSET_Y || currentTarget.y + targetRadius > pixiApp.screen.height) {
            currentTarget.targetData.vy *= -1;
            currentTarget.y = Math.max(HUD_OFFSET_Y + targetRadius, Math.min(currentTarget.y, pixiApp.screen.height - targetRadius)); 
        }
        
        const crosshairRect = crosshairElement.getBoundingClientRect();
        const gameRect = pixiApp.view.getBoundingClientRect();
        const mouseGameX = crosshairRect.left + crosshairRect.width / 2 - gameRect.left;
        const mouseGameY = crosshairRect.top + crosshairRect.height / 2 - gameRect.top;

        const distance = Math.sqrt(
            Math.pow(mouseGameX - currentTarget.x, 2) + Math.pow(mouseGameY - currentTarget.y, 2)
        );

        totalTrackingTime += elapsedSeconds; 

        if (distance < targetRadius) { 
            currentScore += 2 * delta; 
            timeOnTarget += elapsedSeconds; 
            targetsHit++; 
        } else {
            targetsMissed++; 
        }
    } else if (currentDrillType === 'DYNAMIC_FLICKING') {
         if (currentTarget && !currentTarget._destroyed && currentTarget.targetData && currentTarget.targetData.isMoving) {
            currentTarget.x += currentTarget.targetData.vx * delta;
            currentTarget.y += currentTarget.targetData.vy * delta;
            currentTarget.targetData.moveTimer -= elapsedSeconds;

            const targetRadius = currentTarget.targetData.size / 2;
            if (currentTarget.x - targetRadius < 0 || currentTarget.x + targetRadius > pixiApp.screen.width) {
                currentTarget.targetData.vx *= -1;
                currentTarget.x = Math.max(targetRadius, Math.min(currentTarget.x, pixiApp.screen.width - targetRadius));
            }
             if (currentTarget.y - targetRadius < HUD_OFFSET_Y || currentTarget.y + targetRadius > pixiApp.screen.height) {
                currentTarget.targetData.vy *= -1;
                currentTarget.y = Math.max(HUD_OFFSET_Y + targetRadius, Math.min(currentTarget.y, pixiApp.screen.height - targetRadius));
            }

            if (currentTarget.targetData.moveTimer <= 0) {
                currentTarget.targetData.isMoving = false;
                currentTarget.targetData.timeSinceStop = 0; 
            }
        } else if (currentTarget && !currentTarget._destroyed && currentTarget.targetData && !currentTarget.targetData.isMoving) {
             currentTarget.targetData.timeSinceStop += elapsedSeconds; 
        }
    } else if (currentDrillType === 'PRECISION_TIMING') {
        if (currentTarget && !currentTarget._destroyed && currentTarget.targetData) {
            currentTarget.targetData.stateTimer -= elapsedSeconds;
            if (currentTarget.targetData.stateTimer <= 0) {
                if (currentTarget.targetData.state === 'ARMING') {
                    currentTarget.targetData.state = 'ACTIVE';
                    currentTarget.targetData.isHittable = true;
                    currentTarget.targetData.stateTimer = currentTarget.targetData.activeDuration;
                    updatePrecisionTargetAppearance(currentTarget);
                } else if (currentTarget.targetData.state === 'ACTIVE') {
                    currentTarget.targetData.state = 'EXPIRED';
                    currentTarget.targetData.isHittable = false;
                    updatePrecisionTargetAppearance(currentTarget);
                    lateClicks++; 
                    updateHUD();
                    setTimeout(() => {
                        if(gameState === 'PLAYING' && currentTarget && currentTarget.targetData && currentTarget.targetData.state === 'EXPIRED') {
                             if (currentTarget && !currentTarget._destroyed) {
                                pixiApp.stage.removeChild(currentTarget);
                                currentTarget.destroy({children:true});
                                currentTarget = null;
                            }
                            spawnTarget_PrecisionTiming();
                        }
                    }, 300); 
                }
            }
        }
    }
}

function changeReactiveTargetVelocity() { 
    if (gameState !== 'PLAYING' || currentDrillType !== 'REACTIVE_TRACKING' || !currentTarget || currentTarget._destroyed || !currentTarget.targetData) {
        return;
    }
    const speed = 2 + Math.random() * 3; 
    const angle = Math.random() * Math.PI * 2;
    currentTarget.targetData.vx = Math.cos(angle) * speed;
    currentTarget.targetData.vy = Math.sin(angle) * speed;
}


function handleCanvasClick(event) {
    if (gameState !== 'PLAYING' || !timerHasStarted) return; 

    const rect = pixiApp.view.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    if (currentDrillType === 'TARGET_SWITCHING') {
        let hitRegistered = false;
        for (let i = 0; i < currentTargetsArray.length; i++) {
            const target = currentTargetsArray[i];
            if (target && !target._destroyed && target.targetData) {
                const targetRadius = target.targetData.size / 2;
                let isClickOnThisTarget = false;
                // Using bounding box for hit detection on shapes for simplicity
                if (clickX >= target.x - targetRadius && clickX <= target.x + targetRadius &&
                    clickY >= target.y - targetRadius && clickY <= target.y + targetRadius) {
                    isClickOnThisTarget = true;
                }

                if (isClickOnThisTarget) {
                    targetSwitchingTargetHit(i);
                    hitRegistered = true;
                    break; 
                }
            }
        }
        if (!hitRegistered) { 
            targetSwitchingMiss();
        }
    } else { 
        if (!currentTarget || currentTarget._destroyed || !currentTarget.targetData) return;
        let hit = false;
        const targetRadius = currentTarget.targetData.size / 2;
         if (clickX >= currentTarget.x - targetRadius && clickX <= currentTarget.x + targetRadius &&
            clickY >= currentTarget.y - targetRadius && clickY <= currentTarget.y + targetRadius) {
            hit = true;
        }


        if (currentDrillType === 'FLICKING' || currentDrillType === 'RECOIL_CONTROL_FLICK' || currentDrillType === 'TARGET_BLITZ' || currentDrillType === 'MICRO_FLICKING' || currentDrillType === 'MACRO_FLICKING') {
            if (hit) flickingTargetHit(); 
            else flickingTargetMiss();
        } else if (currentDrillType === 'DYNAMIC_FLICKING') {
            if (currentTarget.targetData && !currentTarget.targetData.isMoving) { 
                if (hit) dynamicFlickTargetHit();
                else dynamicFlickTargetMiss();
            }
        } else if (currentDrillType === 'PRECISION_TIMING') {
            precisionTimingTargetClick(hit);
        }
    }
}

function commonHitLogic(scoreIncrement = 100) {
    targetsHit++;
    if (currentDrillType !== 'TARGET_BLITZ') { 
        currentScore += scoreIncrement;
    }
    if (currentDrillType === 'RECOIL_CONTROL_FLICK') {
        const currentCrosshairTop = parseFloat(crosshairElement.style.top || "0");
        crosshairElement.style.top = `${Math.max(0, currentCrosshairTop - userSettings.recoilStrength)}px`;
    }
    if (currentDrillType === 'TARGET_BLITZ') {
        targetsHitThisDrill++;
        if (targetsHitThisDrill >= targetsToHitGoal) {
            endGame(); 
        }
    }
    checkAndUnlockAchievement('FIRST_BLOOD');
}
function commonMissLogic(scoreDecrement = 20) {
    playSound(missSound);
    targetsMissed++;
    if (currentDrillType !== 'TARGET_BLITZ') {
        currentScore -= scoreDecrement;
        if (currentScore < 0) currentScore = 0;
    }
}

function animateAndRespawnTarget(hitTarget, respawnFunction) {
    if (hitTarget && !hitTarget._destroyed) {
        currentTarget = null; 
        hitTarget.interactive = false; 

        new TWEEN.Tween({ scale: hitTarget.scale.x, alpha: hitTarget.alpha })
            .to({ scale: 0, alpha: 0 }, 150) 
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate((obj) => {
                if (hitTarget && !hitTarget._destroyed && hitTarget.scale && typeof hitTarget.scale.set === 'function') {
                    hitTarget.scale.set(obj.scale);
                    hitTarget.alpha = obj.alpha;
                }
            })
            .onComplete(() => {
                if (hitTarget && !hitTarget._destroyed) { 
                    if (pixiApp.stage.children.includes(hitTarget)) pixiApp.stage.removeChild(hitTarget);
                    hitTarget.destroy({ children: true, texture: true, baseTexture: true });
                }
                if (gameState === 'PLAYING' && currentDrillType !== 'TARGET_BLITZ') {
                     respawnFunction(); 
                } else if (gameState === 'PLAYING' && currentDrillType === 'TARGET_BLITZ' && targetsHitThisDrill < targetsToHitGoal) {
                    respawnFunction(); 
                }
            })
            .start();
    } else {
        if (gameState === 'PLAYING' && !currentTarget && currentDrillType !== 'TARGET_BLITZ') respawnFunction();
        else if (gameState === 'PLAYING' && !currentTarget && currentDrillType === 'TARGET_BLITZ' && targetsHitThisDrill < targetsToHitGoal) respawnFunction();
    }
}

function flickingTargetHit() { 
    if (currentTarget.targetData.isBomb) {
        playSound(bombExplodeSound);
        currentScore -= userSettings.bombPenalty;
        if (currentScore < 0) currentScore = 0;
        animateAndRespawnTarget(currentTarget, currentDrillType === 'MICRO_FLICKING' ? spawnTarget_MicroFlick : (currentDrillType === 'MACRO_FLICKING' ? spawnTarget_MacroFlick : spawnTarget_Flicking));
        updateHUD();
        return;
    }
    if (currentTarget.targetData.isShielded && currentTarget.targetData.shieldHP > 0) {
        playSound(shieldBreakSound, Tone.now(), 'G4', '16n');
        currentTarget.targetData.shieldHP--;
        if (currentTarget.targetData.shieldHP <= 0) {
            currentTarget.targetData.isShielded = false; 
            drawTargetShape(currentTarget, currentTarget.targetData.size, userSettings.flickingTargetColor, userSettings.targetOutlineColor, currentTarget.targetData);
        } else { 
             drawTargetShape(currentTarget, currentTarget.targetData.size, userSettings.flickingTargetColor, userSettings.targetOutlineColor, currentTarget.targetData);
        }
        updateHUD();
        return; 
    }

    commonHitLogic();
    let respawnFunc = spawnTarget_Flicking;
    if(currentDrillType === 'MICRO_FLICKING') respawnFunc = spawnTarget_MicroFlick;
    else if(currentDrillType === 'MACRO_FLICKING') respawnFunc = spawnTarget_MacroFlick;
    animateAndRespawnTarget(currentTarget, respawnFunc); 
    updateHUD();
}
function flickingTargetMiss() {
    commonMissLogic();
    updateHUD();
}

function dynamicFlickTargetHit() {
     if (currentTarget.targetData.isBomb) {
        playSound(bombExplodeSound);
        currentScore -= userSettings.bombPenalty;
        if (currentScore < 0) currentScore = 0;
        animateAndRespawnTarget(currentTarget, spawnTarget_DynamicFlick);
        updateHUD();
        return;
    }
    if (currentTarget.targetData.isShielded && currentTarget.targetData.shieldHP > 0) {
        playSound(shieldBreakSound, Tone.now(), 'G4', '16n');
        currentTarget.targetData.shieldHP--;
         if (currentTarget.targetData.shieldHP <= 0) {
            currentTarget.targetData.isShielded = false;
            drawTargetShape(currentTarget, currentTarget.targetData.size, userSettings.flickingTargetColor, userSettings.targetOutlineColor, currentTarget.targetData);
        } else {
            drawTargetShape(currentTarget, currentTarget.targetData.size, userSettings.flickingTargetColor, userSettings.targetOutlineColor, currentTarget.targetData);
        }
        updateHUD();
        return;
    }
    commonHitLogic(150); 
    animateAndRespawnTarget(currentTarget, spawnTarget_DynamicFlick);
    updateHUD();
}
function dynamicFlickTargetMiss() {
    commonMissLogic(30);
    updateHUD();
}

function precisionTimingTargetClick(isHitOnTargetShape) {
    if (!currentTarget || !currentTarget.targetData) return;

    const targetState = currentTarget.targetData.state;
    const hitTarget = currentTarget; 
    currentTarget = null; 

    if (targetState === 'ACTIVE' && isHitOnTargetShape) {
        commonHitLogic(200); 
    } else if (targetState === 'ARMING') {
        playSound(missSound, Tone.now(), 'A3', '16n'); 
        earlyClicks++;
        commonMissLogic(50); 
    } else { 
        playSound(missSound);
        lateClicks++; 
        commonMissLogic(25);
    }
    updateHUD();
    
    if (hitTarget && !hitTarget._destroyed) {
         if (pixiApp.stage.children.includes(hitTarget)) pixiApp.stage.removeChild(hitTarget);
         hitTarget.destroy({children: true});
    }
    if(gameState === 'PLAYING') spawnTarget_PrecisionTiming();
}

function targetSwitchingTargetHit(hitIndex) {
    const target = currentTargetsArray[hitIndex];
    if (!target || !target.targetData) return;

    if (target.targetData.isBomb) {
        playSound(bombExplodeSound);
        currentScore -= userSettings.bombPenalty;
        if (currentScore < 0) currentScore = 0;
        if (!target._destroyed) {
            if (pixiApp.stage.children.includes(target)) pixiApp.stage.removeChild(target);
            target.destroy({ children: true });
        }
        spawnTarget_TargetSwitching(hitIndex); 
        updateHUD();
        return;
    }

    if (target.targetData.isShielded && target.targetData.shieldHP > 0) {
        playSound(shieldBreakSound, Tone.now(), 'G4', '16n');
        target.targetData.shieldHP--;
        if (target.targetData.shieldHP <= 0) {
            target.targetData.isShielded = false;
        }
        drawTargetShape(target, target.targetData.size, userSettings.flickingTargetColor, userSettings.targetOutlineColor, target.targetData); 
        updateHUD();
        return;
    }


    if (hitIndex === activeTargetIndex) {
        commonHitLogic(120); 
        const hitTarget = currentTargetsArray[hitIndex];
        
         if (hitTarget && !hitTarget._destroyed) {
            hitTarget.interactive = false;
            new TWEEN.Tween({ scale: hitTarget.scale.x, alpha: hitTarget.alpha })
                .to({ scale: 0, alpha: 0 }, 150)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate((obj) => {
                    if (hitTarget && !hitTarget._destroyed && hitTarget.scale) {
                        hitTarget.scale.set(obj.scale);
                        hitTarget.alpha = obj.alpha;
                    }
                })
                .onComplete(() => {
                    if (hitTarget && !hitTarget._destroyed) {
                        if (pixiApp.stage.children.includes(hitTarget)) pixiApp.stage.removeChild(hitTarget);
                        hitTarget.destroy({ children: true, texture: true, baseTexture: true });
                    }
                    if (gameState === 'PLAYING') {
                        spawnTarget_TargetSwitching(hitIndex); 
                        activateNextSwitchTarget(); 
                    }
                })
                .start();
        }
    } else { 
        commonMissLogic(40); 
    }
    updateHUD();
}
function targetSwitchingMiss() { 
    commonMissLogic(10);
    updateHUD();
}


function startDrillTimer() {
    clearInterval(drillInterval);
    clearInterval(reactiveTargetChangeInterval); 
    
    if (currentDrillType === 'TARGET_BLITZ') {
        drillTimer = 0; 
        hudTimeLabel.textContent = "Time Elapsed: ";
        hudTargetCountLabel.style.display = 'block';
    } else {
        drillTimer = drillDuration; 
        hudTimeLabel.textContent = "Time: ";
        hudTargetCountLabel.style.display = 'none';
    }
    updateHUD(); 
    
    drillInterval = setInterval(() => {
        if (gameState !== 'PLAYING' || !timerHasStarted) { 
            clearInterval(drillInterval);
            clearInterval(reactiveTargetChangeInterval);
            return;
        }

        if (currentDrillType === 'TARGET_BLITZ') {
            drillTimer++; 
            if (drillTimer >= overallTimeLimit && targetsHitThisDrill < targetsToHitGoal) { 
                endGame(); 
            }
        } else {
            drillTimer--; 
            if (drillTimer <= 0) {
                endGame();
            }
        }
        updateHUD();
    }, 1000);

    if (currentDrillType === 'REACTIVE_TRACKING' && timerHasStarted) { 
        reactiveTargetChangeInterval = setInterval(changeReactiveTargetVelocity, (1 + Math.random() * 2) * 1000); 
    }
}

function updateHUD() {
    if (currentDrillType === 'TARGET_BLITZ') {
        hudScoreValue.textContent = `${targetsHitThisDrill}/${targetsToHitGoal}`; 
        hudTimeValue.textContent = `${drillTimer}`; 
        hudTargetCountValue.textContent = `${targetsHitThisDrill}/${targetsToHitGoal}`;
    } else {
        hudScoreValue.textContent = `${Math.round(currentScore)}`;
        hudTimeValue.textContent = `${drillTimer}`;
    }
    
    let accuracy = 0;
    if (currentDrillType === 'FLICKING' || currentDrillType === 'DYNAMIC_FLICKING' || currentDrillType === 'RECOIL_CONTROL_FLICK' || currentDrillType === 'TARGET_BLITZ' || currentDrillType === 'TARGET_SWITCHING' || currentDrillType === 'MICRO_FLICKING' || currentDrillType === 'MACRO_FLICKING') {
        const totalShots = (currentDrillType === 'TARGET_BLITZ' ? targetsHitThisDrill : targetsHit) + targetsMissed;
        accuracy = totalShots > 0 ? (((currentDrillType === 'TARGET_BLITZ' ? targetsHitThisDrill : targetsHit) / totalShots) * 100) : ((currentDrillType === 'TARGET_BLITZ' ? targetsHitThisDrill : targetsHit) > 0 ? 100.0 : 0.0);
    } else if (currentDrillType === 'TRACKING' || currentDrillType === 'REACTIVE_TRACKING') {
         accuracy = (targetsHit + targetsMissed > 0) ? (targetsHit / (targetsHit + targetsMissed)) * 100 : 0; 
    } else if (currentDrillType === 'PRECISION_TIMING') {
        const totalAttempts = targetsHit + targetsMissed + earlyClicks + lateClicks;
        accuracy = totalAttempts > 0 ? (targetsHit / totalAttempts) * 100 : (targetsHit > 0 ? 100.0 : 0.0);
    }
    hudAccuracyValue.textContent = `${accuracy.toFixed(1)}`;
}

function TWEEN_Loop(time) { 
    requestAnimationFrame(TWEEN_Loop);
    TWEEN.update(time);
}
requestAnimationFrame(TWEEN_Loop); 

async function endGame() {
    if (gameState === 'SCORE' || gameState === 'IN_ROUTINE_SCORE_SCREEN' || gameState === 'ROUTINE_SUMMARY') return; 
    playSound(drillEndSound, Tone.now(), 'G4', '2n');

    console.log("Ending game. Drill type:", currentDrillType);
    clearInterval(drillInterval);
    clearInterval(reactiveTargetChangeInterval);
    timerHasStarted = false; 
    
    const endedDrillType = currentDrillType; 
    const endedScore = Math.round(currentScore);
    const endedHits = (endedDrillType === 'TARGET_BLITZ' ? targetsHitThisDrill : targetsHit);
    const endedMisses = targetsMissed;
    const endedEarlyClicks = earlyClicks;
    const endedLateClicks = lateClicks;
    const endedDrillDuration = (endedDrillType === 'TARGET_BLITZ' ? drillTimer : drillDuration); 

    let accuracyVal = 0;
    if (endedDrillType === 'FLICKING' || endedDrillType === 'DYNAMIC_FLICKING' || endedDrillType === 'RECOIL_CONTROL_FLICK' || endedDrillType === 'TARGET_BLITZ' || endedDrillType === 'TARGET_SWITCHING' || endedDrillType === 'MICRO_FLICKING' || endedDrillType === 'MACRO_FLICKING') {
        const totalShots = endedHits + endedMisses;
        accuracyVal = totalShots > 0 ? (endedHits / totalShots) * 100 : (endedHits > 0 ? 100.0 : 0.0);
    } else if (endedDrillType === 'TRACKING' || endedDrillType === 'REACTIVE_TRACKING') {
        accuracyVal = (endedHits + endedMisses > 0) ? (endedHits / (endedHits + endedMisses)) * 100 : 0;
    } else if (endedDrillType === 'PRECISION_TIMING') {
        const totalAttempts = endedHits + endedMisses + endedEarlyClicks + endedLateClicks; 
        accuracyVal = totalAttempts > 0 ? (endedHits / totalAttempts) * 100 : 0;
    }

    const drillResult = {
        drillType: endedDrillType,
        score: (endedDrillType === 'TARGET_BLITZ' ? endedDrillDuration : endedScore), 
        accuracy: parseFloat(accuracyVal.toFixed(1)),
        hits: endedHits,
        misses: endedMisses,
    };
    if (endedDrillType === 'PRECISION_TIMING') {
        drillResult.earlyClicks = endedEarlyClicks;
        drillResult.lateClicks = endedLateClicks;
    }
    if (endedDrillType === 'TARGET_BLITZ') {
        drillResult.targetsToHit = targetsToHitGoal;
        drillResult.timeTaken = endedDrillDuration; 
    }
    drillResult.durationPlayed = endedDrillDuration; 
    
    let xpEarned = 0;
    if (endedDrillType === 'TARGET_BLITZ') {
        if (drillResult.timeTaken > 0 && targetsHitThisDrill === targetsToHitGoal) { 
            xpEarned = (targetsToHitGoal * 50) / (drillResult.timeTaken / 10) * (drillResult.accuracy / 100);
        }
    } else {
        xpEarned = drillResult.score / 10;
    }
    if (xpEarned > 0) awardXP(xpEarned);
    
    drillsCompleted++;
    userSettings.drillsCompleted = drillsCompleted; 
    checkAndUnlockAchievement('NOVICE_TRAINER');
    if (endedDrillType === 'FLICKING' && drillResult.score >= 5000) {
        checkAndUnlockAchievement('FLICK_MASTER_1');
    }
    if (endedDrillType === 'TARGET_SWITCHING' && targetsHit > 0) { 
        checkAndUnlockAchievement('SWITCH_HITTER');
    }
    if (endedDrillType === 'MICRO_FLICKING' && targetsHit > 0) checkAndUnlockAchievement('MICRO_MANAGER');
    if (endedDrillType === 'MACRO_FLICKING' && targetsHit > 0) checkAndUnlockAchievement('MACRO_MASTER');

    await saveUserProfileData(); 

    if (gameState === 'IN_ROUTINE') {
        routineScores.push(drillResult);
        currentRoutineIndex++;
        if (currentRoutineIndex < dailyWarmupRoutine.length) {
            gameState = 'IN_ROUTINE_SCORE_SCREEN'; 
            displayIndividualDrillScore(drillResult, true); 
        } else {
            showRoutineSummary();
        }
    } else {
         gameState = 'SCORE';
         displayIndividualDrillScore(drillResult, false);
    }
    
    hudElement.classList.add('hidden');
    awaitingInputMessage.classList.add('hidden');
    TWEEN.removeAll(); 
    if (currentTarget && typeof currentTarget.destroy === 'function' && !currentTarget._destroyed) {
        currentTarget.destroy({ children: true, texture: true, baseTexture: true });
    }
    currentTarget = null; 
    currentTargetsArray.forEach(t => { if (t && !t._destroyed) t.destroy({children:true}); });
    currentTargetsArray = [];
    activeTargetIndex = -1;
    pixiApp.stage.removeChildren(); 

    if (userId && endedDrillType && endedDrillType !== 'DAILY_WARMUP') { 
        try {
            const firestoreScoreData = { 
                drill: endedDrillType,
                score: drillResult.score,
                accuracy: drillResult.accuracy,
                hits: drillResult.hits,
                misses: drillResult.misses,
                durationPlayed: drillResult.durationPlayed,
                timestamp: serverTimestamp(), 
                userId: userId, 
                displayName: userDisplayName 
            };
            if (drillResult.earlyClicks !== undefined) firestoreScoreData.earlyClicks = drillResult.earlyClicks;
            if (drillResult.lateClicks !== undefined) firestoreScoreData.lateClicks = drillResult.lateClicks;
            if (drillResult.targetsToHit !== undefined) firestoreScoreData.targetsToHit = drillResult.targetsToHit;
            if (drillResult.timeTaken !== undefined) firestoreScoreData.timeTaken = drillResult.timeTaken;
            
            const scoresCollectionPath = `artifacts/${appId}/public/data/leaderboards/${endedDrillType}/scores`;
            const scoresCollectionRef = collection(db, scoresCollectionPath);
            await addDoc(scoresCollectionRef, firestoreScoreData); 
            console.log("Score saved to public leaderboard for", endedDrillType);
        } catch (error) {
            console.error("Error saving score to public leaderboard:", error);
        }
    }
}

function displayIndividualDrillScore(result, isInRoutine) {
    finalDrillTypeElement.textContent = result.drillType ? result.drillType.replace(/_/g, ' ') : "N/A";
    finalScoreElement.textContent = result.score;
    scoreUnitElement.textContent = (result.drillType === 'TARGET_BLITZ' ? "s" : "");
    document.getElementById('finalAccuracy').textContent = result.accuracy.toFixed(1);
    document.getElementById('finalHits').textContent = result.hits;
    
    if (result.drillType === 'PRECISION_TIMING') {
        finalHitsLabel.textContent = "(Timed Hits)";
        finalMissesLabel.textContent = ""; 
        document.getElementById('finalMisses').textContent = `Early: ${result.earlyClicks}, Late/Miss: ${result.lateClicks + result.misses}`;
    } else if (result.drillType === 'TARGET_BLITZ') {
        finalHitsLabel.textContent = `(Targets: ${result.hits}/${result.targetsToHit})`;
        finalMissesLabel.textContent = `(Shots Missed: ${result.misses})`;
    } else if (result.drillType === 'TRACKING' || result.drillType === 'REACTIVE_TRACKING') {
        finalHitsLabel.textContent = "(Frames On)";
        finalMissesLabel.textContent = "(Frames Off)";
        document.getElementById('finalMisses').textContent = result.misses;
    } else {
        finalHitsLabel.textContent = "(Targets Hit)";
        finalMissesLabel.textContent = "(Shots Missed)";
        document.getElementById('finalMisses').textContent = result.misses;
    }

    if (isInRoutine) {
        if (currentRoutineIndex < dailyWarmupRoutine.length) {
            playAgainButton.textContent = "Next Drill";
        } else {
            playAgainButton.textContent = "View Summary";
        }
    } else {
        playAgainButton.textContent = "Re-engage";
    }
    scoreModal.classList.remove('hidden');
    scoreModal.classList.add('active');
}

function showRoutineSummary() {
    gameState = 'ROUTINE_SUMMARY';
    routineSummaryList.innerHTML = ''; 
    routineScores.forEach(result => {
        const li = document.createElement('li');
        let scoreDisplay = result.score;
        if (result.drillType === 'TARGET_BLITZ') scoreDisplay += "s";
        
        li.innerHTML = `<strong>${result.drillType.replace(/_/g, ' ')}:</strong> 
                        Score/Time: ${scoreDisplay}, 
                        Acc: ${result.accuracy}%`;
        routineSummaryList.appendChild(li);
    });
    routineSummaryModal.classList.remove('hidden');
    routineSummaryModal.classList.add('active');
}

async function fetchLeaderboard(drillType = 'FLICKING') { 
    playSound(clickSound);
    leaderboardTitle.textContent = `Leaderboard: ${drillType.replace(/_/g, ' ')}`;
    leaderboardLoadingStatus.textContent = "Fetching scores...";
    leaderboardList.innerHTML = ''; 
    leaderboardModal.classList.remove('hidden');
    leaderboardModal.classList.add('active');
    mainMenuModal.classList.remove('active');
    mainMenuModal.classList.add('hidden');

    try {
        const scoresCollectionPath = `artifacts/${appId}/public/data/leaderboards/${drillType}/scores`;
        const q = query(collection(db, scoresCollectionPath), orderBy("score", drillType === 'TARGET_BLITZ' ? "asc" : "desc"), limit(10));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            leaderboardLoadingStatus.textContent = "No scores yet for this drill!";
            return;
        }
        
        let rank = 1;
        querySnapshot.forEach((docEntry) => {
            const data = docEntry.data();
            const li = document.createElement('li');
            const displayName = data.displayName || `User-${data.userId ? data.userId.substring(0,6) : 'Anon'}`;
            const scoreDisplay = (drillType === 'TARGET_BLITZ' ? `${data.score}s` : data.score);

            li.innerHTML = `<span class="rank">#${rank++}</span> 
                            <span>${displayName}</span> 
                            <span class="score">${scoreDisplay}</span>
                            <span class="accuracy">${data.accuracy}%</span>`;
            leaderboardList.appendChild(li);
        });
        leaderboardLoadingStatus.textContent = `Top 10 Scores for ${drillType.replace(/_/g, ' ')}`;

    } catch (error) {
        console.error("Error fetching leaderboard:", error);
        leaderboardLoadingStatus.textContent = "Error loading leaderboard.";
    }
}
async function fetchAnalyticsData() {
    playSound(clickSound);
    analyticsLoadingStatus.textContent = "Calculating stats...";
    analyticsSummaryList.innerHTML = '';
    analyticsModal.classList.remove('hidden');
    analyticsModal.classList.add('active');
    mainMenuModal.classList.remove('active');
    mainMenuModal.classList.add('hidden');

    if (!userId) {
        analyticsLoadingStatus.textContent = "Please sign in to view analytics.";
        return;
    }

    try {
        const liDrills = document.createElement('li');
        liDrills.innerHTML = `<strong>Total Drills Completed:</strong> ${userSettings.drillsCompleted || 0}`;
        analyticsSummaryList.appendChild(liDrills);

        const scoresQuery = query(collection(db, `artifacts/${appId}/users/${userId}/scores`));
        const querySnapshot = await getDocs(scoresQuery);
        
        let totalAccuracySum = 0;
        let numScoresForAccuracy = 0;
        let bestFlickingScore = 0;

        if (!querySnapshot.empty) {
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if (data.accuracy !== undefined && !isNaN(parseFloat(data.accuracy))) {
                    totalAccuracySum += parseFloat(data.accuracy);
                    numScoresForAccuracy++;
                }
                if (data.drill === 'FLICKING' && data.score > bestFlickingScore) {
                    bestFlickingScore = data.score;
                }
            });
        }

        const overallAvgAccuracy = numScoresForAccuracy > 0 ? (totalAccuracySum / numScoresForAccuracy) : 0;
        const liAccuracy = document.createElement('li');
        liAccuracy.innerHTML = `<strong>Overall Average Accuracy:</strong> ${overallAvgAccuracy.toFixed(1)}%`;
        analyticsSummaryList.appendChild(liAccuracy);

        const liBestFlick = document.createElement('li');
        liBestFlick.innerHTML = `<strong>Best Flick Shot Matrix Score:</strong> ${bestFlickingScore}`;
        analyticsSummaryList.appendChild(liBestFlick);
        
        analyticsLoadingStatus.textContent = "Summary:";

    } catch (error) {
        console.error("Error fetching analytics data:", error);
        analyticsLoadingStatus.textContent = "Error loading analytics.";
    }
}


// --- UI Event Listeners ---
startDailyWarmupButton.addEventListener('click', () => {
    if (auth.currentUser && userId) startDailyWarmup();
    else loadingStatus.textContent = "Authenticating, please wait...";
});
startFlickingButton.addEventListener('click', () => {
    if (auth.currentUser && userId) openDrillConfiguration('FLICKING');
    else loadingStatus.textContent = "Authenticating, please wait...";
});
 startRecoilFlickButton.addEventListener('click', () => {
    if (auth.currentUser && userId) openDrillConfiguration('RECOIL_CONTROL_FLICK');
    else loadingStatus.textContent = "Authenticating, please wait...";
});
startTrackingButton.addEventListener('click', () => {
    if (auth.currentUser && userId) openDrillConfiguration('TRACKING');
    else loadingStatus.textContent = "Authenticating, please wait...";
});
startReactiveTrackingButton.addEventListener('click', () => {
    if (auth.currentUser && userId) openDrillConfiguration('REACTIVE_TRACKING');
    else loadingStatus.textContent = "Authenticating, please wait...";
});
startDynamicFlickButton.addEventListener('click', () => {
    if (auth.currentUser && userId) openDrillConfiguration('DYNAMIC_FLICKING');
    else loadingStatus.textContent = "Authenticating, please wait...";
});
startPrecisionTimingButton.addEventListener('click', () => {
    if (auth.currentUser && userId) openDrillConfiguration('PRECISION_TIMING');
    else loadingStatus.textContent = "Authenticating, please wait...";
});
startTargetBlitzButton.addEventListener('click', () => {
    if (auth.currentUser && userId) openDrillConfiguration('TARGET_BLITZ');
    else loadingStatus.textContent = "Authenticating, please wait...";
});
startTargetSwitchingButton.addEventListener('click', () => {
    if (auth.currentUser && userId) openDrillConfiguration('TARGET_SWITCHING');
    else loadingStatus.textContent = "Authenticating, please wait...";
});
startMicroFlickingButton.addEventListener('click', () => {
    if (auth.currentUser && userId) openDrillConfiguration('MICRO_FLICKING');
    else loadingStatus.textContent = "Authenticating, please wait...";
});
startMacroFlickingButton.addEventListener('click', () => {
    if (auth.currentUser && userId) openDrillConfiguration('MACRO_FLICKING');
    else loadingStatus.textContent = "Authenticating, please wait...";
});



endGameButton.addEventListener('click', () => {
    playSound(clickSound);
    if (gameState === 'PLAYING' || gameState === 'AWAITING_INPUT') { 
        endGame();
    }
});


settingsButton.addEventListener('click', () => {
    playSound(clickSound);
    gameState = 'SETTINGS';
    applyCurrentSettingsToUI(); 
    mainMenuModal.classList.remove('active');
    mainMenuModal.classList.add('hidden');
    settingsModal.classList.remove('hidden');
    settingsModal.classList.add('active');
    settingsErrorMessages.textContent = ''; 
});

achievementsButton.addEventListener('click', () => {
    playSound(clickSound);
    achievementsList.innerHTML = ''; 
    let hasAchievements = false;
    for (const key in achievements) {
        if (unlockedAchievements[key]) {
            hasAchievements = true;
            const achievement = achievements[key];
            const li = document.createElement('li');
            li.innerHTML = `<strong>${achievement.name}</strong> - ${achievement.description}`;
            achievementsList.appendChild(li);
        }
    }
    if (!hasAchievements) {
         const li = document.createElement('li');
         li.textContent = "No achievements unlocked yet. Keep training!";
         achievementsList.appendChild(li);
    }
    mainMenuModal.classList.remove('active');
    mainMenuModal.classList.add('hidden');
    achievementsModal.classList.remove('hidden');
    achievementsModal.classList.add('active');
});
achievementsOkButton.addEventListener('click', () => {
    playSound(clickSound);
    achievementsModal.classList.remove('active');
    achievementsModal.classList.add('hidden');
    mainMenuModal.classList.remove('hidden');
    mainMenuModal.classList.add('active');
});

leaderboardButton.addEventListener('click', () => {
    playSound(clickSound);
    fetchLeaderboard('FLICKING'); 
});
leaderboardOkButton.addEventListener('click', () => {
    playSound(clickSound);
    leaderboardModal.classList.remove('active');
    leaderboardModal.classList.add('hidden');
    mainMenuModal.classList.remove('hidden');
    mainMenuModal.classList.add('active');
});
analyticsButton.addEventListener('click', () => {
    playSound(clickSound);
    fetchAnalyticsData();
});
analyticsOkButton.addEventListener('click', () => {
    playSound(clickSound);
    analyticsModal.classList.remove('active');
    analyticsModal.classList.add('hidden');
    mainMenuModal.classList.remove('hidden');
    mainMenuModal.classList.add('active');
});


saveSettingsButton.addEventListener('click', async () => {
    playSound(clickSound);
    settingsErrorMessages.textContent = ''; 
    const newSensitivity = parseFloat(sensitivityInput.value);
    const newRecoilStrength = parseInt(recoilStrengthInput.value);
    const newShieldProb = parseInt(shieldProbabilityInput.value);
    const newBombProb = parseInt(bombProbabilityInput.value);
    const newBombPenalty = parseInt(bombPenaltyInput.value);
    let isValid = true;

    if (isNaN(newSensitivity) || newSensitivity < 0.1 || newSensitivity > 5.0) {
        settingsErrorMessages.textContent += " Sensitivity: 0.1-5.0. ";
        isValid = false;
    }
    if (isNaN(newRecoilStrength) || newRecoilStrength < 0 || newRecoilStrength > 50) {
        settingsErrorMessages.textContent += " Recoil: 0-50px. ";
        isValid = false;
    }
    if (isNaN(newShieldProb) || newShieldProb < 0 || newShieldProb > 100) {
        settingsErrorMessages.textContent += " Shield Prob: 0-100%. ";
        isValid = false;
    }
    if (isNaN(newBombProb) || newBombProb < 0 || newBombProb > 100) {
        settingsErrorMessages.textContent += " Bomb Prob: 0-100%. ";
        isValid = false;
    }
    if (isNaN(newBombPenalty) || newBombPenalty < 0) {
        settingsErrorMessages.textContent += " Bomb Penalty >= 0. ";
        isValid = false;
    }
    const csSize = parseInt(crosshairSizeInput.value);
    const csThick = parseInt(crosshairThicknessInput.value);
    const csGap = parseInt(crosshairGapInput.value);

    if(isNaN(csSize) || csSize < 1 || csSize > 50) { settingsErrorMessages.textContent += " Crosshair Size: 1-50px."; isValid = false;}
    if(isNaN(csThick) || csThick < 1 || csThick > 10) { settingsErrorMessages.textContent += " Crosshair Thickness: 1-10px."; isValid = false;}
    if(isNaN(csGap) || csGap < 0 || csGap > 20) { settingsErrorMessages.textContent += " Crosshair Gap: 0-20px."; isValid = false;}
    
    if (isValid) {
        userSettings.sensitivity = newSensitivity;
        userSettings.recoilStrength = newRecoilStrength;
        userSettings.shieldProbability = newShieldProb;
        userSettings.bombProbability = newBombProb;
        userSettings.bombPenalty = newBombPenalty;
        userSettings.crosshairType = crosshairTypeInput.value;
        userSettings.crosshairColor = crosshairColorInput.value;
        userSettings.crosshairSize = csSize;
        userSettings.crosshairThickness = csThick;
        userSettings.crosshairGap = csGap;
        userSettings.targetShape = targetShapeInput.value;
        userSettings.flickingTargetColor = flickingTargetColorInput.value;
        userSettings.trackingTargetColor = trackingTargetColorInput.value;
        userSettings.targetOutlineColor = targetOutlineColorInput.value;
        userSettings.currentTheme = themeSelector.value;
        userSettings.sfxVolume = parseInt(sfxVolumeInput.value);
        
        await saveUserProfileData(); 
        settingsModal.classList.remove('active');
        settingsModal.classList.add('hidden');
        mainMenuModal.classList.remove('hidden');
        mainMenuModal.classList.add('active');
        gameState = 'MENU';
    }
});

cancelSettingsButton.addEventListener('click', () => {
    playSound(clickSound);
    applyCurrentSettingsToUI(); 
    settingsErrorMessages.textContent = ''; 
    settingsModal.classList.remove('active');
    settingsModal.classList.add('hidden');
    mainMenuModal.classList.remove('hidden');
    mainMenuModal.classList.add('active');
    gameState = 'MENU';
});

playAgainButton.addEventListener('click', () => {
    playSound(clickSound);
    scoreModal.classList.remove('active');
    scoreModal.classList.add('hidden'); 
    if (gameState === 'IN_ROUTINE_SCORE_SCREEN') {
        if (currentRoutineIndex < dailyWarmupRoutine.length) {
            startNextDrillInRoutine();
        } else { 
            showRoutineSummary();
        }
    } else { 
         if (currentDrillType === 'FLICKING') startFlickingGame();
        else if (currentDrillType === 'RECOIL_CONTROL_FLICK') startRecoilControlFlickGame();
        else if (currentDrillType === 'TRACKING') startTrackingGame();
        else if (currentDrillType === 'REACTIVE_TRACKING') startReactiveTrackingGame();
        else if (currentDrillType === 'DYNAMIC_FLICKING') startDynamicFlickingGame();
        else if (currentDrillType === 'PRECISION_TIMING') startPrecisionTimingGame();
        else if (currentDrillType === 'TARGET_BLITZ') startTargetBlitzGame();
        else if (currentDrillType === 'TARGET_SWITCHING') startTargetSwitchingGame();
        else if (currentDrillType === 'MICRO_FLICKING') startMicroFlickingGame();
        else if (currentDrillType === 'MACRO_FLICKING') startMacroFlickingGame();
    }
});

backToMenuButton.addEventListener('click', () => {
    playSound(clickSound);
    scoreModal.classList.remove('active');
    scoreModal.classList.add('hidden');
    mainMenuModal.classList.remove('hidden');
    mainMenuModal.classList.add('active');
    gameState = 'MENU';
    currentDrillType = null; 
    currentRoutineIndex = -1; 
    routineScores = [];
});
routineOkButton.addEventListener('click', () => {
    playSound(clickSound);
    routineSummaryModal.classList.remove('active');
    routineSummaryModal.classList.add('hidden');
    mainMenuModal.classList.remove('hidden');
    mainMenuModal.classList.add('active');
    gameState = 'MENU';
    currentRoutineIndex = -1;
    routineScores = [];
});

[crosshairTypeInput, crosshairColorInput, crosshairSizeInput, crosshairThicknessInput, crosshairGapInput].forEach(input => {
    input.addEventListener('input', () => { 
        userSettings.crosshairType = crosshairTypeInput.value;
        userSettings.crosshairColor = crosshairColorInput.value;
        userSettings.crosshairSize = parseInt(crosshairSizeInput.value) || defaultUserSettings.crosshairSize;
        userSettings.crosshairThickness = parseInt(crosshairThicknessInput.value) || defaultUserSettings.crosshairThickness;
        userSettings.crosshairGap = parseInt(crosshairGapInput.value); 
         if (isNaN(userSettings.crosshairGap)) userSettings.crosshairGap = defaultUserSettings.crosshairGap;
        updateCrosshairStyle();
        toggleCrosshairSettingsVisibility(); 
    });
});
 [flickingTargetColorInput, trackingTargetColorInput, targetOutlineColorInput, recoilStrengthInput, targetShapeInput, themeSelector, sfxVolumeInput, shieldProbabilityInput, bombProbabilityInput, bombPenaltyInput].forEach(input => {
    input.addEventListener('input', () => { 
        userSettings.flickingTargetColor = flickingTargetColorInput.value;
        userSettings.trackingTargetColor = trackingTargetColorInput.value;
        userSettings.targetOutlineColor = targetOutlineColorInput.value;
        userSettings.recoilStrength = parseInt(recoilStrengthInput.value) || defaultUserSettings.recoilStrength;
        userSettings.targetShape = targetShapeInput.value;
        userSettings.currentTheme = themeSelector.value;
        userSettings.sfxVolume = parseInt(sfxVolumeInput.value);
        userSettings.shieldProbability = parseInt(shieldProbabilityInput.value);
        if(isNaN(userSettings.shieldProbability)) userSettings.shieldProbability = defaultUserSettings.shieldProbability;
        userSettings.bombProbability = parseInt(bombProbabilityInput.value);
        if(isNaN(userSettings.bombProbability)) userSettings.bombProbability = defaultUserSettings.bombProbability;
        userSettings.bombPenalty = parseInt(bombPenaltyInput.value);
        if(isNaN(userSettings.bombPenalty)) userSettings.bombPenalty = defaultUserSettings.bombPenalty;

        applyTheme(userSettings.currentTheme);
        setSfxVolume(userSettings.sfxVolume);
    });
});


// --- Initialization ---
window.onload = async () => {
    await initFirebase(); 
    initPixi();       
    initSounds(); 
    mainMenuModal.classList.remove('hidden');
    mainMenuModal.classList.add('active');
};


