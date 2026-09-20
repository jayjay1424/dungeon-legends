const AUDIO_PATHS = {
  sword: "/audio/sword_swing.mp3",
  goblinBeast: "/audio/goblin beast.mp3",
  goblinRider: "/audio/goblin rider.mp3",
  kingSkeleton: "/audio/king skeleton.mp3",
  necromancer: "/audio/necromancer.mp3",
  skeleton: "/audio/skleleton sword and skleton hunter.mp3",
  slimeHit: "/audio/slime_hit.mp3",
  vampireLaugh: "/audio/vampire laugh.mp3",
  village: "/audio/background of the village.mp3",
  login: "/audio/login page.mp3",
  warriorSecondSkill: "/audio/warrior_second_skill.mp3",
  warriorThirdSkill: "/audio/3rd skill.mp3",
  jutsu: "/audio/jutsu.mp3",
  dodge: "/audio/dodge.mp3",
} as const;

const audioCache = new Map<string, HTMLAudioElement>();
const lastEffectAt = new Map<string, number>();
const ENEMY_HEARING_RADIUS = 420;
const GUARDIAN_HEARING_RADIUS = 220;
let audioContext: AudioContext | null = null;
let villageAudio: HTMLAudioElement | null = null;
let loginAudio: HTMLAudioElement | null = null;
let dodgeAudio: HTMLAudioElement | null = null;
let activeMusic: "village" | "login" | null = null;
let requestedMusic: "village" | "login" | null = null;
let musicFadeTimer: number | null = null;

function getAudio(src: string): HTMLAudioElement {
  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    audioCache.set(src, audio);
  }
  return audio;
}

function getAudioContext() {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

export function playAudioFile(
  src: string,
  volume = 0.7,
  pan = 0,
  maxDurationMs?: number,
  cooldownMs = 0
): (() => void) | null {
  if (typeof window === "undefined") return null;
  const now = performance.now();
  const lastPlayed = lastEffectAt.get(src) ?? -Infinity;
  if (now - lastPlayed < cooldownMs) return null;
  lastEffectAt.set(src, now);
  const audio = getAudio(src).cloneNode(true) as HTMLAudioElement;
  audio.volume = Math.max(0, Math.min(1, volume));
  let stopPlayback = () => {
    audio.pause();
    audio.currentTime = 0;
  };
  try {
    const context = getAudioContext();
    const source = context.createMediaElementSource(audio);
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(gain).connect(panner).connect(context.destination);
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      source.disconnect();
      gain.disconnect();
      panner.disconnect();
      audio.remove();
    };
    stopPlayback = () => {
      audio.pause();
      audio.currentTime = 0;
      cleanup();
    };
    audio.addEventListener("ended", cleanup, { once: true });
    if (maxDurationMs !== undefined) {
      window.setTimeout(() => {
        audio.pause();
        audio.currentTime = 0;
        cleanup();
      }, maxDurationMs);
    }
  } catch {
    // Fall back to normal element playback if Web Audio is unavailable.
  }
  void audio.play().catch(() => undefined);
  return stopPlayback;
}

export function playSwordSwingSound(pan = 0, volumeMultiplier = 1) {
  playAudioFile(AUDIO_PATHS.sword, 0.65 * volumeMultiplier, pan);
}

export function playGuardianAttackSound(distance: number, pan = 0) {
  const distanceVolume = Math.max(0, 1 - distance / GUARDIAN_HEARING_RADIUS) ** 2;
  if (distanceVolume <= 0) return null;
  return playAudioFile(
    AUDIO_PATHS.sword,
    0.7 * distanceVolume,
    pan,
    undefined,
    320
  );
}

export function playWarriorSecondSkillSound() {
  playAudioFile(AUDIO_PATHS.warriorSecondSkill, 0.8, 0, 1000, 300);
}

export function playWarriorThirdSkillSound() {
  playAudioFile(AUDIO_PATHS.warriorThirdSkill, 0.8, 0, undefined, 300);
}

export function playJutsuSound() {
  playAudioFile(AUDIO_PATHS.jutsu, 0.8, 0, undefined, 250);
}

export function playDodgeSound() {
  if (typeof window === "undefined") return;
  const now = performance.now();
  const lastPlayed = lastEffectAt.get(AUDIO_PATHS.dodge) ?? -Infinity;
  if (now - lastPlayed < 250) return;
  lastEffectAt.set(AUDIO_PATHS.dodge, now);
  if (!dodgeAudio) {
    dodgeAudio = new Audio(AUDIO_PATHS.dodge);
    dodgeAudio.preload = "auto";
  }
  dodgeAudio.pause();
  dodgeAudio.currentTime = 0;
  dodgeAudio.volume = 0.65;
  void dodgeAudio.play().catch(() => undefined);
  window.setTimeout(() => {
    dodgeAudio?.pause();
  }, 700);
}

export function preloadDodgeSound() {
  if (typeof window === "undefined") return;
  if (!dodgeAudio) {
    dodgeAudio = new Audio(AUDIO_PATHS.dodge);
    dodgeAudio.preload = "auto";
  }
  dodgeAudio.load();
}

export function playSlimeHitSound(_pan = 0, volumeMultiplier = 1) {
  playAudioFile(AUDIO_PATHS.slimeHit, 0.75 * volumeMultiplier, _pan, 1000, 180);
}

export function playEnemyAttackSound(
  kind: "bloodMonster" | "demon" | "goblinBeast" | "goblinRider" | "necromancer" | "skeleton" | "skeletonBow" | "skeletonKing" | "vampire",
  distance = 0,
  pan = 0
) {
  const src =
    kind === "goblinBeast" ? AUDIO_PATHS.goblinBeast :
    kind === "goblinRider" ? AUDIO_PATHS.goblinRider :
    kind === "skeletonKing" ? AUDIO_PATHS.kingSkeleton :
    kind === "necromancer" ? AUDIO_PATHS.necromancer :
    kind === "vampire" ? AUDIO_PATHS.vampireLaugh :
    kind === "skeleton" || kind === "skeletonBow" ? AUDIO_PATHS.skeleton :
    AUDIO_PATHS.sword;
  const distanceVolume = Math.max(0, 1 - distance / ENEMY_HEARING_RADIUS) ** 2;
  if (distanceVolume <= 0) return null;
  return playAudioFile(src, 0.7 * distanceVolume, pan, undefined, 320);
}

function startLoopingAudio(
  current: HTMLAudioElement | null,
  src: string,
  volume: number
): HTMLAudioElement {
  if (current) {
    void current.play().catch(() => undefined);
    return current;
  }
  const audio = getAudio(src);
  audio.loop = true;
  audio.volume = volume;
  void audio.play().catch(() => undefined);
  return audio;
}

function fadeMusic(audio: HTMLAudioElement, target: number, onComplete?: () => void) {
  if (musicFadeTimer !== null) {
    window.clearInterval(musicFadeTimer);
    musicFadeTimer = null;
  }
  const startVolume = audio.volume;
  const startedAt = performance.now();
  musicFadeTimer = window.setInterval(() => {
    const progress = Math.min(1, (performance.now() - startedAt) / 350);
    audio.volume = startVolume + (target - startVolume) * progress;
    if (progress >= 1) {
      window.clearInterval(musicFadeTimer!);
      musicFadeTimer = null;
      onComplete?.();
    }
  }, 16);
}

function stopMusicAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
  audio.volume = 0;
}

export function changeMusic(track: "village" | "login") {
  if (typeof window === "undefined") return;
  if (requestedMusic === track) return;
  requestedMusic = track;

  const previousAudio = activeMusic === "village" ? villageAudio : loginAudio;
  const nextAudio = track === "village"
    ? (villageAudio ?? getAudio(AUDIO_PATHS.village))
    : (loginAudio ?? getAudio(AUDIO_PATHS.login));

  const startNextTrack = () => {
    if (requestedMusic !== track) return;
    stopMusicAudio(track === "village" ? loginAudio : villageAudio);
    nextAudio.loop = true;
    nextAudio.volume = track === "village" ? 0.25 : 0.3;
    if (track === "village") villageAudio = nextAudio;
    else loginAudio = nextAudio;
    activeMusic = track;
    void nextAudio.play().catch(() => undefined);
  };

  if (!previousAudio || previousAudio.paused) {
    startNextTrack();
    return;
  }

  fadeMusic(previousAudio, 0, () => {
    stopMusicAudio(previousAudio);
    startNextTrack();
  });
}

export function startVillageMusic(volume = 0.25) {
  if (typeof window === "undefined") return;
  if (activeMusic === "village") {
    villageAudio = startLoopingAudio(villageAudio, AUDIO_PATHS.village, volume);
    return;
  }
  changeMusic("village");
}

export function stopVillageMusic() {
  stopMusicAudio(villageAudio);
  villageAudio = null;
  if (activeMusic === "village") activeMusic = null;
  if (requestedMusic === "village") requestedMusic = null;
}

export function startLoginMusic(volume = 0.3) {
  if (typeof window === "undefined") return;
  if (activeMusic === "login") {
    loginAudio = startLoopingAudio(loginAudio, AUDIO_PATHS.login, volume);
    return;
  }
  changeMusic("login");
}

export function stopLoginMusic() {
  stopMusicAudio(loginAudio);
  loginAudio = null;
  if (activeMusic === "login") activeMusic = null;
  if (requestedMusic === "login") requestedMusic = null;
}

export function startCombatMusic() {
  changeMusic("login");
}

export function stopCombatMusic() {
  changeMusic("village");
}