import { useState } from "react";
import { Sheet } from "../../shell/Sheet";

type Props = {
  onClose: () => void;
};

/** Placeholder key/value field (URL-param style). Local state only for now. */
export function KvSheet({ onClose }: Props) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  const preview =
    key.trim() === "" && value.trim() === ""
      ? "?key=value"
      : `?${encodeURIComponent(key.trim() || "key")}=${encodeURIComponent(value)}`;

  return (
    <Sheet title="Parameters" eyebrow="console" onClose={onClose}>
      <div className="list">
        <div className="row">
          <label className="auth-label" htmlFor="kv-key">
            Key
          </label>
          <input
            id="kv-key"
            className="auth-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="key"
          />
        </div>
        <div className="row">
          <label className="auth-label" htmlFor="kv-value">
            Value
          </label>
          <input
            id="kv-value"
            className="auth-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="value"
          />
        </div>
        <div className="row">
          <div className="row-meta">preview</div>
          <div className="row-body">
            <code>{preview}</code>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
