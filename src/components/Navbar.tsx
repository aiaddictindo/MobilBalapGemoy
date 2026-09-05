import React from 'react';
import {
  Trophy,
  Bell,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  LogIn,
  LogOut,
  User,
  Sparkles,
} from 'lucide-react';
import type { PlayerProfile } from '../types';
import { soundManager } from '../audio';

interface Props {
  playerProfile: PlayerProfile | null;
  authUser: { displayName: string | null; photoURL: string | null; isAnonymous: boolean } | null;
  onLoginGoogle: () => void;
  onLogout: () => void;
  onOpenLeaderboard: () => void;
  onOpenInvites: () => void;
  onOpenPicker: () => void;
  pendingInvitesCount: number;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export const Navbar: React.FC<Props> = ({
  playerProfile,
  authUser,
  onLoginGoogle,
  onLogout,
  onOpenLeaderboard,
  onOpenInvites,
  onOpenPicker,
  pendingInvitesCount,
  isDarkMode,
  onToggleDarkMode,
  muted,
  onToggleMute,
}) => {
  return (
    <header
      className={`w-full max-w-full overflow-hidden px-2 sm:px-4 py-2 sm:py-3 border-b sticky top-0 z-40 backdrop-blur-md transition-colors ${
        isDarkMode
          ? 'bg-slate-950/85 border-slate-800 text-slate-100'
          : 'bg-white/90 border-slate-200 text-slate-800 shadow-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3 w-full min-w-0">
        {/* Brand Logo */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-base sm:text-xl shadow-md shrink-0">
            🏁
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-['Press_Start_2P'] text-[10px] sm:text-xs md:text-sm font-bold text-amber-500 tracking-tight truncate">
                MINI BALAP
              </span>
              <span className="hidden md:inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[9px] font-bold uppercase">
                Arcade
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium hidden lg:block truncate">
              Balapan Arena Multiplayer • 8 Pemain Real-Time
            </div>
          </div>
        </div>

        {/* Action Controls & Profile */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Character Quick Selection Preview */}
          {playerProfile && (
            <button
              onClick={() => {
                soundManager.playClick();
                onOpenPicker();
              }}
              className={`px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl border flex items-center gap-1 sm:gap-1.5 transition hover:scale-105 active:scale-95 shrink-0 ${
                isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300'
              }`}
              title="Ganti Karakter & Kendaraan"
            >
              <div className="flex items-center text-base sm:text-lg">
                <span>{playerProfile.selectedCharacter || '🦁'}</span>
                <span className="text-xs sm:text-sm">{playerProfile.selectedVehicle || '🦖'}</span>
              </div>
              <Sparkles className="w-3 h-3 text-amber-400" />
            </button>
          )}

          {/* Leaderboard Button */}
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenLeaderboard();
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-amber-400 transition border border-slate-700/60 shrink-0"
            title="Papan Peringkat Global"
          >
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Invites & Push Notification Button */}
          <button
            onClick={() => {
              soundManager.playClick();
              onOpenInvites();
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-cyan-400 transition relative border border-slate-700/60 shrink-0"
            title="Undangan Teman & Notifikasi"
          >
            <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {pendingInvitesCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-red-500 text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center animate-pulse">
                {pendingInvitesCount}
              </span>
            )}
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={() => {
              soundManager.playClick();
              onToggleMute();
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition border border-slate-700/60 shrink-0"
            title={muted ? 'Nyalakan Audio' : 'Bisukan Audio'}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => {
              soundManager.playClick();
              onToggleDarkMode();
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition border border-slate-700/60 shrink-0"
            title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />}
          </button>

          {/* Google Auth / Profile Button */}
          {authUser && !authUser.isAnonymous ? (
            <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 border-l border-slate-700/60 shrink-0">
              <div className="flex items-center gap-1">
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt={authUser.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-amber-500 shrink-0 object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold border border-amber-500/50 shrink-0">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                )}
                <div className="hidden lg:block text-left max-w-[90px]">
                  <div className="text-xs font-bold text-slate-200 truncate">
                    {authUser.displayName}
                  </div>
                  <div className="text-[9px] text-amber-400 font-mono">
                    {playerProfile?.totalScore || 0} pts
                  </div>
                </div>
              </div>

              {/* Dedicated Google Logout Button with explicit feedback */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  soundManager.playClick();
                  onLogout();
                }}
                className="px-2 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/40 text-red-400 border border-red-500/30 transition flex items-center gap-1 shrink-0 font-sans"
                title="Keluar dari akun Google"
                aria-label="Keluar dari akun Google"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[10px] sm:text-xs font-bold hidden sm:inline">Keluar</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                soundManager.playClick();
                onLoginGoogle();
              }}
              className="px-2 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold transition shadow flex items-center gap-1.5 shrink-0"
              title="Masuk dengan Akun Google"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span className="text-[11px] sm:text-xs">Masuk</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
