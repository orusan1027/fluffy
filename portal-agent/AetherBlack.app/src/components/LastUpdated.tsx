interface Props {
  fetchedAt: string;
}

export default function LastUpdated({ fetchedAt }: Props) {
  const date = new Date(fetchedAt);
  const formatted = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Tokyo",
    timeZoneName: "short",
  }).format(date);

  return (
    <p className="mt-6 text-center text-xs text-aether-muted">
      最終取得: {formatted}
    </p>
  );
}
