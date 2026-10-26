// Radio buttons underneath, so the keyboard works.
export function ToggleGroup<Value extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: Value;
  options: { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col rounded-md border border-rule bg-field p-1">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`flex h-10 cursor-pointer items-center justify-center rounded text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-ink ${
                selected ? "bg-ink text-paper" : "text-ink-muted hover:text-ink"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
