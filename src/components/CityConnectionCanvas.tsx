import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Shield,
  Zap,
  Volume2,
  VolumeX,
  Gauge,
  Trophy,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Flame,
} from 'lucide-react';
import type {
  GameRoom,
  RoomMember,
  RoomLiveState,
  PlayerProfile,
} from '../types';
import { CHARACTERS, VEHICLES, PLAYER_COLORS } from '../types';
import { soundManager } from '../audio';
import { syncLiveState, updateRoomSettings, savePlayerProfile } from '../firebase';

interface Props {
  room: GameRoom;
  currentUserMember: RoomMember;
  allMembers: RoomMember[];
  liveStates: Record<string, RoomLiveState>;
  playerProfile: PlayerProfile | null;
  onGameEnd: (winner: RoomMember) => void;
  onExitToLobby: () => void;
  isDarkMode: boolean;
}

interface RoadTile {
  id: number;
  tier: number; // 0 to 3
  x: number;
  width: number;
  paintedBy: string | null; // memberId
  color: string | null;
}

interface OilCan {
  id: number;
  x: number;
  tier: number;
  collected: boolean;
  respawnTimer?: number;
}

interface ThrownOil {
  id: number;
  x: number;
  y: number;
  vx: number;
  tier: number;
  thrownBy: string;
  life?: number;
}

interface PolicePatrol {
  id: number;
  x: number;
  tier: number;
  vx: number;
  direction: number;
  isSpun: boolean;
  spinTimer: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

const TRACK_WIDTH = 1800;
const CANVAS_HEIGHT = 480;
const TIER_Y = [390, 290, 190, 90]; // Tiers 0, 1, 2, 3
const TILE_WIDTH = 50;

// Looping track math helpers
const loopingDistance = (x1: number, x2: number, width: number = TRACK_WIDTH): number => {
  const d = Math.abs(x1 - x2) % width;
  return d > width / 2 ? width - d : d;
};

export const CityConnectionCanvas: React.FC<Props> = ({
  room,
  currentUserMember,
  allMembers,
  liveStates,
  playerProfile,
  onGameEnd,
  onExitToLobby,
  isDarkMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Audio mute state
  const [muted, setMuted] = useState(soundManager.isMuted);

  // Player local state
  const [localOilCount, setLocalOilCount] = useState(3);
  const [skillCooldownLeft, setSkillCooldownLeft] = useState(0);
  const [shieldActive, setShieldActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(90); // 90 second race
  const [totalPaintedPercent, setTotalPaintedPercent] = useState(0);
  const [localRank, setLocalRank] = useState(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winnerMember, setWinnerMember] = useState<RoomMember | null>(null);

  // Keyboard state
  const keysRef = useRef<{
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    skill: boolean;
    oil: boolean;
  }>({
    left: false,
    right: false,
    up: false,
    down: false,
    skill: false,
    oil: false,
  });

  // Local physics entity for current player
  const playerEntityRef = useRef({
    x: 100,
    y: TIER_Y[0] - 24,
    tier: 0,
    vx: 0,
    vy: 0,
    direction: 1, // 1 = right, -1 = left
    isJumping: false,
    isSpinning: false,
    spinTime: 0,
    jumpHold: 0,
    score: 0,
    paintCount: 0,
    cameraX: 0,
  });

  // Level elements (Tiles, Items, Police)
  const tilesRef = useRef<RoadTile[]>([]);
  const oilCansRef = useRef<OilCan[]>([]);
  const thrownOilsRef = useRef<ThrownOil[]>([]);
  const policeRef = useRef<PolicePatrol[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const botPositionsRef = useRef<Record<string, {
    x: number;
    tier: number;
    vx: number;
    direction: number;
    isJumping: boolean;
    isSpinning: boolean;
    jumpVy: number;
    jumpY: number;
    score: number;
    paintCount: number;
    targetTier: number;
    actionTimer: number;
  }>>({});

  const vehicleInfo = VEHICLES.find((v) => v.emoji === currentUserMember.vehicle) || VEHICLES[0];
  const charInfo = CHARACTERS.find((c) => c.emoji === currentUserMember.character) || CHARACTERS[0];

  // Initialize 4-tier track roads
  useEffect(() => {
    const tiles: RoadTile[] = [];
    let tileId = 0;
    for (let tier = 0; tier < 4; tier++) {
      const numTiles = Math.floor(TRACK_WIDTH / TILE_WIDTH);
      for (let i = 0; i < numTiles; i++) {
        // Create occasional ramp / gap on upper tiers for jumping down
        const isGap = (tier > 0 && (i === 7 || i === 8 || i === 20 || i === 21));
        if (!isGap) {
          tiles.push({
            id: tileId++,
            tier,
            x: i * TILE_WIDTH,
            width: TILE_WIDTH,
            paintedBy: null,
            color: null,
          });
        }
      }
    }
    tilesRef.current = tiles;

    // Place oil cans along the road
    const cans: OilCan[] = [];
    let canId = 0;
    for (let tier = 0; tier < 4; tier++) {
      for (let x = 150; x < TRACK_WIDTH - 150; x += 220) {
        cans.push({
          id: canId++,
          x: x + (Math.random() * 40 - 20),
          tier,
          collected: false,
        });
      }
    }
    oilCansRef.current = cans;

    // Spawn patrol police cats/doggos on tiers
    const police: PolicePatrol[] = [
      { id: 1, x: 500, tier: 0, vx: -1.5, direction: -1, isSpun: false, spinTimer: 0 },
      { id: 2, x: 1200, tier: 1, vx: 2, direction: 1, isSpun: false, spinTimer: 0 },
      { id: 3, x: 750, tier: 2, vx: -1.8, direction: -1, isSpun: false, spinTimer: 0 },
      { id: 4, x: 950, tier: 3, vx: 2.2, direction: 1, isSpun: false, spinTimer: 0 },
    ];
    policeRef.current = police;

    // Initialize bots
    const botEntities: typeof botPositionsRef.current = {};
    allMembers.filter((m) => m.isBot).forEach((bot, idx) => {
      botEntities[bot.memberId] = {
        x: 150 + idx * 120,
        tier: idx % 4,
        vx: 2 + Math.random(),
        direction: 1,
        isJumping: false,
        isSpinning: false,
        jumpVy: 0,
        jumpY: 0,
        score: 0,
        paintCount: 0,
        targetTier: Math.floor(Math.random() * 4),
        actionTimer: 0,
      };
    });
    botPositionsRef.current = botEntities;

    // Start background retro chiptune
    soundManager.startBGM();

    return () => {
      soundManager.stopBGM();
    };
  }, [allMembers]);

  // Handle Keyboard inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keysRef.current.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keysRef.current.right = true;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keysRef.current.up = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keysRef.current.down = true;

      // Throw Oil Can with E or J
      if (e.code === 'KeyE' || e.code === 'KeyJ') {
        throwOilCan();
      }

      // Activate Vehicle Skill with Q or K
      if (e.code === 'KeyQ' || e.code === 'KeyK') {
        triggerVehicleSkill();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keysRef.current.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keysRef.current.right = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') keysRef.current.up = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keysRef.current.down = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [localOilCount, skillCooldownLeft, shieldActive]);

  // Haptic feedback helper for smartphones
  const triggerHaptic = (duration: number = 15) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {
        // Safe catch
      }
    }
  };

  // Direct action handlers for smartphone & touch controls
  const triggerJump = useCallback(() => {
    if (isGameOver) return;
    const p = playerEntityRef.current;
    if (!p.isJumping && !p.isSpinning) {
      p.isJumping = true;
      p.vy = -(9.5 + vehicleInfo.jump * 0.8);
      soundManager.playJumpSound();
      triggerHaptic(18);
    }
  }, [isGameOver, vehicleInfo.jump]);

  const triggerDrop = useCallback(() => {
    if (isGameOver) return;
    const p = playerEntityRef.current;
    if (!p.isJumping && p.tier > 0) {
      p.tier--;
      p.y = TIER_Y[p.tier] - 24;
      soundManager.playClick();
      triggerHaptic(15);
    }
  }, [isGameOver]);

  // Canvas direct touch gestures (tap sides to steer, swipe up to jump, swipe down to drop)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    }
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;

    // Swipe up -> Jump
    if (dy < -30 && Math.abs(dy) > Math.abs(dx)) {
      triggerJump();
    }
    // Swipe down -> Drop tier
    else if (dy > 30 && Math.abs(dy) > Math.abs(dx)) {
      triggerDrop();
    }
    // Tap left/right or center
    else if (dt < 300 && Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const tapX = t.clientX - rect.left;
        if (tapX < rect.width * 0.35) {
          playerEntityRef.current.direction = -1;
          playerEntityRef.current.vx = -Math.abs(playerEntityRef.current.vx || 3);
          triggerHaptic(10);
        } else if (tapX > rect.width * 0.65) {
          playerEntityRef.current.direction = 1;
          playerEntityRef.current.vx = Math.abs(playerEntityRef.current.vx || 3);
          triggerHaptic(10);
        } else {
          triggerJump();
        }
      }
    }
    touchStartRef.current = null;
  };

  // Throw Oil Can logic
  const throwOilCan = useCallback(() => {
    if (localOilCount <= 0 || isGameOver) return;
    setLocalOilCount((prev) => prev - 1);
    soundManager.playOilTossSound();

    const p = playerEntityRef.current;
    thrownOilsRef.current.push({
      id: Date.now() + Math.random(),
      x: p.x + p.direction * 30,
      y: TIER_Y[p.tier] - 16,
      vx: p.direction * (6 * room.gameSpeed),
      tier: p.tier,
      thrownBy: currentUserMember.memberId,
    });
  }, [localOilCount, isGameOver, room.gameSpeed, currentUserMember.memberId]);

  // Trigger Vehicle Skill
  const triggerVehicleSkill = useCallback(() => {
    if (skillCooldownLeft > 0 || isGameOver) return;

    soundManager.playSkillSound(vehicleInfo.soundFreq);
    setSkillCooldownLeft(vehicleInfo.skillCooldown);

    const p = playerEntityRef.current;

    // Custom vehicle skills
    if (vehicleInfo.id === 'turtle') {
      // Iron Shell: invulnerable for 4s
      setShieldActive(true);
      setTimeout(() => setShieldActive(false), 4000);
    } else if (vehicleInfo.id === 'trex') {
      // Stomp: shock all nearby bots/opponents within 350px
      Object.keys(botPositionsRef.current).forEach((bId) => {
        const b = botPositionsRef.current[bId];
        if (Math.abs(b.x - p.x) < 350 && Math.abs(b.tier - p.tier) <= 1) {
          b.isSpinning = true;
          setTimeout(() => { b.isSpinning = false; }, 1800);
        }
      });
      // Police spin
      policeRef.current.forEach((pol) => {
        if (Math.abs(pol.x - p.x) < 350) {
          pol.isSpun = true;
          pol.spinTimer = 100;
        }
      });
    } else if (vehicleInfo.id === 'cat_orange' || vehicleInfo.id === 'tiger_mount') {
      // Super Nitro Dash
      p.vx = p.direction * 14 * room.gameSpeed;
      // Burst particles
      for (let i = 0; i < 20; i++) {
        particlesRef.current.push({
          x: p.x,
          y: TIER_Y[p.tier] - 15,
          vx: -p.direction * (Math.random() * 5 + 3),
          vy: (Math.random() - 0.5) * 4,
          color: '#f97316',
          size: Math.random() * 6 + 3,
          life: 1,
          maxLife: 25,
        });
      }
    } else if (vehicleInfo.id === 'elephant') {
      // Paint 6 tiles ahead
      const startX = p.x;
      const endX = p.x + p.direction * (TILE_WIDTH * 6);
      const minX = Math.min(startX, endX);
      const maxX = Math.max(startX, endX);
      tilesRef.current.forEach((t) => {
        if (t.tier === p.tier && t.x >= minX && t.x <= maxX && t.paintedBy !== currentUserMember.memberId) {
          t.paintedBy = currentUserMember.memberId;
          t.color = currentUserMember.color;
          p.paintCount++;
          p.score += 15;
        }
      });
      soundManager.playPaintSound(5);
    } else if (vehicleInfo.id === 'rabbit' || vehicleInfo.id === 'bronto') {
      // High jump
      p.isJumping = true;
      p.vy = -13;
    } else {
      // Default boost & speed wave
      p.vx = p.direction * 11 * room.gameSpeed;
    }
  }, [skillCooldownLeft, isGameOver, vehicleInfo, room.gameSpeed, currentUserMember]);

  // Skill cooldown countdown
  useEffect(() => {
    if (skillCooldownLeft <= 0) return;
    const timer = setInterval(() => {
      setSkillCooldownLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [skillCooldownLeft]);

  // Race Timer Countdown (90s)
  useEffect(() => {
    if (isGameOver) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          finishRace();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isGameOver]);

  // Periodic Firestore Live State Sync (Throttled every 150ms)
  useEffect(() => {
    if (isGameOver || room.roomId.startsWith('SOLO_')) return;
    const syncInterval = setInterval(() => {
      const p = playerEntityRef.current;
      syncLiveState(room.roomId, {
        memberId: currentUserMember.memberId,
        x: Math.round(p.x),
        tier: p.tier,
        vx: Math.round(p.vx * 10) / 10,
        direction: p.direction,
        isJumping: p.isJumping,
        isSpinning: p.isSpinning,
        paintCount: p.paintCount,
        score: p.score,
        skillActive: shieldActive,
        updatedAt: Date.now(),
      }).catch((err) => console.warn('Sync live state error:', err));
    }, 150);

    return () => clearInterval(syncInterval);
  }, [room.roomId, currentUserMember.memberId, isGameOver, shieldActive]);

  // Finish Race Handler
  const finishRace = useCallback(() => {
    if (isGameOver) return;
    setIsGameOver(true);
    soundManager.stopBGM();
    soundManager.playVictoryFanfare();

    // Determine winner based on score and paint count
    const p = playerEntityRef.current;
    const userResult: RoomMember = {
      ...currentUserMember,
      score: p.score,
      paintCount: p.paintCount,
      paintPercent: Math.min(100, Math.round((p.paintCount / Math.max(1, tilesRef.current.length)) * 100)),
    };

    const finalStandings: RoomMember[] = [userResult];
    allMembers.filter((m) => m.memberId !== currentUserMember.memberId).forEach((m) => {
      if (m.isBot) {
        const bot = botPositionsRef.current[m.memberId];
        finalStandings.push({
          ...m,
          score: bot ? bot.score : Math.floor(Math.random() * 400 + 200),
          paintCount: bot ? bot.paintCount : 25,
          paintPercent: Math.min(100, Math.round(((bot ? bot.paintCount : 25) / Math.max(1, tilesRef.current.length)) * 100)),
        });
      } else {
        const remote = liveStates[m.memberId];
        finalStandings.push({
          ...m,
          score: remote ? remote.score : 0,
          paintCount: remote ? remote.paintCount : 0,
          paintPercent: remote ? Math.min(100, Math.round((remote.paintCount / Math.max(1, tilesRef.current.length)) * 100)) : 0,
        });
      }
    });

    finalStandings.sort((a, b) => b.score - a.score);
    const winner = finalStandings[0];
    setWinnerMember(winner);

    // Save user stats if logged in (skip for local solo/guest)
    if (playerProfile && !playerProfile.userId.startsWith('guest_') && !playerProfile.userId.startsWith('solo_')) {
      const isWinner = winner.memberId === currentUserMember.memberId;
      savePlayerProfile({
        ...playerProfile,
        totalScore: (playerProfile.totalScore || 0) + p.score,
        totalWins: (playerProfile.totalWins || 0) + (isWinner ? 1 : 0),
        totalRaces: (playerProfile.totalRaces || 0) + 1,
        highPaintPercent: Math.max(playerProfile.highPaintPercent || 0, userResult.paintPercent),
      }).catch((e) => console.warn('Save stats error:', e));
    }

    if (winner.memberId === currentUserMember.memberId) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });
    }

    // Update room in Firestore if host (only for online rooms)
    if (room.hostId === currentUserMember.memberId && !room.roomId.startsWith('SOLO_')) {
      updateRoomSettings(room.roomId, {
        status: 'finished',
        winnerId: winner.memberId,
        winnerName: winner.displayName,
        winnerAvatar: `${winner.character} ${winner.vehicle}`,
      }).catch((e) => console.warn('Update room finish error:', e));
    }

    onGameEnd(winner);
  }, [isGameOver, currentUserMember, allMembers, liveStates, playerProfile, room, onGameEnd]);

  // Main 60FPS Game Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let comboCount = 0;
    let comboResetTimer = 0;

    const loop = () => {
      const p = playerEntityRef.current;
      const speedMult = room.gameSpeed;
      const baseSpeed = (2.8 + vehicleInfo.speed * 0.4) * speedMult;
      const accel = 0.4 + vehicleInfo.accel * 0.15;
      const jumpPower = 9.5 + vehicleInfo.jump * 0.8;

      // 1. UPDATE PLAYER PHYSICS
      if (!p.isSpinning && !isGameOver) {
        // Horizontal Movement
        if (keysRef.current.right) {
          p.vx = Math.min(p.vx + accel, baseSpeed);
          p.direction = 1;
        } else if (keysRef.current.left) {
          p.vx = Math.max(p.vx - accel, -baseSpeed);
          p.direction = -1;
        } else {
          p.vx *= 0.88; // Friction
        }

        // Jump Control (Parabolic arcade jump)
        if (keysRef.current.up && !p.isJumping) {
          p.isJumping = true;
          p.vy = -jumpPower;
          soundManager.playJumpSound();
        }

        // Drop down tier
        if (keysRef.current.down && !p.isJumping && p.tier > 0) {
          p.tier--;
          p.y = TIER_Y[p.tier] - 24;
          soundManager.playClick();
        }
      } else if (p.isSpinning) {
        p.vx *= 0.94;
        p.spinTime--;
        if (p.spinTime <= 0) {
          p.isSpinning = false;
        }
      }

      // Apply Gravity & Jumping
      if (p.isJumping) {
        p.vy += 0.45; // gravity
        p.y += p.vy;

        // Check if landing on an upper tier or current tier
        const targetTierY = TIER_Y[p.tier] - 24;
        const upperTierY = p.tier < 3 ? TIER_Y[p.tier + 1] - 24 : -999;

        // If jumping upwards and passed upper tier platform
        if (p.vy > 0 && p.tier < 3 && p.y <= upperTierY + 10 && p.y >= upperTierY - 14) {
          // Check if there is road beneath at upper tier using looping distance
          const hasRoadAbove = tilesRef.current.some(
            (t) => t.tier === p.tier + 1 && loopingDistance(t.x + t.width / 2, p.x) < 26
          );
          if (hasRoadAbove) {
            p.tier++;
            p.y = TIER_Y[p.tier] - 24;
            p.vy = 0;
            p.isJumping = false;
          }
        } else if (p.vy > 0 && p.y >= targetTierY) {
          // Landed back on same tier
          p.y = targetTierY;
          p.vy = 0;
          p.isJumping = false;
        }
      } else {
        p.y = TIER_Y[p.tier] - 24;
      }

      // Move along track & wrap around seamlessly (Map Looping)
      p.x += p.vx;
      if (p.x >= TRACK_WIDTH) {
        p.x -= TRACK_WIDTH;
        p.cameraX -= TRACK_WIDTH;
      } else if (p.x < 0) {
        p.x += TRACK_WIDTH;
        p.cameraX += TRACK_WIDTH;
      }

      // Camera follows player smoothly around the looping track
      const targetCamX = p.x - canvas.width / 2;
      let camDelta = targetCamX - p.cameraX;
      if (camDelta > TRACK_WIDTH / 2) camDelta -= TRACK_WIDTH;
      if (camDelta < -TRACK_WIDTH / 2) camDelta += TRACK_WIDTH;
      p.cameraX += camDelta * 0.12;
      p.cameraX = ((p.cameraX % TRACK_WIDTH) + TRACK_WIDTH) % TRACK_WIDTH;

      // 2. ROAD PAINTING (Signature road painting mechanic)
      if (!p.isJumping && Math.abs(p.vx) > 0.4) {
        tilesRef.current.forEach((tile) => {
          if (tile.tier === p.tier && loopingDistance(tile.x + tile.width / 2, p.x) < 22) {
            if (tile.paintedBy !== currentUserMember.memberId) {
              tile.paintedBy = currentUserMember.memberId;
              tile.color = currentUserMember.color;
              p.paintCount++;
              p.score += 10;
              comboCount++;
              comboResetTimer = 40;
              soundManager.playPaintSound(comboCount);

              // Tire sparks
              particlesRef.current.push({
                x: p.x - p.direction * 12,
                y: TIER_Y[p.tier] - 6,
                vx: -p.direction * (Math.random() * 2 + 1),
                vy: -Math.random() * 2,
                color: currentUserMember.color,
                size: Math.random() * 4 + 2,
                life: 1,
                maxLife: 16,
              });
            }
          }
        });
      }

      if (comboResetTimer > 0) {
        comboResetTimer--;
        if (comboResetTimer === 0) comboCount = 0;
      }

      // 3. COLLECT & RESPAWN OIL CANS
      oilCansRef.current.forEach((can) => {
        if (!can.collected) {
          if (can.tier === p.tier && loopingDistance(can.x, p.x) < 26) {
            can.collected = true;
            can.respawnTimer = 600; // ~10s respawn
            setLocalOilCount((c) => Math.min(8, c + 1));
            p.score += 50;
            soundManager.playClick();
            // Spawn sparkle particles
            for (let i = 0; i < 8; i++) {
              particlesRef.current.push({
                x: can.x,
                y: TIER_Y[can.tier] - 12,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color: '#f59e0b',
                size: 3,
                life: 1,
                maxLife: 20,
              });
            }
          }
        } else if (can.respawnTimer && can.respawnTimer > 0) {
          can.respawnTimer--;
          if (can.respawnTimer <= 0) {
            can.collected = false;
          }
        }
      });

      // 4. POLICE PATROLS PHYSICS & COLLISION
      policeRef.current.forEach((pol) => {
        if (!pol.isSpun) {
          pol.x += pol.vx * speedMult;
          if (pol.x >= TRACK_WIDTH) pol.x -= TRACK_WIDTH;
          if (pol.x < 0) pol.x += TRACK_WIDTH;

          // Check hit with player using looping distance
          if (!shieldActive && pol.tier === p.tier && loopingDistance(pol.x, p.x) < 28 && !p.isSpinning) {
            p.isSpinning = true;
            p.spinTime = 80;
            p.vx = -p.direction * 3;
            soundManager.playSpinSound();
          }
        } else {
          pol.spinTimer--;
          if (pol.spinTimer <= 0) pol.isSpun = false;
        }
      });

      // 5. THROWN OIL CANS MOVEMENT & HIT REGISTRATION
      for (let i = thrownOilsRef.current.length - 1; i >= 0; i--) {
        const oil = thrownOilsRef.current[i];
        oil.x += oil.vx;
        if (oil.x >= TRACK_WIDTH) oil.x -= TRACK_WIDTH;
        if (oil.x < 0) oil.x += TRACK_WIDTH;
        oil.life = (oil.life || 0) + 1;

        let hit = false;
        // Hit police?
        policeRef.current.forEach((pol) => {
          if (pol.tier === oil.tier && loopingDistance(pol.x, oil.x) < 30 && !pol.isSpun) {
            pol.isSpun = true;
            pol.spinTimer = 110;
            p.score += 100;
            soundManager.playSpinSound();
            hit = true;
          }
        });

        // Hit bots?
        Object.keys(botPositionsRef.current).forEach((bId) => {
          const b = botPositionsRef.current[bId];
          if (b.tier === oil.tier && loopingDistance(b.x, oil.x) < 28 && !b.isSpinning) {
            b.isSpinning = true;
            setTimeout(() => { b.isSpinning = false; }, 1800);
            p.score += 100;
            soundManager.playSpinSound();
            hit = true;
          }
        });

        // Remove if hit or range reached
        if (hit || oil.life > 120) {
          thrownOilsRef.current.splice(i, 1);
        }
      }

      // 6. ADAPTIVE BOT AI UPDATE
      const difficulty = room.botDifficulty || 'medium';
      const botSpeedRate = difficulty === 'hard' ? 1.2 : difficulty === 'medium' ? 1.0 : 0.75;

      Object.keys(botPositionsRef.current).forEach((bId) => {
        const bot = botPositionsRef.current[bId];
        const member = allMembers.find((m) => m.memberId === bId);
        if (!member) return;

        if (!bot.isSpinning) {
          bot.x += bot.vx * botSpeedRate * speedMult;
          if (bot.x >= TRACK_WIDTH) bot.x -= TRACK_WIDTH;
          if (bot.x < 0) bot.x += TRACK_WIDTH;

          // Bot jumps periodically or changes tier
          bot.actionTimer++;
          if (bot.actionTimer > (difficulty === 'hard' ? 90 : 150)) {
            bot.actionTimer = 0;
            if (Math.random() > 0.4 && bot.tier < 3) {
              bot.tier++;
            } else if (bot.tier > 0 && Math.random() > 0.5) {
              bot.tier--;
            }
          }

          // Bot road painting using loopingDistance
          tilesRef.current.forEach((t) => {
            if (t.tier === bot.tier && loopingDistance(t.x + t.width / 2, bot.x) < 24) {
              if (t.paintedBy !== member.memberId) {
                t.paintedBy = member.memberId;
                t.color = member.color;
                bot.paintCount++;
                bot.score += 10;
              }
            }
          });
        }
      });

      // Calculate total painted percentage (track territory)
      const totalTiles = tilesRef.current.length;
      const userPainted = tilesRef.current.filter((t) => t.paintedBy === currentUserMember.memberId).length;
      const userPercent = Math.round((userPainted / Math.max(1, totalTiles)) * 100);
      setTotalPaintedPercent(userPercent);

      // Rare instant victory: Only if a single player dominates 100% of the entire track alone
      if (userPainted === totalTiles && totalTiles > 0 && !isGameOver) {
        finishRace();
      }

      // Calculate Rank
      const allScores = [
        { id: currentUserMember.memberId, score: p.score },
        ...allMembers.filter((m) => m.memberId !== currentUserMember.memberId).map((m) => ({
          id: m.memberId,
          score: m.isBot ? (botPositionsRef.current[m.memberId]?.score || 0) : (liveStates[m.memberId]?.score || 0),
        })),
      ].sort((a, b) => b.score - a.score);

      const currentRank = allScores.findIndex((s) => s.id === currentUserMember.memberId) + 1;
      setLocalRank(currentRank > 0 ? currentRank : 1);

      // 7. RENDER GAME CANVAS WITH INFINITE HORIZONTAL WRAP
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background Skyline (Retro City)
      renderSkyline(ctx, isDarkMode, p.cameraX, canvas.width);

      // Determine which track wrapped offsets are visible in camera viewport
      const visibleOffsets = [0];
      if (p.cameraX + canvas.width > TRACK_WIDTH) {
        visibleOffsets.push(TRACK_WIDTH);
      }
      if (p.cameraX < 150) {
        visibleOffsets.push(-TRACK_WIDTH);
      }

      visibleOffsets.forEach((offset) => {
        ctx.save();
        ctx.translate(-p.cameraX + offset, 0);

        // Render 4 Road Tiers
        renderRoadTiers(ctx, isDarkMode);

        // Render Oil Cans on Track
        renderOilCans(ctx);

        // Render Police Patrol Cars
        renderPolice(ctx);

        // Render Thrown Oils
        renderThrownOils(ctx);

        // Render Particles
        renderParticles(ctx);

        // Render Remote Players
        allMembers
          .filter((m) => !m.isBot && m.memberId !== currentUserMember.memberId)
          .forEach((remoteMember) => {
            const state = liveStates[remoteMember.memberId];
            if (state) {
              renderRacer(
                ctx,
                state.x,
                TIER_Y[state.tier] - 24,
                remoteMember.character,
                remoteMember.vehicle,
                remoteMember.displayName,
                remoteMember.color,
                state.direction,
                state.isSpinning,
                state.skillActive || false
              );
            }
          });

        // Render Bots
        allMembers
          .filter((m) => m.isBot)
          .forEach((botMember) => {
            const bState = botPositionsRef.current[botMember.memberId];
            if (bState) {
              renderRacer(
                ctx,
                bState.x,
                TIER_Y[bState.tier] - 24,
                botMember.character,
                botMember.vehicle,
                `🤖 ${botMember.displayName}`,
                botMember.color,
                bState.direction,
                bState.isSpinning,
                false
              );
            }
          });

        // Render Local Current Player
        renderRacer(
          ctx,
          p.x,
          p.y,
          currentUserMember.character,
          currentUserMember.vehicle,
          `⭐ ${currentUserMember.displayName}`,
          currentUserMember.color,
          p.direction,
          p.isSpinning,
          shieldActive
        );

        ctx.restore();
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    currentUserMember,
    allMembers,
    liveStates,
    room,
    vehicleInfo,
    isDarkMode,
    shieldActive,
    isGameOver,
    finishRace,
  ]);

  // Canvas Drawing Helpers
  const renderSkyline = (
    ctx: CanvasRenderingContext2D,
    dark: boolean,
    camX: number,
    viewWidth: number
  ) => {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    if (dark) {
      skyGrad.addColorStop(0, '#090d16');
      skyGrad.addColorStop(0.5, '#1e1b4b');
      skyGrad.addColorStop(1, '#0f172a');
    } else {
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.5, '#818cf8');
      skyGrad.addColorStop(1, '#c084fc');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, viewWidth, CANVAS_HEIGHT);

    // Stars / Retro Moon with subtle parallax
    ctx.fillStyle = dark ? '#fef08a' : '#fef9c3';
    ctx.beginPath();
    const moonX = ((viewWidth - 80 - Math.floor(camX * 0.1)) % viewWidth + viewWidth) % viewWidth;
    ctx.arc(moonX, 50, 24, 0, Math.PI * 2);
    ctx.fill();

    // Retro city skyline silhouettes looping smoothly across view
    const buildingWidth = 55;
    const startIdx = Math.floor(camX / buildingWidth) - 1;
    const endIdx = Math.ceil((camX + viewWidth) / buildingWidth) + 1;
    for (let i = startIdx; i <= endIdx; i++) {
      const bx = i * buildingWidth - camX;
      const seed = ((i % 36) + 36) % 36;
      const bHeight = 80 + ((seed * 37) % 110);
      ctx.fillStyle = dark ? '#0f172a' : '#4338ca';
      ctx.fillRect(bx, CANVAS_HEIGHT - bHeight, 48, bHeight);

      // Building pixel windows
      ctx.fillStyle = dark ? '#fbbf24' : '#fef08a';
      for (let wy = CANVAS_HEIGHT - bHeight + 12; wy < CANVAS_HEIGHT - 30; wy += 20) {
        if ((seed + wy) % 3 !== 0) {
          ctx.fillRect(bx + 8, wy, 8, 8);
          ctx.fillRect(bx + 26, wy, 8, 8);
        }
      }
    }
  };

  const renderRoadTiers = (ctx: CanvasRenderingContext2D, dark: boolean) => {
    // Render 4-tier horizontal steel beam platforms
    TIER_Y.forEach((y, tier) => {
      // Support pillars
      ctx.fillStyle = dark ? '#334155' : '#64748b';
      for (let px = 80; px < TRACK_WIDTH; px += 260) {
        ctx.fillRect(px, y + 10, 16, 480 - y);
      }

      // Base beam
      ctx.fillStyle = dark ? '#1e293b' : '#334155';
      ctx.fillRect(0, y + 2, TRACK_WIDTH, 12);
      ctx.fillStyle = dark ? '#0f172a' : '#1e293b';
      ctx.fillRect(0, y + 14, TRACK_WIDTH, 4);

      // Tier label
      ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.fillText(`LVL ${tier + 1}`, 15, y - 8);
    });

    // Render road blocks / paint states
    tilesRef.current.forEach((tile) => {
      const y = TIER_Y[tile.tier];
      if (tile.paintedBy) {
        // Painted segment (bright neon road tile)
        ctx.fillStyle = tile.color || '#3b82f6';
        ctx.fillRect(tile.x, y - 4, tile.width - 2, 8);

        // Gloss highlight
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(tile.x + 2, y - 3, tile.width - 6, 2);
        ctx.globalAlpha = 1.0;
      } else {
        // Unpainted dark asphalt with dashed center
        ctx.fillStyle = dark ? '#475569' : '#64748b';
        ctx.fillRect(tile.x, y - 4, tile.width - 2, 8);
        // Dashed stripe
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(tile.x + 10, y - 2, tile.width - 22, 3);
      }
    });
  };

  const renderOilCans = (ctx: CanvasRenderingContext2D) => {
    oilCansRef.current.forEach((can) => {
      if (!can.collected) {
        const y = TIER_Y[can.tier] - 18;
        // Oil drum sprite
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(can.x - 8, y, 16, 16);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(can.x - 8, y + 5, 16, 5);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('OIL', can.x - 7, y + 10);
      }
    });
  };

  const renderPolice = (ctx: CanvasRenderingContext2D) => {
    policeRef.current.forEach((pol) => {
      const y = TIER_Y[pol.tier] - 22;
      ctx.save();
      ctx.translate(pol.x, y);

      if (pol.isSpun) {
        ctx.rotate((pol.spinTimer * 0.3) % (Math.PI * 2));
      } else if (pol.direction === -1) {
        ctx.scale(-1, 1);
      }

      // Police Car / Siren
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-16, 2, 32, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8, -4, 18, 8);
      // Red/Blue Siren Flasher
      const flasher = Math.floor(Date.now() / 150) % 2 === 0 ? '#ef4444' : '#3b82f6';
      ctx.fillStyle = flasher;
      ctx.beginPath();
      ctx.arc(0, -6, 4, 0, Math.PI * 2);
      ctx.fill();
      // Wheels
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-10, 16, 4, 0, Math.PI * 2);
      ctx.arc(10, 16, 4, 0, Math.PI * 2);
      ctx.fill();

      // Cute Cat cop icon
      ctx.font = '14px sans-serif';
      ctx.fillText('👮🐱', -12, 4);

      ctx.restore();
    });
  };

  const renderThrownOils = (ctx: CanvasRenderingContext2D) => {
    thrownOilsRef.current.forEach((oil) => {
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(oil.x, oil.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(oil.x - 3, oil.y - 2, 6, 4);
    });
  };

  const renderParticles = (ctx: CanvasRenderingContext2D) => {
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      if (p.life >= p.maxLife) {
        particlesRef.current.splice(i, 1);
      }
    }
  };

  const renderRacer = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    charEmoji: string,
    vehicleEmoji: string,
    name: string,
    color: string,
    direction: number,
    isSpinning: boolean,
    hasShield: boolean
  ) => {
    ctx.save();
    ctx.translate(x, y);

    if (isSpinning) {
      const spinAngle = (Date.now() / 60) % (Math.PI * 2);
      ctx.rotate(spinAngle);
    } else if (direction === -1) {
      ctx.scale(-1, 1);
    }

    // Shield bubble
    if (hasShield) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 4, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fill();
    }

    // Vehicle Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 20, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Racer Chassis / Glow
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-16, 12, 32, 6, 3);
    ctx.fill();

    // Emoji Mount Vehicle (Large on bottom)
    ctx.font = '28px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(vehicleEmoji, 0, 10);

    // Emoji Character Rider (Cute on top)
    ctx.font = '20px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.fillText(charEmoji, 0, -10);

    ctx.restore();

    // Name tag & paint flag above racer
    ctx.save();
    ctx.translate(x, y - 28);
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';

    // Label background tag
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    const textWidth = ctx.measureText(name).width;
    ctx.roundRect(-textWidth / 2 - 6, -12, textWidth + 12, 16, 4);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, 0, 0);
    ctx.restore();
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-full overflow-x-hidden flex flex-col items-center select-none ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-900 text-white'
      }`}
    >
      {/* Top HUD Display */}
      <div className="w-full max-w-5xl px-3 sm:px-6 py-2 flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/95 backdrop-blur z-10 select-none">
        {/* Race Timer & Rank */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-xs sm:text-sm border border-amber-500/40">
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span className="font-bold">#{localRank}/{allMembers.length}</span>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 font-mono text-xs sm:text-sm border border-cyan-500/40">
            <span>⏱️ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
          </div>

          {/* Looping indicator */}
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono text-xs border border-emerald-500/40">
            <span>♾️ LOOPING</span>
          </div>
        </div>

        {/* Paint Gauge */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-[200px] sm:max-w-xs mx-1 sm:mx-4">
          <div className="hidden xs:block text-[11px] font-semibold text-slate-300 whitespace-nowrap">CAT:</div>
          <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative">
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${totalPaintedPercent}%`,
                backgroundColor: currentUserMember.color || '#3b82f6',
              }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
              {totalPaintedPercent}%
            </span>
          </div>
        </div>

        {/* Speed & Audio controls */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-1 text-[11px] sm:text-xs text-amber-400 font-bold bg-amber-950/40 px-2 py-1 rounded-lg border border-amber-800">
            <Gauge className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>{room.gameSpeed}x</span>
          </div>

          <button
            onClick={() => {
              const nextMute = !muted;
              setMuted(nextMute);
              soundManager.setMuted(nextMute);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title={muted ? 'Nyalakan Suara' : 'Bisukan Suara'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Game Canvas Container */}
      <div className="relative w-full flex justify-center overflow-hidden bg-black touch-none">
        <canvas
          ref={canvasRef}
          width={900}
          height={CANVAS_HEIGHT}
          onTouchStart={handleCanvasTouchStart}
          onTouchEnd={handleCanvasTouchEnd}
          className="w-full max-w-[900px] h-[260px] xs:h-[300px] sm:h-[420px] object-cover border-x border-slate-800 shadow-2xl touch-none select-none"
        />

        {/* Subtle Looping Badge Floating Over Corner */}
        <div className="absolute top-2 left-2 pointer-events-none bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded px-2 py-0.5 text-[10px] text-amber-300 font-mono flex items-center gap-1">
          <span>♾️ Map Bersambung (Loop)</span>
        </div>

        {/* Game Over Winner Overlay */}
        {isGameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in zoom-in duration-300">
            <div className="text-4xl sm:text-5xl mb-2">🏁🏆🏁</div>
            <h2 className="text-2xl sm:text-3xl font-bold font-['Press_Start_2P'] text-amber-400 mb-2">
              BALAPAN SELESAI!
            </h2>
            <div className="p-4 rounded-xl bg-slate-800/90 border border-amber-500/50 max-w-sm w-full mb-6">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">JUARA PERTAMA</div>
              <div className="text-xl font-bold text-white flex items-center justify-center gap-2">
                <span>{winnerMember?.character} {winnerMember?.vehicle}</span>
                <span>{winnerMember?.displayName}</span>
              </div>
              <div className="mt-2 text-sm text-emerald-400 font-mono">
                Skor: {winnerMember?.score || 0} Poin • Cat: {winnerMember?.paintCount || 0} Ubin
              </div>
            </div>

            <button
              onClick={onExitToLobby}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-base shadow-lg hover:scale-105 active:scale-95 transition"
            >
              Kembali ke Lobi Balap
            </button>
          </div>
        )}
      </div>

      {/* Ergonomic Smartphone Gamepad & Action Controls */}
      <div className="w-full max-w-5xl px-3 sm:px-6 py-2.5 bg-slate-900 border-t border-slate-800 flex flex-col gap-2 z-10 select-none">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-6">
          
          {/* LEFT CLUSTER: Steering & Drop Down (Left Thumb) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Steer Left */}
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                keysRef.current.left = true;
                triggerHaptic(12);
              }}
              onPointerUp={() => { keysRef.current.left = false; }}
              onPointerLeave={() => { keysRef.current.left = false; }}
              onPointerCancel={() => { keysRef.current.left = false; }}
              className="w-13 h-13 sm:w-16 sm:h-16 bg-slate-800 hover:bg-slate-700 active:bg-amber-600 active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center border-2 border-slate-700 active:border-amber-400 touch-none shadow-lg transition-all"
              title="Belok Kiri (A / ◀)"
            >
              <ArrowLeft className="w-6 h-6 sm:w-7 sm:h-7" />
              <span className="text-[9px] font-bold text-slate-300">KIRI</span>
            </button>

            {/* Steer Right */}
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                keysRef.current.right = true;
                triggerHaptic(12);
              }}
              onPointerUp={() => { keysRef.current.right = false; }}
              onPointerLeave={() => { keysRef.current.right = false; }}
              onPointerCancel={() => { keysRef.current.right = false; }}
              className="w-13 h-13 sm:w-16 sm:h-16 bg-slate-800 hover:bg-slate-700 active:bg-amber-600 active:scale-95 text-white rounded-2xl flex flex-col items-center justify-center border-2 border-slate-700 active:border-amber-400 touch-none shadow-lg transition-all"
              title="Belok Kanan (D / ▶)"
            >
              <ArrowRight className="w-6 h-6 sm:w-7 sm:h-7" />
              <span className="text-[9px] font-bold text-slate-300">KANAN</span>
            </button>

            {/* Drop Down Tier */}
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                triggerDrop();
              }}
              className="w-11 h-13 sm:w-14 sm:h-16 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-slate-300 rounded-2xl flex flex-col items-center justify-center border-2 border-slate-700 touch-none shadow-lg transition-all"
              title="Turun Tingkat (S / ▼)"
            >
              <ArrowDown className="w-5 h-5 sm:w-6 sm:h-6 text-slate-300" />
              <span className="text-[8px] font-bold uppercase text-slate-400">TURUN</span>
            </button>
          </div>

          {/* CENTER: Quick Desktop Keyboard Hint */}
          <div className="hidden lg:flex flex-col items-center justify-center text-center px-2">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Kontrol Sentuh & Keyboard</div>
            <div className="text-[11px] text-slate-300 font-mono">
              [A/D/◀▶] Jalan • [W/Spasi] Lompat • [S] Turun • [Q] Skill • [E] Lempar Oli
            </div>
          </div>

          {/* RIGHT CLUSTER: Skill, Oil, and Hero Jump (Right Thumb) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Special Vehicle Skill Button */}
            <button
              onClick={() => {
                triggerHaptic(20);
                triggerVehicleSkill();
              }}
              disabled={skillCooldownLeft > 0 || isGameOver}
              className="w-12 h-13 sm:w-16 sm:h-16 px-1 bg-cyan-950/80 hover:bg-cyan-900 active:bg-cyan-700 active:scale-95 disabled:opacity-40 text-cyan-300 rounded-2xl flex flex-col items-center justify-center border-2 border-cyan-500/60 touch-none shadow-lg transition-all relative overflow-hidden"
              title={`Skill: ${vehicleInfo.skillName} (Q)`}
            >
              <span className="text-lg sm:text-2xl">{vehicleInfo.emoji}</span>
              <span className="text-[8px] sm:text-[9px] font-bold uppercase truncate max-w-full px-0.5">
                {skillCooldownLeft > 0 ? `${skillCooldownLeft}s` : 'SKILL'}
              </span>
            </button>

            {/* Throw Oil Can Button */}
            <button
              onClick={() => {
                triggerHaptic(18);
                throwOilCan();
              }}
              disabled={localOilCount <= 0 || isGameOver}
              className="w-12 h-13 sm:w-16 sm:h-16 px-1 bg-amber-950/80 hover:bg-amber-900 active:bg-amber-600 active:scale-95 disabled:opacity-40 text-amber-300 rounded-2xl flex flex-col items-center justify-center border-2 border-amber-500/60 touch-none shadow-lg transition-all relative"
              title="Lempar Kaleng Oli (E)"
            >
              <span className="text-lg sm:text-2xl">🛢️</span>
              <span className="text-[8px] sm:text-[9px] font-bold text-amber-200">
                {localOilCount} OLI
              </span>
            </button>

            {/* Big Hero Jump Button */}
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                triggerJump();
              }}
              className="w-16 h-13 sm:w-20 sm:h-16 bg-gradient-to-tr from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 active:from-indigo-700 active:to-violet-600 active:scale-90 text-white rounded-2xl flex flex-col items-center justify-center border-2 border-indigo-400 touch-none shadow-xl shadow-indigo-500/30 transition-all ring-2 ring-indigo-500/20"
              title="Lompat Tingkat (W / Spasi / ▲)"
            >
              <ArrowUp className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow" />
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                LOMPAT
              </span>
            </button>
          </div>

        </div>

        {/* Mobile touch tip footer */}
        <div className="flex sm:hidden items-center justify-between text-[9px] text-slate-400 px-1 pt-0.5 border-t border-slate-800/80">
          <span>🎮 Usap / Tap canvas untuk kendali cepat</span>
          <span className="text-amber-400 font-mono">Loop: Terhubung ♾️</span>
        </div>
      </div>
    </div>
  );
};
