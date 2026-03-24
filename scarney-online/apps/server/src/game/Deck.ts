import type { Card, Suit, Rank } from '@scarney/shared';
import { SUITS, RANKS } from '@scarney/shared';

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ rank, suit, id: `${rank}${suit}` });
    }
  }
  return cards;
}

export function shuffle(deck: Card[]): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createShuffledDeck(): Card[] {
  return shuffle(createDeck());
}
