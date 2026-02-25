"use client";

import { useEffect, useRef, useState } from "react";

type Options<T> = {
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
};

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
  options?: Options<T>,
) {
  const serialize = options?.serialize ?? ((v: T) => JSON.stringify(v));
  const deserialize =
    options?.deserialize ?? ((raw: string) => JSON.parse(raw) as T);

  const [hydrated, setHydrated] = useState(false);
  const [value, setValue] = useState<T>(initialValue);

  // avoid re-reading on every render if key changes mid-flight
  const keyRef = useRef(key);
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved != null) setValue(deserialize(saved));
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(keyRef.current, serialize(value));
    } catch {
      // ignore
    }
  }, [hydrated, value, serialize]);

  return { value, setValue, hydrated } as const;
}
