---
remarksTarget: BisCore.ecschema.md
---

# BisCore

Contains the core classes which define the base classes used by all BIS Domain schemas.

The BisCore schema also defines the database structure for an iModel.  Other schemas may not add to the db schema without explicit permission from BisCore.

### PhysicalPortion

Abstract base used to represent a part of a larger Element that can be broken down in more detail in a sub Model.  Division of the larger Element into portions is arbitrary, defined by convention in a domain or by a user and individual portions are not viable outside the larger Element.
