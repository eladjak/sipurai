import { useState, useEffect, useRef, useCallback } from "react";

const AUTO_SAVE_DELAY_MS = 3000;
const AUTO_SAVE_STORAGE_PREFIX = "ey_autosave_";

/**
 * Auto-save hook that debounces saves to localStorage and optionally to a remote DB.
 *
 * @param {string} key - Unique key for this auto-save instance (e.g., book ID)
 * @param {object} data - The data to auto-save
 * @param {object} [options]
 * @param {function} [options.onSaveToDb] - Async function to persist to database
 * @param {number} [options.delayMs] - Debounce delay in ms (default 3000)
 * @param {boolean} [options.enabled] - Whether auto-save is active (default true)
 * @returns {{ status: string, lastSaved: Date|null, forceSave: function, clearSaved: function }}
 */
export function useAutoSave(key, data, options = {}) {
  const {
    onSaveToDb = null,
    delayMs = AUTO_SAVE_DELAY_MS,
    enabled = true
  } = options;

  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [lastSaved, setLastSaved] = useState(null);
  const timerRef = useRef(null);
  const dataRef = useRef(data);
  const initialLoadDone = useRef(false);

  // Keep data ref in sync
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Debounced save to localStorage
  useEffect(() => {
    if (!enabled || !key || !initialLoadDone.current) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      saveToLocalStorage();
    }, delayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [data, key, enabled, delayMs]);

  // Mark initial load as done after first render
  useEffect(() => {
    initialLoadDone.current = true;
  }, []);

  const saveToLocalStorage = useCallback(() => {
    if (!key) return;

    try {
      setStatus("saving");
      const storageKey = `${AUTO_SAVE_STORAGE_PREFIX}${key}`;
      const payload = {
        data: dataRef.current,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setLastSaved(new Date());
      setStatus("saved");
    } catch (error) {
      setStatus("error");
    }
  }, [key]);

  const forceSave = useCallback(async () => {
    if (!key) return;

    try {
      setStatus("saving");

      // Save to localStorage
      const storageKey = `${AUTO_SAVE_STORAGE_PREFIX}${key}`;
      const payload = {
        data: dataRef.current,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));

      // Save to DB if handler provided
      if (onSaveToDb) {
        await onSaveToDb(dataRef.current);
      }

      setLastSaved(new Date());
      setStatus("saved");
    } catch (error) {
      setStatus("error");
    }
  }, [key, onSaveToDb]);

  const clearSaved = useCallback(() => {
    if (!key) return;
    const storageKey = `${AUTO_SAVE_STORAGE_PREFIX}${key}`;
    localStorage.removeItem(storageKey);
    setStatus("idle");
    setLastSaved(null);
  }, [key]);

  return { status, lastSaved, forceSave, clearSaved };
}

/**
 * Load auto-saved data from localStorage.
 * @param {string} key - The auto-save key
 * @returns {{ data: object|null, timestamp: string|null }}
 */
export function loadAutoSaved(key) {
  if (!key) return { data: null, timestamp: null };

  try {
    const storageKey = `${AUTO_SAVE_STORAGE_PREFIX}${key}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { data: null, timestamp: null };

    const parsed = JSON.parse(raw);
    return {
      data: parsed.data || null,
      timestamp: parsed.timestamp || null
    };
  } catch (error) {
    return { data: null, timestamp: null };
  }
}
