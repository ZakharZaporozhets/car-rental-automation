# Car Rental Automation – TypeScript + Playwright

End-to-end test suite covering the **Booking.com car rental search bar** (TC-01 → TC-09)
plus REST API tests for `https://api.restful-api.dev/objects`.

---

## Project structure

```
car-rental-automation/
├── pages/
│   └── CarRentalSearchPage.ts   # Page Object Model for the search bar
├── tests/
│   ├── carRentalSearch.spec.ts  # UI tests TC-01 → TC-09
│   └── restApi.spec.ts          # API tests: GET, POST, PATCH, DELETE
├── utils/
│   └── dateHelper.ts            # Date calculation helpers
├── playwright.config.ts
├── tsconfig.json
└── package.json
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 LTS |
| npm | ≥ 9 |

Install Node.js from https://nodejs.org/

---

## Setup

```bash
# 1. Clone or unzip the project
cd car-rental-automation

# 2. Install dependencies
npm install

# 3. Install Playwright browsers (Chromium only by default)
npx playwright install chromium
```

---

## Running tests

```bash
# Run ALL tests (headless)
npm test

# Run with visible browser window
npm run test:headed

# Run SMOKE tests only (TC-02, TC-03, TC-04 tagged @smoke)
npm run test:smoke

# Run only UI tests
npx playwright test tests/carRentalSearch.spec.ts --headed

# Run only API tests
npx playwright test tests/restApi.spec.ts

# Run a single test case
npx playwright test --grep "TC-01" --headed

# Open HTML report after a run
npm run test:report
```

---

## Test cases covered

### UI – Booking.com Car Rental Search Bar

| ID | Description | Expected validation message | Tag |
|----|--------------|-----------------------------|-----|
| TC-01 | Search results displayed for valid input | — | — |
| TC-02 | Validation when Drop-off time is less than 1 hour after Pick-up | "There must be at least one hour between pick up and drop off" | @smoke |
| TC-03 | Validation when driver age is not provided | "Provide the driver's age" | @smoke |
| TC-04 | Validation when Pick-up location is not provided | "Please provide a pick-up location" | @smoke |
| TC-05 | No cars available for rental period > 1 year | — | — |
| TC-06 | Navigate to "View deal" page from search results | — | — |
| TC-07 | "Drop off at different location" reveals drop-off field | — | — |
| TC-08 | Validation when invalid Drop-off location is set | "Please provide a drop-off location" | — |
| TC-09 | Date/time values persist after search on results page | — | — |

### API – api.restful-api.dev/objects

| Test | Method | Endpoint |
|------|--------|----------|
| List all objects | GET | `/objects` |
| Get single object by ID | GET | `/objects/1` |
| 404 for unknown ID | GET | `/objects/nonexistent-id-00000` |
| Filter objects by multiple IDs | GET | `/objects?id=3&id=5` |
| Create a new object | POST | `/objects` |
| Partially update an object | PATCH | `/objects/:id` |
| Delete an existing object | DELETE | `/objects/:id` |
| 404 for deleting unknown ID | DELETE | `/objects/nonexistent-id-00000` |

---

## Architecture notes

### Page Object Model
`CarRentalSearchPage` encapsulates all locators and actions for the car rental search form.

### AWS WAF bypass for location autocomplete
Booking.com's `location-suggestions` API is blocked for headless Chromium browsers by AWS WAF.
The page object intercepts these requests with `page.route()` and proxies them through Node.js
(which is not subject to the WAF challenge), then fulfils the browser request with the real API response.
This only applies to the **pick-up location** field. For the drop-off field in validation tests (TC-08),
the proxy is intentionally skipped so the field stays unconfirmed and triggers form validation.

### Calendar navigation for large date offsets
The booking.com date picker uses `aria-label="Following months"` for its next-month button.
`clickCalendarDay()` navigates forward month by month (up to 14 times) until `[data-date="YYYY-MM-DD"]`
becomes visible, then clicks it. Pick-up and drop-off dates are set in **separate calendar sessions**
(each opened with its own trigger button) to avoid the calendar resetting to pick-up mode mid-selection.

### Validation message detection
Most validation messages use CSS `::before` pseudo-element content on `[role="alert"]` spans.
`getValidationMessage()` reads them with `innerText()` (which includes pseudo-element text) rather
than `textContent()` (which does not). The driver's age tooltip is a separate component without
`role="alert"` and is detected via a text-content filter as a fallback.

### Date helpers
`utils/dateHelper.ts` provides `addDays()` so all test dates are relative to today —
no hardcoded date strings that go stale.

---

## Troubleshooting

**Tests fail with "Element not found"**
Booking.com frequently A/B tests its UI. Run `npx playwright test --headed` to watch the browser
and update affected selectors in `CarRentalSearchPage.ts`.

**"Please provide a pick-up location" shown despite entering New York**
The location autocomplete API is blocked by AWS WAF in headless mode. The route proxy handles
this automatically — if it stops working, check that `fetch()` in the route handler can reach
`https://cars.booking.com/api/location-suggestions`.

**Sign-in modal blocks results**
`waitForSearchResults()` automatically dismisses the "Sign in, save money" modal via
`[data-testid="signin-modal-close"]` after the loading animation completes.

**Cookie banner blocks interactions**
`dismissCookieBanner()` runs automatically on page load in `goto()`.
If a new consent dialog appears, add its button text to the selector in that method.
