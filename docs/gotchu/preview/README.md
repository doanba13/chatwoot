# Gotchu preview harness

A standalone page that mounts the re-themed `components-next` primitives against
the real dashboard stylesheet, so the design pass can actually be looked at.

```sh
# from the repo root — the aliases are cwd-relative, as in vite.shared.ts
pnpm exec vite --config docs/gotchu/preview/vite.config.mjs
# → http://localhost:5199, with a Light/Dark toggle in the header

# and the smoke mount, which is the part CI could run:
pnpm exec vitest --no-watch --config docs/gotchu/preview/vitest.config.mjs
```

## Why this exists rather than histoire

`pnpm story:dev` and `pnpm story:build` are broken on this fork, and were broken
before this branch — verified by running `story:build` on `develop`, where it
fails identically. histoire 0.17 / vite-node 0.34 / mlly mis-resolve
`@babel/runtime`'s `./helpers/esm/*` exports wildcard under pnpm's strict
layout, and it dies during story collection before Vite compiles anything.
Switching to the node version `.nvmrc` pins (24.13.0) does not change it.

So the repo's own visual surface produced no signal at all on a change whose
whole point is visual. This harness is the replacement. It is a development aid:
nothing under `app/` imports it, and it is excluded from the main vitest config
by that config's own `include: ['app/**']`.

## What the smoke spec is for

A successful Vite build only proves the components *compile*. `smoke.spec.js`
mounts them together and catches the class of mistake a build cannot see — a
prop that does not exist, a slot contract read the wrong way round, a component
that throws on setup. It earned its place on the first run: `SidebarGroupLeaf`
threw `Component is missing a parent <Sidebar /> component`, which the build had
happily accepted.

## Known gap

`SidebarGroupLeaf` is not in the gallery. It calls `useSidebarContext()`, which
injects a `Symbol` private to `sidebar/provider.js` and additionally needs
`usePolicy()` and `useUISettings()` — the Vuex store. Mounting it here would mean
reproducing half the application for one row, so its re-theme is covered by its
own 19 passing specs instead.
