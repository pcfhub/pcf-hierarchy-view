---
title: Migrating to 0.3
description: What changed, and what a maker has to do about it.
appliesTo: ">=0.3.0"
order: 9
---

# Migrating to 0.3

## What changed

**Two new properties, both off.** *Layout* (the tree, as before, or an org
chart) and *Show pictures*. A form that had 0.2 draws exactly what it drew
until somebody sets them.

**The keyboard.** The tree is now one Tab stop with the arrow keys inside it,
where 0.2 made every chevron and every name a stop of its own. Somebody who
tabbed through the rows now tabs past the tree in one press and moves inside it
with the arrows; a mouse works as before.

## What to do

**Nothing.** No property was renamed or removed, no feature is newly required,
and the control asks the server for nothing new unless *Show pictures* is on.

## Migrating to 0.2.0

**Sample data (demo only) is gone.** Until 0.1.2 it took a JSON tree that the
control drew instead of querying. A form where it was set queries the record's
hierarchy as it would anywhere else; nothing needs removing.
