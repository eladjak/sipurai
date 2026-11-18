import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { generateDurableBook } from "../durableBookRun";
import { buildRecipe } from "../bookRecipe";
import { reserveBookSlot } from "../bookQuota";

vi.mock("../bookQuota", () => ({
  newBookKey: () => crypto.randomUUID(),
  reserveBookSlot: vi.fn(async () => ({ ok: true })),
}));
const id = "11111111-1111-4111-8111-111111111111";
function fixture() {
  let book = null,
    checkpoint = null,
    held = false,
    fence = 0,
    seq = 0;
  const rows = new Map();
  const Book = {
    create: vi.fn(async (data) => (book = { ...data })),
    get: vi.fn(async () => book),
    update: vi.fn(async (_id, patch) => (book = { ...book, ...patch })),
  };
  const Page = {
    filter: vi.fn(async () => [...rows.values()].map((r) => ({ ...r }))),
  };
  const storage = {
    acquire: vi.fn(async ({ newQuotaKey, seed, createBook }) => {
      if (held) throw Object.assign(Error("busy"), { code: "busy" });
      if (!seed && !checkpoint)
        throw Object.assign(Error("missing"), { code: "provenance_missing" });
      held = true;
      fence++;
      if (createBook && !book)
        book = {
          ...createBook,
          id,
          status: "generating",
          is_public: false,
          cover_image: "",
        };
      if (seed && !checkpoint) checkpoint = structuredClone(seed);
      return {
        fence,
        book: structuredClone(book),
        checkpoint: structuredClone(checkpoint),
        quotaKey: newQuotaKey || id,
      };
    }),
    renew: vi.fn(async () => {}),
    release: vi.fn(async () => {
      held = false;
    }),
    savePlan: vi.fn(async ({ checkpoint: c, skeletons }) => {
      checkpoint = structuredClone(c);
      for (const p of skeletons) {
        let found = [...rows.values()].find(
          (r) => r.page_number === p.page_number,
        );
        const rid = found?.id || `p${++seq}`;
        rows.set(rid, {
          id: rid,
          book_id: id,
          image_url: null,
          ...found,
          ...p,
        });
      }
    }),
    listRows: vi.fn(async () => [...rows.values()].map((r) => ({ ...r }))),
    bookWrite: vi.fn(async ({ patch }) => {
      book = { ...book, ...patch };
    }),
    commitPages: vi.fn(async ({ items }) => {
      for (const { id: rid, expected, patch } of items) {
        const old = rows.get(rid);
        if (Object.keys(expected).some((k) => (old[k] ?? null) !== expected[k]))
          throw Object.assign(Error("conflict"), { code: "conflict" });
        rows.set(rid, { ...old, ...patch });
      }
    }),
  };
  return {
    entities: { Book, Page },
    storage,
    get book() {
      return book;
    },
    get checkpoint() {
      return checkpoint;
    },
    rows,
    hold: () => {
      held = true;
    },
    free: () => {
      held = false;
    },
    setBook: (x) => {
      book = x;
    },
  };
}
const inputs = {
  bookData: {
    title: "A family title",
    description: "Journey",
    language: "english",
    art_style: "watercolor",
    length: "short",
    print_size: "square-200",
  },
  characters: [{ id: "hero", name: "Maya", traits: "kind" }],
  scenes: [{ title: "Beginning", description: "Find the key" }],
  topic: "forest",
  pageCount: 2,
};
function makeRecipe() {
  return buildRecipe(structuredClone(inputs));
}
function makeAI({ failCover = false, failPage = false } = {}) {
  let calls = [];
  return {
    calls,
    InvokeLLM: vi.fn(async (req) => {
      calls.push(req.prompt);
      if (req.prompt.includes("copy editor"))
        return {
          pages: [0, 1].map((i) => ({
            page_number: i,
            text_content: `Edited ${i}`,
            image_prompt: `Scene ${i}`,
          })),
        };
      return {
        title: "Unapproved title",
        outline: [{ description: "Beginning" }, { description: "Ending" }],
        cast: [],
      };
    }),
    GenerateImage: vi.fn(async (req) => {
      calls.push(req);
      if (failCover && !req.referenceImageBase64)
        throw Error("cover unavailable");
      if (failPage && req.referenceImageBase64)
        throw Error("image unavailable");
      return { url: "https://example.test/image", base64: "COVER" };
    }),
  };
}
const run = (f, ai, extra = {}) =>
  generateDurableBook({
    storage: f.storage,
    entities: f.entities,
    ai,
    recipe: makeRecipe(),
    newBookId: id,
    lock: () => () => {},
    fetchReference: async () => "validated pixels",
    ...extra,
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      headers: { get: () => "image/png" },
      arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
    })),
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("durable book generation", () => {
  it("uses permanent reserved id and checkpoints family plan and edited text", async () => {
    const f = fixture(),
      ai = makeAI();
    await run(f, ai);
    expect(f.book.id).toBe(id);
    expect(f.storage.acquire.mock.calls[0][0].newQuotaKey).toBe(id);
    expect(f.checkpoint.recipe.bookData.art_style).toBe("watercolor");
    expect(f.checkpoint.recipe.characters[0].name).toBe("Maya");
    expect(f.checkpoint.recipe.scenes[0].title).toBe("Beginning");
    expect(f.checkpoint.manuscriptSaved).toBe(true);
    expect(f.checkpoint.scenes[0].title).toBe("Beginning");
    expect(f.checkpoint.drawingPrompts[0]).toContain("Scene 0");
    expect(f.checkpoint.manuscript[0].text_content).toBe("Edited 0");
    expect(
      f.storage.savePlan.mock.calls[0][0].skeletons.map((p) => p.text_content),
    ).toEqual(["Edited 0", "Edited 1"]);
    expect([...f.rows.values()].map((p) => p.text_content)).toEqual([
      "Edited 0",
      "Edited 1",
    ]);
    expect(f.book.title).toBe("A family title");
  });
  it("does not start a second device while a lease is busy", async () => {
    const f = fixture();
    f.setBook({ id, status: "partial", total_pages: 2 });
    f.hold();
    await expect(run(f, makeAI(), { bookId: id })).rejects.toMatchObject({
      code: "busy",
    });
    expect(reserveBookSlot).not.toHaveBeenCalled();
  });
  it("fences an overlapping second device while first device is editing", async () => {
    const f = fixture(),
      ai = makeAI();
    let release;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    let started;
    const editing = new Promise((resolve) => {
      started = resolve;
    });
    const answer = ai.InvokeLLM;
    ai.InvokeLLM = vi.fn(async (req) => {
      if (req.prompt.includes("copy editor")) {
        started();
        await pending;
      }
      return answer(req);
    });
    const first = run(f, ai);
    await editing;
    await expect(run(f, makeAI(), { bookId: id })).rejects.toMatchObject({
      code: "busy",
    });
    expect(reserveBookSlot).not.toHaveBeenCalled();
    release();
    await first;
  });
  it("requires explicit consent before reserving for old books without provenance", async () => {
    const f = fixture();
    f.setBook({ id, status: "partial", total_pages: 2 });
    await expect(run(f, makeAI(), { bookId: id })).rejects.toMatchObject({
      code: "provenance_missing",
    });
    expect(reserveBookSlot).not.toHaveBeenCalled();
  });
  it("reopens a historical complete book before saving its plan, keeping the parent's words", async () => {
    const f = fixture();
    f.setBook({ id, title: "Old book", total_pages: 2, status: "complete", cover_image: "cover" });
    for (const i of [0, 1]) {
      f.rows.set("old-" + i, { id: "old-" + i, book_id: id, page_number: i,
        text_content: "Original page " + i, image_url: i ? "bad-art" : "old-art", image_prompt: "Original scene", layout_type: "standard" });
    }
    const publishPlan = f.storage.savePlan.getMockImplementation();
    f.storage.savePlan.mockImplementation(args => {
      if (f.book.status === "complete") throw Error("book_complete");
      return publishPlan(args);
    });
    const ai = makeAI();
    const result = await run(f, ai, { bookId: id, allowLegacyReservation: true, repairPages: [1] });
    expect(result.status).toBe("complete");
    expect(f.storage.bookWrite.mock.calls[0][0].patch).toEqual({status: "partial"});
    expect(ai.InvokeLLM).not.toHaveBeenCalled();
    expect(ai.GenerateImage).toHaveBeenCalledTimes(1);
    expect(f.rows.get("old-1").text_content).toBe("Original page 1");
    expect(reserveBookSlot).toHaveBeenCalledExactlyOnceWith(id);
  });

  it("requires a deliberate legacy reservation before accepting an unproven old book", async () => {
    const f = fixture();
    f.setBook({ id, status: "partial", total_pages: 2, title: "Old book" });
    await run(f, makeAI(), { bookId: id, allowLegacyReservation: true });
    expect(reserveBookSlot).toHaveBeenCalledTimes(1);
    expect(reserveBookSlot).toHaveBeenCalledWith(id);
  });
  it("retries a failed picture with its original scene prompt and cover reference", async () => {
    const f = fixture();
    await run(f, makeAI({ failPage: true }));
    const failed = [...f.rows.values()][0];
    const previous = failed.image_prompt.replace(
      /^\[Image generation failed\] /,
      "",
    );
    const ai = makeAI();
    await run(f, ai, { bookId: id });
    const retries = ai.GenerateImage.mock.calls
      .map(([args]) => args)
      .filter((x) => x.referenceImageBase64);
    expect(retries.length).toBeGreaterThan(0);
    expect(retries[0].prompt).toBe(previous);
    expect(retries[0].referenceImageBase64).toBeTruthy();
  });
  it("does not overwrite a parent edit made after a worker read the page", async () => {
    const f = fixture(),
      ai = makeAI(),
      events = [];
    const generate = ai.GenerateImage;
    ai.GenerateImage = vi.fn(async (args) => {
      if (args.referenceImageBase64) {
        const row = [...f.rows.values()].find((p) => p.page_number === 0);
        if (row) f.rows.set(row.id, { ...row, text_content: "Parent edit" });
      }
      return generate(args);
    });
    await run(f, ai, { onEvent: (e) => events.push(e) });
    expect(
      [...f.rows.values()].find((p) => p.page_number === 0).text_content,
    ).toBe("Parent edit");
    expect(
      events.some(
        (e) => e.type === "page-image-failed" && /conflict/.test(e.message),
      ),
    ).toBe(true);
  });
  it("returns partial if cover is missing, then allows repair", async () => {
    const f = fixture();
    const first = await run(f, makeAI({ failCover: true }));
    expect(first.status).toBe("partial");
    const second = await run(f, makeAI(), { bookId: id, repairCover: true });
    expect(second.status).toBe("complete");
  });
  it("after interruption resumes the saved words using the same slot key", async () => {
    const f = fixture(),
      controller = new AbortController();
    await reserveBookSlot(id);
    await run(f, makeAI(), {
      signal: controller.signal,
      onEvent: (e) => {
        if (e.type === "plan-saved") controller.abort();
      },
    });
    const before = [...f.rows.values()].map((p) => p.text_content);
    expect(before).toEqual(["Edited 0", "Edited 1"]);
    const ai = makeAI();
    await run(f, ai, { bookId: id });
    expect([...f.rows.values()].map((p) => p.text_content)).toEqual(before);
    expect(ai.InvokeLLM).not.toHaveBeenCalled();
    expect(
      vi.mocked(reserveBookSlot).mock.calls.map((args) => args[0]),
    ).toEqual([id, id]);
  });
  it("resumes saved manuscript without another edit or outline and keeps the reservation key", async () => {
    const f = fixture();
    await run(f, makeAI({ failCover: true }));
    const before = [...f.rows.values()].map((p) => p.text_content);
    const ai = makeAI();
    await run(f, ai, { bookId: id, repairCover: true });
    expect([...f.rows.values()].map((p) => p.text_content)).toEqual(before);
    expect(ai.InvokeLLM).not.toHaveBeenCalled();
    expect(reserveBookSlot).toHaveBeenCalledWith(id);
  });
});
