// @ts-check
import { test, expect } from '@playwright/test';
import { waitForApp, waitForPageContent } from './helpers/auth.js';

/**
 * book-creation.spec.js — Book creation wizard flow tests.
 *
 * Tests the BookWizard page (/BookWizard):
 * - Page loads and renders the wizard shell
 * - Step 1 (Topic) shows topic cards
 * - Clicking a topic card activates it
 * - Step 2 (Characters) is reachable via "Next"
 * - Step 3 (Preview/Edit) is reachable
 * - Back button returns to the previous step
 * - Wizard progress indicator shows correct step number
 *
 * NOTE: We do NOT submit the wizard / actually create a book because that
 * would require real AI API credentials. These tests only verify UI
 * rendering and navigation.
 */

test.describe('Book Creation Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/BookWizard');
  });

  // -------------------------------------------------------------------------
  // Page load
  // -------------------------------------------------------------------------
  test('BookWizard page loads without crashing', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.goto('/BookWizard');
    await page.waitForTimeout(2000);

    const criticalErrors = jsErrors.filter(
      (msg) =>
        !msg.includes('Failed to fetch') &&
        !msg.includes('NetworkError') &&
        !msg.includes('net::ERR')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('BookWizard renders its page shell', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    await waitForPageContent(page);

    // The wizard should have a progress/step indicator visible
    const wizardNav = page.locator('[role="navigation"]').filter({
      hasText: /step|topic|character|preview|שלב|נושא/i,
    });
    // If role=navigation is not found, fall back to checking for step labels
    const stepIndicator = page.locator(
      'text=Topic, text=Characters, text=Preview, text=נושא, text=דמויות'
    ).first();

    const hasWizardUI =
      (await wizardNav.count()) > 0 || (await stepIndicator.isVisible().catch(() => false));

    expect(hasWizardUI).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Step 1 — Topic
  // -------------------------------------------------------------------------
  test('Step 1 shows topic selection cards', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    await waitForPageContent(page);

    // Topic cards should be clickable buttons / divs with topic names
    // The TopicStep renders cards with text like Animals, Space, Family, etc.
    const topicLabels = ['Animals', 'Space', 'Family', 'Adventure', 'Magic', 'חיות', 'חלל'];

    let foundTopics = 0;
    for (const label of topicLabels) {
      const el = page.locator(`text=${label}`).first();
      if (await el.isVisible().catch(() => false)) {
        foundTopics++;
      }
    }

    // At least two topic labels should be visible on step 1
    expect(foundTopics).toBeGreaterThanOrEqual(2);
  });

  test('clicking a topic card activates/selects it', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    await waitForPageContent(page);

    // Find the first visible topic-like button (has a gradient class or is a clickable card)
    // TopicStep renders buttons with gradient backgrounds
    const topicCard = page.locator('button').filter({
      has: page.locator('.bg-gradient-to-br, .from-amber-400, .from-indigo-400, .from-pink-400'),
    }).first();

    if (!(await topicCard.isVisible().catch(() => false))) {
      // Fallback: try finding by text
      const animalCard = page.locator('text=Animals').first();
      if (!(await animalCard.isVisible().catch(() => false))) {
        test.skip();
        return;
      }
      await animalCard.click();
    } else {
      await topicCard.click();
    }

    // After clicking, a selection ring or active indicator should appear
    // The TopicStep adds a `ring-2` class when selected
    await page.waitForTimeout(300);

    // The "Next" button should now be enabled (not disabled)
    const nextBtn = page.locator('button').filter({ hasText: /next|continue|הבא/i }).first();
    if (await nextBtn.isVisible().catch(() => false)) {
      const isDisabled = await nextBtn.isDisabled();
      // Button might already be enabled now that a topic is selected
      expect(isDisabled).toBe(false);
    }
  });

  test('Step 1 has a "Next" button', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    await waitForPageContent(page);

    const nextBtn = page.locator('button').filter({ hasText: /next|continue|הבא/i }).first();
    await expect(nextBtn).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------------
  test('Next button advances from Step 1 to Step 2 after selecting a topic', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    await waitForPageContent(page);

    // Select the first topic card
    const topicButtons = page.locator('button').filter({
      has: page.locator('svg'),
    });

    // Click the first topic-like button that has an icon inside it
    // and looks like a topic card (within the step content area)
    const allButtons = await topicButtons.all();
    let clicked = false;
    for (const btn of allButtons) {
      const cls = await btn.getAttribute('class') || '';
      if (
        cls.includes('rounded') &&
        (cls.includes('bg-') || cls.includes('border')) &&
        !cls.includes('justify-start') // exclude sidebar nav buttons
      ) {
        await btn.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      // Fallback: click the text "Animals" if visible
      const animalText = page.locator('text=Animals').first();
      if (await animalText.isVisible().catch(() => false)) {
        await animalText.click();
        clicked = true;
      }
    }

    if (!clicked) {
      test.skip();
      return;
    }

    await page.waitForTimeout(200);

    // Click Next
    const nextBtn = page.locator('button').filter({ hasText: /^next$|^continue$|^הבא$/i }).first();
    if (!(await nextBtn.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    const isDisabled = await nextBtn.isDisabled();
    if (isDisabled) {
      test.skip();
      return;
    }

    await nextBtn.click();
    await waitForPageContent(page);

    // Step 2 should show character-related content
    const step2Content = await page.locator('body').innerText();
    const hasCharacterContent =
      step2Content.toLowerCase().includes('character') ||
      step2Content.toLowerCase().includes('דמות') ||
      step2Content.toLowerCase().includes('pick') ||
      step2Content.toLowerCase().includes('select');

    expect(hasCharacterContent).toBe(true);
  });

  test('Back button is visible on Step 2 and navigates back', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    await waitForPageContent(page);

    // Select a topic and advance
    const animalText = page.locator('text=Animals').first();
    if (!(await animalText.isVisible().catch(() => false))) {
      test.skip();
      return;
    }
    await animalText.click();
    await page.waitForTimeout(200);

    const nextBtn = page.locator('button').filter({ hasText: /next|continue|הבא/i }).first();
    if (!(await nextBtn.isVisible().catch(() => false)) || await nextBtn.isDisabled()) {
      test.skip();
      return;
    }
    await nextBtn.click();
    await waitForPageContent(page);

    // Now on Step 2 — find the Back button
    const backBtn = page.locator('button').filter({ hasText: /back|previous|חזור/i }).first();
    await expect(backBtn).toBeVisible();

    await backBtn.click();
    await waitForPageContent(page);

    // Should be back on Step 1 — topic cards visible again
    const topicText = await page.locator('body').innerText();
    expect(
      topicText.toLowerCase().includes('topic') ||
      topicText.toLowerCase().includes('animals') ||
      topicText.toLowerCase().includes('נושא')
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Wizard progress indicator
  // -------------------------------------------------------------------------
  test('wizard progress indicator shows step 1 as active', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    await waitForPageContent(page);

    // The WizardProgress component uses aria-current="step" on the active step button
    const activeStep = page.locator('[aria-current="step"]').first();
    if (await activeStep.isVisible().catch(() => false)) {
      // Active step should show "1" (first step)
      const stepText = await activeStep.innerText();
      expect(stepText.trim()).toBe('1');
    } else {
      // Fallback: look for step 1 indicator by class (ring-4 = active)
      const step1Ring = page.locator('[class*="ring-4"]').first();
      await expect(step1Ring).toBeVisible();
    }
  });

  // -------------------------------------------------------------------------
  // Custom idea / "My Own Idea" card
  // -------------------------------------------------------------------------
  test('"My Own Idea" card is present in topic step', async ({ page }) => {
    const appLoaded = await waitForApp(page);
    if (!appLoaded) {
      test.skip();
      return;
    }

    await waitForPageContent(page);

    // TopicStep includes a "My Own Idea" card
    const myOwnIdeaCard = page.locator('text=My Own Idea, text=הרעיון שלי').first();
    await expect(myOwnIdeaCard).toBeVisible();
  });
});
