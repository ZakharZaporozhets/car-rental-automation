import { Page, Locator, BrowserContext } from '@playwright/test';
import { addDays } from '../utils/dateHelper';

export class CarRentalSearchPage {
  readonly page: Page;
  readonly context: BrowserContext;

  readonly pickupLocationInput: Locator;
  readonly dropoffLocationInput: Locator;
  readonly pickupDateButton: Locator;
  readonly dropoffDateButton: Locator;
  readonly searchButton: Locator;
  readonly dropDifferentLocationCheckbox: Locator;
  readonly driverAgeCheckbox: Locator;
  readonly driverAgeInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.context = page.context();

    this.pickupLocationInput = page
      .locator('div')
      .filter({ hasText: /^Pick-up location$/ })
      .nth(3);

    this.dropoffLocationInput = page
      .locator('div')
      .filter({ hasText: /^Drop-off location$/ })
      .nth(3);

    this.pickupDateButton = page.getByRole('button', { name: 'Choose Pick-up Date' });
    this.dropoffDateButton = page.getByRole('button', { name: 'Choose Drop-off Date' });
    this.searchButton = page.getByRole('button', { name: 'Search' });

    this.dropDifferentLocationCheckbox = page
      .locator('label')
      .filter({ hasText: 'Drop car off at different' });

    this.driverAgeCheckbox = page
      .locator('label')
      .filter({ hasText: /driver aged|водій віком/i });

    this.driverAgeInput = page.getByRole('spinbutton', { name: "Driver's Age" });
  }

  // ─── Navigation ──────────────────────────────────────────────────────────────

  async goto() {
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    await this.page.goto(
      'https://www.booking.com/cars/index.html?selected_currency=UAH&lang=en-us',
      { waitUntil: 'domcontentloaded' }
    );
    await this.dismissCookieBanner();
  }

  async dismissCookieBanner() {
    const acceptBtn = this.page
      .getByRole('button', { name: /accept|agree|ok/i })
      .first();
    if (await acceptBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await acceptBtn.click();
    }
  }

  // ─── Location ────────────────────────────────────────────────────────────────

  private async fillLocationInput(triggerLocator: Locator, location: string, proxyApi = true) {
    // Proxy the autocomplete API through Node.js: AWS WAF blocks the browser but not Node.js
    if (!proxyApi) {
      // Type the text but never select from the dropdown — field stays unconfirmed,
      // causing the form to show a "please provide" validation on submit.
      await triggerLocator.click();
      const input = triggerLocator.locator('[role="combobox"]').first();
      await input.waitFor({ state: 'visible', timeout: 5_000 });
      await input.click({ clickCount: 3 });
      await input.pressSequentially(location, { delay: 80 });
      await this.page.keyboard.press('Escape');
      return;
    }

    await this.page.route('**/api/location-suggestions**', async (route) => {
      try {
        const res = await fetch(route.request().url(), {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        });
        const body = await res.text();
        await route.fulfill({ status: res.status, contentType: 'application/json', body });
      } catch {
        await route.continue();
      }
    });

    await triggerLocator.click();

    // Scope to the clicked trigger so pickup and drop-off are not confused
    const input = triggerLocator.locator('[role="combobox"]').first();

    await input.waitFor({ state: 'visible', timeout: 5_000 });
    // Triple-click keeps the combobox in editing mode (fill/clear resets autocomplete state)
    await input.click({ clickCount: 3 });
    await input.pressSequentially(location, { delay: 80 });

    // Give the proxied API call time to complete and the DOM to update
    await this.page.waitForTimeout(2_000);

    // Click via JS to bypass Playwright's visibility check (listbox may be transitioning)
    const clicked = await this.page.evaluate(() => {
      const option = document.querySelector('[role="listbox"] [role="option"]') as HTMLElement | null;
      if (option) {
        option.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      await input.press('Enter');
    }

    await this.page.unroute('**/api/location-suggestions**');
  }

  async enterPickupLocation(location: string) {
    await this.fillLocationInput(this.pickupLocationInput, location);
  }

  async enterDropoffLocation(location: string) {
    // No proxy: for invalid-location validation tests we want WAF to block the API
    // so the field stays unconfirmed and the form shows "Please provide a drop-off location"
    await this.fillLocationInput(this.dropoffLocationInput, location, false);
  }

  async clearPickupLocation() {
    await this.pickupLocationInput.click();

    const input = this.page
      .locator('input[type="search"]')
      .or(this.page.locator('input[placeholder*="Airport"], input[placeholder*="city"]'))
      .first();

    await input.waitFor({ state: 'visible', timeout: 5_000 });
    await input.fill('');
    await input.press('Escape');
  }

  // ─── Dates ───────────────────────────────────────────────────────────────────

  async setDates(options: {
    pickupDaysOffset?: number;
    dropoffDaysOffset?: number;
  }) {
    const { pickupDaysOffset = 1, dropoffDaysOffset = 3 } = options;

    const pickupDate  = addDays(new Date(), pickupDaysOffset);
    const dropoffDate = addDays(new Date(), dropoffDaysOffset);

    // ── Pick-up ──────────────────────────────────────────────────────────────
    await this.pickupDateButton.click();
    await this.page.locator('[data-date]').first().waitFor({ timeout: 5_000 }).catch(() => {});
    await this.clickCalendarDay(pickupDate);
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);

    // ── Drop-off ─────────────────────────────────────────────────────────────
    // Open the drop-off picker explicitly so we are always in drop-off mode
    // before navigating, regardless of what the calendar did after the pickup click.
    await this.dropoffDateButton.click();
    await this.page.locator('[data-date]').first().waitFor({ timeout: 5_000 }).catch(() => {});
    await this.clickCalendarDay(dropoffDate);
    await this.page.keyboard.press('Escape');
  }

  private async clickCalendarDay(date: Date) {
    const isoDate   = date.toISOString().split('T')[0];
    const dayNumber = date.getDate().toString();

    // Navigate forward month by month until the target date is visible (max 14 months)
    for (let attempt = 0; attempt < 14; attempt++) {
      const byDataDate = this.page.locator(`[data-date="${isoDate}"]`).first();
      if (await byDataDate.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await byDataDate.click();
        return;
      }
      const nextBtn = this.page.locator('button[aria-label="Following months"]').first();
      if (await nextBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await nextBtn.click();
        await this.page.waitForTimeout(300);
      } else {
        break;
      }
    }

    // Fallback: click by day number in the currently visible month
    const byDay = this.page
      .locator('.bui-calendar__date, [class*="CalendarDay"], [class*="calendar"] td, [class*="calendar"] button')
      .filter({ hasText: new RegExp(`^${dayNumber}$`) })
      .first();
    if (await byDay.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await byDay.click();
    }
  }

  // ─── Other interactions ───────────────────────────────────────────────────────

  async checkDropDifferentLocation() {
    await this.dropDifferentLocationCheckbox.click();
  }

  async uncheckDriverAge() {
    if (await this.driverAgeCheckbox.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.driverAgeCheckbox.click();
    }
  }

  async clearDriverAgeInput() {
    if (await this.driverAgeInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await this.driverAgeInput.click({ clickCount: 3 });
      await this.driverAgeInput.press('Delete');
    }
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async clickSearchAndGetResultsPage(): Promise<Page> {
    await this.searchButton.click();
    // Wait for URL to change away from the homepage
    await this.page
      .waitForURL(url => !url.href.includes('/cars/index'), { timeout: 30_000 })
      .catch(() => {});
    return this.page;
  }

  async waitForSearchResults(resultsPage?: Page): Promise<Page> {
    const target = resultsPage ?? this.page;
    await target.waitForLoadState('domcontentloaded');
    // Wait for the "Checking the top companies..." loading animation to finish
    await target
      .locator(':text("Checking the top companies")')
      .waitFor({ state: 'hidden', timeout: 20_000 })
      .catch(() => {});
    // Dismiss "Sign in, save money" modal if it appears over the results
    const closeBtn = target.locator('[data-testid="signin-modal-close"]');
    if (await closeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await closeBtn.click();
    }
    return target;
  }

  // ─── Assertion helpers ────────────────────────────────────────────────────────

  async getValidationMessage(): Promise<string> {
    const parts: string[] = [];

    // Primary: [role="alert"] elements — text lives in CSS ::before, requires innerText()
    await this.page.locator('[role="alert"]').first()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .catch(() => {});
    const alerts = this.page.locator('[role="alert"]');
    const alertCount = await alerts.count();
    for (let i = 0; i < alertCount; i++) {
      const text = (await alerts.nth(i).innerText().catch(() => '')).trim();
      if (text) parts.push(text);
    }

    // Fallback: driver's age inline badge doesn't use role="alert" on booking.com
    if (parts.length === 0) {
      const inlineMsg = this.page
        .locator('div, span')
        .filter({ hasText: /^Provide the driver's age$/ })
        .first();
      if (await inlineMsg.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const text = (await inlineMsg.innerText().catch(() => '')).trim();
        if (text) parts.push(text);
      }
    }

    return parts.join(' | ');
  }

  async getCarCardCount(resultsPage: Page): Promise<number> {
    // Count "View deal" buttons — one per car card
    const cards = resultsPage.locator('button[aria-label="View deal"]');
    return cards.count();
  }

  async getCarsAvailableMessage(resultsPage: Page): Promise<string> {
    const el = resultsPage.locator('h1, h2, h3').first();
    return (await el.textContent()) ?? '';
  }

  async isDropoffLocationVisible(): Promise<boolean> {
    return this.dropoffLocationInput.isVisible({ timeout: 5_000 }).catch(() => false);
  }
}