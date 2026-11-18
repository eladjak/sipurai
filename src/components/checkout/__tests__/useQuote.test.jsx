import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useQuote } from "../useQuote";

it("ignores an older quote that arrives after a new paper selection", async () => {
  let finishOld;
  const api = { getQuote: vi.fn(({ paper }) => paper === "standard"
    ? new Promise(resolve => { finishOld = resolve; })
    : Promise.resolve({ paper })) };
  const { result, rerender } = renderHook(({ paper }) => useQuote(api, {
    bookId: "b1", qty: 1, method: "ship", paper, debounceMs: 0,
  }), { initialProps: { paper: "standard" } });
  await waitFor(() => expect(finishOld).toBeTypeOf("function"));
  rerender({ paper: "chrome-matte-130" });
  await waitFor(() => expect(result.current.quote?.paper).toBe("chrome-matte-130"));
  await act(async () => finishOld({ paper: "standard" }));
  expect(result.current.quote.paper).toBe("chrome-matte-130");
});
