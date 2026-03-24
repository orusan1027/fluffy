/**
 * SCARNEY 6-Max Hi-Lo Game Engine
 * Server-authoritative game state machine.
 *
 * Rules:
 * - Each player gets 6 hole cards
 * - Each community card deal puts 1 card on topBoard AND 1 on bottomBoard
 * - Hole cards matching bottomBoard cards are auto-discarded (applyDiscards)
 * - Hi pot: best 5-card hand using hole cards + topBoard
 * - Lo pot: lowest sum of remaining hole cards (A=1, T/J/Q/K=10)
 * - Pot splits: Hi winner gets half, Lo winner gets half
 */
import type {
  Card, GameState, PersonalGameState, PublicPlayerState,
  GameAction, HandResult, ActionType, DealPhase,
  WinnerEntry, PlayerShowdownInfo, Pot,
} from '@scarney/shared';
import {
  CARDS_PER_PLAYER, TOURNAMENT_SB, TOURNAMENT_BB, PHASE_DEAL_COUNT,
  bestHighHand, loSum,
} from '@scarney/shared';
import { createShuffledDeck } from './Deck.js';

// ─── Internal player state (server-only, includes secrets) ───────────────────

export interface ServerPlayer {
  userId: string;
  username: string;
  avatarEmoji: string;
  isBot: boolean;
  seatIndex: number;
  stack: number;
  holeCards: Card[];
  discardedCards: Card[];
  betThisRound: number;
  totalBetThisHand: number;
  status: 'active' | 'folded' | 'all_in' | 'disconnected' | 'sitting_out';
  lastAction?: ActionType;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
}

export type GameEngineMode = 'tournament' | 'bomb_pot';

interface EngineState {
  roomId: string;
  handNumber: number;
  phase: DealPhase;
  gameMode: GameEngineMode;
  deck: Card[];
  topBoard: Card[];
  bottomBoard: Card[];
  players: ServerPlayer[];
  pot: number;            // running pot total
  currentBet: number;
  minRaise: number;
  dealerIndex: number;
  sbIndex: number;
  bbIndex: number;
  activePlayerIndex: number;
  actedSet: Set<number>;  // indices that have acted this round
  lastRaiserIndex: number;
  lastActionAt: number;
}

// ─── GameEngine class ─────────────────────────────────────────────────────────

export class GameEngine {
  private state: EngineState;

  constructor(roomId: string) {
    this.state = {
      roomId,
      handNumber: 0,
      phase: 'waiting',
      gameMode: 'tournament',
      deck: [],
      topBoard: [],
      bottomBoard: [],
      players: [],
      pot: 0,
      currentBet: 0,
      minRaise: TOURNAMENT_BB,
      dealerIndex: 0,
      sbIndex: 0,
      bbIndex: 0,
      activePlayerIndex: -1,
      actedSet: new Set(),
      lastRaiserIndex: -1,
      lastActionAt: Date.now(),
    };
  }

  // ─── Start hand ─────────────────────────────────────────────────────────────

  startHand(
    players: Array<Omit<ServerPlayer, 'holeCards' | 'discardedCards' | 'betThisRound' | 'totalBetThisHand' | 'status' | 'lastAction' | 'isDealer' | 'isSB' | 'isBB'>>,
    handNumber: number,
    dealerIndex: number,
    gameMode: GameEngineMode,
    smallBlind: number,
    bigBlind: number,
  ): void {
    const deck = createShuffledDeck();
    const n = players.length;

    // Deal 6 cards to each player
    const serverPlayers: ServerPlayer[] = players.map((p, i) => ({
      ...p,
      holeCards: deck.slice(i * CARDS_PER_PLAYER, (i + 1) * CARDS_PER_PLAYER),
      discardedCards: [],
      betThisRound: 0,
      totalBetThisHand: 0,
      status: 'active',
      lastAction: undefined,
      isDealer: i === dealerIndex,
      isSB: false,
      isBB: false,
    }));

    const remainingDeck = deck.slice(n * CARDS_PER_PLAYER);
    let pot = 0;
    let currentBet = 0;
    let activePlayerIndex = 0;

    if (gameMode === 'tournament') {
      // Post blinds
      const sbIdx = (dealerIndex + 1) % n;
      const bbIdx = (dealerIndex + 2) % n;
      serverPlayers[sbIdx].isSB = true;
      serverPlayers[bbIdx].isBB = true;

      const sbAmt = Math.min(smallBlind, serverPlayers[sbIdx].stack);
      serverPlayers[sbIdx].stack -= sbAmt;
      serverPlayers[sbIdx].betThisRound = sbAmt;
      serverPlayers[sbIdx].totalBetThisHand = sbAmt;

      const bbAmt = Math.min(bigBlind, serverPlayers[bbIdx].stack);
      serverPlayers[bbIdx].stack -= bbAmt;
      serverPlayers[bbIdx].betThisRound = bbAmt;
      serverPlayers[bbIdx].totalBetThisHand = bbAmt;

      if (serverPlayers[sbIdx].stack === 0) serverPlayers[sbIdx].status = 'all_in';
      if (serverPlayers[bbIdx].stack === 0) serverPlayers[bbIdx].status = 'all_in';

      pot = sbAmt + bbAmt;
      currentBet = bbAmt;
      activePlayerIndex = (bbIdx + 1) % n;

      this.state = {
        ...this.state,
        sbIndex: sbIdx,
        bbIndex: bbIdx,
      };
    } else {
      // Bomb pot: everyone antes bigBlind
      let totalAnte = 0;
      for (const p of serverPlayers) {
        const ante = Math.min(bigBlind, p.stack);
        p.stack -= ante;
        p.betThisRound = ante;
        p.totalBetThisHand = ante;
        totalAnte += ante;
        if (p.stack === 0) p.status = 'all_in';
      }
      pot = totalAnte;
      currentBet = 0;
      activePlayerIndex = (dealerIndex + 1) % n;

      this.state = {
        ...this.state,
        sbIndex: dealerIndex,
        bbIndex: dealerIndex,
      };
    }

    // Find first non-allin active player
    activePlayerIndex = this.findNextActiveFrom(serverPlayers, activePlayerIndex - 1);

    this.state = {
      ...this.state,
      handNumber,
      phase: gameMode === 'tournament' ? 'preflop' : 'flop_deal',
      gameMode,
      deck: remainingDeck,
      topBoard: [],
      bottomBoard: [],
      players: serverPlayers,
      pot,
      currentBet,
      minRaise: bigBlind,
      dealerIndex,
      activePlayerIndex,
      actedSet: new Set(),
      lastRaiserIndex: -1,
      lastActionAt: Date.now(),
    };
  }

  // ─── Deal community cards ──────────────────────────────────────────────────

  /**
   * Deal community card pairs for the current deal phase.
   * Returns true if cards were dealt, false if phase is not a deal phase.
   */
  dealCommunityCards(): boolean {
    const { phase } = this.state;
    const count = PHASE_DEAL_COUNT[phase];
    if (!count) return false;

    const deck = [...this.state.deck];
    const topBoard = [...this.state.topBoard];
    const bottomBoard = [...this.state.bottomBoard];

    for (let i = 0; i < count; i++) {
      if (deck.length < 2) break;
      const topCard = deck.shift()!;
      const botCard = deck.shift()!;
      topBoard.push(topCard);
      bottomBoard.push(botCard);
      // Auto-discard matching hole cards
      this.applyDiscard(botCard);
    }

    const nextPhase: Record<string, DealPhase> = {
      flop_deal: 'flop',
      turn_deal: 'turn',
      river_deal: 'river',
    };

    this.state.deck = deck;
    this.state.topBoard = topBoard;
    this.state.bottomBoard = bottomBoard;

    // Reset betting round
    for (const p of this.state.players) {
      p.betThisRound = 0;
      p.lastAction = undefined;
    }
    this.state.currentBet = 0;
    this.state.minRaise = this.getBigBlind();
    this.state.actedSet = new Set();
    this.state.lastRaiserIndex = -1;
    this.state.phase = nextPhase[phase] as DealPhase;
    this.state.activePlayerIndex = this.findNextActiveFrom(this.state.players, this.state.dealerIndex);
    this.state.lastActionAt = Date.now();

    return true;
  }

  private applyDiscard(bottomCard: Card): void {
    for (const p of this.state.players) {
      if (p.status === 'folded') continue;
      const kept: Card[] = [];
      const disc: Card[] = [];
      for (const c of p.holeCards) {
        // Match by suit AND rank (exact card)
        if (c.id === bottomCard.id) disc.push(c);
        else kept.push(c);
      }
      p.holeCards = kept;
      p.discardedCards = [...p.discardedCards, ...disc];
    }
  }

  // ─── Process player action ─────────────────────────────────────────────────

  processAction(userId: string, action: GameAction): { ok: boolean; error?: string; phaseEnded: boolean } {
    const { players, activePlayerIndex, phase } = this.state;

    if (phase === 'showdown' || ['flop_deal', 'turn_deal', 'river_deal'].includes(phase)) {
      return { ok: false, error: 'アクション受付外のフェーズです', phaseEnded: false };
    }

    const playerIndex = players.findIndex(p => p.userId === userId);
    if (playerIndex === -1) return { ok: false, error: 'プレイヤーが見つかりません', phaseEnded: false };
    if (playerIndex !== activePlayerIndex) return { ok: false, error: 'あなたのターンではありません', phaseEnded: false };

    const player = players[playerIndex];
    if (player.status === 'folded' || player.status === 'all_in') {
      return { ok: false, error: 'アクションできない状態です', phaseEnded: false };
    }

    const { currentBet } = this.state;
    const toCall = Math.max(0, currentBet - player.betThisRound);

    switch (action.type) {
      case 'fold':
        player.status = 'folded';
        player.lastAction = 'fold';
        break;

      case 'check':
        if (toCall > 0) return { ok: false, error: 'チェックできません（コールが必要です）', phaseEnded: false };
        player.lastAction = 'check';
        break;

      case 'call': {
        const callAmt = Math.min(toCall, player.stack);
        player.stack -= callAmt;
        player.betThisRound += callAmt;
        player.totalBetThisHand += callAmt;
        this.state.pot += callAmt;
        if (player.stack === 0) player.status = 'all_in';
        player.lastAction = 'call';
        break;
      }

      case 'bet':
      case 'raise': {
        const amount = action.amount ?? 0;
        const targetBet = Math.max(player.betThisRound + toCall + this.state.minRaise, amount);
        const actualAdd = Math.min(targetBet - player.betThisRound, player.stack);
        if (actualAdd <= 0) return { ok: false, error: '無効なベット額です', phaseEnded: false };

        // Pot Limit check
        if (this.state.gameMode === 'bomb_pot') {
          const plMax = this.potLimitMax(player.betThisRound);
          const cappedAdd = Math.min(actualAdd, plMax - player.betThisRound);
          if (cappedAdd <= 0) return { ok: false, error: 'ポットリミット超過です', phaseEnded: false };
          player.stack -= cappedAdd;
          const newBet = player.betThisRound + cappedAdd;
          if (newBet > this.state.currentBet) {
            this.state.minRaise = Math.max(newBet - this.state.currentBet, this.getBigBlind());
            this.state.currentBet = newBet;
            this.state.lastRaiserIndex = playerIndex;
            this.state.actedSet = new Set([playerIndex]);
          }
          player.betThisRound = newBet;
          player.totalBetThisHand += cappedAdd;
          this.state.pot += cappedAdd;
        } else {
          // No Limit
          player.stack -= actualAdd;
          const newBet = player.betThisRound + actualAdd;
          if (newBet > this.state.currentBet) {
            this.state.minRaise = Math.max(newBet - this.state.currentBet, this.getBigBlind());
            this.state.currentBet = newBet;
            this.state.lastRaiserIndex = playerIndex;
            this.state.actedSet = new Set([playerIndex]);
          }
          player.betThisRound = newBet;
          player.totalBetThisHand += actualAdd;
          this.state.pot += actualAdd;
        }
        if (player.stack === 0) player.status = 'all_in';
        player.lastAction = action.type;
        break;
      }

      case 'all_in': {
        const allInAmt = player.stack;
        const newBet = player.betThisRound + allInAmt;
        player.stack = 0;
        player.betThisRound = newBet;
        player.totalBetThisHand += allInAmt;
        this.state.pot += allInAmt;
        if (newBet > this.state.currentBet) {
          this.state.minRaise = Math.max(newBet - this.state.currentBet, this.getBigBlind());
          this.state.currentBet = newBet;
          this.state.lastRaiserIndex = playerIndex;
          this.state.actedSet = new Set([playerIndex]);
        }
        player.status = 'all_in';
        player.lastAction = 'all_in';
        break;
      }
    }

    this.state.actedSet.add(playerIndex);
    this.state.lastActionAt = Date.now();

    // Check if only one player remains
    const active = players.filter(p => p.status !== 'folded');
    if (active.length === 1) {
      this.forceSingleWinner();
      return { ok: true, phaseEnded: true };
    }

    // Check if betting round is complete
    const canAct = players.filter(p => p.status === 'active');
    const roundDone = canAct.length === 0 || canAct.every(p => {
      const idx = players.indexOf(p);
      return this.state.actedSet.has(idx) && p.betThisRound === this.state.currentBet;
    });

    if (roundDone) {
      const advanced = this.advancePhase();
      return { ok: true, phaseEnded: advanced };
    }

    // Advance to next player
    this.state.activePlayerIndex = this.findNextActiveFrom(players, playerIndex);
    return { ok: true, phaseEnded: false };
  }

  private advancePhase(): boolean {
    const nextPhase: Record<string, DealPhase | 'end'> = {
      preflop: 'flop_deal',
      flop: 'turn_deal',
      turn: 'river_deal',
      river: 'showdown',
    };
    const next = nextPhase[this.state.phase];
    if (!next || next === 'end') {
      this.state.phase = 'showdown';
    } else {
      this.state.phase = next as DealPhase;
    }
    return true;
  }

  // ─── Showdown ──────────────────────────────────────────────────────────────

  computeShowdown(): HandResult {
    const active = this.state.players.filter(p => p.status !== 'folded');
    const pot = this.state.pot;

    if (active.length === 0) {
      return { handNumber: this.state.handNumber, winners: [], hiWinner: null, loWinner: null, scoopWinner: null, playerInfos: [], potAmount: pot, winLog: [] };
    }

    // Evaluate each player
    const evaluated = active.map(p => {
      const allCards = [...p.holeCards, ...this.state.topBoard];
      const hiHand = bestHighHand(allCards);
      const lo = loSum(p.holeCards);
      return { player: p, hiHand, loScore: lo };
    });

    // Find Hi winner
    const maxHiScore = Math.max(...evaluated.map(e => e.hiHand?.score ?? 0));
    const hiWinners = evaluated.filter(e => (e.hiHand?.score ?? 0) === maxHiScore);

    // Find Lo winner (lowest sum)
    const minLoScore = Math.min(...evaluated.map(e => e.loScore));
    const loWinners = evaluated.filter(e => e.loScore === minLoScore);

    // Split pot
    const hiShare = Math.floor(pot / 2);
    const loShare = pot - hiShare;

    const winnerMap = new Map<string, number>();
    const winLog: string[] = [];

    hiWinners.forEach(e => {
      const share = Math.floor(hiShare / hiWinners.length);
      const current = winnerMap.get(e.player.userId) ?? 0;
      winnerMap.set(e.player.userId, current + share);
      e.player.stack += share;
      winLog.push(`🎴 ${e.player.username}: ハイ +${share.toLocaleString()} (${e.hiHand?.label ?? 'ハイカード'})`);
    });

    loWinners.forEach(e => {
      const share = Math.floor(loShare / loWinners.length);
      const current = winnerMap.get(e.player.userId) ?? 0;
      winnerMap.set(e.player.userId, current + share);
      e.player.stack += share;
      winLog.push(`📊 ${e.player.username}: ロー +${share.toLocaleString()} (${e.loScore}点)`);
    });

    // Build winner entries
    const winners: WinnerEntry[] = [];
    const hiWinnerUserId = hiWinners[0]?.player.userId;
    const loWinnerUserId = loWinners[0]?.player.userId;

    winnerMap.forEach((amount, userId) => {
      const p = this.state.players.find(pl => pl.userId === userId)!;
      const isHi = hiWinners.some(e => e.player.userId === userId);
      const isLo = loWinners.some(e => e.player.userId === userId);
      const type: WinnerEntry['type'] = (isHi && isLo) ? 'scoop' : isHi ? 'hi' : 'lo';
      winners.push({ userId, username: p.username, avatarEmoji: p.avatarEmoji, amount, type, handLabel: isHi ? evaluated.find(e => e.player.userId === userId)?.hiHand?.label : undefined });
    });

    const scoopWinner = winners.find(w => w.type === 'scoop') ?? null;

    if (scoopWinner) winLog.push(`🏆 スクープ！ ${scoopWinner.username}`);

    const playerInfos: PlayerShowdownInfo[] = this.state.players.map(p => {
      const ev = evaluated.find(e => e.player.userId === p.userId);
      return {
        userId: p.userId,
        username: p.username,
        avatarEmoji: p.avatarEmoji,
        holeCards: [...p.holeCards],
        discardedCards: [...p.discardedCards],
        hiHand: ev?.hiHand ?? null,
        loSum: ev?.loScore ?? 999,
        finalStack: p.stack,
      };
    });

    this.state.phase = 'showdown';

    return {
      handNumber: this.state.handNumber,
      winners,
      hiWinner: winners.find(w => w.userId === hiWinnerUserId && (w.type === 'hi' || w.type === 'scoop')) ?? null,
      loWinner: winners.find(w => w.userId === loWinnerUserId && (w.type === 'lo' || w.type === 'scoop')) ?? null,
      scoopWinner,
      playerInfos,
      potAmount: pot,
      winLog,
    };
  }

  private forceSingleWinner(): void {
    const winner = this.state.players.find(p => p.status !== 'folded');
    if (!winner) return;
    winner.stack += this.state.pot;
    this.state.phase = 'showdown';
  }

  // ─── Sanitized state for clients ─────────────────────────────────────────

  getSanitizedState(forUserId: string): PersonalGameState {
    const { players, phase } = this.state;
    const isShowdown = phase === 'showdown';

    const publicPlayers: PublicPlayerState[] = players.map(p => ({
      userId: p.userId,
      username: p.username,
      avatarEmoji: p.avatarEmoji,
      seatIndex: p.seatIndex,
      stack: p.stack,
      betThisRound: p.betThisRound,
      status: p.status,
      // At showdown, everyone's card count revealed via playerInfos in HandResult
      holeCardCount: p.holeCards.length,
      discardedCards: [...p.discardedCards],
      isDealer: p.isDealer,
      isSB: p.isSB,
      isBB: p.isBB,
      lastAction: p.lastAction,
      isBot: p.isBot,
    }));

    const myPlayer = players.find(p => p.userId === forUserId);

    const pot: Pot = {
      main: this.state.pot,
      sides: [],
      total: this.state.pot,
    };

    return {
      roomId: this.state.roomId,
      handNumber: this.state.handNumber,
      phase: this.state.phase,
      gameMode: this.state.gameMode,
      bettingMode: this.state.gameMode === 'tournament' ? 'NL' : 'PL',
      topBoard: [...this.state.topBoard],
      bottomBoard: [...this.state.bottomBoard],
      pot,
      players: publicPlayers,
      activePlayerIndex: this.state.activePlayerIndex,
      dealerIndex: this.state.dealerIndex,
      sbIndex: this.state.sbIndex,
      bbIndex: this.state.bbIndex,
      smallBlind: TOURNAMENT_SB,
      bigBlind: TOURNAMENT_BB,
      currentBet: this.state.currentBet,
      minRaise: this.state.minRaise,
      lastActionAt: this.state.lastActionAt,
      updatedAt: Date.now(),
      myUserId: forUserId,
      myHoleCards: myPlayer ? [...myPlayer.holeCards] : [],
      myDiscardedCards: myPlayer ? [...myPlayer.discardedCards] : [],
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  getPhase(): DealPhase { return this.state.phase; }
  getPlayers(): ServerPlayer[] { return this.state.players; }
  getActivePlayerIndex(): number { return this.state.activePlayerIndex; }
  getActivePlayer(): ServerPlayer | undefined { return this.state.players[this.state.activePlayerIndex]; }
  getPot(): number { return this.state.pot; }
  getHandNumber(): number { return this.state.handNumber; }

  setPlayerStatus(userId: string, status: ServerPlayer['status']): void {
    const p = this.state.players.find(pl => pl.userId === userId);
    if (p) p.status = status;
  }

  getPlayerIds(): string[] { return this.state.players.map(p => p.userId); }

  isShowdown(): boolean { return this.state.phase === 'showdown'; }
  isDealPhase(): boolean { return ['flop_deal', 'turn_deal', 'river_deal'].includes(this.state.phase); }

  private findNextActiveFrom(players: ServerPlayer[], fromIndex: number): number {
    const n = players.length;
    for (let i = 1; i <= n; i++) {
      const idx = (fromIndex + i) % n;
      if (players[idx].status === 'active') return idx;
    }
    return -1;
  }

  private getBigBlind(): number {
    return TOURNAMENT_BB;
  }

  private potLimitMax(myCurrentBet: number): number {
    const pot = this.state.pot;
    const call = Math.max(0, this.state.currentBet - myCurrentBet);
    return myCurrentBet + call + (pot + call);
  }
}
