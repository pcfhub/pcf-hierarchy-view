/*
 * Retake every screenshot in `media/`.
 *
 *     npm run harness -- --no-open --port 8181     # in one shell
 *     npm run shots                                # in another
 *     npm run shots -- chart                       # only the recipes whose name contains "chart"
 *
 * **The recipes live here, not in a person's shell history.** A stale
 * screenshot is a documented claim about a version that no longer exists, and
 * the only defence is a retake cheap enough to run on every release. A recipe
 * is a page, the query string or the script that arranges the state, and what
 * to frame; the engine is `dev/cdp.js`, which is the template's and which
 * `sync-rig.mjs` keeps current. This file is the control's own.
 *
 * Every recipe points at `dev/preview.html` (its query switches are listed at
 * the top of that page) and frames `#root`, the control and nothing else.
 * `?image=1` draws a portrait per record as a data URI, because the page has
 * no `/Image/download.aspx` to answer the real addresses.
 *
 * **A picture changed under a published name is not republished.** The hub
 * mirrors `media/` by path and never fetches a path again, so a retake that
 * changes `screenshot.png` leaves the old one on the component page. The run
 * says so when it happens; 0.3's pictures carry `-0.3` in their names for that
 * reason.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { shoot } = require('./cdp');

const root = path.join(__dirname, '..');

const RECIPES = [
    // 0.1.1–0.2.0, the tree.
    { name: 'screenshot.png', purpose: 'the tree on a record in the middle', query: 'width=760', width: 792, frame: '#root' },
    { name: 'screenshot-expanded.png', purpose: 'Show all children and a branch opened', query: 'showall=p1&expand=k1&width=760', width: 792, frame: '#root' },
    { name: 'screenshot-fallback.png', purpose: 'a lookup nobody flagged: no counts', query: 'hierarchical=false&width=760', width: 792, frame: '#root' },
    { name: 'screenshot-dark.png', purpose: 'the tree, dark', query: 'dark=1&showall=p1&width=760', width: 792, frame: '#root' },
    { name: 'screenshot-narrow.png', purpose: 'the tree at 300px', query: 'width=300&depth=2', width: 332, frame: '#root' },

    // 0.3: the org chart, pictures, the keyboard.
    {
        name: 'screenshot-chart-0.3.png',
        purpose: 'the org chart with pictures: two teams side by side, the record centred',
        query: 'layout=chart&image=1&showall=r1,p1&depth=2&width=1180',
        width: 1212,
        frame: '#root',
        settle: 900,
    },
    {
        name: 'screenshot-chart-dark-0.3.png',
        purpose: 'the same chart, dark',
        query: 'layout=chart&image=1&showall=r1,p1&depth=2&width=1180&dark=1',
        width: 1212,
        frame: '#root',
        settle: 900,
    },
    {
        name: 'screenshot-chart-hanging-0.3.png',
        purpose: 'a team of leaves hangs in one column; initials where a record has no picture',
        query: 'layout=chart&image=1&width=640',
        width: 672,
        frame: '#root',
    },
    {
        name: 'screenshot-keyboard-0.3.png',
        purpose: 'the tree with the keyboard on it: the ring on the active row',
        query: 'image=1&showall=p1&width=760',
        width: 792,
        frame: '#root',
        act: "const t = document.querySelector('[role=tree]'); t.focus(); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));",
    },
    {
        name: 'screenshot-chart-narrow-0.3.png',
        purpose: 'Org chart chosen, 360px: the tree, with its pictures',
        query: 'layout=chart&image=1&width=360&depth=2',
        width: 392,
        frame: '#root',
    },
];

(async () => {
    const published = new Set(((JSON.parse(fs.readFileSync(path.join(root, 'pcfhub.json'), 'utf8')).media || {}).screenshots || [])
        .map((file) => path.basename(file)));
    const before = new Map(RECIPES.map((recipe) => {
        const file = path.join(root, 'media', recipe.name);

        return [recipe.name, fs.existsSync(file) ? fs.readFileSync(file) : null];
    }));

    const failed = await shoot(RECIPES, {
        root,
        port: process.env.PORT || 8181,
        only: process.argv.slice(2),
    });

    for (const [name, old] of before) {
        const file = path.join(root, 'media', name);

        if (old && published.has(name) && fs.existsSync(file) && !old.equals(fs.readFileSync(file))) {
            console.log(`\n  ${name} changed under a name pcfhub.json already publishes — the hub keeps serving the old`
                + '\n  picture. Give the new one a new name and repoint pcfhub.json and the docs.');
        }
    }

    if (failed > 0) {
        console.log(`\n  ${failed} of ${RECIPES.length} failed`);
        process.exit(1);
    }
})().catch((error) => {
    console.error(`\n  ${error.message}\n`);
    process.exit(1);
});
