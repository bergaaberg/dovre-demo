# dovre-demo

The public demo of [Dovre](https://dovre.dev), at [demo.dovre.dev](https://demo.dovre.dev): hosted
Dovre's pages over made-up data. It's an example instance repo, and shows packs in action.

Core keeps the safety boundary in `createDemoWorker` (`dovre/demo/worker.ts`): no bindings, no
secrets, an empty database, everyone signed in as the visitor, and every write refused except
asking the scripted Bino. This repo supplies only made-up data and packs:

- `packs/shop/`: Northwind Shop, an example custom app pack (storefront metrics, support queue,
  actions behind Confirm).
- `src/linear.ts`: the real Linear pack from [dovre-packs](https://github.com/bergaaberg/dovre-packs),
  fed a fake Linear that answers its GraphQL from made-up data. It never reaches api.linear.app.
- `src/fixtures.ts`: core's Northwind fixtures, plus a changelog that names Linear issues.

## Run it

Core and dovre-packs are checkouts beside this one (`../dovre`, `../dovre-packs`).

```sh
pnpm install
pnpm check        # typecheck and tests
pnpm dev          # http://localhost:8798
pnpm run deploy   # demo.dovre.dev
```
