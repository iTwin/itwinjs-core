# Default BIS Presentation Rules

iTwin.js delivers a supplemental presentation ruleset that gets automatically merged into all presentation rulesets that support BisCore ECSchema. The ruleset provides default behavior for various BIS types: Elements, Models, etc.

## Label Overrides

Label override rules are used when we calculate ECInstance display labels for trees, property grid and other components. Below is the algorithm for calculating the labels.

- For `BisCore:GeometricElement` and it's subclasses:
  1. Use `CodeValue`. If empty, go to #2.
  2. Use `UserLabel [base36(briefcase id)-base36(local id)]`. If `UserLabel` empty, go to #3.
  3. Use `ECClassLabel [base36(briefcase id)-base36(local id)]`.
- For all other `BisCore:Element` subclasses:
  1. Use `UserLabel`. If empty, go to #2.
  2. Use `CodeValue`. If empty, go to #3.
  3. Use `ECClassLabel [base36(briefcase id)-base36(local id)]`.
- For all `BisCore:Model` subclasses:
  1. Use modeled `Element`'s label (calculated using the above)

`briefcase id` and `local id` are calculated from `Element`'s id:

- `briefcase id = element id >> 40`
- `local id = element id & (1 << 40 - 1)`

## Content Modifiers

Content modifier rules are applied when creating content for property grid, table and similar components. Each modifier is applied on specific types of ECInstances.

### BisCore:Element

- Append properties
  - of all related `BisCore:ElementUniqueAspect`s through `BisCore:ElementOwnsUniqueAspect` forward relationship
  - of all related `BisCore:ElementMultiAspect`s through `BisCore:ElementOwnsMultiAspects` forward relationship
  - of all related `BisCore:LinkElement`s through `BisCore:ElementHasLinks` forward relationship
  - of all related `BisCore:GroupInformationElement`s through `BisCore:ElementGroupsMembers` backward relationship
    - and their related `BisCore:LinkElement`s through `BisCore:ElementHasLinks` forward relationship
  - 'Identifier' as 'Source Element ID' of related `BisCore:ExternalSourceAspect` through `BisCore:ElementOwnsMultiAspects` forward relationship into the 'Source File Information' category
  - 'Url' as 'Source File Path' and 'UserLabel' as 'Source File Name' of related `BisCore:RepositoryLink` through `BisCore:ModelContainsElements` -> `BisCore:Model` -> `BisCore:ModelModelsElement` -> `BisCore:PhysicalPartition | BisCore:Drawing` -> `BisCore:ElementHasLinks` path.

### BisCore:PhysicalElement

- Append properties
  - of all related `BisCore:PhysicalType`s through `BisCore:PhysicalElementIsOfType` forward relationship

### BisCore:SpatialLocationElement

- Append properties
  - of all related `BisCore:SpatialLocationType`s through `BisCore:SpatialLocationIsOfType` forward relationship

### BisCore:DrawingGraphic

- Append properties
  - of all related `BisCore:Element`s through `BisCore:DrawingGraphicRepresentsElement` forward relationship

### BisCore:GraphicalElement3d

- Append properties
  - of all related `BisCore:Element`s through `BisCore:GraphicalElement3dRepresentsElement` forward relationship

### BisCore:PhysicalType

- Hide all properties (excluding subclass properties)

### BisCore:SpatialLocationType

- Hide all properties (excluding subclass properties)

### BisCore:LinkElement

- Hide `CodeValue` and `UserLabel` properties

### BisCore:UrlLink

- Hide `Description` property

### BisCore:EmbeddedFileLink

- Hide `Description` property
