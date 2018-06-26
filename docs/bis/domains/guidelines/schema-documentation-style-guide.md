# Schema Documentation Style Guide

Goal of the schema doc is to clarify :
- What is the goal of the schema
- How should the schema be used
- Why is the schema done this way ?
-


## General Guidelines:

1. Include all xml into the .bd (into the appropriate sections)
1. One .md per .ecschema.xml
1. Add a section on `Pending Work` add names of people to follow up.
1. Add a section on `Schema Naming Considerations`
1. Add a section on `Schema Design Considerations`
1. name the .md without abbreviations "-" between words
1. Add no "-00.00.00.md" to the filename unless the schema has been finalized and published, no version means current.

## Schema diagrams

1. Add .cmap in media folder
1. Make screenshot at 150%
1. Add legend (Bis section, Abstract (dashed line), Mixin (square box), Sealed)
1. Color yellow:spatial location, green:functional, grey:definition
1. Class is shown in rounded rectangle.
1. Relationships are shown as arrows.
1. Clean up the diagram make vertical lines vertical, horizontal lines horizontal.

## Illustrations

1. Scale cmaps to 150% when makign screenshot for .md
1. Copyright ?

## Classes section

1. Add section on `Rules and Dependency management`
1. Add section on `Class naming` refer to industry standard (ISO/IFC etc)
1. Add section on `Geometry use`. Please add illustrations.
1. Add section on `Holes`, `Local Coordinates`, `Allowed Geometry` like Forms, CurveVector, Solid.
1. include the schema xml snippet, remove comments and descriptions, add them to the .md

## Relationships section

1. Add section on `Relationship naming`
1. include the schema xml snippet, remove comments and descriptions, add them to the .md

## Enums section

## Mixins section

1. include the schema xml snippet, remove comments and descriptions, add them to the .md
