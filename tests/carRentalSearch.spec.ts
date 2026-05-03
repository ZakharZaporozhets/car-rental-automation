import { test, expect } from '@playwright/test';
import { CarRentalSearchPage } from '../pages/CarRentalSearchPage';
import { addDays } from '../utils/dateHelper';

test.describe('Car Rental Search Bar', () => {
  let searchPage: CarRentalSearchPage;

  test.beforeEach(async ({ page }) => {
    searchPage = new CarRentalSearchPage(page);
    await searchPage.goto();
  });

  // TC-01 – Verify car rental search results are displayed for valid input
  test('TC-01 – Search results displayed for valid input', async () => {
    await searchPage.enterPickupLocation('New York');
    await searchPage.setDates({ pickupDaysOffset: 1, dropoffDaysOffset: 3 });

    const resultsPage = await searchPage.clickSearchAndGetResultsPage();
    await searchPage.waitForSearchResults(resultsPage);

    const cardCount = await searchPage.getCarCardCount(resultsPage);
    expect(cardCount).toBeGreaterThan(0);
  });

  // TC-02 @smoke – Verify validation when Drop-off time is less than 1 hour after Pick-up time on car rental search bar
  test('TC-02 @smoke – Validation when Drop-off time is less than 1 hour after Pick-up', async () => {
    await searchPage.enterPickupLocation('New York');
    await searchPage.setDates({ pickupDaysOffset: 1, dropoffDaysOffset: 1 });
    await searchPage.clickSearch();

    const msg = await searchPage.getValidationMessage();
    expect(msg).toContain('There must be at least one hour between pick up and drop off');
  });

  // TC-03 @smoke – Verify validation when driver age is not provided on car rental search bar
  test('TC-03 @smoke – Validation when driver age is not provided', async () => {
    await searchPage.enterPickupLocation('New York');
    await searchPage.setDates({ pickupDaysOffset: 1, dropoffDaysOffset: 3 });
    await searchPage.uncheckDriverAge();
    await searchPage.clearDriverAgeInput();
    await searchPage.clickSearch();

    const msg = await searchPage.getValidationMessage();
    expect(msg).toContain("Provide the driver's age");
  });

  // TC-04 @smoke – Verify validation when Pick-up location is not provided
  test('TC-04 @smoke – Validation when Pick-up location is not provided', async () => {
    await searchPage.clearPickupLocation();
    await searchPage.clickSearch();

    const msg = await searchPage.getValidationMessage();
    expect(msg).toContain('Please provide a pick-up location');
  });

  // TC-05 – Verify that system doesn't display car rental search results when 1 year (extremely large) rental period is selected
  test('TC-05 – No cars available for rental period > 1 year', async () => {
    await searchPage.enterPickupLocation('New York');
    await searchPage.setDates({ pickupDaysOffset: 1, dropoffDaysOffset: 365 });

    const resultsPage = await searchPage.clickSearchAndGetResultsPage();
    await searchPage.waitForSearchResults(resultsPage);

    const cardCount = await searchPage.getCarCardCount(resultsPage);
    const message   = await searchPage.getCarsAvailableMessage(resultsPage);
    const noCars    = cardCount === 0 || /no cars available/i.test(message);
    expect(noCars).toBe(true);
  });

  // TC-06 – Verify navigation to “View deal” page from car rental search results
  test('TC-06 – Navigate to "View deal" page from search results', async () => {
    await searchPage.enterPickupLocation('New York');
    await searchPage.setDates({ pickupDaysOffset: 1, dropoffDaysOffset: 3 });

    const resultsPage = await searchPage.clickSearchAndGetResultsPage();
    await searchPage.waitForSearchResults(resultsPage);

    const viewDealButton = resultsPage.locator('a:has-text("View deal"), button:has-text("View deal")').first();
    await expect(viewDealButton).toBeVisible({ timeout: 15_000 });

    const [newTab] = await Promise.all([
      resultsPage.context().waitForEvent('page').catch(() => undefined),
      viewDealButton.click(),
    ]);

    const detailPage = newTab ?? resultsPage;
    await detailPage.waitForLoadState('domcontentloaded');
    const carTitle = detailPage.locator('h1').first();
    await expect(carTitle).toBeVisible({ timeout: 15_000 });
  });

  // TC-07 – Verify “Drop off at different location” option on car rental search bar
  test('TC-07 – "Drop off at different location" reveals drop-off field', async () => {
    const initiallyVisible = await searchPage.isDropoffLocationVisible();
    expect(initiallyVisible).toBe(false);

    await searchPage.checkDropDifferentLocation();

    const nowVisible = await searchPage.isDropoffLocationVisible();
    expect(nowVisible).toBe(true);
  });

  // TC-08 – Verify validation when invalid Drop-off location is set on car rental search bar
  test('TC-08 – Validation when invalid Drop-off location is set', async () => {
    await searchPage.enterPickupLocation('New York');
    await searchPage.setDates({ pickupDaysOffset: 1, dropoffDaysOffset: 3 });
    await searchPage.checkDropDifferentLocation();
    await searchPage.enterDropoffLocation('asd');
    await searchPage.clickSearch();

    const msg = await searchPage.getValidationMessage();
    expect(msg).toContain('Please provide a drop-off location');
  });

  // TC-09 – Verify date/time persistence after search on car rental search results
  test('TC-09 – Date/time values persist after search on results page', async () => {
    const pickupDate = addDays(new Date(), 1);

    await searchPage.enterPickupLocation('New York');
    await searchPage.setDates({ pickupDaysOffset: 1, dropoffDaysOffset: 3 });

    const resultsPage = await searchPage.clickSearchAndGetResultsPage();
    await searchPage.waitForSearchResults(resultsPage);

    const url     = resultsPage.url();
    const dayStr  = pickupDate.getDate().toString();
    const dateStr = pickupDate.toISOString().split('T')[0];

    const dateFound = url.includes(dateStr) || url.includes(dayStr);
    expect(dateFound).toBe(true);
  });
});
