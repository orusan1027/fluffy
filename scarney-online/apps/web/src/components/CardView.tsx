import type { Card } from '@scarney/shared';

const SUIT_SYMBOL: Record<string, string> = {
  c: '♣', d: '♦', h: '♥', s: '♠',
};

interface Props {
  card?: Card | null;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
  style?: React.CSSProperties;
  className?: string;
  animateDelay?: number;
}

export default function CardView({ card, size = 'md', faceDown = false, style, className = '', animateDelay }: Props) {
  const isRed = card?.suit === 'd' || card?.suit === 'h';
  const sizeClass = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : '';
  const colorClass = faceDown ? '' : isRed ? 'red' : 'black';
  const backClass = faceDown ? 'back' : '';

  const cardStyle: React.CSSProperties = {
    ...style,
    ...(animateDelay !== undefined ? { animationDelay: `${animateDelay}ms` } : {}),
  };

  if (!card && !faceDown) {
    return (
      <div
        className={`playing-card ${sizeClass} back ${className}`}
        style={cardStyle}
      />
    );
  }

  return (
    <div
      className={`playing-card ${sizeClass} ${colorClass} ${backClass} animate-deal ${className}`}
      style={cardStyle}
    >
      {!faceDown && card && (
        <>
          <span className="card-rank">{card.rank}</span>
          <span className="card-suit">{SUIT_SYMBOL[card.suit]}</span>
        </>
      )}
    </div>
  );
}
