# Pricing module

The workshop price calculator, based on the owner's pricing sheet
(КАЛЬКУЛЯТОР_ПРОФІ). It calculates one-off items and 3D models for staff,
keeps NBU metal rates, and keeps auto-priced catalog products and metal
prices in sync. All routes are admin-only. Money is in kopiykas, rates are
fractions (`0.06` = 6%).

## Calculation

`src/modules/pricing/pricing.engine.ts` is a pure implementation of the
sheet. Every price line has a protected cost, a customer price, and a
discount base, so a discount reduces only margins, never the metal purchase,
the metal buffer, casting, delivery, or the pay of the people doing the work.

- Metal: purchased weight = finished weight / (1 − loss). Alloy price per
  gram = pure metal price × fineness / 1000 (+ ligature for the rest) × (1 +
  supplier markup). The scenario adds a metal buffer; the metal margin is a
  fixed amount per finished gram.
- Casting: tariff per gram = pure metal price × spot share + fixed part; the
  customer price is the tariff × (1 + casting markup), rounded up to 5 UAH,
  × purchased weight × (1 + scenario external markup).
- Services (wax print by volume tiers in USD per cm³, rubber moulds,
  coatings, engraving, other) use presets from the settings or entered
  amounts; outside contractors get the external markup.
- Stones: purchase price × (1 + stone markup). Setting per stone = rate by
  setting type and metal family × cut factor × size factor; the setter's pay
  is the protected cost and the owner keeps the rest as pay.
- Fittings: cost × (1 + fittings markup) unless a price is entered.
- Jewelry work: hours × the owner's rate (by metal, basic or complex work)
  or the hired jeweler's rate plus the business share per hour, × (1 +
  markup), at least the metal's minimum work price.
- Delivery, packaging, consumables; overhead (share of direct costs) and risk
  reserve (share of material costs) by scenario; extra profit; a top-up to
  the minimum business profit.
- Final price = (sum × (1 + urgency)) / (1 − tax − payment fee), rounded up
  to the rounding step (100 UAH). Business profit = final − tax − fee − costs
  − the owner's pay; the margin status is `critical` (< 20%), `acceptable`
  (< 30%), `good` (< 40%), or `strong`.
- 3D model: hours × the designer's rate (+ business share for hired
  designers) × (1 + markup), at least the minimum price, plus paid revisions
  beyond the free ones, grossed up for tax and fee.
- The project combines both into four payments: model prepayment and
  remainder, item prepayment and remainder.

Scenarios (`minimal`, `recommended`, `safe`) set the metal buffer, external
markup, overhead, and risk. Item overrides replace the alloy price per gram,
margin per gram, loss, scenario rates, rounding step, or minimum profit for
one calculation.

Two places where the sheet itself is inconsistent are resolved on purpose:
the platinum casting fixed part is 80 UAH/g (the sheet converts a UAH amount
as USD), and outside services use the scenario external markup (the sheet
references an empty cell).

## Settings

- `GET /api/pricing/settings`
- `PUT /api/pricing/settings` replaces them and reprices auto-priced products.

One row (`pricing_settings.id = 'default'`) stores tax and fee rates, loss,
rounding, minimum profit, the default scenario and scenario rates, markups,
jeweler and 3D modeling rates, delivery/packaging/consumables defaults,
setting rates, cut and size factors, wax print tiers, and service presets.
Stored values are merged over the defaults from the sheet
(`pricing.settings.ts`), so new parameters get a value.

## Market rates

- `GET /api/pricing/market-rates` lists `USD`, `XAU`, `XAG`, `XPT`, `XPD`.
- `POST /api/pricing/market-rates/refresh` fetches NBU rates now (`502` when
  NBU is unavailable).
- `PUT /api/pricing/market-rates/:code` with `{ "manualRate": number | null }`
  sets or clears a manual rate.

Rates are UAH per troy ounce for metals and UAH per dollar. The effective
rate is the manual rate, else the last NBU rate; the settings `usdRate` is the
fallback for USD. A job at 06:00 Europe/Kyiv fetches NBU rates and reprices.
Every rate change reprices auto-priced products and refreshes the card
prices of print-priced Lab products.

`readUsdRate` (`usd.rate.ts`, also `ProductPricingService.usdRate`) returns
the effective USD rate (manual, else NBU, else the settings `usdRate`); the
[prints](prints.md) module uses it to convert printer prices bought in USD.

## Metals

- `GET /api/pricing/metals`
- `PUT /api/pricing/metals/:id/profile` saves the metal's tariffs.
- `DELETE /api/pricing/metals/:id/profile` returns to the family defaults.

A metal profile holds the margin per gram, supplier markup, ligature price,
casting spot share and fixed part, owner work rates, minimum work prices, and
`autoPricePerGram`. Without a saved profile the family defaults apply
(fineness is read from the purity, for example `585`). Responses include the
pure and alloy prices per gram, the casting tariff, and
`suggestedPricePerGram`: the customer price of one more finished gram in the
default scenario. With `autoPricePerGram` on, the metal's catalog
`pricePerGram` follows that value on every reprice; it is off by default, so
hand-entered prices stay unchanged. Profiles are never exposed by storefront
endpoints.

## Calculator

- `POST /api/pricing/calculate` calculates an item (metal, client metal,
  weight, work, scenario, urgency, discount, services, stones, fittings,
  overrides) and an optional 3D model, and returns every line, the effective
  parameters, profit analytics, and the payment plan.
- `POST /api/pricing/product-preview` prices an unsaved product editor state
  (`pricing`, `weightGrams`, `stones`, `optionGroups`) and returns the stored
  prices it would produce plus the full calculation per metal option.

## Auto-priced products

A product's `pricing` (see [catalog](catalog.md#automatic-pricing)) holds the
calculator inputs. In `auto` mode `product.price.plan.ts` splits the
calculated price into the parts the storefront quote adds up:

- each stone with a purchase price or setting type gets a unit price (stone,
  setting, their overhead and risk share, urgency, tax, and fee); other stones
  keep their entered price;
- `basePrice` = the default metal's calculated price − its price per gram ×
  the default weight − calculated stones;
- each metal option value gets `priceDelta` = its own calculated price − its
  price per gram × weight − calculated stones − `basePrice`;
- each value of a `stone` group with a purchase price or setting type gets
  `priceDelta` = `stoneQuantity` × the stone unit price above (size from
  `stoneSizeMm`, setting price for the default metal's family), so the
  customer's choice of diamond, cubic zirconia, and so on changes the price
  by the cost of that stone; other stone choices keep their entered surcharge.

The default configuration then costs exactly the calculated price plus the
default stone choice of a required stone group, other metals cost their own
calculation, size weight changes are charged through the price per gram, and
other option surcharges stay on top. The preview returns stone choice
surcharges as `optionPrices` (`groupIndex`, `valueIndex`, `priceDelta`). A metal without
a market price keeps being charged by its entered price per gram on top of
the calculated work (warning `missing_market_price`). Metal surcharges are
always planned with the metal's own price per gram, so a product-level
`pricePerGram` on a metal value changes that metal's price by the difference
× weight.

Auto-priced products are repriced on every product or option save, metal
change, settings change, rate change, and nightly with the rate refresh.
`manual` or `null` keeps hand-entered prices.
