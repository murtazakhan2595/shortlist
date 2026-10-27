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
      {/* Options share a row equally, and wrap onto a second one when their names do not fit (a phone, five sources). */}
      <div className="flex flex-wrap rounded-md border border-rule bg-field p-1">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`flex h-10 min-w-fit grow basis-0 cursor-pointer items-center justify-center rounded px-3 text-sm font-medium whitespace-nowrap has-focus-visible:outline-2 has-focus-visible:outline-ink ${
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
