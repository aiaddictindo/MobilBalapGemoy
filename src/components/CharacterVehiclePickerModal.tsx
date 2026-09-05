import React, { useState } from 'react';
import { X, Check, Zap, Gauge, ArrowUpCircle } from 'lucide-react';
import { CHARACTERS, VEHICLES, type CharacterInfo, type VehicleInfo } from '../types';
import { soundManager } from '../audio';

interface Props {
  selectedCharacterId: string;
  selectedVehicleId: string;
  onSave: (char: CharacterInfo, veh: VehicleInfo) => void;
  onClose: () => void;
  isDarkMode: boolean;
}

export const CharacterVehiclePickerModal: React.FC<Props> = ({
  selectedCharacterId,
  selectedVehicleId,
  onSave,
  onClose,
  isDarkMode,
}) => {
  const [tab, setTab] = useState<'char' | 'veh'>('char');
  const [currentCharId, setCurrentCharId] = useState(selectedCharacterId);
  const [currentVehId, setCurrentVehId] = useState(selectedVehicleId);

  const activeChar = CHARACTERS.find((c) => c.id === currentCharId) || CHARACTERS[0];
  const activeVeh = VEHICLES.find((v) => v.id === currentVehId) || VEHICLES[0];

  const handleConfirm = () => {
    soundManager.playClick();
    onSave(activeChar, activeVeh);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          isDarkMode
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700/40 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-['Press_Start_2P'] text-amber-500 text-xs sm:text-sm">
              PILIH KARAKTER & KENDARAAN
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Kombinasikan karakter gemoy dengan tunggangan berkemampuan unik!
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Preview Hero */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-cyan-500/10 border-b border-slate-700/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-2xl bg-slate-800/80 border border-slate-600 flex items-center justify-center shadow-inner">
              <span className="text-4xl absolute -top-1">{activeChar.emoji}</span>
              <span className="text-4xl absolute bottom-1">{activeVeh.emoji}</span>
            </div>
            <div>
              <div className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <span>{activeChar.name}</span>
                <span className="text-xs text-slate-400">naik</span>
                <span>{activeVeh.name}</span>
              </div>
              <div className="text-xs text-slate-300 font-medium mt-0.5">
                ✨ <span className="text-cyan-400 font-semibold">{activeVeh.skillName}</span>: {activeVeh.skillDesc}
              </div>
              <div className="text-[11px] text-emerald-400 mt-0.5">
                🎯 {activeChar.trait}
              </div>
            </div>
          </div>

          {/* Quick Vehicle Stats */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                <Gauge className="w-3 h-3 text-amber-400" />
                <span>KECEPATAN</span>
              </div>
              <div className="flex gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div
                    key={s}
                    className={`w-2.5 h-1.5 rounded-sm ${
                      s <= activeVeh.speed ? 'bg-amber-400' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                <Zap className="w-3 h-3 text-cyan-400" />
                <span>AKSELERASI</span>
              </div>
              <div className="flex gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div
                    key={s}
                    className={`w-2.5 h-1.5 rounded-sm ${
                      s <= activeVeh.accel ? 'bg-cyan-400' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                <ArrowUpCircle className="w-3 h-3 text-emerald-400" />
                <span>LOMPATAN</span>
              </div>
              <div className="flex gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div
                    key={s}
                    className={`w-2.5 h-1.5 rounded-sm ${
                      s <= activeVeh.jump ? 'bg-emerald-400' : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="px-6 pt-3 flex border-b border-slate-700/40 gap-2">
          <button
            onClick={() => { soundManager.playClick(); setTab('char'); }}
            className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              tab === 'char'
                ? 'border-amber-500 text-amber-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Karakter ({CHARACTERS.length})</span>
          </button>
          <button
            onClick={() => { soundManager.playClick(); setTab('veh'); }}
            className={`pb-2.5 px-4 font-bold text-xs uppercase tracking-wider transition border-b-2 flex items-center gap-2 ${
              tab === 'veh'
                ? 'border-cyan-500 text-cyan-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Kendaraan Tunggangan ({VEHICLES.length})</span>
          </button>
        </div>

        {/* Grid List */}
        <div className="p-6 overflow-y-auto flex-1">
          {tab === 'char' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {CHARACTERS.map((char) => {
                const isSelected = char.id === currentCharId;
                return (
                  <button
                    key={char.id}
                    onClick={() => {
                      soundManager.playClick();
                      setCurrentCharId(char.id);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col items-center text-center relative ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/40'
                        : isDarkMode
                        ? 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                    <span className="text-4xl my-1">{char.emoji}</span>
                    <div className="font-bold text-sm text-slate-200">{char.name}</div>
                    <div className="text-[11px] text-amber-400/90 font-medium">{char.trait}</div>
                    <div className="text-[10px] text-slate-400 italic mt-1">"{char.quote}"</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {VEHICLES.map((veh) => {
                const isSelected = veh.id === currentVehId;
                return (
                  <button
                    key={veh.id}
                    onClick={() => {
                      soundManager.playSkillSound(veh.soundFreq);
                      setCurrentVehId(veh.id);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between relative ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/15 ring-2 ring-cyan-500/40'
                        : isDarkMode
                        ? 'border-slate-800 bg-slate-800/40 hover:bg-slate-800'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl">{veh.emoji}</span>
                      <div>
                        <div className="font-bold text-sm text-slate-200">{veh.name}</div>
                        <div className="text-[10px] text-slate-400">{veh.category}</div>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-950/40 border border-slate-800 text-[11px] mb-2">
                      <div className="text-cyan-300 font-bold flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span>{veh.skillName}</span>
                      </div>
                      <div className="text-slate-300 text-[10px] mt-0.5">{veh.skillDesc}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-400 text-center">
                      <div>Kec: {veh.speed}/5</div>
                      <div>Aks: {veh.accel}/5</div>
                      <div>Lom: {veh.jump}/5</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700/40 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white transition"
          >
            Batal
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-md transition"
          >
            Gunakan Kombinasi Ini
          </button>
        </div>
      </div>
    </div>
  );
};
