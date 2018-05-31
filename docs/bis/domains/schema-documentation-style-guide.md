# Schema Documentation Style Guide

## General Guidelines:

1 - Include all xml into the .bd (into the appropriate sections)
2 - One .md per .ecschema.xml
3 - Add a section on `Pending Work` add names of people to follow up.
4 - Add a section on `Schema Naming Considerations`
5 - Add a section on `Schema Design Considerations`
6 - name the .md without abbreviations "-" between words
7 - Add no "-00.00.00.md" to the filename unless the schema has been finalized and published, no version means current.

## Schema diagrams

1 - Add .cmap in media folder
2 - Make screenshot ar 150%
3 - Add legend (Bis section, Abstract (dashed line), Mixin (square box), Sealed)
4 - Color yellow:spatial location, green:functional, grey:definition
5 - Class is shown in rounded rectangle.
6 - Relationships are shown as arrows.
7 - Clean up the diagram make vertical lines vertical, horizontal lines horizontal.

## Illustrations

1 - Scale and size ??
2 - Copyright.

## Classes section

1 - Add section on `Rules and Dependency management`
2 - Add section on `Class naming` refer to industry standard (ISO/IFC etc)
3 - Add section on `Geometry use`. Please add illustrations. Add section on `Holes`, `Local Coordinates`, `Allowed Geometry` like Forms, CurveVector, Solid.
4 - include the schema xml snippet, remove comments and descriptions, add them to the .md

## Relationships section

1 - Add section on `Relationship naming`
2 - include the schema xml snippet, remove comments and descriptions, add them to the .md

## Enums section

## Mixins section

1 - include the schema xml snippet, remove comments and descriptions, add them to the .md
