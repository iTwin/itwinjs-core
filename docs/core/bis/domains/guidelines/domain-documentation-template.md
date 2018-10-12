# Schema : domain-name

short description

longer, more detailed description here

```xml
<ECSchema schemaName="domain-name" alias="dom" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECSchemaReference name="ref1" version="01.00.00" alias="ref1" />
    <ECSchemaReference name="ref2" version="01.00.00" alias="ref2" />
```

![Class](path_to_cmap_here)

## Classes

---

---

### Class1

---

description of the class

<u>Naming:</u>

1. naming consideration - 1
2. `DgnCode`: ("value", parentId, Element) | default

<u>Geometry Use:</u>

1. how is geometry stored?
2. Local Coordinates : how are local coordinates computed?

<u>Schema:</u>

```xml
    <ECEntityClass typeName="Class1" modifier="???">
      <BaseClass>baseclass</BaseClass>
    </ECEntityClass>
```

### Class2

---

.
.
.

## Relationships

---

---

### Relationship1

---

relationship description here

<u>Naming:</u>

1. naming consideration - 1

<u>Schema:</u>

```xml
    <ECRelationshipClass typeName="rel1" modifier="???" strength="???">
      <BaseClass>baseclass</BaseClass>
        <Source multiplicity="(0..*)" roleLabel="???" polymorphic="?">
            <Class class="???"/>
        </Source>
        <Target multiplicity="(0..*)" roleLabel="???" polymorphic="?">
            <Class class="???"/>
        </Target>
    </ECRelationshipClass>
```

## Code

| Name      | Value                     |
| --------- | ------------------------- |
| CodeValue | NULL                      |
| CodeScope | CodeScopeSpec::Repository |
| CodeSpec  | bis:NullCodeSpec          |

## Domain Standardization of SpatialCategories

---

---

## User Control of DrawingCategories

---

---

## iModel Bridges using BuildingSpatial

---

---
