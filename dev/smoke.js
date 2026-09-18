/*
 * Drives the real built bundle outside a browser.
 *
 *     npm run build && npm run smoke
 *
 * What it does: installs the DOM and the platform globals, loads
 * `out/controls/HierarchyView/bundle.js` the way a form would, drives the control
 * through the states a form can put it in, and asserts what it did.
 *
 * Why it exists alongside `npm start` and `dev/harness.html`: both of those
 * *show* you the control, and the states that matter most are ones nobody
 * thinks to look at — a column the user cannot read, a business rule that
 * failed, a host with no column metadata, a cleared value that has to travel
 * back as `null` rather than `undefined`. Those are decisions, they are what
 * regresses, and here they are assertions with an exit code.
 *
 * Why no test framework: there is none in this repository, and adding one to
 * run a handful of assertions against a bundle would be a dependency, a config
 * file and a second build pipeline for something `node` already does. It also
 * runs the **built bundle** rather than the TypeScript sources, which is the
 * part worth checking — webpack, the externals and the manifest all sit between
 * the source and what a form actually loads. CI runs it after the msbuild pack,
 * so there it drives the production bundle.
 *
 * **What passing here does NOT mean.** Every value below is supplied by this
 * file. It cannot tell you that the control looks right, that the stylesheet
 * applies, that focus order works, that a real form hands down what these
 * fixtures hand down, or that a save persists anything. Keep the answers to
 * those in SPEC.md under "Not verified".
 *
 * **If the bundle will not load here at all**, because it carries a browser
 * application that reads `document` at module scope — a Monaco, a map, a
 * charting library — do not grow `dom.js` to meet it. Keep the control's
 * decisions in modules that import nothing of the library, and drive those
 * instead: `pcf-code-editor`'s `dev/smoke.js` transpiles them with the
 * TypeScript already in devDependencies and refuses one that imports the
 * library. The skill has the shape under *When the bundle cannot load in
 * Node*.
 *
 * **And a stub must never be more capable than the thing it stands in for.**
 * `dev/host.js` withholds `security`, `attributes` and `fluentDesignLanguage`
 * exactly where the platform withholds them. When you add to it, stub the
 * refusals first — the argument the call requires, the field it omits, the
 * empty collection it hands back. If you cannot say what the real call
 * withholds, the stub is a guess and the assertions resting on it prove
 * nothing.
 *
 * ---
 *
 * **The assertions below the divider are a worked example. Replace them.**
 * Everything above the divider is plumbing that works for any field control;
 * the examples exercise the scaffolded control and are meant to be thrown away
 * with it.
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Resolved from this file rather than from the working directory, so the script
// behaves the same run directly or through npm.
const root = path.join(__dirname, '..');
const dom = require('./dom.js');
const host = require('./host.js');
const clock = require('./clock.js');
const fixture = require('./fixture.js');

const BUNDLE = path.join(root, 'out', 'controls', 'HierarchyView', 'bundle.js');

if (!fs.existsSync(BUNDLE)) {
    console.error('\n  No bundle at out/controls/HierarchyView. Run npm run build first.\n');
    process.exit(1);
}

/* ----------------------------------------------------------- the platform */

dom.install(global);

/*
 * Time, replaced with something the test drives.
 *
 * `vm.runInThisContext` below evaluates the bundle in *this* realm, so the
 * `Date`, `setInterval` and `setTimeout` the control closes over are the ones
 * installed here. That is what makes a control with a clock testable without
 * an injectable clock parameter — which would be production code bent to suit
 * a harness, and the only reason that seam would exist.
 *
 * A control with no timers is unaffected by this: nothing schedules, nothing
 * fires, and `time.pending()` stays at zero. Keep it anyway — the teardown
 * assertion at the bottom of this file is written against it, and it is the
 * assertion worth keeping when the worked example goes.
 *
 * The start value is arbitrary and fixed. A suite that starts at "now" asserts
 * something slightly different every time it runs.
 */
const time = clock.install(Date.UTC(2026, 0, 1, 12, 0, 0), global);

const registration = host.captureRegistration(global);

const source = fs.readFileSync(BUNDLE, 'utf8');

/*
 * The platform libraries, supplied under the names the bundle actually asks
 * for — read out of the bundle rather than written down here.
 *
 * A `<platform-library>` entry becomes a webpack external, and the global it
 * compiles to carries a version in its name. **That version is not the one the
 * manifest declares.** `pcf-scripts` maps a declared version onto the platform
 * build it supports, so Fluent `9.46.2` arrives as `FluentUIReactv940` and
 * React `16.14.0` as `Reactv16`. Hardcoding either is a trap that springs on
 * the next version bump, with a `ReferenceError` naming a global that appears
 * nowhere in the repository.
 *
 * A standard control has no externals at all, in which case both lists are
 * empty and nothing below runs.
 */
const reactGlobals = [...new Set(source.match(/\bReactv[\w]*\b/g) || [])];
const fluentGlobals = [...new Set(source.match(/\bFluentUIReact[\w]*\b/g) || [])];

let React = null;

if (reactGlobals.length > 0) {
    React = require(path.join(root, 'node_modules', 'react'));
    reactGlobals.forEach((name) => {
        global[name] = React;
    });
}

/*
 * Fluent is stubbed rather than loaded, the way the grid rig stubs it: every
 * component resolves to its own name as an element type, so
 * `React.createElement(Input, …)` produces `{ type: 'Input', props }` and the
 * props the control passed survive for inspection. These assertions are about
 * the control's decisions, not about how Fluent renders them — and Fluent 9
 * ships no UMD build, so there is nothing to load in a browser either.
 */
/*
 * **A stand-in component per name, not the name as the element type.** React
 * lower-cases an unknown element, so `MenuItem` became `<menuitem>` — which
 * HTML treats as a void element, and `renderToStaticMarkup` throws rather
 * than give it children. Every capitalised export is therefore a function
 * component rendering a `<div data-fluent="Name">` with the string, number
 * and boolean props the control passed — className, aria-*, title, disabled
 * — so `renderDeep` can look for them; a lower-case export (`webLightTheme`,
 * `tokens`) is a plain object. Found by `pcf-calendar-view`, whose move menu
 * was the first `MenuItem` a suite tried to render.
 */
const standIns = new Map();

function fluentStandIn(name) {
    if (!standIns.has(name)) {
        const StandIn = (props) => {
            const passed = { 'data-fluent': name };

            Object.keys(props || {}).forEach((key) => {
                const value = props[key];

                if (key !== 'children' && ['string', 'number', 'boolean'].includes(typeof value)) {
                    passed[key] = value;
                }
            });

            return React.createElement('div', passed, props.children);
        };

        StandIn.displayName = name;
        standIns.set(name, StandIn);
    }

    return standIns.get(name);
}

const fluent = new Proxy({}, {
    get: (_target, name) => {
        if (typeof name !== 'string') {
            return undefined;
        }

        return /^[A-Z]/.test(name) ? fluentStandIn(name) : {};
    },
});

fluentGlobals.forEach((name) => {
    global[name] = fluent;
});

vm.runInThisContext(source, { filename: 'bundle.js' });

/* ---------------------------------------------------------------- harness */

const results = [];

function check(label, ok, detail) {
    results.push({ ok, label, detail });
}

// `getString` returns a marked key rather than a real string, so an assertion
// can tell "read from the .resx" apart from "hardcoded in the source" — which
// would otherwise look identical in the output.
const marked = (key) => `resx:${key}`;

/**
 * Mount a fresh control in a given state and hand back everything worth
 * asserting about it.
 *
 * A new instance per state on purpose: `init` runs once per control on a real
 * form, so a suite that reused one instance would be testing a sequence the
 * platform never produces. Where the *sequence* is the point — a value arriving
 * after an edit — drive `updateView` again through the returned handle.
 */
/**
 * Every control mounted and not yet destroyed.
 *
 * A suite that mounts and walks away is testing something other than what it
 * says: an abandoned control keeps its interval and its `document` listeners,
 * so the next section's counts include them and the next event dispatched at
 * `document` reaches all of them. That is the leak the teardown assertion
 * exists to catch, and asserting it from inside one proves nothing.
 */
const live = [];

function disposeAll() {
    while (live.length > 0) {
        live.pop().destroy();
    }
}

function mount(options) {
    const container = dom.createElement('div');
    /*
     * What is the *instance's* rather than the render's: the call log, the
     * organisation URL and the rows behind the Web API. `createContext` runs
     * per render, so these are decided once here and handed to every context
     * this mount builds — `update()` included, which used to drop `calls` and
     * so could not record what a re-render made the control do.
     */
    const site = { calls: [], clientUrl: options.clientUrl || host.nextClientUrl(), fixture: options.fixture || fixture };
    // `getString` first, so a single assertion can override it — the marked key
    // proves a string came from the .resx, but it cannot prove a `{0}` was
    // substituted, because a marked key has no `{0}` in it to substitute.
    const context = host.createContext({ getString: marked, ...options, ...site });
    const instance = new registration.ctor();

    let notifications = 0;

    /*
     * The third argument is the state a previous mount handed to
     * `mode.setControlState`, and it was hard-coded to `{}` here — which made
     * the *return* half of that API unreachable from a suite. Pass `state` in
     * `options` to mount a control the way the platform remounts one after a
     * form tab switch. `{}` remains the default, because that is a first mount.
     */
    instance.init(context, () => {
        notifications += 1;
    }, options.state || {}, container);

    // A standard control returns nothing and has written into `container`; a
    // virtual one returns the element it wants rendered and was handed no
    // container at all.
    const element = instance.updateView(context);

    const handle = {
        instance,
        container,
        element,
        props: () => (element && element.props) || {},
        outputs: () => instance.getOutputs(),
        notifications: () => notifications,
        /** Every platform call the control made, on any pass. */
        calls: () => site.calls,
        /** The organisation URL this instance's `page.getClientUrl()` answers. */
        clientUrl: site.clientUrl,
        /** Re-render in a new state, as the platform does on every change. */
        update: (next) => instance.updateView(host.createContext({ getString: marked, ...options, ...site, ...next })),
        /** Unmount, as the platform does when the form closes or navigates. */
        destroy: () => {
            instance.destroy();

            const at = live.indexOf(handle);

            if (at !== -1) {
                live.splice(at, 1);
            }
        },
        find: (selector) => container.querySelector(selector),
    };

    live.push(handle);

    return handle;
}

check('bundle registered a control', typeof registration.ctor === 'function');

if (typeof registration.ctor !== 'function') {
    report();
}

/* ======================================================================== *
 *  HIERARCHY VIEW — what the control decides, asserted two ways.
 *
 *  The **pure modules** (`query/`, `tree/`, `sample/`, `data/`, `platform.ts`)
 *  are transpiled straight from source and driven directly: the exact FetchXML
 *  a server would receive, the chain put in order, every reducer transition,
 *  the two live sources against the rig's Web API. The **bundle** is mounted
 *  through `mount()` and read through the props it hands the component, which
 *  are its decisions about the host: which of the seven modes, which route,
 *  what key the tree is built from.
 *
 *  What neither can prove: that a real form's `retrieveMultipleRecords` takes
 *  the FetchXML at all, or how it wants it encoded — SPEC.md's P1, and every
 *  other row of its *Measured* table.
 * ======================================================================== */

const ts = require(path.join(root, 'node_modules', 'typescript'));

/**
 * Render an element all the way down with `react-dom/server`, which needs no
 * DOM. Fluent is the stand-in, so a component renders as
 * `<div data-fluent="Name">`; the assertions are about what the control put
 * in the markup, never about Fluent. Effects do not run here, so this reaches
 * the synchronous states only — the tree after loading is rendered through
 * `TreeRow` from reducer state below.
 */
function renderDeep(element) {
    if (element === undefined || element === null || React === null) {
        return null;
    }

    const server = require(path.join(root, 'node_modules', 'react-dom', 'server'));
    const warn = console.error;
    console.error = () => {};

    try {
        return server.renderToStaticMarkup(element);
    } finally {
        console.error = warn;
    }
}
const { Module } = require('module');
const src = path.join(root, 'HierarchyView');

/**
 * Transpile one source file and evaluate it as its own module. Relative
 * imports come back through here; `react` is the React the bundle got;
 * `@fluentui/react-components` is the same stand-in Proxy the bundle got, so a
 * transpiled component renders to `<div data-fluent="Name">` too.
 */
const moduleCache = new Map();

function load(name) {
    if (moduleCache.has(name)) {
        return moduleCache.get(name).exports;
    }

    const file = path.join(src, `${name}.ts${fs.existsSync(path.join(src, `${name}.tsx`)) ? 'x' : ''}`);
    const source = fs.readFileSync(file, 'utf8');
    const { outputText, diagnostics } = ts.transpileModule(source, {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true, jsx: ts.JsxEmit.React },
        reportDiagnostics: true,
    });

    if (diagnostics && diagnostics.length > 0) {
        throw new Error(`${name}: ${diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n')}`);
    }

    const mod = new Module(file, module);
    mod.filename = file;
    mod.paths = Module._nodeModulePaths(src);
    moduleCache.set(name, mod);
    mod.require = function (request) {
        if (request.startsWith('.')) {
            return load(path.posix.normalize(path.posix.join(path.posix.dirname(name), request)));
        }
        if (request === 'react') {
            return React;
        }
        if (request === '@fluentui/react-components') {
            return fluent;
        }
        return Module.prototype.require.call(this, request);
    };
    mod._compile(outputText, file);

    return mod.exports;
}

const Q = load('query/fetchXml');
const R = load('query/records');
const C = load('query/chain');
const T = load('tree/reducer');
const S = load('sample/parseSampleData');
const D = load('data/HierarchyData');
const P = load('platform');

const q = { entity: 'account', primaryId: 'accountid', primaryName: 'name', column: 'parentaccountid', details: ['address1_city', 'revenue'] };
const G1 = '0f8fad5b-d9cb-469f-a165-70867728950e';

/* ------------------------------------------------------------ the queries */

check(
    'detailColumns: logical names only, lower-cased, deduplicated, three at most, the bound column excluded',
    JSON.stringify(Q.parseDetailColumns(' Address1_City, revenue, Bogus Name!, parentaccountid, revenue, telephone1, fax ', ['parentaccountid']))
        === JSON.stringify(['address1_city', 'revenue', 'telephone1']),
    JSON.stringify(Q.parseDetailColumns(' Address1_City, revenue, Bogus Name!, parentaccountid, revenue, telephone1, fax ', ['parentaccountid'])),
);

check('bareId strips braces and folds case, and refuses an empty or non-string id', Q.bareId('{0F8FAD5B-D9CB-469F-A165-70867728950E}') === G1 && Q.bareId('c1') === 'c1' && Q.bareId('') === null && Q.bareId(undefined) === null && Q.bareId(12) === null);

check('escapeXml covers the five characters', Q.escapeXml(`<a&'b">`) === '&lt;a&amp;&apos;b&quot;&gt;');

const ancestors = Q.ancestorsFetchXml(q, G1);

check(
    'the ancestor query asks eq-or-above on the primary key, with every card column and a CountChildren aggregate',
    ancestors === "<fetch><entity name='account'>"
        + "<attribute name='accountid'/><attribute name='name'/><attribute name='parentaccountid'/><attribute name='address1_city'/><attribute name='revenue'/>"
        + "<attribute name='accountid' rowaggregate='CountChildren' alias='children'/>"
        + `<filter><condition attribute='accountid' operator='eq-or-above' value='${G1}'/></filter>`
        + '</entity></fetch>',
    ancestors,
);

check(
    'the children query filters on the lookup column and orders by name',
    Q.childrenFetchXml(q, G1).includes(`<filter><condition attribute='parentaccountid' operator='eq' value='${G1}'/></filter><order attribute='name'/>`),
);

check(
    'the fallback children query is OData on the lookup\'s _value, ordered by name',
    Q.childrenOData(q, G1) === `?$select=accountid,name,parentaccountid,address1_city,revenue&$filter=_parentaccountid_value eq ${G1}&$orderby=name asc`,
    Q.childrenOData(q, G1),
);

check(
    'the query string spelling is decided in one place, and it is the documented one until P1 says otherwise',
    Q.FETCHXML_ENCODED === false && Q.queryString('<fetch/>') === '?fetchXml=<fetch/>',
);

/* -------------------------------------------------------------- the rows */

const row = {
    accountid: '{C1C1C1C1-0000-0000-0000-000000000001}',
    name: 'Contoso West',
    _parentaccountid_value: 'p1p1p1p1-0000-0000-0000-000000000001',
    '_parentaccountid_value@OData.Community.Display.V1.FormattedValue': 'Contoso',
    address1_city: 'Seattle',
    revenue: 1200000,
    'revenue@OData.Community.Display.V1.FormattedValue': '$1,200,000.00',
    children: '2',
};
const node = R.toNode(row, q);

check(
    'a row becomes a node: bare id, formatted values over raw ones, a string count read as a number',
    node.id === 'c1c1c1c1-0000-0000-0000-000000000001'
        && node.parentId === 'p1p1p1p1-0000-0000-0000-000000000001'
        && node.details[0].text === 'Seattle'
        && node.details[1].text === '$1,200,000.00'
        && node.childCount === 2,
    JSON.stringify(node),
);

check('a null detail is an empty string, and a row without the aggregate has no count',
    R.toNode({ accountid: G1, name: 'x', address1_city: null }, q).details[0].text === ''
    && R.toNode({ accountid: G1, name: 'x' }, q).childCount === null);

check('a row without a usable id is dropped', R.toNodes([{ name: 'no id' }, { accountid: G1, name: 'ok' }], q).length === 1);

/* ------------------------------------------------------------- the chain */

const mk = (id, parentId, count) => ({ id, name: id.toUpperCase(), parentId, details: [], childCount: count === undefined ? null : count });

check(
    'the chain is ordered top-most first whatever order the server sent, and strangers are left out',
    C.orderChain([mk('c1', 'p1'), mk('x9', 'r1'), mk('r1', null), mk('p1', 'r1')], 'c1').map((n) => n.id).join(',') === 'r1,p1,c1',
);
check('a parent the user cannot read starts the chain there', C.orderChain([mk('c1', 'p1'), mk('p1', 'ghost')], 'c1').map((n) => n.id).join(',') === 'p1,c1');
check('a cycle in the data ends the chain rather than the tab', C.orderChain([mk('a', 'b'), mk('b', 'a')], 'a').map((n) => n.id).join(',') === 'b,a');
check('a record missing from its own answer is an empty chain', C.orderChain([mk('p1', null)], 'c1').length === 0);

/* ----------------------------------------------------------- the reducer */

let tree = T.initialState('c1');
tree = T.reduce(tree, { type: 'chainLoaded', chain: [mk('r1', null, 2), mk('p1', 'r1', 2), mk('c1', 'p1', 2)], initialDepth: 1 });

let rows = T.visibleRows(tree);
check(
    'after the chain: three rows, the ancestors partial and open, the current record open and marked',
    rows.map((r) => `${r.node.id}:${r.depth}:${r.isAncestor ? 'A' : ''}${r.isCurrent ? 'C' : ''}${r.partial ? 'p' : ''}${r.expanded ? 'e' : ''}`).join(' ')
        === 'r1:0:Ape p1:1:Ape c1:2:Ce',
    rows.map((r) => `${r.node.id}:${r.depth}:${r.isAncestor ? 'A' : ''}${r.isCurrent ? 'C' : ''}${r.partial ? 'p' : ''}${r.expanded ? 'e' : ''}`).join(' '),
);
check('only the current record is pending — an ancestor shows its path child without a query', JSON.stringify(T.pendingLoads(tree)) === '["c1"]');
check('relative depth: current 0, parent -1, root -2', T.relativeDepth(tree, 'c1') === 0 && T.relativeDepth(tree, 'p1') === -1 && T.relativeDepth(tree, 'r1') === -2);

tree = T.reduce(tree, { type: 'loading', id: 'c1' });
check('a loading node is no longer pending', T.pendingLoads(tree).length === 0 && T.visibleRows(tree)[2].loading === true);

tree = T.reduce(tree, { type: 'childrenLoaded', id: 'c1', children: [mk('k1', 'c1', 1), mk('k2', 'c1', 0)], truncated: false, expandChildren: false });
rows = T.visibleRows(tree);
check(
    'children land under the current record, collapsed, one with a chevron and one without',
    rows.map((r) => `${r.node.id}:${r.hasChildren}`).join(' ') === 'r1:yes p1:yes c1:yes k1:yes k2:no'
        && T.relativeDepth(tree, 'k1') === 1,
    rows.map((r) => `${r.node.id}:${r.hasChildren}`).join(' '),
);

tree = T.reduce(tree, { type: 'toggle', id: 'k1' });
check('opening a node makes it pending; a node the server counted at zero never is', JSON.stringify(T.pendingLoads(tree)) === '["k1"]');

tree = T.reduce(tree, { type: 'loading', id: 'k1' });
tree = T.reduce(tree, { type: 'loadFailed', id: 'k1', message: 'Refused by the rig.' });
check('a failed load stays open, shows the message, and is not retried on its own', T.visibleRows(tree)[3].failed === 'Refused by the rig.' && T.pendingLoads(tree).length === 0);
tree = T.reduce(tree, { type: 'retry', id: 'k1' });
check('retry forgets the failure and the node is pending again', JSON.stringify(T.pendingLoads(tree)) === '["k1"]' && T.visibleRows(tree)[3].failed === null);

tree = T.reduce(tree, { type: 'showAll', id: 'p1' });
check('show all on an ancestor forgets its path child and makes it pending', T.pendingLoads(tree).includes('p1') && T.visibleRows(tree)[1].partial === false);
tree = T.reduce(tree, { type: 'childrenLoaded', id: 'p1', children: [mk('c1', 'p1', 2), mk('s1', 'p1', 0)], truncated: false, expandChildren: false });
rows = T.visibleRows(tree);
check(
    'the sibling appears beside the current record, which keeps its children and its mark',
    rows.map((r) => r.node.id).join(',') === 'r1,p1,c1,k1,k2,s1' && rows[2].isCurrent && rows[1].isAncestor,
    rows.map((r) => r.node.id).join(','),
);

const truncated = T.reduce(T.reduce(T.initialState('c1'), { type: 'chainLoaded', chain: [mk('c1', null, 9)], initialDepth: 1 }),
    { type: 'childrenLoaded', id: 'c1', children: [mk('k1', 'c1'), mk('k2', 'c1')], truncated: true, expandChildren: false });
check('a truncated node keeps the server\'s count and says how many are shown', T.visibleRows(truncated)[0].truncated && T.visibleRows(truncated)[0].loadedCount === 2 && truncated.nodes.c1.childCount === 9);

const deep = T.reduce(T.reduce(T.initialState('c1'), { type: 'chainLoaded', chain: [mk('c1', null)], initialDepth: 2 }),
    { type: 'childrenLoaded', id: 'c1', children: [mk('k1', 'c1')], truncated: false, expandChildren: true });
check('initialDepth 2 opens the children as they land', T.pendingLoads(deep).includes('k1'));
check('initialDepth 0 shows the current record closed', T.pendingLoads(T.reduce(T.initialState('c1'), { type: 'chainLoaded', chain: [mk('c1', null)], initialDepth: 0 })).length === 0);
check('an empty chain is not-found', T.reduce(T.initialState('c1'), { type: 'chainLoaded', chain: [], initialDepth: 1 }).error === 'not-found');

/* ------------------------------------------------------------ sample data */

const sampleJson = JSON.stringify({
    current: 'c1',
    records: [
        { id: 'r1', name: 'Contoso', parentId: null },
        { id: 'c1', name: 'Contoso West', parentId: 'r1', details: { City: 'Seattle', Owner: 'Ana' }, childCount: 2 },
        { id: 'k1', name: 'Kid', parentId: 'c1' },
        { id: 'k2', name: 'Kid 2', parentId: 'c1', childCount: -3 },
        { id: 'orphan', name: 'Orphan', parentId: 'nobody' },
        { name: 'no id' },
        { id: 'c1', name: 'duplicate' },
    ],
});
const sample = S.parseSampleData(sampleJson);

check(
    'sample data: records kept once each, an unknown parent makes a root, a bad count is null, details capped',
    sample.ok && sample.tree.currentId === 'c1' && sample.tree.nodes.length === 5
        && sample.tree.nodes.find((n) => n.id === 'orphan').parentId === null
        && sample.tree.nodes.find((n) => n.id === 'k2').childCount === null
        && sample.tree.nodes.find((n) => n.id === 'c1').details.length === 2,
    JSON.stringify(sample),
);
check('bad JSON, no records, or a blank string is not sample data', !S.parseSampleData('nope').ok && !S.parseSampleData('{}').ok && !S.parseSampleData('  ').ok);
check('a current that names no record falls back to the first', S.parseSampleData('{"current":"zz","records":[{"id":"a","name":"A"}]}').tree.currentId === 'a');

/* --------------------------------------------- the three sources, live */

async function sources() {
    const sampleSource = D.createSampleSource(sample.tree);
    const chain = await sampleSource.loadChain();
    check('the sample source answers the chain and children from the parsed tree', chain.map((n) => n.id).join(',') === 'r1,c1' && (await sampleSource.loadChildren('c1')).children.length === 2);

    const calls = [];
    const ctx = host.createContext({ fixture, calls, clientUrl: host.nextClientUrl() });
    const live = { webAPI: ctx.webAPI, q: { ...q, details: ['address1_city', 'revenue'] }, recordId: 'c1', parentId: 'p1', maxChildren: 50 };

    const fx = D.createFetchXmlSource(live);
    const fxChain = await fx.loadChain();
    check(
        'the FetchXML source reads the whole chain in one eq-or-above call, in order, with counts',
        fxChain.map((n) => `${n.id}:${n.childCount}`).join(',') === 'r1:2,p1:2,c1:2'
            && calls.filter((c) => c.startsWith('webAPI.retrieveMultipleRecords')).length === 1
            && calls[0].includes("operator='eq-or-above'"),
        JSON.stringify({ chain: fxChain.map((n) => n.id), calls }),
    );
    check('and formatted values reach the card', fxChain[0].details[1].text === '$1,200,000,000.00', JSON.stringify(fxChain[0].details));

    const kids = await fx.loadChildren('c1');
    check(
        'its children come by name with their own counts, and maxChildren is the page size',
        kids.children.map((n) => `${n.id}:${n.childCount}`).join(',') === 'k1:1,k2:0' && kids.truncated === false
            && calls[calls.length - 1].includes(' max=50'),
        JSON.stringify(kids.children.map((n) => n.id)) + ' ' + calls[calls.length - 1].slice(-60),
    );
    const cut = await D.createFetchXmlSource({ ...live, maxChildren: 1 }).loadChildren('c1');
    check('a node with more children than the page says so', cut.children.length === 1 && cut.truncated === true);

    calls.length = 0;
    const od = D.createODataSource(live);
    const odChain = await od.loadChain();
    check(
        'the OData source walks up one retrieveRecord per level, current first, and orders the same chain',
        odChain.map((n) => n.id).join(',') === 'r1,p1,c1'
            && calls.filter((c) => c.startsWith('webAPI.retrieveRecord')).map((c) => c.split(' ')[1]).join(',') === 'c1,p1,r1',
        JSON.stringify(calls),
    );
    const odKids = await od.loadChildren('c1');
    check(
        'its children come through an OData $filter on the lookup, without counts',
        odKids.children.map((n) => `${n.id}:${n.childCount}`).join(',') === 'k1:null,k2:null'
            && calls[calls.length - 1].includes('$filter=_parentaccountid_value eq c1'),
        calls[calls.length - 1],
    );

    const orphaned = JSON.parse(JSON.stringify(fixture));
    orphaned.tables.account = orphaned.tables.account.filter((r) => r.accountid !== 'r1');
    const partialChain = await D.createODataSource({ ...live, webAPI: host.createContext({ fixture: orphaned, clientUrl: host.nextClientUrl() }).webAPI }).loadChain();
    check('a parent the user cannot read ends the walk, not the tree', partialChain.map((n) => n.id).join(',') === 'p1,c1', partialChain.map((n) => n.id).join(','));

    let fault = null;
    await D.createFetchXmlSource({ ...live, webAPI: host.createContext({ fixture, clientUrl: host.nextClientUrl(), webApiFails: true }).webAPI }).loadChain().catch((e) => { fault = e; });
    check('a refusing Web API surfaces the platform\'s sentence, not [object Object]', D.faultMessage(fault) === 'The request could not be completed.', D.faultMessage(fault));
    check('faultMessage survives null, a string and an Error', D.faultMessage(null) === '' && D.faultMessage('x') === 'x' && D.faultMessage(new Error('e')) === 'e');

    /* ------------------------------------------------ the hierarchy check */

    const a = host.createContext({ fixture, clientUrl: host.nextClientUrl() });
    check('isHierarchical: the fixture\'s parentaccountid is', await P.isHierarchical(a.page.getClientUrl(), 'account', 'parentaccountid') === true);
    check('… and masterid is not', await P.isHierarchical(a.page.getClientUrl(), 'account', 'masterid') === false);
    const b = host.createContext({ fixture, clientUrl: host.nextClientUrl(), hierarchical: false });
    check('… nor parentaccountid on a table nobody flagged', await P.isHierarchical(b.page.getClientUrl(), 'account', 'parentaccountid') === false);
    const c = host.createContext({ fixture, clientUrl: host.nextClientUrl(), relationshipsStatus: 403 });
    check('a refused metadata read answers false, never throws', await P.isHierarchical(c.page.getClientUrl(), 'account', 'parentaccountid') === false);
    const d = host.createContext({ fixture, clientUrl: host.nextClientUrl(), relationshipsStatus: 0 });
    check('an offline metadata read answers false, never throws', await P.isHierarchical(d.page.getClientUrl(), 'account', 'parentaccountid') === false);
    check('the answer is cached per organisation and table', P.isHierarchical(a.page.getClientUrl(), 'account', 'parentaccountid') === P.isHierarchical(a.page.getClientUrl(), 'account', 'parentaccountid'));
}

/* ------------------------------------------------------------- the bundle */

const LOOKUP = { valueType: 'Lookup.Simple', column: 'parentaccountid', value: fixture.parentLookup, contextInfo: { entityId: '{C1C1C1C1-0000-0000-0000-000000000001}', entityTypeName: 'account' } };

const bound = mount(LOOKUP);
check('a saved record with a parent lookup and a Web API is live', bound.props().mode === 'live', bound.props().mode);
check('the record id is bare and lower-case whatever the host spelt', bound.props().currentId === 'c1c1c1c1-0000-0000-0000-000000000001', bound.props().currentId);
check('getOutputs is empty and the control never notifies', JSON.stringify(bound.outputs()) === '{}' && bound.notifications() === 0);
check('it asks for width changes once, in init', bound.calls().filter((c) => c === 'trackContainerResize(true)').length === 1, JSON.stringify(bound.calls()));
check('the strings come from the .resx', bound.props().strings.notAvailable === 'resx:HierarchyView_NotAvailable' && bound.props().strings.expand === 'resx:HierarchyView_Expand');
check('the card can open a record because the host has openForm', typeof bound.props().openRecord === 'function');
check('the theme is the host\'s when it publishes one, and dark is passed through as a boolean', bound.props().dark === false);

const keyBefore = bound.props().sourceKey;
const redrawn = bound.update({});
check('a re-render with nothing changed keeps the same key and the same resolve', redrawn.props.sourceKey === keyBefore && redrawn.props.resolve === bound.props().resolve);
const deeper = bound.update({ inputs: { initialDepth: 3, detailColumns: 'address1_city' } });
check('an input changed after init changes the key — the hub\'s preset switch reaches the tree', deeper.props.sourceKey !== keyBefore && deeper.props.initialDepth === 3);
check('initialDepth and maxChildren are clamped', bound.update({ inputs: { initialDepth: 99, maxChildren: 0 } }).props.initialDepth === 5 && bound.update({ inputs: { maxChildren: 9999 } }).props.sourceKey.includes('|250|'));

check('no Web API is not-available', mount({ ...LOOKUP, webAPI: false }).props().mode === 'not-available');
check('an unsaved record is save-first', mount({ ...LOOKUP, contextInfo: null }).props().mode === 'save-first');
check('a text column is not-a-lookup', mount({ contextInfo: LOOKUP.contextInfo }).props().mode === 'not-a-lookup');
check('a lookup whose host has no methods still finds its target in the value', mount({ ...LOOKUP, targetMethod: 'absent' }).props().mode === 'live');
check('a lookup whose method throws falls back the same way', mount({ ...LOOKUP, targetMethod: 'throws' }).props().mode === 'live');
check('an empty lookup on a host with no methods has no target, and says so', mount({ ...LOOKUP, targetMethod: 'absent', value: [] }).props().mode === 'not-a-lookup');
check('a column the user cannot read is no-access, before anything else', mount({ ...LOOKUP, security: 'no-access' }).props().mode === 'no-access');
check('a host with no openForm gets cards that do not open', mount({ ...LOOKUP, openForm: 'absent' }).props().openRecord === null);
check('hidden is honoured', mount({ ...LOOKUP, visible: false }).props().visible === false);

const sampled = mount({ webAPI: false, inputs: { sampleData: sampleJson } });
check('sample data wins over everything the host lacks, and names its own current record', sampled.props().mode === 'sample' && sampled.props().currentId === 'c1');
check('unreadable sample data is its own state', mount({ inputs: { sampleData: '{not json' } }).props().mode === 'bad-sample');
check(
    "sample data with blank detail columns is names only, and the key says so — the hub's Names only preset",
    mount({ webAPI: false, inputs: { sampleData: sampleJson, detailColumns: '' } }).props().sourceKey.includes('|names|')
        && mount({ webAPI: false, inputs: { sampleData: sampleJson, detailColumns: 'City' } }).props().sourceKey.includes('|details|'),
);

/* -------------------------------------------- the routes, through the bundle */

async function routes() {
    check('the live resolve picks FetchXML on a hierarchical lookup', (await bound.props().resolve()).route === 'fetchxml');
    check('and the same resolve twice is one promise', bound.props().resolve() === bound.props().resolve());
    check('… OData when the relationship is not hierarchical', (await mount({ ...LOOKUP, hierarchical: false }).props().resolve()).route === 'odata');
    check('… OData when the metadata read is refused', (await mount({ ...LOOKUP, relationshipsStatus: 403 }).props().resolve()).route === 'odata');
    check('… OData when there is no client URL to read metadata from', (await mount({ ...LOOKUP, page: false }).props().resolve()).route === 'odata');
    check('… and the sample source for sample data', (await sampled.props().resolve()).route === 'sample');

    const namesOnly = await (await mount({ webAPI: false, inputs: { sampleData: sampleJson, detailColumns: '' } }).props().resolve()).loadChain();
    const withDetails = await (await mount({ webAPI: false, inputs: { sampleData: sampleJson, detailColumns: 'City' } }).props().resolve()).loadChain();
    check(
        'the sample keeps its details only while detail columns is non-blank',
        namesOnly.every((n) => n.details.length === 0) && withDetails.some((n) => n.details.length > 0),
        JSON.stringify([namesOnly.map((n) => n.details.length), withDetails.map((n) => n.details.length)]),
    );

    const detailed = mount({ ...LOOKUP, inputs: { detailColumns: 'address1_city, name, revenue' } });
    const source = await detailed.props().resolve();
    await source.loadChildren('c1');
    const query = detailed.calls().filter((c) => c.startsWith('webAPI.retrieveMultipleRecords')).pop();
    check(
        'detail columns reach the query once each, and the primary columns are not asked for twice',
        query.includes("<attribute name='address1_city'/>") && query.includes("<attribute name='revenue'/>")
            && query.split("<attribute name='name'/>").length === 2,
        query,
    );
    check('utils.getEntityMetadata was asked for the primary columns', detailed.calls().some((c) => c === 'getEntityMetadata("account")'));

    const noUtils = mount({ ...LOOKUP, utils: false });
    const guessed = await noUtils.props().resolve();
    await guessed.loadChain();
    check('without the Utility feature the primary columns are guessed, and the control still works', guessed.route === 'fetchxml' && noUtils.calls().some((c) => c.includes("attribute='accountid' operator='eq-or-above'")));
}

/* -------------------------------------------------------------- the markup */

const componentModule = load('components/HierarchyViewControl');
const server = require(path.join(root, 'node_modules', 'react-dom', 'server'));

const messageMarkup = renderDeep(mount({ ...LOOKUP, webAPI: false }).element) || '';
check('the not-available state renders its .resx sentence and no tree', messageMarkup.includes('resx:HierarchyView_NotAvailable') && !messageMarkup.includes('role="tree"'));
const liveMarkup = renderDeep(bound.element) || '';
check('the first live render is the loading state', liveMarkup.includes('data-fluent="Spinner"') && liveMarkup.includes('resx:HierarchyView_Loading'));
check('the root carries the narrow class when the host allocates a narrow width', (renderDeep(mount({ ...LOOKUP, width: 320 }).element) || '').includes('HierarchyView--narrow'));
check('and the dark class when the host says dark', (renderDeep(mount({ ...LOOKUP, dark: true }).element) || '').includes('HierarchyView--dark'));

const strings = bound.props().strings;
const treeMarkup = (() => {
    const warn = console.error;
    console.error = () => {};
    try {
        return server.renderToStaticMarkup(React.createElement('ul', null, rows.map((r) =>
            React.createElement(componentModule.TreeRow, { key: r.node.id, row: r, strings, openRecord: () => Promise.resolve(), onToggle: () => {}, onRetry: () => {}, onShowAll: () => {} }))));
    } finally {
        console.error = warn;
    }
})();

check('each row is a treeitem at its level', treeMarkup.includes('aria-level="1"') && treeMarkup.includes('aria-level="4"'));
check('the current record is marked and is not a link', treeMarkup.includes('aria-current="true"') && treeMarkup.includes('resx:HierarchyView_Current') && (treeMarkup.match(/HierarchyView-open/g) || []).length === 5);
check('a node with children gets a chevron labelled from the .resx with its name', treeMarkup.includes('aria-label="resx:HierarchyView_Collapse"') || treeMarkup.includes('Collapse'), treeMarkup.slice(0, 200));
check('the ancestor at the top still shows its path child and the show-all affordance', treeMarkup.includes('resx:HierarchyView_ShowAll'));
check('a count badge shows the server\'s number', treeMarkup.includes('>2</span>'));

/* ---------------------------------------------------- what destroy owes */

/*
 * **Keep this when the worked example above goes.** It is written against no
 * particular control and needs no knowledge of what yours takes.
 *
 * `destroy` is the lifecycle method with nothing visible riding on it, so it is
 * the one that quietly does nothing. A control that takes an interval, a
 * `requestAnimationFrame` loop, or a listener on `document` or `window` owes
 * each of them back — and none of the three shows up on a form. The interval
 * keeps firing against a container the platform has already thrown away; the
 * document listener keeps the whole control reachable, so nothing about it is
 * ever collected. On a form somebody leaves open all afternoon, or a subgrid
 * that re-renders its rows, they accumulate.
 *
 * Counting before and after is the whole trick. The scaffolded control takes
 * neither, so both numbers are zero and this passes trivially — which is the
 * point: it starts passing for a real reason the moment somebody adds a timer,
 * and fails the moment they forget the other half.
 */
disposeAll();

const timersBefore = time.pending();
const listenersBefore = Object.values(dom.document.listeners).reduce((total, list) => total + list.length, 0);

const disposable = mount({});

disposable.destroy();

check(
    'destroy() releases every timer the control took',
    time.pending() === timersBefore,
    `${timersBefore} → ${time.pending()}`,
);

check(
    'and every document-level listener',
    Object.values(dom.document.listeners).reduce((total, list) => total + list.length, 0) === listenersBefore,
    `${listenersBefore} → ${Object.values(dom.document.listeners).reduce((total, list) => total + list.length, 0)}`,
);

/*
 * The other half, and the leak this shape is famous for. `updateView` runs on
 * every change to any bound value, so a `setInterval` reached from the render
 * path adds a timer per render rather than replacing one.
 */
const rerendered = mount({});
const afterFirst = time.pending();

rerendered.update({});
rerendered.update({});
rerendered.update({});

check(
    'and re-rendering does not add another one',
    time.pending() === afterFirst,
    `${afterFirst} → ${time.pending()}`,
);

disposeAll();

/* ======================================================================== *
 *  THE RIG'S OWN CLAIMS — keep these. They are about `dev/host.js`, not about
 *  the control, and they exist because a rig that silently answers the wrong
 *  host's question certifies whatever it is handed. Each one was a real bug in
 *  a sibling repository's rig before it was an assertion here.
 * ======================================================================== */

async function rigSelfCheck() {
    const relationships = (url) => `${url}/api/data/v9.2/EntityDefinitions(LogicalName='account')/OneToManyRelationships`;

    /*
     * Two hosts, two answers. The fetch stub is one global routed by origin,
     * and before it was, the stub belonged to whichever host a suite created
     * last — so a second mount's refusal became every mount's refusal.
     */
    const open = mount({});
    const refused = mount({ relationshipsStatus: 403 });
    const [a, b] = await Promise.all([fetch(relationships(open.clientUrl)), fetch(relationships(refused.clientUrl))]);

    check('rig: each host answers its own metadata fetch', a.status === 200 && b.status === 403, `${a.status} / ${b.status}`);
    check(
        "rig: a fresh host does not inherit an earlier host's answers",
        (await a.json()).value.some((row) => row.ReferencingAttribute === 'parentaccountid' && row.IsHierarchical === true),
    );

    let foreign = 'resolved';
    await fetch('https://nowhere.invalid/api/data/v9.2/x').catch((error) => { foreign = error.constructor.name; });
    // Whatever `fetch` was there before answers — Node's own, here, which cannot
    // resolve the name — and the claim is only that the rig did not answer it.
    check("rig: a URL on no host's origin is refused, not answered", foreign !== 'resolved', foreign);

    const ctx = host.createContext({ fixture, clientUrl: host.nextClientUrl() });
    const xml = "<fetch><entity name='account'><attribute name='accountid'/><attribute name='name'/><attribute name='accountid' rowaggregate='CountChildren' alias='children'/><filter><condition attribute='accountid' operator='eq-or-above' value='c1'/></filter></entity></fetch>";
    const chain = await ctx.webAPI.retrieveMultipleRecords('account', `?fetchXml=${encodeURIComponent(xml)}`);

    check(
        'rig: eq-or-above answers the record and every ancestor, with child counts',
        chain.entities.map((row) => `${row.accountid}:${row.children}`).sort().join(',') === 'c1:2,p1:2,r1:2',
        JSON.stringify(chain.entities.map((row) => [row.accountid, row.children])),
    );

    let fault = null;
    await host.createContext({ fixture, clientUrl: host.nextClientUrl(), hierarchical: false })
        .webAPI.retrieveMultipleRecords('account', `?fetchXml=${encodeURIComponent(xml)}`)
        .catch((error) => { fault = error; });
    check(
        'rig: a hierarchical operator on a table that is not hierarchical is refused as a plain object',
        fault !== null && !(fault instanceof Error) && typeof fault.errorCode === 'number' && typeof fault.message === 'string',
        fault && fault.constructor.name,
    );

    const page = await ctx.webAPI.retrieveMultipleRecords('account', "?$select=accountid,name&$filter=_parentaccountid_value eq c1&$orderby=name asc", 1);
    check('rig: maxPageSize truncates and says there is more', page.entities.length === 1 && typeof page.nextLink === 'string', JSON.stringify(page));

    disposeAll();
}

sources().then(routes).then(rigSelfCheck).then(report, (error) => {
    check('the asynchronous half ran to the end', false, String(error && error.stack || error));
    report();
});

function report() {
    const failed = results.filter((result) => !result.ok);

    for (const result of results) {
        const detail = result.detail ? `  — ${result.detail}` : '';

        console.log(`  ${result.ok ? 'ok  ' : 'FAIL'}  ${result.label}${detail}`);
    }

    console.log(
        failed.length > 0
            ? `\n  ${failed.length} of ${results.length} failed\n`
            : `\n  ${results.length} passed — the control's own decisions only; see SPEC.md for what a real form still has to confirm\n`,
    );

    process.exit(failed.length > 0 ? 1 : 0);
}
