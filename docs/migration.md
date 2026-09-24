---
title: Migrating to 0.2.0
description: What changed, and what a maker has to do about it.
appliesTo: ">=0.2.0"
order: 9
---

# Migrating to 0.2.0

## What changed

**Sample data (demo only) is gone.** Until 0.1.2 it took a JSON tree that
the control drew instead of querying, for PCFHub's demo and for previewing the
layout before the data existed. PCFHub's demo now answers the control's real
queries from a small account tree shipped with the release, so the property
had nothing left to do but sit in every maker's panel.

## What to do

**Most forms: nothing.** *Sample data* was blank on a real form, and removing
it changes nothing there.

**A form where you set it to preview the layout:** after the upgrade the
control queries the record's hierarchy as it would anywhere else. If the record
is saved and the lookup has values, you see the real tree; if it is a new
record, you see *Save the record to see its hierarchy*. Nothing needs removing —
the old value is simply not read.

To see the layout without data of your own, use the demo on this page.
