import { useCallback, useEffect, useState } from "react";
import { createApiKey, getApiKeys } from "../api/client";

const FALLBACK_KEYS = [
  {
    id: "k1",
    name: "React Portfolio Widget",
    key: "vcs_live_9f81a7bc6d4e21093a",
    requests: 1420,
  },
  {
    id: "k2",
    name: "Discord Lo-Fi Bot",
    key: "vcs_live_3e21098b6c5a4d12f1",
    requests: 8930,
  },
];

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState(FALLBACK_KEYS);
  const [newKeyName, setNewKeyName] = useState("");
  const [copiedKeyId, setCopiedKeyId] = useState(null);

  const loadKeys = useCallback(async () => {
    try {
      const keys = await getApiKeys();
      if (keys.length > 0) setApiKeys(keys);
    } catch (e) {
      console.error("API key load failed, using fallback:", e);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const addKey = useCallback(
    async (e) => {
      e.preventDefault();
      try {
        const key = await createApiKey(newKeyName || "New Project Key");
        setApiKeys((prev) => [...prev, key]);
        setNewKeyName("");
      } catch (err) {
        console.error("Create key failed:", err);
      }
    },
    [newKeyName]
  );

  const copyKey = useCallback((id, value) => {
    navigator.clipboard?.writeText(value);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 1500);
  }, []);

  return {
    apiKeys,
    newKeyName,
    setNewKeyName,
    copiedKeyId,
    addKey,
    copyKey,
  };
}