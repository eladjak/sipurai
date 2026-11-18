import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { I18nContext, LANGUAGES } from "@/components/i18n/i18nProvider";
import PrintPreferences from "./PrintPreferences";

afterEach(cleanup);
const t = key => key.split(".").reduce((item, part) => item?.[part], LANGUAGES.hebrew.translations);
function Fixture({ allowUpgradedPaper = true }) {
  const [value, onChange] = useState({ version: 1, paper: "premium", cover: "hardcover" });
  return <I18nContext.Provider value={{ t, language: "hebrew", direction: "rtl" }}>
    <PrintPreferences compact isRTL value={value} onChange={onChange} allowUpgradedPaper={allowUpgradedPaper} />
  </I18nContext.Provider>;
}
it("lets a legacy selection be explicitly replaced and keeps hardcover unavailable", () => {
  render(<Fixture />);
  fireEvent.click(screen.getByText("מכינים גם מהדורה מודפסת?"));
  expect(screen.getByLabelText(/כריכה קשה/).disabled).toBe(true);
  expect(screen.getByText(/הבחירה הקודמת בנייר משודרג/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText(/כרומו מט 130 גרם/));
  expect(screen.getByLabelText(/כרומו מט 130 גרם/).checked).toBe(true);
  fireEvent.click(screen.getByLabelText(/כריכה רכה/));
  expect(screen.getByLabelText(/כריכה רכה/).checked).toBe(true);
});
it("respects the subscriber restriction for both upgraded stocks", () => {
  render(<Fixture allowUpgradedPaper={false} />);
  fireEvent.click(screen.getByText("מכינים גם מהדורה מודפסת?"));
  expect(screen.getByLabelText(/כרומו מט 130 גרם/).disabled).toBe(true);
  expect(screen.getByLabelText(/כרומו מט 170 גרם/).disabled).toBe(true);
});
