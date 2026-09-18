---
title: Limitations
description: What Hierarchy View does not do, and why each of those is a decision.
order: 7
---

# Limitations

Each of these is a constraint that was chosen, not a defect waiting on a fix.

- **It is read-only.** No drag to re-parent, no *add child*, no delete. The
  hierarchy is edited where it always was — on each record's parent lookup —
  and a control that moves a subtree with one drop needs a confirmation flow
  this one deliberately does not carry. It binds the parent lookup in order to
  read it and leaves the column as it found it.
- **Model-driven only.** It binds a `Lookup.Simple`, which canvas apps cannot
  bind, and it reads through `context.webAPI`, which canvas apps do not have.
  There is no canvas page because there is nothing to put on it.
- **One table.** The lookup must point at the record's own table. A customer
  lookup (account *or* contact) and a regarding lookup are polymorphic, and a
  hierarchy that changes table halfway down is not one tree.
- **Children arrive a page at a time, per node.** *Children per node* is the
  page size, capped at 250 by the control and by the platform. A node with more
  children shows the first page, ordered by name, and says *Showing the first
  N*. There is no *load more* under one node — a record with hundreds of direct
  children is a list, not a tree, and a view serves it better.
- **Counts need a hierarchical relationship.** The child-count badge and the
  "chevron only where there are children" behaviour come from Dataverse's
  `CountChildren` aggregate, which exists only for a relationship flagged
  hierarchical. On any other self-referential lookup every node gets a chevron
  until it is opened. The flag is one checkbox on the relationship.
- **One hundred levels.** Dataverse limits hierarchical operators to 100
  recursions, and the fallback route stops walking up after 20 levels. Neither
  has been met by a real hierarchy.
- **An ancestor the user cannot read ends the chain there.** The tree starts at
  the top-most record the user is allowed to see, without saying that anything
  sits above it. Saying so would leak that a record exists.
- **Below 480 pixels the indent tightens** from 24 to 16 pixels per level, so
  four levels still fit a phone; nothing is hidden. The measurement is the
  control's own width, not the browser's — a narrow form column on a desktop
  does the same.
- **Sample data is for the demo.** While *Sample data (demo only)* holds
  anything, the control renders it and never queries. It is documented as
  such, defaults to blank, and belongs blank on a real form.
- **Not yet measured on the phone client or Power Pages.** The web client is
  where every claim above was checked; the phone layout renders in the
  harness and has not been opened on a device.
