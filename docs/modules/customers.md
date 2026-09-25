# Customers module

Keeps the customer profile that belongs to a Supabase user. The profile row is
created automatically the first time the customer uses a feature that needs it
(profile, checkout, custom request); its id is the Supabase user id and its
phone comes from the verified Supabase user.

## Routes

Private (signed-in customer):

- `GET /api/customers/me`: the profile.
- `PATCH /api/customers/me`: update first and last name, email, ring size, and
  the default Nova Poshta delivery (city and branch refs and names) used to
  prefill checkout.

Admin:

- `GET /api/customers?q=&page=&pageSize=`: customers with `orderCount` and
  `totalPaid` (kopiykas). `q` searches phone, name, and email.
- `GET /api/customers/:id`: a customer with their orders.

The phone number cannot be changed here; it always matches the phone used to
sign in.
