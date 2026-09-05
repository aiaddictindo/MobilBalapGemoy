export type GameSpeed = 1 | 1.5 | 2;
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type RoomStatus = 'waiting' | 'countdown' | 'playing' | 'finished';

export interface CharacterInfo {
  id: string;
  emoji: string;
  name: string;
  title: string;
  trait: string;
  quote: string;
  accentColor: string;
}

export interface VehicleInfo {
  id: string;
  emoji: string;
  name: string;
  category: string;
  speed: number; // 1-5
  accel: number; // 1-5
  jump: number; // 1-5
  skillName: string;
  skillDesc: string;
  skillCooldown: number; // in seconds
  soundFreq: number;
}

export interface PlayerProfile {
  userId: string;
  displayName: string;
  photoURL?: string;
  totalScore: number;
  totalWins: number;
  totalRaces: number;
  highPaintPercent: number;
  selectedCharacter: string;
  selectedVehicle: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface RoomMember {
  memberId: string;
  displayName: string;
  isBot: boolean;
  character: string;
  vehicle: string;
  isReady: boolean;
  color: string;
  score: number;
  paintCount: number;
  paintPercent: number;
  rank?: number;
}

export interface GameRoom {
  roomId: string;
  roomName: string;
  hostId: string;
  status: RoomStatus;
  gameSpeed: GameSpeed;
  botDifficulty: BotDifficulty;
  maxPlayers: number;
  currentPlayersCount: number;
  winnerId?: string;
  winnerName?: string;
  winnerAvatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomChatMessage {
  messageId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  createdAt: string;
}

export interface RoomLiveState {
  memberId: string;
  x: number;
  tier: number; // 0 (bottom) to 3 (top)
  vx: number;
  direction: number; // -1 or 1
  isJumping: boolean;
  isSpinning: boolean;
  paintCount: number;
  score: number;
  skillActive?: boolean;
  updatedAt: number;
}

export interface GameInvite {
  inviteId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  roomId: string;
  roomName: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
}

// 11 Cute Emoji Characters requested by user: 🦁🐯🐱🐶🐺🐻🐻‍❄️🐨🐼🐷🦊
export const CHARACTERS: CharacterInfo[] = [
  { id: 'lion', emoji: '🦁', name: 'Singa Raja', title: 'Raja Jalanan', trait: 'Skor Bonus +15%', quote: 'Auman saya menggetarkan aspal!', accentColor: '#f59e0b' },
  { id: 'tiger', emoji: '🐯', name: 'Harimau Garang', title: 'Si Belang Cepat', trait: 'Akselerasi Kilat', quote: 'Tak ada yang bisa menyusulku!', accentColor: '#ea580c' },
  { id: 'cat', emoji: '🐱', name: 'Kucing Manis', title: 'Si Imut Gesit', trait: 'Lompatan Mulus', quote: 'Meong! Jalur ini milikku!', accentColor: '#ec4899' },
  { id: 'dog', emoji: '🐶', name: 'Anjing Setia', title: 'Sahabat Sejati', trait: 'Deteksi Kaleng Oli', quote: 'Guk! Ayo balap sampai finis!', accentColor: '#eab308' },
  { id: 'wolf', emoji: '🐺', name: 'Serigala Malam', title: 'Pemburu Malam', trait: 'Kecepatan Malam +10%', quote: 'Lolongan pemenang di puncak!', accentColor: '#6366f1' },
  { id: 'bear', emoji: '🐻', name: 'Beruang Cokelat', title: 'Si Kuat Santai', trait: 'Tahan Benturan', quote: 'Pelan tapi pasti menang!', accentColor: '#854d0e' },
  { id: 'polar_bear', emoji: '🐻‍❄️', name: 'Beruang Kutub', title: 'Raja Es Antartika', trait: 'Anti-Selip Licin', quote: 'Dingin dan tak tertandingi!', accentColor: '#0284c7' },
  { id: 'koala', emoji: '🐨', name: 'Koala Santuy', title: 'Pembalap Kalem', trait: 'Pemulihan Kilat', quote: 'Ngantuk tapi podium satu!', accentColor: '#64748b' },
  { id: 'panda', emoji: '🐼', name: 'Panda Gembul', title: 'Master Bambu', trait: 'Cat Jalanan Lebar', quote: 'Gembul tapi gerakannya lincah!', accentColor: '#10b981' },
  { id: 'pig', emoji: '🐷', name: 'Babi Gemoy', title: 'Si Lucu Merona', trait: 'Dapat Oli Gratis', quote: 'Oink! Jalanan ini jadi pink!', accentColor: '#f43f5e' },
  { id: 'fox', emoji: '🦊', name: 'Rubah Licik', title: 'Taktisi Jalanan', trait: 'Cooldown Skill -20%', quote: 'Kecepatan dipadu trik cerdik!', accentColor: '#f97316' },
];

// 17 Vehicles requested by user: 🦖🐢🦕🐈🐈‍⬛🐇🐁🐖🐑🦬🐐🦌🐅🐘🦏🦛🐫
export const VEHICLES: VehicleInfo[] = [
  {
    id: 'trex',
    emoji: '🦖',
    name: 'T-Rex Purba',
    category: 'Dino Monster',
    speed: 4,
    accel: 4,
    jump: 4,
    skillName: 'Hentakan Gempa',
    skillDesc: 'Menghentak aspal, membuat lawan terdekat terhuyung!',
    skillCooldown: 7,
    soundFreq: 120,
  },
  {
    id: 'turtle',
    emoji: '🐢',
    name: 'Kura Baja',
    category: 'Pertahanan Baja',
    speed: 3,
    accel: 3,
    jump: 3,
    skillName: 'Perisai Tempurung',
    skillDesc: 'Kebal dari tumpahan oli & tabrakan selama 4 detik.',
    skillCooldown: 6,
    soundFreq: 280,
  },
  {
    id: 'bronto',
    emoji: '🦕',
    name: 'Bronto Layang',
    category: 'Dino Raksasa',
    speed: 3,
    accel: 3,
    jump: 5,
    skillName: 'Melayang Tinggi',
    skillDesc: 'Lompatan super tinggi dengan waktu melayang lama.',
    skillCooldown: 6,
    soundFreq: 180,
  },
  {
    id: 'cat_orange',
    emoji: '🐈',
    name: 'Kucing Oren',
    category: 'Gesit Kompak',
    speed: 5,
    accel: 5,
    jump: 4,
    skillName: 'Serbuan Bar-bar',
    skillDesc: 'Melesat maju seketika dengan kecepatan gila!',
    skillCooldown: 5,
    soundFreq: 360,
  },
  {
    id: 'cat_black',
    emoji: '🐈‍⬛',
    name: 'Kucing Siluman',
    category: 'Siluman Malam',
    speed: 4,
    accel: 4,
    jump: 4,
    skillName: 'Fase Bayangan',
    skillDesc: 'Menembus rintangan dan lawan tanpa terbentur.',
    skillCooldown: 6,
    soundFreq: 400,
  },
  {
    id: 'rabbit',
    emoji: '🐇',
    name: 'Kelinci Pegas',
    category: 'Spesialis Lompat',
    speed: 4,
    accel: 5,
    jump: 5,
    skillName: 'Lompat Tiga Tingkat',
    skillDesc: 'Melompat langsung menembus 2 tingkat jalan ke atas!',
    skillCooldown: 5,
    soundFreq: 520,
  },
  {
    id: 'mouse',
    emoji: '🐁',
    name: 'Tikus Turbo',
    category: 'Mikro Gesit',
    speed: 5,
    accel: 5,
    jump: 3,
    skillName: 'Mikro Nitro',
    skillDesc: 'Ukuran mungil dan dorongan nitro cepat berulang kali.',
    skillCooldown: 4,
    soundFreq: 600,
  },
  {
    id: 'pig_mount',
    emoji: '🐖',
    name: 'Babi Lumpur',
    category: 'Pengacau Lintasan',
    speed: 3,
    accel: 4,
    jump: 3,
    skillName: 'Semprotan Lumpur',
    skillDesc: 'Menyemprotkan genangan licin ke belakang untuk lawan!',
    skillCooldown: 6,
    soundFreq: 220,
  },
  {
    id: 'sheep',
    emoji: '🐑',
    name: 'Domba Wol',
    category: 'Lembut Pantul',
    speed: 3,
    accel: 4,
    jump: 4,
    skillName: 'Balon Pantul',
    skillDesc: 'Memantul empuk tanpa kehilangan kecepatan saat mendarat.',
    skillCooldown: 5,
    soundFreq: 330,
  },
  {
    id: 'bison',
    emoji: '🦬',
    name: 'Bison Perkasa',
    category: 'Penyapu Jalur',
    speed: 4,
    accel: 4,
    jump: 3,
    skillName: 'Tabrakan Banteng',
    skillDesc: 'Menerobos lurus mengecat semua ubin jalan di depannya.',
    skillCooldown: 7,
    soundFreq: 150,
  },
  {
    id: 'goat',
    emoji: '🐐',
    name: 'Kambing Gunung',
    category: 'Pendaki Jalur',
    speed: 4,
    accel: 4,
    jump: 5,
    skillName: 'Panjat Tebing',
    skillDesc: 'Berpindah antar tingkat jalan dengan kecepatan dobel.',
    skillCooldown: 5,
    soundFreq: 300,
  },
  {
    id: 'deer',
    emoji: '🦌',
    name: 'Rusa Anggun',
    category: 'Manuver Halus',
    speed: 5,
    accel: 4,
    jump: 4,
    skillName: 'Langkah Melayang',
    skillDesc: 'Kecepatan tidak berkurang saat berbelok tajam.',
    skillCooldown: 5,
    soundFreq: 440,
  },
  {
    id: 'tiger_mount',
    emoji: '🐅',
    name: 'Harimau Sumatra',
    category: 'Predator Liar',
    speed: 5,
    accel: 5,
    jump: 4,
    skillName: 'Teror Belang',
    skillDesc: 'Akselerasi puncak instan dan raungan pembuka jalan.',
    skillCooldown: 6,
    soundFreq: 260,
  },
  {
    id: 'elephant',
    emoji: '🐘',
    name: 'Gajah Meriam',
    category: 'Pengecat Masal',
    speed: 3,
    accel: 3,
    jump: 2,
    skillName: 'Semburan Belalai',
    skillDesc: 'Menyemprotkan cat ke 5 balok jalan sekaligus di depan!',
    skillCooldown: 6,
    soundFreq: 110,
  },
  {
    id: 'rhino',
    emoji: '🦏',
    name: 'Badak Lapis Baja',
    category: 'Penghancur Hambatan',
    speed: 4,
    accel: 3,
    jump: 3,
    skillName: 'Tanduk Penghancur',
    skillDesc: 'Menghancurkan rintangan polisi/tong oli menjadi poin!',
    skillCooldown: 6,
    soundFreq: 140,
  },
  {
    id: 'hippo',
    emoji: '🦛',
    name: 'Kuda Nil Ombak',
    category: 'Gelombang Air',
    speed: 3,
    accel: 3,
    jump: 3,
    skillName: 'Hempasan Air',
    skillDesc: 'Membuat gelombang yang memutar arah lawan di dekatnya.',
    skillCooldown: 7,
    soundFreq: 160,
  },
  {
    id: 'camel',
    emoji: '🐫',
    name: 'Unta Gurun',
    category: 'Stamina Baja',
    speed: 4,
    accel: 4,
    jump: 3,
    skillName: 'Stamina Tak Terbatas',
    skillDesc: 'Kebal terhadap efek perlambatan jalanan dan debu.',
    skillCooldown: 6,
    soundFreq: 240,
  },
];

export const PLAYER_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber/Yellow
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

export const BOT_NAMES = [
  'Kancil_Gemoy',
  'Meong_Speed',
  'Bujang_Lincah',
  'Si_Penyapu_Jalan',
  'Turbo_Panda',
  'Kelinci_Racing',
  'Bison_Barbar',
  'Rusa_Asphalt',
];
