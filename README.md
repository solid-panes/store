# store

A public catalogue of panes and apps for a Solid tool index.

**Browse it:** <https://solid-panes.github.io/store/>

## What it is

One file, [`catalogue.jsonld`](catalogue.jsonld), listing panes and apps in the
[PodOS tools vocabulary](https://pod-os.org/vocab/tools). It is the same format as a person's own tool index,
so "installing" an entry is copying its registration into your index.

- **Panes** draw your data inside the SolidOS data browser. Each is one JavaScript module.
- **Apps** open your data in their own tab, by a link pattern with `{url}` in it. The apps listed come from
  the list PodOS offers, with the same types.

## Adding one to your pod

1. Open your tool index dashboard ([Tools](https://solid-apps.github.io/tools/) finds or creates your index).
2. Choose **Browse the store**.
3. Press **Add**.

The dashboard is the [tool index pane](https://github.com/solid-panes/tool-index).

## Adding to the catalogue

Edit the lists at the top of `build.mjs` and run `node build.mjs`; it writes `catalogue.jsonld`.

A pane is a small program that runs as the person using it. This catalogue is a list, not a review: entries
are not checked or signed yet. Signing by authors and ratings from people you trust are the next steps
(JavaScriptSolidServer/JavaScriptSolidServer#651).

The type used for a pane module, `https://mashlib.com/ns/panes#PaneModuleInvocation`, is a placeholder: the
PodOS vocabulary does not yet have a kind for a JavaScript module.

## Licence

[MIT](LICENSE), copyright Melvin Carvalho.
