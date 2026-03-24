/**
 * GameRoom: ties together GameEngine + TimerManager + BotPlayer.
 * One instance per active room. Orchestrates game flow and socket emissions.
 */
import type { Server as SocketServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData, HandResult } from '@scarney/shared';
import { IDLE_TIMEOUT_MS, NEXT_HAND_DELAY_MS, STARTING_STACK } from '@scarney/shared';
import { GameEngine, type GameEngineMode, type ServerPlayer } from './GameEngine.js';
import { TimerManager } from './TimerManager.js';
import { botDecide, BOT_PROFILES } from './BotPlayer.js';
import { prisma } from '../db/prisma.js';
import { updateRanking } from '../services/rankingService.js';
import type { Room } from './RoomStore.js';

type IO = SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export class GameRoom {
  private engine: GameEngine;
  private timers: TimerManager;
  private io: IO;
  private room: Room;
  private socketMap: Map<string, string> = new Map(); // userId → socketId
  private handId: string | null = null;
  private isRunning = false;
  private nextHandTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(io: IO, room: Room) {
    this.io = io;
    this.room = room;
    this.engine = new GameEngine(room.id);
    this.timers = new TimerManager();
  }

  // ─── Socket management ───────────────────────────────────────────────────

  registerSocket(userId: string, socketId: string): void {
    this.socketMap.set(userId, socketId);
  }

  removeSocket(userId: string): void {
    this.socketMap.delete(userId);
  }

  getSocketId(userId: string): string | undefined {
    return this.socketMap.get(userId);
  }

  // ─── Game start ─────────────────────────────────────────────────────────

  async startGame(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.startHand(0);
  }

  private async startHand(dealerIndex: number): Promise<void> {
    const { settings, seats } = this.room;

    // Build player list from seats
    const players: Array<Omit<ServerPlayer, 'holeCards' | 'discardedCards' | 'betThisRound' | 'totalBetThisHand' | 'status' | 'lastAction' | 'isDealer' | 'isSB' | 'isBB'>> = [];
    for (let i = 0; i < seats.length; i++) {
      const seat = seats[i];
      if (!seat) continue;
      players.push({
        userId: seat.userId,
        username: seat.username,
        avatarEmoji: seat.avatarEmoji,
        isBot: seat.isBot,
        seatIndex: i,
        stack: seat.stack,
      });
    }

    if (players.length < 2) {
      this.isRunning = false;
      return;
    }

    const handNumber = this.engine.getHandNumber() + 1;
    const gameMode: GameEngineMode = settings.gameMode as GameEngineMode;

    this.engine.startHand(
      players,
      handNumber,
      dealerIndex % players.length,
      gameMode,
      settings.smallBlind,
      settings.bigBlind,
    );

    // Create hand record
    try {
      const hand = await prisma.hand.create({
        data: {
          roomId: this.room.id,
          handNumber,
          gameState: {},
          potAmount: 0,
        },
      });
      this.handId = hand.id;
    } catch (e) {
      console.error('Failed to create hand record:', e);
    }

    this.broadcastState();
    this.scheduleNextAction();
  }

  // ─── Action handling ─────────────────────────────────────────────────────

  async handleAction(userId: string, action: { type: string; amount?: number }): Promise<{ ok: boolean; error?: string }> {
    if (!this.isRunning || this.engine.isShowdown()) {
      return { ok: false, error: 'ゲームが進行中ではありません' };
    }

    const activePlayer = this.engine.getActivePlayer();
    if (!activePlayer || activePlayer.userId !== userId) {
      return { ok: false, error: 'あなたのターンではありません' };
    }

    this.timers.clear(userId);

    const result = this.engine.processAction(userId, action as any);
    if (!result.ok) return { ok: false, error: result.error };

    // Persist action
    if (this.handId) {
      await prisma.handAction.create({
        data: {
          handId: this.handId,
          userId: userId.startsWith('bot_') ? userId : userId,
          phase: this.engine.getPhase(),
          actionType: action.type,
          amount: action.amount,
        },
      }).catch(() => {});
    }

    if (result.phaseEnded) {
      await this.handlePhaseEnd();
    } else {
      this.broadcastState();
      this.scheduleNextAction();
    }

    return { ok: true };
  }

  private async handlePhaseEnd(): Promise<void> {
    const phase = this.engine.getPhase();

    if (this.engine.isDealPhase()) {
      // Deal community cards after short delay
      await new Promise(r => setTimeout(r, 480));
      this.engine.dealCommunityCards();
      this.broadcastState();
      this.scheduleNextAction();
      return;
    }

    if (phase === 'showdown') {
      await this.handleShowdown();
      return;
    }

    // For non-deal intermediate phases, just broadcast
    this.broadcastState();
    this.scheduleNextAction();
  }

  private async handleShowdown(): Promise<void> {
    const result = this.engine.computeShowdown();
    this.broadcastState();
    this.broadcastResult(result);

    // Persist hand result
    if (this.handId) {
      await prisma.hand.update({
        where: { id: this.handId },
        data: {
          hiWinnerId: result.hiWinner?.userId,
          loWinnerId: result.loWinner?.userId,
          potAmount: result.potAmount,
          endedAt: new Date(),
          gameState: result as any,
        },
      }).catch(() => {});
    }

    // Update rankings for real players
    const players = this.engine.getPlayers();
    for (const p of players) {
      if (p.isBot) continue;
      const startStack = this.room.seats.find(s => s?.userId === p.userId)?.stack ?? STARTING_STACK;
      const delta = p.stack - startStack;
      const wonHi = result.hiWinner?.userId === p.userId;
      const wonLo = result.loWinner?.userId === p.userId;
      const won = wonHi || wonLo;
      await updateRanking(p.userId, delta, won, wonHi, wonLo).catch(() => {});
    }

    // Update room seats with new stacks
    for (const p of players) {
      const seat = this.room.seats.find(s => s?.userId === p.userId);
      if (seat) seat.stack = p.stack;
    }

    // Schedule next hand
    this.nextHandTimer = setTimeout(async () => {
      this.nextHandTimer = null;
      const nextDealerIndex = (this.engine.getPlayers().findIndex(p => p.isDealer) + 1) % this.engine.getPlayers().length;
      await this.startHand(nextDealerIndex);
    }, NEXT_HAND_DELAY_MS);
  }

  // ─── Deal phase automation ───────────────────────────────────────────────

  private scheduleNextAction(): void {
    const phase = this.engine.getPhase();

    // Auto-deal phases
    if (this.engine.isDealPhase()) {
      setTimeout(() => {
        if (!this.isRunning) return;
        this.engine.dealCommunityCards();
        this.broadcastState();
        this.scheduleNextAction();
      }, 480);
      return;
    }

    if (phase === 'showdown') return;

    // Check if all remaining players are all-in → run out board
    const canAct = this.engine.getPlayers().filter(p => p.status === 'active');
    if (canAct.length === 0) {
      setTimeout(async () => {
        const r = this.engine.processAction('', { type: 'check' });
        if (r.phaseEnded) await this.handlePhaseEnd();
        else { this.broadcastState(); this.scheduleNextAction(); }
      }, 500);
      return;
    }

    const activePlayer = this.engine.getActivePlayer();
    if (!activePlayer) return;

    if (activePlayer.isBot) {
      // Schedule bot action
      const delay = 600 + Math.random() * 900;
      setTimeout(() => {
        if (!this.isRunning || this.engine.isShowdown()) return;
        const current = this.engine.getActivePlayer();
        if (!current || current.userId !== activePlayer.userId) return;

        const ctx = {
          holeCards: activePlayer.holeCards,
          topBoard: this.engine.getPlayers()[0]?.holeCards ?? [],
          pot: this.engine.getPot(),
          currentBet: 0, // accessed via engine but simplified for bot
          myBetThisRound: activePlayer.betThisRound,
          myStack: activePlayer.stack,
          phase: this.engine.getPhase(),
          isLatePosition: false,
          gameMode: this.engine.getPhase() === 'preflop' ? 'tournament' : 'tournament' as 'tournament' | 'bomb_pot',
        };

        // Get proper context from engine state
        const sanitized = this.engine.getSanitizedState(activePlayer.userId);
        const botCtx = {
          holeCards: activePlayer.holeCards,
          topBoard: sanitized.topBoard,
          pot: sanitized.pot.total,
          currentBet: sanitized.currentBet,
          myBetThisRound: activePlayer.betThisRound,
          myStack: activePlayer.stack,
          phase: sanitized.phase,
          isLatePosition: activePlayer.seatIndex > sanitized.players.length / 2,
          gameMode: sanitized.gameMode,
        };

        const decision = botDecide(botCtx);
        this.handleAction(activePlayer.userId, decision).catch(console.error);
      }, delay);
    } else {
      // Start idle timer for human player
      this.timers.start(activePlayer.userId, IDLE_TIMEOUT_MS, async () => {
        // Auto-fold on timeout
        const current = this.engine.getActivePlayer();
        if (!current || current.userId !== activePlayer.userId) return;
        this.io.to(this.room.id).emit('player:timeout', activePlayer.userId);
        await this.handleAction(activePlayer.userId, { type: 'fold' });
      });
    }
  }

  // ─── Reconnect ───────────────────────────────────────────────────────────

  handleReconnect(userId: string, socketId: string): void {
    this.registerSocket(userId, socketId);
    this.engine.setPlayerStatus(userId, 'active');
    this.io.to(this.room.id).emit('player:reconnected', userId);

    // Send current state to reconnected player
    const state = this.engine.getSanitizedState(userId);
    this.io.to(socketId).emit('game:state', state);

    // Restore idle timer if it's their turn
    const active = this.engine.getActivePlayer();
    if (active?.userId === userId) {
      const remaining = this.timers.getRemainingMs(userId);
      this.timers.start(userId, remaining > 0 ? remaining : IDLE_TIMEOUT_MS, async () => {
        this.io.to(this.room.id).emit('player:timeout', userId);
        await this.handleAction(userId, { type: 'fold' });
      });
    }
  }

  handleDisconnect(userId: string): void {
    this.removeSocket(userId);
    this.engine.setPlayerStatus(userId, 'disconnected');
    this.io.to(this.room.id).emit('player:disconnected', userId);
  }

  // ─── Broadcast helpers ───────────────────────────────────────────────────

  broadcastState(): void {
    const players = this.engine.getPlayers();
    for (const p of players) {
      const socketId = this.socketMap.get(p.userId);
      if (socketId) {
        const state = this.engine.getSanitizedState(p.userId);
        this.io.to(socketId).emit('game:state', state);
      }
    }
  }

  broadcastResult(result: HandResult): void {
    this.io.to(this.room.id).emit('game:result', result);
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  destroy(): void {
    this.timers.clearAll();
    if (this.nextHandTimer) clearTimeout(this.nextHandTimer);
    this.isRunning = false;
  }

  isActive(): boolean { return this.isRunning; }
  getRoomId(): string { return this.room.id; }
}
