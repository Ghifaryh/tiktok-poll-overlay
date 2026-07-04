import { useState } from "react";
import { api } from "../lib/api";

export function CreateLayoutForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"comment" | "gift">("comment");
  const [options, setOptions] = useState([{ label: "", matchValue: "" }]);

  function updateOption(i: number, field: "label" | "matchValue", value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, [field]: value } : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, { label: "", matchValue: "" }]);
  }

  function removeOption(i: number) {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const valid = options.filter((o) => o.label && o.matchValue);
    if (!name || valid.length < 2) return; // a poll needs at least 2 real options

    await api.createLayout({ name, sourceType, options: valid });
    setName("");
    setOptions([{ label: "", matchValue: "" }]);
    onCreated();
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setName(e.target.value);
  }
  function handleSourceTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSourceType(e.target.value as "comment" | "gift");
  }
  function handleOptionChange(i: number, field: "label" | "matchValue") {
    return (e: React.ChangeEvent<HTMLInputElement>) => updateOption(i, field, e.target.value);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 rounded-xl border border-border p-3.5">
      <input
        type="text"
        placeholder="Poll name"
        value={name}
        onChange={handleNameChange}
        className="rounded-md border border-border px-2.5 py-2 text-sm"
      />
      <select
        value={sourceType}
        onChange={handleSourceTypeChange}
        className="rounded-md border border-border px-2.5 py-2 text-sm"
      >
        <option value="comment">Match by comment</option>
        <option value="gift">Match by gift</option>
      </select>

      {options.map((opt, i) => (
        <div key={i} className="flex gap-1.5">
          <input
            type="text"
            placeholder={`Option ${i + 1} label`}
            value={opt.label}
            onChange={(e) => updateOption(i, "label", e.target.value)}
            className="flex-1 rounded-md border border-border px-2.5 py-2 text-sm"
          />
          <input
            type="text"
            placeholder={sourceType === "comment" ? 'e.g. "1"' : "gift id"}
            value={opt.matchValue}
            onChange={(e) => updateOption(i, "matchValue", e.target.value)}
            className="w-24 rounded-md border border-border px-2.5 py-2 text-sm"
          />
          {options.length > 1 && (
            <button type="button" onClick={() => removeOption(i)} aria-label="Remove option" className="px-2 text-text-muted">
              ✕
            </button>
          )}
        </div>
      ))}

      <button type="button" onClick={addOption} className="rounded-md border border-border py-2 text-sm">
        + Add option
      </button>
      <button type="submit" className="rounded-md bg-text-primary py-2 text-sm text-white">
        Create layout
      </button>
    </form>
  );
}