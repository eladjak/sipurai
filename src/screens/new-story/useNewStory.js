import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Book } from "@/entities/Book";
import { Page } from "@/entities/Page";
import { InvokeLLM, GenerateImage } from "@/integrations/Core";
import { generateBookIncremental } from "@/lib/bookGeneration";
import { buildRecipe, pageCountFor } from "@/lib/bookRecipe";
import {
  reserveBookSlot,
  clearActiveBookKey,
  newBookKey,
  QuotaError,
} from "@/lib/bookQuota";
import { initialEditionFields } from "@/lib/printEdition/model";
import { moderateInput } from "@/utils/content-moderation";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function newStoryStorageKey(ownerId) {
  const encoded = encodeURIComponent(ownerId);
  return `sipurai_new_story_v2_${encoded.length}_${encoded}`;
}

export function useNewStory(language, leaveMessage) {
  const { user } = useCurrentUser();
  const ownerId = user?.id || null;
  const ownerRef = useRef(ownerId);
  ownerRef.current = ownerId;
  const [loadedOwner, setLoadedOwner] = useState(null);
  const [step, setStep] = useState(0),
    [hero, setHero] = useState(null),
    [topic, setTopic] = useState("");
  const [length, setLength] = useState("medium"),
    [style, setStyle] = useState("disney");
  const [printEdition, setPrintEdition] = useState(null),
    [printSize, setPrintSize] = useState("square-220");
  const [quotaError, setQuotaError] = useState(null);
  const [state, setState] = useState(null),
    [bookId, setBookId] = useState(null),
    [invalid, setInvalid] = useState(false);
  const lock = useRef(false),
    key = useRef(null),
    savedBook = useRef(null);
  useLayoutEffect(() => {
    key.current = null;
    savedBook.current = null;
    setState(null);
    setBookId(null);
    setStep(0);
    setHero(null);
    setTopic("");
    setLength("medium");
    setStyle("disney");
    setPrintEdition(null);
    setPrintSize("square-220");
    if (!ownerId) {
      setLoadedOwner(null);
      return;
    }
    try {
      const raw = localStorage.getItem(newStoryStorageKey(ownerId));
      if (raw) {
        const draft = JSON.parse(raw);
        setStep(
          Number.isInteger(draft.step) && draft.step >= 0 && draft.step <= 2
            ? draft.step
            : 0,
        );
        setHero(draft.hero || null);
        setTopic(typeof draft.topic === "string" ? draft.topic : "");
        setLength(draft.length || "medium");
        setStyle(draft.style || "disney");
        setPrintEdition(draft.printEdition || null);
        setPrintSize(draft.printSize || "square-220");
        key.current = draft.attemptId || null;
      }
    } catch {
      /* Invalid storage is never used as another account's draft. */
    }
    setLoadedOwner(ownerId);
  }, [ownerId]);
  const writeDraft = (attemptId = key.current) => {
    if (!ownerId || loadedOwner !== ownerId || ownerRef.current !== ownerId)
      return false;
    try {
      localStorage.setItem(
        newStoryStorageKey(ownerId),
        JSON.stringify({
          step,
          hero,
          topic,
          length,
          style,
          printEdition,
          printSize,
          attemptId: attemptId || null,
        }),
      );
      return true;
    } catch {
      return false;
    }
  };
  useEffect(() => {
    if (ownerId && loadedOwner === ownerId && !state && (hero || topic))
      writeDraft();
  }, [
    ownerId,
    loadedOwner,
    step,
    hero,
    topic,
    length,
    style,
    printEdition,
    printSize,
    state,
  ]);
  useEffect(() => {
    const offline = () => {
      if (lock.current) setState("disconnected");
    };
    window.addEventListener("offline", offline);
    return () => window.removeEventListener("offline", offline);
  }, []);
  useEffect(() => {
    if (!(hero || topic) || state) return;
    const before = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", before);
    const click = (e) => {
      const a = e.target.closest?.("a[href]");
      if (a && !window.confirm(leaveMessage)) e.preventDefault();
    };
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
    };
  }, [hero, topic, state, leaveMessage]);
  const start = async () => {
    if (lock.current) return;
    if (moderateInput(topic, "description").blocked) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    lock.current = true;
    setState("queued");
    const previousKey = key.current || savedBook.current;
    key.current ||= newBookKey();
    const timer = setTimeout(
      () => setState((s) => (s === "queued" ? "slow" : s)),
      30000,
    );
    try {
      if (!writeDraft(key.current)) throw new Error("draft_unavailable");
      if (previousKey && !savedBook.current && Book.generationStore) {
        const matches = await Book.filter({ id: key.current });
        savedBook.current = matches.some(
          (book) => book.id === key.current && book.created_by === ownerId,
        )
          ? key.current
          : null;
      }
      if (ownerRef.current !== ownerId) throw new Error("account_changed");
      if (!savedBook.current || !Book.generationStore) {
        const reservation = await reserveBookSlot(key.current);
        if (Book.generationStore && reservation?.skipped)
          throw new Error("reservation_missing");
      }
      if (ownerRef.current !== ownerId) throw new Error("account_changed");
      const characters = [hero];
      const persistedCharacters = characters.map((c) => ({
        id: c.id,
        name: c.name,
        appearance: c.appearance || "",
        description: c.description || "",
        traits: c.traits || "",
      }));
      const bookData = {
        title: topic,
        description: topic,
        moral: "",
        art_style: style,
        length,
        genre: "adventure",
        age_range: "5-7",
        language: language === "hebrew" ? "hebrew" : "english",
        child_name: hero.name,
        child_age: hero.age || 5,
        child_gender: "neutral",
        tone: "exciting",
        interests: "",
        family_members: "",
        status: "draft",
        cover_image: "",
        print_size: printSize,
        selectedCharacters: persistedCharacters,
        ...initialEditionFields(printEdition),
      };
      const recipe = buildRecipe({
        bookData,
        characters,
        scenes: [],
        topic,
        useRhyming: false,
        rhymeSettings: { pattern: "aabb", meter: "free", complexity: "simple" },
        storyBible: null,
        pageCount: pageCountFor(length),
        defaultAgeRange: localStorage.getItem("preferredAgeRange") || "5-10",
      });
      const result = await generateBookIncremental({
        entities: { Book, Page },
        ai: { InvokeLLM, GenerateImage },
        recipe,
        newBookId: key.current,
        bookId: savedBook.current,
        onEvent: (event) => {
          if (ownerRef.current !== ownerId) return;
          if (
            (event.type === "book-created" || event.type === "resumed") &&
            event.bookId
          ) {
            savedBook.current = event.bookId;
            setBookId(event.bookId);
          }
        },
      });
      if (ownerRef.current !== ownerId) return;
      if (result.bookId) {
        savedBook.current = result.bookId;
        setBookId(result.bookId);
      }
      if (result.status === "failed" || !result.bookId)
        throw new Error("Story not readable");
      if (result.status === "complete") {
        key.current = null;
        savedBook.current = null;
        writeDraft(null);
      }
      setState(result.status === "partial" ? "partial" : "success");
    } catch (err) {
      if (ownerRef.current !== ownerId) return;
      if (err instanceof QuotaError) {
        setQuotaError(err);
        setState("limited");
      } else {
        if (err?.bookId) {
          savedBook.current = err.bookId;
          setBookId(err.bookId);
        }
        setState(navigator.onLine ? "failed" : "disconnected");
      }
    } finally {
      clearTimeout(timer);
      clearActiveBookKey();
      lock.current = false;
    }
  };
  return {
    step,
    setStep,
    hero,
    setHero,
    topic,
    setTopic,
    length,
    setLength,
    style,
    setStyle,
    printEdition,
    setPrintEdition,
    printSize,
    setPrintSize,
    state,
    bookId,
    start,
    invalid,
    quotaError,
  };
}
