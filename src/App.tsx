import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Users,
  Trophy,
  Zap,
  Sparkles,
  Bot,
  Gauge,
  Shield,
  ArrowRight,
  Flame,
  Globe,
  Radio,
  PlusCircle,
  Hash,
} from 'lucide-react';
import type {
  PlayerProfile,
  GameRoom,
  RoomMember,
  RoomChatMessage,
  RoomLiveState,
  GameInvite,
  GameSpeed,
  BotDifficulty,
} from './types';
import { CHARACTERS, VEHICLES, PLAYER_COLORS, BOT_NAMES } from './types';
import {
  subscribeAuthState,
  loginWithGoogle,
  logoutUser,
  getPlayerProfile,
  savePlayerProfile,
  createGameRoom,
  findOrCreateMatchmakingRoom,
  subscribeRoom,
  subscribeRoomMembers,
  subscribeChatMessages,
  subscribeLiveStates,
  subscribeFriendInvites,
  joinRoomMember,
  leaveRoomMember,
  updateRoomSettings,
  testFirestoreConnection,
} from './firebase';
import { soundManager } from './audio';
import { Navbar } from './components/Navbar';
import { LobbyRoom } from './components/LobbyRoom';
import { CityConnectionCanvas } from './components/CityConnectionCanvas';
import { CharacterVehiclePickerModal } from './components/CharacterVehiclePickerModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { FriendInviteModal } from './components/FriendInviteModal';

export default function App() {
  // Theme & Sound state
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [muted, setMuted] = useState(soundManager.isMuted);

  // Auth & Profile
  const [authUser, setAuthUser] = useState<{
    uid: string;
    displayName: string | null;
    photoURL: string | null;
    isAnonymous: boolean;
  } | null>(null);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);

  // Active Game / Room State
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [liveStates, setLiveStates] = useState<Record<string, RoomLiveState>>({});
  const [gameInvites, setGameInvites] = useState<GameInvite[]>([]);

  // Modals
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showInvitesModal, setShowInvitesModal] = useState(false);

  // Matchmaking UI state
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [createSpeed, setCreateSpeed] = useState<GameSpeed>(1);
  const [createDifficulty, setCreateDifficulty] = useState<BotDifficulty>('medium');
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null);

  // Unsubscribe refs
  const roomUnsubRef = useRef<(() => void) | null>(null);
  const membersUnsubRef = useRef<(() => void) | null>(null);
  const chatUnsubRef = useRef<(() => void) | null>(null);
  const liveUnsubRef = useRef<(() => void) | null>(null);
  const invitesUnsubRef = useRef<(() => void) | null>(null);

  // 1. Initial connection test & Auth listener
  useEffect(() => {
    testFirestoreConnection();

    const unsubAuth = subscribeAuthState(async (user) => {
      if (user) {
        setAuthUser({
          uid: user.uid,
          displayName: user.displayName || 'Pembalap Gemoy',
          photoURL: user.photoURL,
          isAnonymous: user.isAnonymous,
        });

        // Load or create player profile
        try {
          const profile = await getPlayerProfile(user.uid);
          if (profile) {
            setPlayerProfile(profile);
          } else {
            const initialProfile: PlayerProfile = {
              userId: user.uid,
              displayName: user.displayName || `Pembalap_${Math.floor(Math.random() * 899 + 100)}`,
              photoURL: user.photoURL || undefined,
              totalScore: 0,
              totalWins: 0,
              totalRaces: 0,
              highPaintPercent: 0,
              selectedCharacter: '🦁',
              selectedVehicle: '🦖',
              createdAt: new Date().toISOString(),
            };
            await savePlayerProfile(initialProfile);
            setPlayerProfile(initialProfile);
          }
        } catch (err) {
          console.warn('Profile sync fallback:', err);
        }

        // Attach invites subscription ONLY when authenticated!
        if (invitesUnsubRef.current) invitesUnsubRef.current();
        invitesUnsubRef.current = subscribeFriendInvites((invites) => {
          setGameInvites(invites);
          if (invites.length > 0) {
            const latest = invites[0];
            soundManager.playChatPop();
            setNotificationBanner(`📩 Undangan balap baru dari ${latest.senderName}!`);
            setTimeout(() => setNotificationBanner(null), 5000);

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification('Undangan Balap Masuk! 🏁', {
                  body: `${latest.senderName} mengundang Anda ke ${latest.roomName} (${latest.roomId})`,
                  icon: '/favicon.ico',
                });
              } catch {
                // Ignore
              }
            }
          }
        });
      } else {
        // Not logged in with Google yet: clean up Firestore invites listener
        if (invitesUnsubRef.current) {
          invitesUnsubRef.current();
          invitesUnsubRef.current = null;
        }
        setAuthUser(null);
        setGameInvites([]);
        // Provide local guest profile so player can still play solo/customize
        setPlayerProfile((prev) => prev || {
          userId: 'guest_' + Math.floor(Math.random() * 10000),
          displayName: 'Pembalap Tamu',
          totalScore: 0,
          totalWins: 0,
          totalRaces: 0,
          highPaintPercent: 0,
          selectedCharacter: '🦁',
          selectedVehicle: '🦖',
          createdAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      unsubAuth();
      if (invitesUnsubRef.current) {
        invitesUnsubRef.current();
        invitesUnsubRef.current = null;
      }
    };
  }, []);

  // Sync active room changes
  useEffect(() => {
    // Clean up any existing listeners first
    if (roomUnsubRef.current) {
      roomUnsubRef.current();
      roomUnsubRef.current = null;
    }
    if (membersUnsubRef.current) {
      membersUnsubRef.current();
      membersUnsubRef.current = null;
    }
    if (chatUnsubRef.current) {
      chatUnsubRef.current();
      chatUnsubRef.current = null;
    }
    if (liveUnsubRef.current) {
      liveUnsubRef.current();
      liveUnsubRef.current = null;
    }

    if (!currentRoom) {
      return;
    }

    const roomId = currentRoom.roomId;

    // Solo / Offline rooms are fully local — DO NOT subscribe to Firestore!
    if (roomId.startsWith('SOLO_')) {
      return;
    }

    // Room doc listener
    roomUnsubRef.current = subscribeRoom(roomId, (room) => {
      if (room) {
        setCurrentRoom(room);
      } else {
        setCurrentRoom(null);
      }
    });

    // Members listener
    membersUnsubRef.current = subscribeRoomMembers(roomId, (members) => {
      setRoomMembers(members);
    });

    // Chat listener
    chatUnsubRef.current = subscribeChatMessages(roomId, (messages) => {
      setChatMessages(messages);
    });

    // Live state listener
    liveUnsubRef.current = subscribeLiveStates(roomId, (states) => {
      setLiveStates(states);
    });

    return () => {
      if (roomUnsubRef.current) roomUnsubRef.current();
      if (membersUnsubRef.current) membersUnsubRef.current();
      if (chatUnsubRef.current) chatUnsubRef.current();
      if (liveUnsubRef.current) liveUnsubRef.current();
    };
  }, [currentRoom?.roomId]);

  // Auth Handlers
  const handleGoogleLogin = async () => {
    try {
      const user = await loginWithGoogle();
      const profile = await getPlayerProfile(user.uid);
      if (profile) {
        setPlayerProfile(profile);
      } else {
        const newProfile: PlayerProfile = {
          userId: user.uid,
          displayName: user.displayName || 'Pembalap Google',
          photoURL: user.photoURL || undefined,
          totalScore: 0,
          totalWins: 0,
          totalRaces: 0,
          highPaintPercent: 0,
          selectedCharacter: playerProfile?.selectedCharacter || '🦁',
          selectedVehicle: playerProfile?.selectedVehicle || '🦖',
          createdAt: new Date().toISOString(),
        };
        await savePlayerProfile(newProfile);
        setPlayerProfile(newProfile);
      }
    } catch (error) {
      console.warn('Login canceled or failed:', error);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setCurrentRoom(null);
    setAuthUser(null);
    setPlayerProfile(null);
  };

  // Join or Create Room Handlers
  const handleJoinOrCreateRoom = async (roomIdToJoin?: string) => {
    soundManager.playClick();
    let currentAuth = authUser;
    let currentProf = playerProfile;

    // Prompt Google sign-in if not yet logged in
    if (!currentAuth || !currentProf) {
      try {
        const loggedIn = await loginWithGoogle();
        currentAuth = {
          uid: loggedIn.uid,
          displayName: loggedIn.displayName || 'Pembalap Google',
          photoURL: loggedIn.photoURL,
          isAnonymous: false,
        };
        const fetched = await getPlayerProfile(loggedIn.uid);
        if (fetched) {
          currentProf = fetched;
        } else {
          currentProf = {
            userId: loggedIn.uid,
            displayName: loggedIn.displayName || 'Pembalap Google',
            totalScore: 0,
            totalWins: 0,
            totalRaces: 0,
            highPaintPercent: 0,
            selectedCharacter: '🦁',
            selectedVehicle: '🦖',
            createdAt: new Date().toISOString(),
          };
          await savePlayerProfile(currentProf);
        }
        setAuthUser(currentAuth);
        setPlayerProfile(currentProf);
      } catch (e) {
        console.warn('Sign-in required for online multiplayer:', e);
        return;
      }
    }

    setIsMatchmaking(true);

    try {
      let roomId = roomIdToJoin;
      if (!roomId) {
        roomId = await findOrCreateMatchmakingRoom(
          currentAuth.uid,
          currentProf.displayName,
          createSpeed,
          createDifficulty
        );
      }

      // Add user to room members
      const memberColor = PLAYER_COLORS[roomMembers.length % PLAYER_COLORS.length];
      const member: RoomMember = {
        memberId: currentAuth.uid,
        displayName: currentProf.displayName,
        isBot: false,
        character: currentProf.selectedCharacter,
        vehicle: currentProf.selectedVehicle,
        isReady: true,
        color: memberColor,
        score: 0,
        paintCount: 0,
        paintPercent: 0,
      };

      await joinRoomMember(roomId, member);

      // Set room
      setCurrentRoom({
        roomId,
        roomName: `Sirkuit ${currentProf.displayName}`,
        hostId: currentAuth.uid,
        status: 'waiting',
        gameSpeed: createSpeed,
        botDifficulty: createDifficulty,
        maxPlayers: 8,
        currentPlayersCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Matchmaking failed:', e);
      alert('Gagal bergabung ke room. Silakan coba lagi!');
    } finally {
      setIsMatchmaking(false);
    }
  };

  const handleCreateCustomRoom = async () => {
    soundManager.playClick();
    let currentAuth = authUser;
    let currentProf = playerProfile;

    if (!currentAuth || !currentProf) {
      try {
        const loggedIn = await loginWithGoogle();
        currentAuth = {
          uid: loggedIn.uid,
          displayName: loggedIn.displayName || 'Pembalap Google',
          photoURL: loggedIn.photoURL,
          isAnonymous: false,
        };
        const fetched = await getPlayerProfile(loggedIn.uid);
        if (fetched) {
          currentProf = fetched;
        } else {
          currentProf = {
            userId: loggedIn.uid,
            displayName: loggedIn.displayName || 'Pembalap Google',
            totalScore: 0,
            totalWins: 0,
            totalRaces: 0,
            highPaintPercent: 0,
            selectedCharacter: '🦁',
            selectedVehicle: '🦖',
            createdAt: new Date().toISOString(),
          };
          await savePlayerProfile(currentProf);
        }
        setAuthUser(currentAuth);
        setPlayerProfile(currentProf);
      } catch (e) {
        console.warn('Sign-in required to host room:', e);
        return;
      }
    }

    setIsMatchmaking(true);

    try {
      const roomId = await createGameRoom(
        currentAuth.uid,
        currentProf.displayName,
        createSpeed,
        createDifficulty
      );
      await handleJoinOrCreateRoom(roomId);
    } catch (e) {
      console.warn('Create room error:', e);
    } finally {
      setIsMatchmaking(false);
    }
  };

  const handlePlaySoloPractice = () => {
    soundManager.playClick();
    const guestId = playerProfile?.userId || 'solo_player';
    const guestName = playerProfile?.displayName || 'Pembalap Gemoy';
    const guestChar = playerProfile?.selectedCharacter || '🦁';
    const guestVeh = playerProfile?.selectedVehicle || '🦖';

    const playerMember: RoomMember = {
      memberId: guestId,
      displayName: guestName,
      isBot: false,
      character: guestChar,
      vehicle: guestVeh,
      isReady: true,
      color: PLAYER_COLORS[0],
      score: 0,
      paintCount: 0,
      paintPercent: 0,
    };

    const botMembers: RoomMember[] = Array.from({ length: 7 }).map((_, i) => ({
      memberId: `bot_solo_${i}`,
      displayName: BOT_NAMES[i % BOT_NAMES.length],
      isBot: true,
      character: CHARACTERS[(i + 1) % CHARACTERS.length].emoji,
      vehicle: VEHICLES[(i + 2) % VEHICLES.length].emoji,
      isReady: true,
      color: PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length],
      score: 0,
      paintCount: 0,
      paintPercent: 0,
    }));

    const soloRoom: GameRoom = {
      roomId: 'SOLO_' + Math.floor(Math.random() * 900 + 100),
      roomName: `Sirkuit Solo ${guestName}`,
      hostId: guestId,
      status: 'playing',
      gameSpeed: createSpeed,
      botDifficulty: createDifficulty,
      maxPlayers: 8,
      currentPlayersCount: 8,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setRoomMembers([playerMember, ...botMembers]);
    setCurrentRoom(soloRoom);
  };

  const handleLeaveRoom = async () => {
    if (currentRoom) {
      soundManager.playClick();
      if (authUser && !currentRoom.roomId.startsWith('SOLO_')) {
        await leaveRoomMember(currentRoom.roomId, authUser.uid).catch((e) => console.warn(e));
      }
      setCurrentRoom(null);
    }
  };

  const handleStartGame = async () => {
    if (!currentRoom) return;
    soundManager.playClick();
    await updateRoomSettings(currentRoom.roomId, { status: 'playing' });
  };

  // Profile Customization
  const handleSavePicker = async (char: typeof CHARACTERS[0], veh: typeof VEHICLES[0]) => {
    if (!playerProfile) return;
    const updated: PlayerProfile = {
      ...playerProfile,
      selectedCharacter: char.emoji,
      selectedVehicle: veh.emoji,
    };
    setPlayerProfile(updated);
    await savePlayerProfile(updated);

    // If currently in a room, update room member profile too
    if (currentRoom && authUser) {
      await joinRoomMember(currentRoom.roomId, {
        memberId: authUser.uid,
        displayName: updated.displayName,
        isBot: false,
        character: updated.selectedCharacter,
        vehicle: updated.selectedVehicle,
        isReady: true,
        color: PLAYER_COLORS[0],
        score: 0,
        paintCount: 0,
        paintPercent: 0,
      });
    }
  };

  // Find current user's room member object
  const currentMemberId = authUser?.uid || playerProfile?.userId || 'solo_player';
  const currentUserMember =
    roomMembers.find((m) => m.memberId === currentMemberId) ||
    roomMembers.find((m) => !m.isBot) || {
      memberId: currentMemberId,
      displayName: playerProfile?.displayName || 'Pembalap',
      isBot: false,
      character: playerProfile?.selectedCharacter || '🦁',
      vehicle: playerProfile?.selectedVehicle || '🦖',
      isReady: true,
      color: PLAYER_COLORS[0],
      score: 0,
      paintCount: 0,
      paintPercent: 0,
    };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* Top Navigation */}
      <Navbar
        playerProfile={playerProfile}
        authUser={authUser}
        onLoginGoogle={handleGoogleLogin}
        onLogout={handleLogout}
        onOpenLeaderboard={() => setShowLeaderboardModal(true)}
        onOpenInvites={() => setShowInvitesModal(true)}
        onOpenPicker={() => setShowPickerModal(true)}
        pendingInvitesCount={gameInvites.length}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        muted={muted}
        onToggleMute={() => {
          const next = !muted;
          setMuted(next);
          soundManager.setMuted(next);
        }}
      />

      {/* Floating Push Notification Toast */}
      {notificationBanner && (
        <div className="fixed top-16 right-4 z-50 p-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-top-4 duration-300">
          <span>{notificationBanner}</span>
          <button
            onClick={() => setShowInvitesModal(true)}
            className="px-2 py-1 bg-slate-950 text-amber-400 rounded-lg text-[10px] uppercase font-bold"
          >
            Lihat
          </button>
        </div>
      )}

      {/* Main Content View Switcher */}
      <main className="flex-1 flex flex-col items-center justify-center">
        {currentRoom?.status === 'playing' ? (
          /* 1. PLAYING IN-GAME CANVAS VIEW */
          <CityConnectionCanvas
            room={currentRoom}
            currentUserMember={currentUserMember}
            allMembers={roomMembers}
            liveStates={liveStates}
            playerProfile={playerProfile}
            onGameEnd={() => {
              // Game ended
            }}
            onExitToLobby={async () => {
              soundManager.playClick();
              if (currentRoom.roomId.startsWith('SOLO_')) {
                setCurrentRoom(null);
              } else if (currentRoom.hostId === authUser?.uid) {
                await updateRoomSettings(currentRoom.roomId, { status: 'waiting' });
              } else {
                setCurrentRoom(null);
              }
            }}
            isDarkMode={isDarkMode}
          />
        ) : currentRoom?.status === 'waiting' ? (
          /* 2. LOBBY VIEW */
          <LobbyRoom
            room={currentRoom}
            currentUserMember={currentUserMember}
            allMembers={roomMembers}
            chatMessages={chatMessages}
            onStartGame={handleStartGame}
            onLeaveRoom={handleLeaveRoom}
            onOpenPicker={() => setShowPickerModal(true)}
            isDarkMode={isDarkMode}
          />
        ) : (
          /* 3. HOME & MATCHMAKING SCREEN */
          <div className="w-full max-w-5xl px-4 py-8 flex flex-col items-center gap-8">
            {/* Hero Arcade Banner */}
            <div className="w-full text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Game Balap Arena Platformer Seru</span>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold font-['Press_Start_2P'] tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-500 drop-shadow-md leading-relaxed sm:leading-tight">
                MINI BALAP GEMOY
              </h1>

              <p className="text-sm sm:text-base text-slate-400 max-w-xl mt-3 leading-relaxed">
                Cat seluruh jalan raya sirkuit bertingkat! Lompat antar tingkat, lempari lawan dengan kaleng oli, dan gunakan kemampuan unik tunggangan emoji bersama 8 pemain!
              </p>
            </div>

            {/* Current Character & Mount Showcase Card */}
            {playerProfile && (
              <div
                className={`w-full max-w-md p-4 rounded-2xl border flex items-center justify-between shadow-xl transition ${
                  isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center">
                    <span className="text-3xl absolute -top-1">{playerProfile.selectedCharacter}</span>
                    <span className="text-3xl absolute bottom-0">{playerProfile.selectedVehicle}</span>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Kombinasi Pembalap</div>
                    <div className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                      <span>{playerProfile.displayName}</span>
                    </div>
                    <div className="text-xs text-amber-400 font-mono mt-0.5">
                      {playerProfile.totalScore} Poin • {playerProfile.totalWins} Menang
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowPickerModal(true)}
                  className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Kustomisasi</span>
                </button>
              </div>
            )}

            {/* Solo Practice Instant Play Banner */}
            <div className="w-full max-w-2xl">
              <button
                onClick={handlePlaySoloPractice}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 hover:from-emerald-500/30 hover:to-cyan-500/30 border border-emerald-500/40 text-left transition flex items-center justify-between group shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl border border-emerald-500/30">
                    🎮
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-['Press_Start_2P'] text-xs font-bold text-emerald-400">
                        MODE LATIHAN SOLO (OFFLINE)
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        Langsung Main
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 mt-1">
                      Balapan langsung melawan 7 AI Bot cerdas di sirkuit bertingkat tanpa perlu login!
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 rounded-xl bg-emerald-500 group-hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow transition whitespace-nowrap">
                  Main Sekarang
                </div>
              </button>
            </div>

            {/* Matchmaking & Room Options Grid */}
            <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card 1: Quick Auto Matchmaking */}
              <div
                className={`p-6 rounded-2xl border shadow-xl flex flex-col justify-between relative overflow-hidden group transition ${
                  isDarkMode
                    ? 'bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border-amber-500/30'
                    : 'bg-white border-amber-300'
                }`}
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3 text-2xl border border-amber-500/30">
                    ⚡
                  </div>
                  <h3 className="text-base font-bold font-['Press_Start_2P'] text-amber-400 mb-1">
                    CARI LAWAN CEPAT
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sistem matchmaking otomatis akan langsung mencarikan room aktif atau membuatkan arena baru untuk Anda.
                  </p>
                </div>

                <button
                  onClick={() => handleJoinOrCreateRoom()}
                  disabled={isMatchmaking}
                  className="w-full mt-5 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>{isMatchmaking ? 'Mencari Sirkuit...' : 'GABUNG SEKARANG'}</span>
                </button>
              </div>

              {/* Card 2: Custom Room Host */}
              <div
                className={`p-6 rounded-2xl border shadow-xl flex flex-col justify-between transition ${
                  isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3 text-2xl border border-cyan-500/30">
                    🛠️
                  </div>
                  <h3 className="text-base font-bold font-['Press_Start_2P'] text-cyan-400 mb-1">
                    BUAT ROOM BARU
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    Atur kecepatan permainan dan tingkat kesulitan bot lawan sesuai preferensi Anda.
                  </p>

                  {/* Settings selectors */}
                  <div className="flex flex-col gap-2 mb-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Kecepatan:</span>
                      <div className="flex gap-1">
                        {([1, 1.5, 2] as GameSpeed[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => setCreateSpeed(s)}
                            className={`px-2 py-1 rounded text-[10px] font-bold ${
                              createSpeed === s
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Bot Lawan:</span>
                      <div className="flex gap-1">
                        {(['easy', 'medium', 'hard'] as BotDifficulty[]).map((d) => (
                          <button
                            key={d}
                            onClick={() => setCreateDifficulty(d)}
                            className={`px-2 py-1 rounded text-[10px] font-bold capitalize ${
                              createDifficulty === d
                                ? 'bg-cyan-500 text-slate-950'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {d === 'easy' ? 'Mudah' : d === 'medium' ? 'Sedang' : 'Sulit'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateCustomRoom}
                  disabled={isMatchmaking}
                  className="w-full mt-3 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-700 transition flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4 text-cyan-400" />
                  <span>Buat Room Kustom</span>
                </button>
              </div>
            </div>

            {/* Join with Code Bar */}
            <div
              className={`w-full max-w-md p-2 rounded-2xl border flex items-center gap-2 shadow-lg ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="pl-3 text-slate-400">
                <Hash className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="Punya Kode Room Teman?"
                maxLength={8}
                className="flex-1 bg-transparent text-xs font-mono uppercase text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                onClick={() => handleJoinOrCreateRoom(joinCodeInput.trim())}
                disabled={!joinCodeInput.trim() || isMatchmaking}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-xs transition"
              >
                Masuk
              </button>
            </div>

            {/* Gameplay Features Infobox */}
            <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              <div
                className={`p-3 rounded-xl border ${
                  isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <div className="text-xl mb-1">🎮</div>
                <div className="font-bold text-amber-400">Sirkuit Bertingkat</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Cat 4 tingkat jalan raya!</div>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <div className="text-xl mb-1">🛢️</div>
                <div className="font-bold text-cyan-400">Kaleng Oli</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Putar & gagalkan musuh!</div>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <div className="text-xl mb-1">🤖</div>
                <div className="font-bold text-emerald-400">Bot Adaptif</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Lobi otomatis terisi 8 racer</div>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  isDarkMode ? 'bg-slate-900/40 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <div className="text-xl mb-1">🏆</div>
                <div className="font-bold text-orange-400">Peringkat Global</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Simpan progres permanen</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showPickerModal && playerProfile && (
        <CharacterVehiclePickerModal
          selectedCharacterId={
            CHARACTERS.find((c) => c.emoji === playerProfile.selectedCharacter)?.id || 'lion'
          }
          selectedVehicleId={
            VEHICLES.find((v) => v.emoji === playerProfile.selectedVehicle)?.id || 'trex'
          }
          onSave={handleSavePicker}
          onClose={() => setShowPickerModal(false)}
          isDarkMode={isDarkMode}
        />
      )}

      {showLeaderboardModal && (
        <LeaderboardModal
          onClose={() => setShowLeaderboardModal(false)}
          currentUserId={authUser?.uid}
          isDarkMode={isDarkMode}
        />
      )}

      {showInvitesModal && (
        <FriendInviteModal
          invites={gameInvites}
          onJoinRoom={(code) => handleJoinOrCreateRoom(code)}
          onClose={() => setShowInvitesModal(false)}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
