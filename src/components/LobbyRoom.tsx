import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Play,
  Share2,
  Copy,
  Check,
  Send,
  Sparkles,
  Bot,
  Gauge,
  Sliders,
  LogOut,
  Smile,
  ShieldAlert,
} from 'lucide-react';
import type {
  GameRoom,
  RoomMember,
  RoomChatMessage,
  GameSpeed,
  BotDifficulty,
} from '../types';
import { CHARACTERS, VEHICLES, BOT_NAMES, PLAYER_COLORS } from '../types';
import { soundManager } from '../audio';
import {
  updateRoomSettings,
  joinRoomMember,
  sendChatMessage,
  sendFriendInvite,
} from '../firebase';

interface Props {
  room: GameRoom;
  currentUserMember: RoomMember;
  allMembers: RoomMember[];
  chatMessages: RoomChatMessage[];
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onOpenPicker: () => void;
  isDarkMode: boolean;
}

const QUICK_EMOJIS = ['🏁 Balap yuk!', '🔥 Gaspol!', '🛢️ Awas oli!', '🐱 Meong!', '⚡ Nitro siap!'];

export const LobbyRoom: React.FC<Props> = ({
  room,
  currentUserMember,
  allMembers,
  chatMessages,
  onStartGame,
  onLeaveRoom,
  onOpenPicker,
  isDarkMode,
}) => {
  const [chatInput, setChatInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [botCountdown, setBotCountdown] = useState(8); // 8 second auto-bot fill
  const [autoBotActive, setAutoBotActive] = useState(false);

  const isHost = room.hostId === currentUserMember.memberId;
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll chat on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-bot fill countdown if waiting and room is not full (as requested by user!)
  useEffect(() => {
    if (allMembers.length >= 8 || room.status !== 'waiting') return;

    const timer = setInterval(() => {
      setBotCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          triggerAutoBotFill();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [allMembers.length, room.status, isHost]);

  // Fill empty slots with bots
  const triggerAutoBotFill = async () => {
    if (!isHost || autoBotActive) return;
    setAutoBotActive(true);

    const neededBots = Math.max(0, 8 - allMembers.length);
    if (neededBots <= 0) return;

    for (let i = 0; i < neededBots; i++) {
      const botIndex = (allMembers.length + i) % BOT_NAMES.length;
      const botName = BOT_NAMES[botIndex];
      const botChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].emoji;
      const botVeh = VEHICLES[Math.floor(Math.random() * VEHICLES.length)].emoji;
      const botColor = PLAYER_COLORS[(allMembers.length + i) % PLAYER_COLORS.length];

      const botMember: RoomMember = {
        memberId: `bot_${Date.now()}_${i}`,
        displayName: botName,
        isBot: true,
        character: botChar,
        vehicle: botVeh,
        isReady: true,
        color: botColor,
        score: 0,
        paintCount: 0,
        paintPercent: 0,
      };

      await joinRoomMember(room.roomId, botMember);
    }
  };

  const handleSendChat = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    soundManager.playChatPop();
    setChatInput('');

    try {
      await sendChatMessage(room.roomId, {
        senderId: currentUserMember.memberId,
        senderName: currentUserMember.displayName,
        senderAvatar: `${currentUserMember.character} ${currentUserMember.vehicle}`,
        text: trimmed,
      });
    } catch (e) {
      console.warn('Send chat error:', e);
    }
  };

  const handleCopyCode = () => {
    soundManager.playClick();
    navigator.clipboard.writeText(room.roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleBroadcastInvite = async () => {
    soundManager.playClick();
    try {
      await sendFriendInvite(
        currentUserMember.memberId,
        currentUserMember.displayName,
        room.roomId,
        room.roomName
      );
      alert('Undangan telah disiarkan ke papan teman!');
    } catch (e) {
      console.warn('Broadcast error:', e);
    }
  };

  const handleSpeedChange = async (speed: GameSpeed) => {
    if (!isHost) return;
    soundManager.playClick();
    await updateRoomSettings(room.roomId, { gameSpeed: speed });
  };

  const handleDifficultyChange = async (diff: BotDifficulty) => {
    if (!isHost) return;
    soundManager.playClick();
    await updateRoomSettings(room.roomId, { botDifficulty: diff });
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* Lobby Header Card */}
      <div
        className={`p-6 rounded-2xl border shadow-xl flex flex-wrap items-center justify-between gap-4 ${
          isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl shadow">
            🏁
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-['Press_Start_2P'] text-amber-400 text-sm sm:text-base">
                {room.roomName}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                LOBI BALAP
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
              <span>Host: {room.hostId === currentUserMember.memberId ? 'Anda' : 'Teman'}</span>
              <span>•</span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-amber-400 hover:text-amber-300 font-mono font-bold transition"
              >
                <span>KODE ROOM: {room.roomId}</span>
                {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleBroadcastInvite}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
          >
            <Share2 className="w-4 h-4 text-cyan-400" />
            <span>Undang Teman</span>
          </button>

          <button
            onClick={onLeaveRoom}
            className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition border border-red-500/30"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* Room Controls & Bot Notice */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Game Speed Setting */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-2 text-slate-300">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-amber-400" />
              <span>Kecepatan Permainan</span>
            </span>
            {isHost && <span className="text-[10px] text-amber-400 font-normal">(Atur Host)</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([1, 1.5, 2] as GameSpeed[]).map((spd) => (
              <button
                key={spd}
                disabled={!isHost}
                onClick={() => handleSpeedChange(spd)}
                className={`py-1.5 rounded-lg text-xs font-bold transition ${
                  room.gameSpeed === spd
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-50'
                }`}
              >
                {spd === 1 ? '1x Normal' : spd === 1.5 ? '1.5x Cepat' : '2x Turbo'}
              </button>
            ))}
          </div>
        </div>

        {/* Bot Difficulty Setting */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-2 text-slate-300">
            <span className="flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span>Kesulitan Bot Lawan</span>
            </span>
            {isHost && <span className="text-[10px] text-cyan-400 font-normal">(Atur Host)</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'medium', 'hard'] as BotDifficulty[]).map((diff) => (
              <button
                key={diff}
                disabled={!isHost}
                onClick={() => handleDifficultyChange(diff)}
                className={`py-1.5 rounded-lg text-xs font-bold capitalize transition ${
                  room.botDifficulty === diff
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-50'
                }`}
              >
                {diff === 'easy' ? 'Mudah' : diff === 'medium' ? 'Sedang' : 'Sulit'}
              </button>
            ))}
          </div>
        </div>

        {/* Auto Bot Banner */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-center ${
            isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200 mb-1">
            <Bot className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Sistem Bot Otomatis</span>
          </div>
          {allMembers.length < 8 ? (
            <p className="text-xs text-slate-400">
              {botCountdown > 0 ? (
                <span>
                  Mencari pemain lain... Bot otomatis aktif dalam{' '}
                  <strong className="text-amber-400">{botCountdown}s</strong>
                </span>
              ) : (
                <span className="text-emerald-400 font-medium">
                  Bot cerdas telah diaktifkan untuk melengkapi lobi 8 pemain!
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-emerald-400 font-medium">
              Lobi Penuh! 8 Pembalap siap bersaing di sirkuit arena bertingkat!
            </p>
          )}
        </div>
      </div>

      {/* Main Grid: 8 Player Slots & Chat Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 8 Player Slots */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>Daftar Pembalap ({allMembers.length} / 8)</span>
            </h2>
            <button
              onClick={onOpenPicker}
              className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ganti Karakter & Kendaraan</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, index) => {
              const member = allMembers[index];
              const isCurrentUser = member?.memberId === currentUserMember.memberId;

              if (member) {
                return (
                  <div
                    key={member.memberId}
                    className={`p-4 rounded-xl border relative flex flex-col items-center text-center transition ${
                      isCurrentUser
                        ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30'
                        : isDarkMode
                        ? 'border-slate-800 bg-slate-800/40'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    {/* Assigned Color Indicator */}
                    <div
                      className="w-3 h-3 rounded-full absolute top-2.5 left-2.5 shadow"
                      style={{ backgroundColor: member.color || PLAYER_COLORS[index] }}
                    />

                    {/* Bot or Host badge */}
                    {member.isBot ? (
                      <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">
                        BOT
                      </span>
                    ) : member.memberId === room.hostId ? (
                      <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                        HOST
                      </span>
                    ) : null}

                    {/* Emoji Avatar */}
                    <div className="relative w-14 h-14 my-2 flex items-center justify-center">
                      <span className="text-3xl absolute -top-1">{member.character}</span>
                      <span className="text-3xl absolute bottom-0">{member.vehicle}</span>
                    </div>

                    <div className="font-bold text-xs text-slate-200 truncate w-full">
                      {isCurrentUser ? '⭐ Anda' : member.displayName}
                    </div>

                    <div className="text-[10px] text-emerald-400 font-medium mt-1">
                      SIAP BALAP
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={index}
                  className={`p-4 rounded-xl border border-dashed flex flex-col items-center justify-center text-center text-slate-500 min-h-[140px] ${
                    isDarkMode ? 'border-slate-800 bg-slate-900/30' : 'border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div className="text-2xl mb-1 opacity-40">🪑</div>
                  <div className="text-xs font-semibold">Slot #{index + 1}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Menunggu pemain...</div>
                </div>
              );
            })}
          </div>

          {/* Big Start Race Button */}
          <div className="mt-2">
            {isHost ? (
              <button
                onClick={onStartGame}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-400 hover:to-red-400 text-slate-950 font-bold font-['Press_Start_2P'] text-sm sm:text-base shadow-xl hover:scale-[1.01] active:scale-[0.99] transition flex items-center justify-center gap-3"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>MULAI BALAPAN SEKARANG!</span>
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 text-center text-sm text-slate-300">
                Menunggu Host memulai balapan... Persiapkan jarimu untuk mengendalikan kendaraan!
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Real-time Lobby Chat Box */}
        <div
          className={`flex flex-col h-[420px] rounded-2xl border shadow-xl overflow-hidden ${
            isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Smile className="w-4 h-4 text-cyan-400" />
              <span>Obrolan Lobi</span>
            </span>
            <span className="text-[10px] text-slate-400">Real-Time</span>
          </div>

          {/* Chat Message List */}
          <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2 text-xs">
            {chatMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-slate-500 text-xs italic">
                Belum ada pesan. Sapa pemain lain di lobi!
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.senderId === currentUserMember.memberId;
                return (
                  <div
                    key={msg.messageId}
                    className={`flex flex-col max-w-[85%] ${
                      isMe ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                      <span>{msg.senderAvatar}</span>
                      <span className="font-semibold">{isMe ? 'Anda' : msg.senderName}</span>
                    </div>
                    <div
                      className={`px-3 py-1.5 rounded-xl ${
                        isMe
                          ? 'bg-amber-500 text-slate-950 font-medium'
                          : isDarkMode
                          ? 'bg-slate-800 text-slate-100'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Reaction Buttons */}
          <div className="px-3 py-1.5 border-t border-slate-800 bg-slate-950/20 flex items-center gap-1 overflow-x-auto no-scrollbar">
            {QUICK_EMOJIS.map((emojiText) => (
              <button
                key={emojiText}
                onClick={() => handleSendChat(emojiText)}
                className="px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-[10px] whitespace-nowrap transition"
              >
                {emojiText}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat(chatInput);
            }}
            className="p-2 border-t border-slate-800 flex items-center gap-2 bg-slate-950/40"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Tulis pesan..."
              maxLength={150}
              className="flex-1 bg-slate-800/80 text-white placeholder-slate-400 text-xs px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-xl transition shadow"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
