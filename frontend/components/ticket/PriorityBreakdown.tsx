interface Factor {
  label: string;
  score: number;
}

interface PriorityBreakdownProps {
  factors: Factor[];
}

export function PriorityBreakdown({ factors }: PriorityBreakdownProps) {
  return (
    <div className="space-y-2">
      {factors.map((f) => (
        <div key={f.label} className="flex items-center justify-between text-sm">
          <span className="text-neutral-700">{f.label}</span>
          <span className="font-medium text-neutral-800">{f.score.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
