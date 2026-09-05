import React, { useEffect, useState } from 'react';
import { X, Trophy, Medal, Award, Flame, RefreshCw } from 'lucide-react';
import type { PlayerProfile } from '../types';
import { getGlobalLeaderboard } from '../firebase';
import { soundManager } from '../audio';

interface Props {
  onClose: () => void;
  currentUserId?: string;
  isDarkMode: boolean;
}

export const LeaderboardModal: React.FC<Props> = ({
  onClose,
  currentUserId,
  isDarkMode,
}) => {
  const [leaders, setLeaders] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaders = async () => {
    setLoading(true);
    try {
      const list = await getGlobalLeaderboard(25);
      // If list is small/empty on fresh database, provide initial hall of fame champions so the UI looks active
      if (list.length === 0) {
        setLeaders([
          {
            userId: 'champ1',
            displayName: 'Raja_Aspal_Gemoy',
            selectedCharacter: '🦁',
            selectedVehicle: '🦖',
            totalScore: 4850,
            totalWins: 18,
            totalRaces: 22,
            highPaintPercent: 100,
          },
          {
            userId: 'champ2',
            displayName: 'Kucing_Oren_Barbar',
            selectedCharacter: '🐱',
            selectedVehicle: '🐈',
            totalScore: 4120,
            totalWins: 14,
            totalRaces: 19,
            highPaintPercent: 96,
          },
          {
            userId: 'champ3',
            displayName: 'Panda_Speedy',
            selectedCharacter: '🐼',
            selectedVehicle: '🐅',
            totalScore: 3650,
            totalWins: 11,
            totalRaces: 16,
            highPaintPercent: 92,
          },
          {
            userId: 'champ4',
            displayName: 'Serigala_Malam',
            selectedCharacter: '🐺',
            selectedVehicle: '🐇',
            totalScore: 2980,
            totalWins: 9,
            totalRaces: 15,
            highPaintPercent: 88,
          },
        ]);
      } else {
        setLeaders(list);
      }
    } catch (e) {
      console.warn('Leaderboard fetch fallback:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaders();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] ${
          isDarkMode
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm sm:text-base font-bold font-['Press_Start_2P'] text-amber-400">
              PAPAN PERINGKAT GLOBAL
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundManager.playClick();
                fetchLeaders();
              }}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top 3 Podium Visual */}
        {leaders.length >= 3 && (
          <div className="px-6 py-4 bg-gradient-to-b from-amber-500/10 to-transparent border-b border-slate-800 flex items-end justify-center gap-4 text-center">
            {/* 2nd Place */}
            <div className="flex flex-col items-center">
              <div className="relative mb-1">
                <span className="text-3xl">{leaders[1].selectedCharacter || '🐱'}</span>
                <span className="text-2xl absolute -bottom-1 -right-2">{leaders[1].selectedVehicle || '🐈'}</span>
              </div>
              <div className="text-xs font-bold text-slate-300 truncate max-w-[90px]">{leaders[1].displayName}</div>
              <div className="text-[10px] text-slate-400 font-mono">{leaders[1].totalScore} pts</div>
              <div className="w-20 h-14 bg-slate-700/60 rounded-t-lg mt-1 flex items-center justify-center text-sm font-bold text-slate-300">
                🥈 2
              </div>
            </div>

            {/* 1st Place Champion */}
            <div className="flex flex-col items-center -mt-4">
              <div className="relative mb-1">
                <div className="text-xs mb-0.5 animate-bounce">👑</div>
                <span className="text-4xl">{leaders[0].selectedCharacter || '🦁'}</span>
                <span className="text-3xl absolute -bottom-1 -right-2">{leaders[0].selectedVehicle || '🦖'}</span>
              </div>
              <div className="text-xs font-bold text-amber-400 truncate max-w-[100px]">{leaders[0].displayName}</div>
              <div className="text-[11px] text-amber-300 font-mono font-bold">{leaders[0].totalScore} pts</div>
              <div className="w-24 h-20 bg-amber-500/30 border-t-2 border-amber-400 rounded-t-lg mt-1 flex items-center justify-center text-base font-bold text-amber-400">
                🥇 1
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center">
              <div className="relative mb-1">
                <span className="text-3xl">{leaders[2].selectedCharacter || '🐼'}</span>
                <span className="text-2xl absolute -bottom-1 -right-2">{leaders[2].selectedVehicle || '🐅'}</span>
              </div>
              <div className="text-xs font-bold text-slate-300 truncate max-w-[90px]">{leaders[2].displayName}</div>
              <div className="text-[10px] text-slate-400 font-mono">{leaders[2].totalScore} pts</div>
              <div className="w-20 h-10 bg-amber-900/30 rounded-t-lg mt-1 flex items-center justify-center text-sm font-bold text-amber-600">
                🥉 3
              </div>
            </div>
          </div>
        )}

        {/* Full List */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2">
          {leaders.map((player, index) => {
            const isMe = currentUserId === player.userId;
            return (
              <div
                key={player.userId}
                className={`px-4 py-2.5 rounded-xl border flex items-center justify-between transition ${
                  isMe
                    ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/40'
                    : isDarkMode
                    ? 'border-slate-800 bg-slate-800/30 hover:bg-slate-800/60'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 text-center font-bold text-xs font-mono text-slate-400">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </div>
                  <div className="flex items-center gap-1.5 text-xl">
                    <span>{player.selectedCharacter || '🦁'}</span>
                    <span className="text-base">{player.selectedVehicle || '🦖'}</span>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                      <span>{player.displayName}</span>
                      {isMe && <span className="text-[9px] px-1 bg-amber-500 text-slate-950 rounded font-bold">Anda</span>}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {player.totalWins || 0} Menang • {player.totalRaces || 0} Balapan
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="text-xs font-bold text-amber-400">{player.totalScore || 0} PTS</div>
                  <div className="text-[10px] text-emerald-400">{player.highPaintPercent || 0}% Cat Tertinggi</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 text-center text-xs text-slate-400">
          Tingkatkan skormu dengan mengecat seluruh aspal dan kalahkan pembalap lain!
        </div>
      </div>
    </div>
  );
};
