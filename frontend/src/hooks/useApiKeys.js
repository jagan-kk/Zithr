import { useCallback, useEffect, useState } from "react";
import { createApiKey, deleteApiKey, getApiKeys } from "../api/client";

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

  const addKey = useCallback(async (name) => {
    try {
      const key = await createApiKey(name || "New Project Key");
      setApiKeys((prev) => [...prev, key]);
      return key;
    } catch (err) {
      console.error("Create key failed:", err);
      return null;
    }
  }, []);

  const copyKey = useCallback((key) => {
    navigator.clipboard?.writeText(key);
  }, []);

  const revokeKey = useCallback(async (id) => {
    try {
      await deleteApiKey(id);
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      return true;
    } catch (err) {
      console.error("Revoke key failed:", err);
      return false;
    }
  }, []);

  return {
    apiKeys,
    addKey,
    copyKey,
    revokeKey,
  };
}