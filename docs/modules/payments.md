# Payments module

Online payments (LiqPay) and manually recorded payments, for both stores.

## Routes

- `POST /api/customers/me/orders/:orderId/payments` (private, `201`): starts a
  payment for the amount currently due and returns `paymentId`, `type`
  (`full`, `deposit`, `model_prepayment`, `production_prepayment`, or
  `remainder`), `amount`, `checkoutUrl`, `data`, and `signature`. Answers
  `409` when nothing is due (paid, cancelled, or refunded orders, or a staged
  custom order between payment stages), and when the order's store has no
  LiqPay shop configured. The payment description carries the order
  reference (`Оплата замовлення GR-1042`, `LAB-1043`).
- `POST /api/payments/liqpay/callback` (public): LiqPay server callback,
  `application/x-www-form-urlencoded` with `data` and `signature`. One URL
  serves both shops.
- `POST /api/orders/:orderId/payments` (admin, `201`) with
  `{ "amount", "note"? }`: records money received outside online payments
  (type `manual`) and returns the admin order.

Admin order details list payments with `merchant` (`gripr` or `lab`, the store
account that receives the money) and `provider` (`liqpay`, or `null` for
manual payments).

## Stores and providers

- Each store has its own LiqPay shop and payout account. Gripr uses
  `LIQPAY_PUBLIC_KEY`/`LIQPAY_PRIVATE_KEY`; Gripr Lab uses
  `LIQPAY_LAB_PUBLIC_KEY`/`LIQPAY_LAB_PRIVATE_KEY`.
- A payment's `merchant` is the order's store and is fixed when the payment
  is created; `provider` is stored next to it. Manual payments take the
  order's store too.
- The payments service talks to a `PaymentProvider` (`payment.provider.ts`:
  is the store set up, start a payment, verify a callback). LiqPay is the only
  implementation (`liqpay.payment.provider.ts`, over the LiqPay integration).

## What is due

- Nothing has been paid: the deposit when the order has one smaller than the
  total, otherwise the full amount.
- Something has been paid: the remaining balance.
- Staged custom orders: the 3D model prepayment, then the production
  prepayment, then the remainder, following the order status (see
  [orders](orders.md#staged-custom-orders)).

## Callback processing

- The signature is `base64(sha3-256(private_key + data + private_key))`;
  legacy SHA-1 signatures are also accepted. It is checked against the
  private key of every configured shop before the payload is read; the key
  that matches tells which shop sent it. Invalid signatures answer `400`.
- The payment row is locked. A callback signed by a different shop than the
  payment's `merchant` answers `400` and changes nothing. Repeated callbacks
  are harmless.
- `success` and `wait_compensation` (and `sandbox` in sandbox mode) mark the
  payment successful when the amount and currency (UAH) match; mismatches are
  recorded as failures. `failure` and `error` mark it failed. `reversed`
  reverses a successful payment and subtracts it from the order's
  `paidAmount`. Other statuses only update the stored provider status.
- A failed payment can still succeed if the customer retries on the same
  LiqPay page.
- A successful payment adds to `paidAmount` and moves a `pending_payment` order
  to `paid`; for staged custom orders it moves the order past the payment
  stage it covers.

## Fiscal receipts

Card payments for goods must be fiscalized. The store uses LiqPay's free
software cash register (ПРРО), which issues the receipt automatically after a
successful payment and sends it to the tax service:

- When the shop's receipt good is set (`LIQPAY_RRO_GOOD_ID` for Gripr,
  `LIQPAY_LAB_RRO_GOOD_ID` for Lab), every checkout includes `rro_info`. A
  full payment lists the order items (quantity and unit price; a discounted
  line whose total does not divide evenly is split into two lines so unit
  prices stay whole kopiykas). Deposits, prepayments, and remainders are one
  line for the paid amount. All lines use the shop's good.
- The receipt is emailed to the order's `contactEmail` when there is one. The
  merchant can also copy the receipt link from the payment in the LiqPay
  dashboard.
- Refunds are fiscalized manually in the LiqPay dashboard ("РРО → Каса →
  Журнал фіскальних операцій").
- Manual payments recorded by administrators are not fiscalized by the API;
  issue their receipts where the money was taken.

LiqPay setup (dashboard, section "РРО", in each shop): connect the company or
sync it with the tax service, register the sales point, the ПРРО, and the
cashier (signed with SmartID from "Приват24 для бізнесу"), set the tax rates,
create a good such as "Ювелірний виріб" (Lab: "Друкована мініатюра"), and put
its id into the shop's receipt good variable. A cashier shift must be open for
receipts to be issued. Use a training shift ("навчальна зміна") to test.
LiqPay's ПРРО is available only to merchants whose payouts go to a PrivatBank
account, and only UAH payments are fiscalized.

## Configuration

`LIQPAY_PUBLIC_KEY`, `LIQPAY_PRIVATE_KEY`, `LIQPAY_SANDBOX`,
`LIQPAY_SIGNATURE_ALGORITHM` (`sha3-256` by default, `sha1` for legacy merchant
accounts), `LIQPAY_RRO_GOOD_ID` (fiscal receipts; empty disables them),
`LIQPAY_RESULT_URL` (storefront return page; `?orderId=` is
appended), and `PUBLIC_API_URL` (the callback is sent to
`${PUBLIC_API_URL}/api/payments/liqpay/callback`, which must be reachable from
the internet).

Gripr Lab: `LIQPAY_LAB_PUBLIC_KEY` and `LIQPAY_LAB_PRIVATE_KEY` (both or
neither; empty disables online payment of Lab orders) and
`LIQPAY_LAB_RRO_GOOD_ID`. The sandbox flag, signature algorithm, result URL,
and callback URL are shared with the Gripr shop.
