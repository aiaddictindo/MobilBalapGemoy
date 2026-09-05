import React, { useState } from 'react';
import { X, Bell, BellRing, Copy, Check, Users, ArrowRight } from 'lucide-react';
import type { GameInvite } from '../types';
import { soundManager } from '../audio';

interface Props {
  invites: GameInvite[];
  onJoinRoom: (roomId: string) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

export const FriendInviteModal: React.FC<Props> = ({
  invites,
  onJoinRoom,
  onClose,
  isDarkMode,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission === 'granted'
      : false
  );
  const [manualCode, setManualCode] = useState('');

  const requestNotificationPermission = async () => {
    soundManager.playClick();
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setHasPermission(permission === 'granted');
      if (permission === 'granted') {
        new Notification('Mini Balap Gemoy', {
          body: 'Notifikasi undangan teman berhasil diaktifkan! 🏁',
          icon: '/favicon.ico',
        });
      }
    }
  };

  const handleManualJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim().toUpperCase();
    if (clean) {
      soundManager.playClick();
      onJoinRoom(clean);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col ${
          isDarkMode
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold font-['Press_Start_2P'] text-cyan-400">
              UNDANGAN TEMAN
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Push Notification Permission Box */}
        <div className="p-4 bg-cyan-500/10 border-b border-cyan-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              {hasPermission ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">Notifikasi Push Browser</div>
              <div className="text-[11px] text-slate-400">
                {hasPermission
                  ? 'Notifikasi aktif! Anda akan diberitahu jika ada undangan.'
                  : 'Aktifkan agar tahu saat teman mengundang balapan.'}
              </div>
            </div>
          </div>

          {!hasPermission && (
            <button
              onClick={requestNotificationPermission}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition shadow whitespace-nowrap"
            >
              Aktifkan
            </button>
          )}
        </div>

        {/* Join by Room Code Form */}
        <form onSubmit={handleManualJoin} className="p-4 border-b border-slate-800 flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="Ketik Kode Room (contoh: AB12CD)"
            maxLength={8}
            className="flex-1 bg-slate-800/80 text-white placeholder-slate-400 text-xs px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono uppercase"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition shadow flex items-center gap-1"
          >
            <span>Gabung</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Live Incoming Invites List */}
        <div className="p-4 overflow-y-auto max-h-60 flex flex-col gap-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Undangan Balapan Terkini ({invites.length})
          </div>

          {invites.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              Belum ada undangan masuk. Bagikan kode room Anda kepada teman untuk bermain bersama!
            </div>
          ) : (
            invites.map((inv) => (
              <div
                key={inv.inviteId}
                className="p-3 rounded-xl border border-slate-800 bg-slate-800/40 flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>{inv.senderName}</span>
                    <span className="text-[10px] text-slate-400">mengundang Anda</span>
                  </div>
                  <div className="text-[11px] text-amber-400 font-mono">
                    Room: {inv.roomName} ({inv.roomId})
                  </div>
                </div>

                <button
                  onClick={() => {
                    soundManager.playClick();
                    onJoinRoom(inv.roomId);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow"
                >
                  Masuk Balap
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
