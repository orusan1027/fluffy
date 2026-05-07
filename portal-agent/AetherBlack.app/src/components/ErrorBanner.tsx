interface Props {
  errors: string[];
}

export default function ErrorBanner({ errors }: Props) {
  if (errors.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-red-700 bg-red-950/60 p-4">
      <p className="mb-2 text-sm font-semibold text-red-400">
        一部のデータ取得に失敗しました
      </p>
      <ul className="list-inside list-disc space-y-1">
        {errors.map((err, i) => (
          <li key={i} className="text-xs text-red-300">
            {err}
          </li>
        ))}
      </ul>
    </div>
  );
}
