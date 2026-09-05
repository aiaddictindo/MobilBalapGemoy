import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  getDocFromServer,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
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

// 1. Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// 2. Strict Error Handling conforming to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 3. Test Connection
export async function testFirestoreConnection(): Promise<boolean> {
  if (!auth.currentUser) {
    return true;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || (error as { code?: string }).code === 'unavailable') {
        console.warn('Firestore connection notice:', error.message);
      }
    }
    return false;
  }
}

// 4. Auth Helpers
export async function loginWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Google Sign-In failed, attempting fallback...', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

// 5. Player Profile Operations
export async function getPlayerProfile(userId: string): Promise<PlayerProfile | null> {
  if (!auth.currentUser) return null;
  const path = `players/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'players', userId));
    if (snap.exists()) {
      return snap.data() as PlayerProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function savePlayerProfile(profile: PlayerProfile): Promise<void> {
  if (!auth.currentUser) return;
  const path = `players/${profile.userId}`;
  try {
    await setDoc(doc(db, 'players', profile.userId), {
      ...profile,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getGlobalLeaderboard(maxLimit = 20): Promise<PlayerProfile[]> {
  if (!auth.currentUser) {
    return [];
  }
  const path = 'players';
  try {
    const q = query(collection(db, 'players'), orderBy('totalScore', 'desc'), limit(maxLimit));
    const snap = await getDocs(q);
    const list: PlayerProfile[] = [];
    snap.forEach((d) => {
      list.push(d.data() as PlayerProfile);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// 6. Rooms & Matchmaking Operations
export async function createGameRoom(
  hostId: string,
  hostName: string,
  speed: GameSpeed = 1,
  difficulty: BotDifficulty = 'medium'
): Promise<string> {
  const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const roomPath = `rooms/${roomId}`;

  const newRoom: GameRoom = {
    roomId,
    roomName: `Sirkuit ${hostName}`,
    hostId,
    status: 'waiting',
    gameSpeed: speed,
    botDifficulty: difficulty,
    maxPlayers: 8,
    currentPlayersCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'rooms', roomId), newRoom);
    return roomId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, roomPath);
  }
}

export async function findOrCreateMatchmakingRoom(
  userId: string,
  userName: string,
  speed: GameSpeed = 1,
  difficulty: BotDifficulty = 'medium'
): Promise<string> {
  const roomsPath = 'rooms';
  try {
    // Look for waiting rooms that have space
    const q = query(
      collection(db, 'rooms'),
      where('status', '==', 'waiting'),
      limit(5)
    );
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const roomData = docSnap.data() as GameRoom;
      if (roomData.currentPlayersCount < roomData.maxPlayers) {
        return roomData.roomId;
      }
    }
    // No waiting room available, create a fresh one
    return await createGameRoom(userId, userName, speed, difficulty);
  } catch (error) {
    console.warn('Matchmaking query fallback, creating new room...', error);
    return await createGameRoom(userId, userName, speed, difficulty);
  }
}

export function subscribeRoom(roomId: string, onUpdate: (room: GameRoom | null) => void): Unsubscribe {
  if (!auth.currentUser) return () => {};
  const path = `rooms/${roomId}`;
  return onSnapshot(
    doc(db, 'rooms', roomId),
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as GameRoom);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function updateRoomSettings(
  roomId: string,
  updates: Partial<GameRoom>
): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// 7. Room Members
export async function joinRoomMember(roomId: string, member: RoomMember): Promise<void> {
  const path = `rooms/${roomId}/members/${member.memberId}`;
  try {
    await setDoc(doc(db, 'rooms', roomId, 'members', member.memberId), member);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function leaveRoomMember(roomId: string, memberId: string): Promise<void> {
  const path = `rooms/${roomId}/members/${memberId}`;
  try {
    await deleteDoc(doc(db, 'rooms', roomId, 'members', memberId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeRoomMembers(roomId: string, onUpdate: (members: RoomMember[]) => void): Unsubscribe {
  if (!auth.currentUser) return () => {};
  const path = `rooms/${roomId}/members`;
  return onSnapshot(
    collection(db, 'rooms', roomId, 'members'),
    (snap) => {
      const list: RoomMember[] = [];
      snap.forEach((d) => list.push(d.data() as RoomMember));
      onUpdate(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// 8. Room Chat Messages
export async function sendChatMessage(roomId: string, msg: Omit<RoomChatMessage, 'messageId' | 'createdAt'>): Promise<void> {
  const messageId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6);
  const path = `rooms/${roomId}/messages/${messageId}`;
  const fullMsg: RoomChatMessage = {
    ...msg,
    messageId,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'rooms', roomId, 'messages', messageId), fullMsg);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeChatMessages(roomId: string, onUpdate: (messages: RoomChatMessage[]) => void): Unsubscribe {
  if (!auth.currentUser) return () => {};
  const path = `rooms/${roomId}/messages`;
  return onSnapshot(
    collection(db, 'rooms', roomId, 'messages'),
    (snap) => {
      const list: RoomChatMessage[] = [];
      snap.forEach((d) => list.push(d.data() as RoomChatMessage));
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list.slice(-50)); // Keep last 50
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// 9. Real-Time Live State during race
export async function syncLiveState(roomId: string, state: RoomLiveState): Promise<void> {
  const path = `rooms/${roomId}/liveState/${state.memberId}`;
  try {
    await setDoc(doc(db, 'rooms', roomId, 'liveState', state.memberId), state, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeLiveStates(roomId: string, onUpdate: (states: Record<string, RoomLiveState>) => void): Unsubscribe {
  if (!auth.currentUser) return () => {};
  const path = `rooms/${roomId}/liveState`;
  return onSnapshot(
    collection(db, 'rooms', roomId, 'liveState'),
    (snap) => {
      const map: Record<string, RoomLiveState> = {};
      snap.forEach((d) => {
        const s = d.data() as RoomLiveState;
        map[s.memberId] = s;
      });
      onUpdate(map);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// 10. Friend Invites & Push Notifications
export async function sendFriendInvite(
  senderId: string,
  senderName: string,
  roomId: string,
  roomName: string,
  receiverId = 'all'
): Promise<string> {
  const inviteId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6);
  const path = `invites/${inviteId}`;
  const invite: GameInvite = {
    inviteId,
    senderId,
    senderName,
    receiverId,
    roomId,
    roomName,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'invites', inviteId), invite);
    return inviteId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeFriendInvites(onUpdate: (invites: GameInvite[]) => void): Unsubscribe {
  if (!auth.currentUser) return () => {};
  const path = 'invites';
  return onSnapshot(
    collection(db, 'invites'),
    (snap) => {
      const list: GameInvite[] = [];
      const now = Date.now();
      snap.forEach((d) => {
        const inv = d.data() as GameInvite;
        // Only keep invites created within the last 15 minutes
        if (now - new Date(inv.createdAt).getTime() < 15 * 60 * 1000) {
          list.push(inv);
        }
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list.slice(0, 10));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
