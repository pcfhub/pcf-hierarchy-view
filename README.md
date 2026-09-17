# Hierarchy View

A record's place in its hierarchy — ancestors above, children below — from its parent lookup.

[![Build](https://github.com/pcfhub/pcf-hierarchy-view/actions/workflows/build.yml/badge.svg)](https://github.com/pcfhub/pcf-hierarchy-view/actions/workflows/build.yml)
[![Release](https://github.com/pcfhub/pcf-hierarchy-view/actions/workflows/release.yml/badge.svg)](https://github.com/pcfhub/pcf-hierarchy-view/actions/workflows/release.yml)

Documentation lives on [PCFHub](https://pcfhub.dev/components/pcf-hierarchy-view), built
from the `docs/` directory in this repository. Edit the Markdown here; the hub
recompiles it.


## What it does

Bound to the lookup that points at a record's own table — *Parent Account*,
*Manager*, a custom table's *Parent* — it draws the record's position in that
hierarchy on the form: every ancestor to the top, the record marked, its
children beneath, each expandable one level at a time. Click a name to open
that record. Model-driven apps removed their built-in hierarchy visualisation
in October 2025; this is the replacement, on the form rather than behind a
button.

Two decisions a reader will otherwise question. **It is bound to the parent
lookup and never writes it** — the binding is the whole configuration (target
table, filter column and the record's own parent all come off it), and a
tree that could also re-parent by drag would need a confirmation flow this
control does not carry. And **it takes one of two routes**, decided by asking
the relationship metadata whether the lookup is flagged hierarchical: with the
flag, one FetchXML `eq-or-above` query reads the whole ancestor chain and a
`CountChildren` aggregate puts a chevron only where there are children;
without it — the usual state of a custom table — it walks up one
`retrieveRecord` per level and filters children on the lookup, and every node
gets a chevron until it is opened. A refused or unreachable metadata read
takes the second route silently rather than showing an error.

An ancestor shows only the branch that leads to the record, with *Show all
children* to load the rest, so a wide tree does not arrive at once; children
come a page at a time per node, by name.

## Properties

| Property | Type | Usage | Default | What it controls |
| --- | --- | --- | --- | --- |
| `value` | Lookup.Simple | bound, **required** | — | The self-referential lookup the hierarchy is read from. Never written. |
| `detailColumns` | SingleLine.Text | input | — | Comma-separated logical names shown under each record, three at most; formatted values. |
| `initialDepth` | Whole.None | input | `1` | Levels below the record open on first render, 0–5. |
| `maxChildren` | Whole.None | input | `50` | Children loaded per node (the query's page size), 1–250. |
| `sampleData` | Multiple | input | — | A JSON tree rendered instead of querying — for the hub's demo. Blank on a real form. |

A React (virtual) control on the platform's React 16.14 and Fluent UI 9.46;
neither is bundled. Strings ship in English, German, French, Japanese and
Spanish. Two features are declared, both optional, and both prompt the maker at
install: `WebAPI` (reading the hierarchy) and `Utility` (the table's primary
columns). The relationship metadata is read with a same-origin `fetch` that no
feature gates.

## On the hub

`demo.fidelity` is **mocked**. The control's whole content comes from
`context.webAPI`, which the hub's harness does not supply, so a demo that ran
the control as-is would show its *not available on this host* state and nothing
else. `sampleData` exists for this: a JSON tree the control renders instead of
querying, documented as demo-only, and every preset carries one — a record in
the middle, the top of the tree, a leaf, three levels open, names only — plus a
preset with no sample that shows the honest empty state. What the demo cannot
show: a card click (`openForm` has no form to open there), which of the two
routes a real form would take, and the platform's own formatted values.

## Install

Download the managed solution from the
[latest release](https://github.com/pcfhub/pcf-hierarchy-view/releases/latest), or from
the component's page on the hub, and import it into your environment.

## Develop

```bash
npm install
npm start          # the PCF test harness
npm run build
npm run lint
npm run check      # what CI runs first: placeholders, pcfhub.json, control shape
npm run smoke      # assertions against the built bundle — see dev/
npm run harness    # serves dev/harness.html and opens it
```

`npm start` renders the control; `dev/` is for the states it cannot reach. Build
first, then `npm run smoke` for the assertions, or `npm run harness` for the
switches — field-level security, a failed business rule, a host that publishes
no theme or no column metadata, and for a dataset control, more than one page.
Both read the bundle `npm run build` wrote, and both are described in the header
of `dev/smoke.js`.

`npm run harness` serves the repository over `http://` rather than leaving you to
open the file: over `file://` a dataset fixture cannot be fetched and a module
script is refused, and both arrive as an empty control with a CORS error. It
takes `--port` and `--no-open`, and needs no dependency — `dev/serve.js` is
`node:http`. A React (virtual) control gets one too: `dev/fluent-stub.js` stands
in for the Fluent the platform would supply, and its header says exactly where
the stand-in is less capable than the real thing.

Run `npm run refreshTypes` after every manifest edit — until you do,
`context.parameters` is typed from the old manifest and `tsc` will accept code that
cannot work.

To pack the solution locally you need msbuild — either Visual Studio or the
Visual Studio Build Tools:

```bash
cd Solution
msbuild /t:build /restore /p:configuration=Release
```

Both zips land in `Solution/bin/Release`. This is the only local step that compiles
in **production** mode, so a green `npm run build` is not evidence the shipping
bundle compiles — and the pack is incremental, so delete `obj/`, `out/`,
`Solution/obj/` and `Solution/bin/` first if you intend to quote a bundle size from
it.

## Release

1. Bump the version in **three** places, in one commit — they are checked
   against each other in CI:
   - `HierarchyView/ControlManifest.Input.xml` → `<control version="…">`
   - `Solution/src/Other/Solution.xml` → `<Version>`
   - `package.json` → `"version"`
2. Write the release notes — what changed for the user, what was fixed, what
   they must do — in a Markdown file.
3. Tag with them: `git tag -a --cleanup=verbatim v1.2.3 -F notes.md && git push origin v1.2.3` — without `--cleanup=verbatim`, git drops every `## Heading` in the notes as a comment, silently

**The tag message is the release body, and the release body is the changelog
on the hub.** A lightweight tag gets GitHub's generated notes instead, which
for a repository without pull requests is a single compare link — and the
workflow warns when that is about to happen.

The release workflow builds, packs both solution types, and attaches them to a
GitHub Release. PCFHub picks the release up from its webhook within seconds, or
from the hourly sweep otherwise. A sync imports a draft; a person publishes it.

## Repository layout

| Path | What it is |
| --- | --- |
| `HierarchyView/` | The control: manifest, entry point, CSS, localised strings |
| `Solution/` | The Dataverse solution that packages it |
| `dev/` | A stand-in host: `npm run smoke` asserts, `harness.html` shows |
| `SPEC.md` | What building this corrected, and what is verified versus read |
| `docs/` | The pages PCFHub publishes — see the comments in each file |
| `media/` | Images and video referenced from the docs |
| `pcfhub.json` | The hub's manifest: identity, links, docs path, demo |
| `scripts/` | Template setup and the CI guard that keeps it adopted |

## Licence

[MIT](LICENSE)
