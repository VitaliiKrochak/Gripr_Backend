<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

NestJS API for the jewelry application. The Next.js frontend is maintained in
the sibling `../Gripr_frontend` repository and exposes a same-origin BFF; browser code
does not call this API origin directly.

## Project setup

```bash
$ npm install
```

Copy `.env.example` to `.env` and configure the Supabase URL and publishable key
before starting locally. NestJS uses them only to verify access tokens for API
operations; it does not own sign-up, sign-in, refresh, sign-out, or browser
cookies.

The sibling Next.js BFF owns the complete authentication lifecycle and forwards
only the access cookie to this API. The global `AuthGuard` independently verifies
that token with Supabase for every protected operation. Administrative
controllers must additionally use `AdminGuard`; a role check performed by
Next.js for page rendering never grants permission to a NestJS operation.

Normal browser traffic must reach NestJS through the BFF. `FRONTEND_URL` remains
the credentialed CORS allowlist for trusted operational clients and local tools;
it is not the application authorization boundary.

The frontend integration guide is [`docs/frontend.md`](docs/frontend.md).

### Database

Business data lives in the `app` schema of the Supabase Postgres database and
is accessed with Drizzle ORM. Set `DATABASE_URL` to the Supabase pooler
connection string, then apply the migrations and seed the reference data
(metals, gemstones, production stages):

```bash
$ npm run db:migrate
$ npm run db:seed
```

After changing `src/integrations/database/schema/*.schema.ts`, generate a new
migration with `npm run db:generate` and commit the files in `drizzle/`.

### Phone sign-in codes

1. In Supabase Auth, enable the phone provider.
2. Add a **Send SMS hook** (HTTPS) pointing to
   `https://<api-host>/api/auth/sms-hook` and copy its secret into
   `SUPABASE_SMS_HOOK_SECRET`.
3. Configure at least one delivery channel: `TELEGRAM_GATEWAY_TOKEN` (Telegram
   Gateway API) and/or `TURBOSMS_TOKEN` with an approved `TURBOSMS_SENDER`
   (Viber with SMS fallback). Telegram is tried first.

### Administrators

Grant the admin role by setting `app_metadata.role` to `admin` on the Supabase
user (dashboard or service-role script). Sign in with that phone number to use
the admin endpoints.

### Integrations

- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET`.
- LiqPay: `LIQPAY_PUBLIC_KEY`, `LIQPAY_PRIVATE_KEY`, `LIQPAY_SANDBOX`,
  `LIQPAY_SIGNATURE_ALGORITHM`, `LIQPAY_RESULT_URL`, and `PUBLIC_API_URL`. The
  callback URL `${PUBLIC_API_URL}/api/payments/liqpay/callback` must be
  reachable from the internet (use a tunnel for local testing).
- Fiscal receipts (required in production): set up the ПРРО in the LiqPay
  dashboard and set `LIQPAY_RRO_GOOD_ID`; see
  [`docs/modules/payments.md`](docs/modules/payments.md#fiscal-receipts).
- Nova Poshta: `NOVAPOSHTA_API_KEY`.

All variables are listed in `.env.example`; the application refuses to start
when a required one is missing.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

### Windows launcher

`start-gripr.bat` starts this API (`start:dev`) and the storefront from
`../Gripr_frontend` (`dev`) in two windows. It checks for Node.js and both
`.env` files, runs `npm ci` where `node_modules` is missing, and passes the
detected public IP to the storefront as `ALLOWED_DEV_ORIGINS` so visitors can
reach the dev server through router port forwarding of TCP 3000. Run it once as
administrator to add the Windows Firewall rule for port 3000.

## Run tests

```bash
# unit tests
$ npm run test

# end-to-end tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

End-to-end tests run the whole application against an in-process PGlite
database with the real migrations and seed. They need no Docker, database, or
network access; external providers are replaced with test doubles. The
`test:e2e` script enables Node's `--experimental-vm-modules` flag, which PGlite
requires.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
