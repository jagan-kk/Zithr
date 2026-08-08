import { useState } from "react";
import { Check, Copy, KeyRound, Plus, Radio, Trash2 } from "lucide-react";

export default function ApiKeyManager({ apiKeys, copyKey, onAdd, onRevoke }) {
  const [name, setName] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (key) => {
    copyKey(key.key);
    setCopiedId(key.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name);
    setName("");
  };

  const handleRevoke = (k) => {
    if (window.confirm(`Revoke the API key "${k.name}"? It will stop working immediately.`)) {
      onRevoke(k.id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-[#3a332b] rounded-xl bg-[#1d1a16] p-5">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={18} className="text-[#d4a373]" />
          <h3 className="font-semibold text-[#e8dfd1]">Streaming API Keys</h3>
        </div>
        <p className="text-xs text-[#6b635a] mb-4">
          Generate keys to embed the live streamer in your own apps.
        </p>

        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name (e.g. Discord Lo-Fi Bot)"
            className="flex-1 rounded-lg bg-[#141210] border border-[#3a332b] px-3 py-2 text-sm text-[#e8dfd1] placeholder-[#6b635a] focus:outline-none focus:border-[#d4a373]"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-lg bg-[#d4a373] text-[#141210] font-semibold px-4 py-2 text-sm disabled:opacity-50"
          >
            <Plus size={16} />
          </button>
        </form>
      </div>

      <ul className="space-y-2">
        {apiKeys.map((k) => (
          <li
            key={k.id}
            className="flex items-center gap-3 border border-[#3a332b] rounded-xl bg-[#1d1a16] p-4"
          >
            <Radio size={16} className="text-[#d4a373]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#e8dfd1] truncate">{k.name}</p>
              <p className="text-xs text-[#a3978b] font-mono truncate">{k.key}</p>
            </div>
            <span className="text-xs text-[#6b635a]">{k.requests} reqs</span>
            {k.name === "Default Web Embed Key" && (
              <span className="text-[10px] uppercase tracking-wide text-[#6b635a] border border-[#3a332b] rounded px-1.5 py-0.5">
                Protected
              </span>
            )}
            <button
              onClick={() => handleCopy(k)}
              className="p-1.5 rounded-full text-[#a3978b] hover:text-[#d4a373]"
              aria-label="Copy key"
            >
              {copiedId === k.id ? (
                <Check size={15} className="text-emerald-500" />
              ) : (
                <Copy size={15} />
              )}
            </button>
            {k.name !== "Default Web Embed Key" && (
              <button
                onClick={() => handleRevoke(k)}
                className="p-1.5 rounded-full text-[#a3978b] hover:text-red-500"
                aria-label="Revoke key"
                title="Revoke key"
              >
                <Trash2 size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}