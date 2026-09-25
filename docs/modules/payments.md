# Payments module

LiqPay payments and manually recorded payments.

## Routes

- `POST /api/customers/me/orders/:orderId/payments` (private, `201`): starts a
  LiqPay payment for the amount currently due and returns `paymentId`, `type`
  (`full`, `deposit`, or `remainder`), `amount`, `checkoutUrl`, `data`, and
  `signature`. Answers `409` when nothing is due (paid, cancelled, or
  refunded orders).
- `POST /api/payments/liqpay/callback` (public): LiqPay server callback,
  `application/x-www-form-urlencoded` with `data` and `signature`.
- `POST /api/orders/:orderId/payments` (admin, `201`) with
  `{ "amount", "note"? }`: records money received outside LiqPay (type
  `manual`) and returns the admin order.

## What is due

- Nothing has been paid: the deposit when the order has one smaller than the
  total, otherwise the full amount.
- Something has been paid: the remaining balance.

## Callback processing

- The signature is `base64(sha3-256(private_key + data + private_key))`;
  legacy SHA-1 signatures are also accepted. Invalid signatures answer `400`.
- The payment row is locked, and repeated callbacks are harmless.
- `success` and `wait_compensation` (and `sandbox` in sandbox mode) mark the
  payment successful when the amount and currency (UAH) match; mismatches are
  recorded as failures. `failure` and `error` mark it failed. `reversed`
  reverses a successful payment and subtracts it from the order's
  `paidAmount`. Other statuses only update the stored provider status.
- A failed payment can still succeed if the customer retries on the same
  LiqPay page.
- A successful payment adds to `paidAmount` and moves a `pending_payment` order
  to `paid`.

## Fiscal receipts

Card payments for goods must be fiscalized. The store uses LiqPay's free
software cash register (ПРРО), which issues the receipt automatically after a
successful payment and sends it to the tax service:

- When `LIQPAY_RRO_GOOD_ID` is set, every checkout includes `rro_info`. A full
  payment lists the order items (quantity and unit price; a discounted line
  whose total does not divide evenly is split into two lines so unit prices
  stay whole kopiykas). Deposits and remainders are one line for the paid
  amount. All lines use the configured LiqPay good.
- The receipt is emailed to the order's `contactEmail` when there is one. The
  merchant can also copy the receipt link from the payment in the LiqPay
  dashboard.
- Refunds are fiscalized manually in the LiqPay dashboard ("РРО → Каса →
  Журнал фіскальних операцій").
- Manual payments recorded by administrators are not fiscalized by the API;
  issue their receipts where the money was taken.

LiqPay setup (dashboard, section "РРО"): connect the company or sync it with
the tax service, register the sales point, the ПРРО, and the cashier (signed
with SmartID from "Приват24 для бізнесу"), set the tax rates, create a good
such as "Ювелірний виріб", and put its id into `LIQPAY_RRO_GOOD_ID`. A cashier
shift must be open for receipts to be issued. Use a training shift ("навчальна
зміна") to test. LiqPay's ПРРО is available only to merchants whose payouts go
to a PrivatBank account, and only UAH payments are fiscalized.

## Configuration

`LIQPAY_PUBLIC_KEY`, `LIQPAY_PRIVATE_KEY`, `LIQPAY_SANDBOX`,
`LIQPAY_SIGNATURE_ALGORITHM` (`sha3-256` by default, `sha1` for legacy merchant
accounts), `LIQPAY_RRO_GOOD_ID` (fiscal receipts; empty disables them),
`LIQPAY_RESULT_URL` (storefront return page; `?orderId=` is
appended), and `PUBLIC_API_URL` (the callback is sent to
`${PUBLIC_API_URL}/api/payments/liqpay/callback`, which must be reachable from
the internet).
