# genesis/

Templates for AllFlow's genesis (plan primera-entrega §4.4, decision 1): the
generic pieces of the domain screens — one form for every entity, the list
table, search and pagination, delete/approve — live here as real code, versioned
with the template. `renderGenesis` (in AllFlow) copies them into the app and
generates only what depends on the spec (tables, queries, actions, pages).

- Files end in `.tpl` on purpose: this repo does not compile or lint them. The
  genesis strips the suffix, so `genesis/templates/lib/domain/meta.ts.tpl`
  lands at `lib/domain/meta.ts`.
- They import through `@/…` like any app file, so they only type-check inside
  a generated app (AllFlow's E13 CI does that for every golden spec).
- Nothing here is imported by the template itself.
