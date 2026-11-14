import { useCallback, useEffect, useState } from "react";

const read = (key, initialValue) => {
  try {
    const stored = window.localStorage.getItem(key);
    return stored !== null ? JSON.parse(stored) : initialValue;
  } catch {
    return initialValue;
  }
};

export function useLocalStorage(key, initialValue) {
  const [state, setState] = useState(() => ({ key, value: read(key, initialValue) }));
  // Do not render the prior namespace while React applies a key change.
  const keyChanged = state.key !== key;
  const value = keyChanged ? read(key, initialValue) : state.value;

  useEffect(() => {
    if (keyChanged) setState({ key, value });
  }, [key, keyChanged, value]);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage might be full or unavailable; fail silently.
    }
  }, [key, value]);

  const setValue = useCallback((next) => {
    setState((current) => {
      const currentValue = current.key === key ? current.value : read(key, initialValue);
      return { key, value: typeof next === "function" ? next(currentValue) : next };
    });
  }, [key]);

  return [value, setValue];
}
