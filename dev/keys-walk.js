/*
 * The tree's keyboard, pressed for real, in both layouts: `npm run keys`.
 *
 * The suite proves the key map as a function (tree/keyboard.ts over the
 * template's lib/tree-keys); this proves the control around it — that Tab
 * reaches the tree once and leaves it on the next press, that a key reaches
 * the listener and moves aria-activedescendant to the row it names, that →
 * loads children through the reducer, that `*` under a partial ancestor
 * loads the family, that the page does not scroll under a handled key, and
 * that the ring is drawn on the active row while the tree has keyboard
 * focus. Real presses through the DevTools protocol (`dev/keys.js`, the
 * template's), against `dev/preview.html` on a spare port.
 *
 * Exits 1 on any failure. Needs a build: `npm run build` first.
 */

'use strict';

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { launch, sleep } = require('./cdp');
const { press, type, focused } = require('./keys');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function check(label, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        passed += 1;
        console.log('  ok    ' + label);
    } else {
        failed += 1;
        console.log('  FAIL  ' + label + '\n          got      ' + a + '\n          expected ' + e);
    }
}

/** The active row as a reader meets it: its name, level, place, open state; and what the page did. */
const STATE = `(() => {
    const tree = document.querySelector('[role=tree]');
    const id = tree && tree.getAttribute('aria-activedescendant');
    const row = id ? document.getElementById(id) : null;
    const name = row && row.querySelector('.HierarchyView-name, .HierarchyView-open');
    return {
        onTree: document.activeElement === tree,
        row: name ? name.textContent : null,
        level: row ? row.getAttribute('aria-level') : null,
        pos: row ? row.getAttribute('aria-posinset') + '/' + row.getAttribute('aria-setsize') : null,
        expanded: row ? row.getAttribute('aria-expanded') : null,
        selected: row ? row.getAttribute('aria-selected') : null,
        ring: row ? getComputedStyle(row.classList.contains('HierarchyView-node') ? row : row.querySelector('.HierarchyView-row')).outlineStyle : null,
        rows: document.querySelectorAll('[role=treeitem]').length,
        scrolled: window.scrollY,
    };
})()`;

async function walk(chrome, port, layout) {
    const state = () => chrome.evaluate(STATE);

    await chrome.navigate(`http://localhost:${port}/dev/preview.html?layout=${layout}&width=900`, 1500);

    console.log(`\n${layout}: one tab stop`);
    await press(chrome, 'Tab');
    let s = await state();
    check('Tab reaches the tree, on the record the form is open on, selected', [s.onTree, s.row, s.level, s.selected], [true, 'Contoso Deutschland GmbH', '3', 'true']);
    check('…and the ring is on that row', s.ring, 'solid');
    check('the tree is the focus, the rows are not: the role it names is a treeitem', (await focused(chrome)).active.role, 'treeitem');

    console.log(`${layout}: arrows`);
    await press(chrome, 'ArrowDown');
    s = await state();
    check('Down: the first child, one of two', [s.row, s.pos, s.expanded], ['Contoso Berlin', '1/2', 'false']);
    await press(chrome, 'ArrowRight', { wait: 400 });
    s = await state();
    check('Right on a closed node opens it and its children load; focus stays', [s.row, s.expanded, s.rows], ['Contoso Berlin', 'true', 6]);
    await press(chrome, 'ArrowRight');
    s = await state();
    check('Right on an open one moves into its first child', [s.row, s.level], ['Contoso Berlin Mitte', '5']);
    await press(chrome, 'ArrowLeft');
    await press(chrome, 'ArrowLeft');
    s = await state();
    check('Left goes to the parent, Left again closes it', [s.row, s.expanded, s.rows], ['Contoso Berlin', 'false', 5]);
    await press(chrome, 'Home');
    s = await state();
    check('Home: the top of the chain', s.row, 'Contoso Holdings');
    await press(chrome, 'End');
    s = await state();
    check('End: the last row on show', s.row, 'Contoso München — Niederlassung Süd, Vertrieb und Service');
    await press(chrome, ' ');
    s = await state();
    check('Space is taken: nothing scrolled', s.scrolled, 0);

    console.log(`${layout}: type-ahead and *`);
    await press(chrome, 'Home');
    await type(chrome, 'contoso e');
    s = await state();
    check('typing a name finds it', s.row, 'Contoso Europe');
    await press(chrome, 'ArrowDown');
    await press(chrome, '*', { wait: 400 });
    s = await state();
    check('* under an ancestor showing only its path child loads the family: France appears beside the record', [s.row, s.rows], ['Contoso Deutschland GmbH', 6]);

    console.log(`${layout}: leaving`);
    await press(chrome, 'Tab');
    s = await state();
    check('Tab again leaves the tree — one stop, not one per row', s.onTree, false);
}

async function main() {
    const spare = http.createServer();
    await new Promise((resolve) => spare.listen(0, resolve));
    const port = spare.address().port;
    await new Promise((resolve) => spare.close(resolve));
    const server = spawn(process.execPath, [path.join(root, 'dev', 'serve.js'), '--no-open', '--port', String(port)], { stdio: 'ignore' });
    await sleep(600);

    const chrome = await launch({ width: 1100, height: 900 });

    try {
        await walk(chrome, port, 'tree');
        await walk(chrome, port, 'chart');
        const errors = await chrome.evaluate('(window.__pageErrors || []).length');
        check('no page errors', errors, 0);
    } finally {
        await chrome.close();
        server.kill();
    }

    console.log(`\n  ${passed} passed, ${failed} failed — real keys in the preview; a form is SPEC.md's walkthrough\n`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
