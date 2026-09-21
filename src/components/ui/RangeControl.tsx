interface RangeControlProps {
  id: string;
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  spokenUnit: string;
  onChange: (value: number) => void;
  onPreview?: () => void;
}

export function RangeControl({
  id,
  label,
  description,
  value,
  min,
  max,
  unit,
  spokenUnit,
  onChange,
  onPreview,
}: RangeControlProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <label className="font-medium" htmlFor={id}>
          {label}
        </label>
        <output
          htmlFor={id}
          className="rounded-lg bg-raised px-3 py-1 font-mono text-sm text-accent tabular-nums"
        >
          {value}
          {unit === '%' ? '' : ' '}
          {unit}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-describedby={`${id}-help`}
        aria-valuetext={`${value} ${spokenUnit}`}
        onChange={event => onChange(Number(event.target.value))}
        onPointerUp={onPreview}
        onKeyUp={event => {
          if (
            [
              'ArrowLeft',
              'ArrowRight',
              'ArrowUp',
              'ArrowDown',
              'Home',
              'End',
              'PageUp',
              'PageDown',
            ].includes(event.key)
          )
            onPreview?.();
        }}
        className="h-8 w-full cursor-pointer accent-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      />
      <p id={`${id}-help`} className="text-sm leading-relaxed text-muted">
        {description}
      </p>
    </div>
  );
}
