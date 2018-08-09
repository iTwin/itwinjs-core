# Schema : ClassificationSystems

This schema contains class definitions for Classifications.

These are used to classify elements as conforming to certain classifications like ASHRAE/CIBSE/OmniClass/MasterFormat and other.

<u>Schema:</u>

```xml
<ECSchema schemaName="ClassificationSystems" alias="clsf" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
    <ECSchemaReference name="BisCore" version="01.00.00" alias="bis" />
```

![Classifications](./media/Classification-Systems.png)


## Pending work
- Applicability (Allan)
- Catalog impact on the Schema (Allan)
- ONLY what BCS needs rest is out. (Wouter)
- how to relate to PE (Wouter)
- Strong or weak typing. SEALED. (Wouter)
- instance diagram is wrong (Wouter)
- how to prevent multiple classifications from the same system on same type. Solve in software.(Wouter)
- IClassifiedType mixin (Wouter)
- Wrong airport-toilet classification in library (Wouter)

## Classes

---

---

### IClassified

---

A mixin which indicates that the element could be classified in classificationsystems.

<u>Naming:</u>

1.  notes that an element can be Classified

<u>Schema:</u>

```xml
    <ECEntityClass typeName="IClassified" modifier="Abstract" displayTitle="IClassifiedElement" Description="An interface that indicates that an element could be classified by classification(s)">
        <ECCustomAttributes>
            <IsMixin xmlns="CoreCustomAttributes.1.0">
                <AppliesToEntityClass>bis:Element</AppliesToEntityClass>
            </IsMixin>
        </ECCustomAttributes>
    </ECEntityClass>
```

### ClassificationSystem

---

An element which holds individual instances of `Classification` in the submodel. An Example of `ClassificationSystem` could be ASHRAE or OmniClass

<u>Naming:</u>

1.  defines Classification System

<u>Schema:</u>

```xml
    <ECEntityClass typeName="ClassificationSystem" displayLabel="ClassificationSystem">
        <BaseClass>bis:DefinitionElement</BaseClass>
        <BaseClass>bis:ISubModeledElement</BaseClass>
        <ECCustomAttributes>
          <ClassHasHandler xmlns="BisCore.1.0"/>
        </ECCustomAttributes>
    </ECEntityClass>
```

### Classification

---

An element which holds a specific classification. i.e. ASHRAE62.1:Coffee stations

<u>Naming:</u>

1.  defines single Classification

<u>Properties:</u>

1.  .Name - name of the classification instance
2.  .Description - a description of the classification instance
3.  .Group - a `ClassificationGroup` this `Classification` is grouped in
4.  .Specialization - a `Classification` that this `Classification` Specializes

<u>Schema:</u>

```xml
    <ECEntityClass typeName="Classification" displayLabel="ClassificationSystem ClassDefinition" description="The ClassDefinition used to store classificationSystem data.">
        <BaseClass>bis:DefinitionElement</BaseClass>
        <ECCustomAttributes>
            <ClassHasHandler xmlns="BisCore.1.0"/>
        </ECCustomAttributes>
        <ECProperty propertyName="Name" typeName="string" displayLabel="Name"/>
        <ECProperty propertyName="Description" typeName="string" displayLabel="Description"/>
        <ECNavigationProperty propertyName="Group" relationshipName="ClassificationIsInClassificationGroup" direction="Forward" description="Group this definition belong to" />
        <ECNavigationProperty propertyName="Specialization" relationshipName="ClassificationSpecializesClassification" direction="Forward" description="Classification this Specializes in" />
    </ECEntityClass>
```

### ClassificationGroup

---

An element used to group multiple classifications together. intended to be used for groups as defined in original classification systems.

<u>Naming:</u>

1.  defines a classification group

<u>Properties:</u>

1.  .UserLabel - carries the name of the group

<u>Schema:</u>

```xml
    <ECEntityClass typeName="ClassificationGroup" displayLabel="ClassificationSystem ClassDefinition group" description="The ClassDefinition group element">
        <BaseClass>bis:GroupInformationElement</BaseClass>
        <ECCustomAttributes>
            <ClassHasHandler xmlns="BisCore.1.0"/>
        </ECCustomAttributes>
    </ECEntityClass>
```

## Relationships

---

---

### IClassifiedIsClassifiedAs

---

a relationship to map `IClassified` element to conformed intances of `Classification`

<u>Naming:</u>

1.  notes that `IClassified` is classified as `Classification`

<u>Schema:</u>

```xml
    <ECRelationshipClass typeName="IClassifiedIsClassifiedAs" modifier="None" strength="referencing" description="a relationship to map IClassified to Classifications">
        <BaseClass>bis:ElementRefersToElements</BaseClass>
        <Source multiplicity="(1..1)" roleLabel="is classified as" polymorphic="true">
            <Class class="IClassified"/>
        </Source>
        <Target multiplicity="(0..*)" roleLabel="classifies" polymorphic="true">
            <Class class="Classification"/>
        </Target>
    </ECRelationshipClass>
```

### ClassificationIsInClassificationGroup

---

a relationship to map instances of `Classification` to their groups (`ClassificationGroup`)

<u>Naming:</u>

1.  notes that `Classification` is grouped in a `ClassificationGroup`

<u>Schema:</u>

```xml
    <ECRelationshipClass typeName="ClassificationIsInClassificationGroup" modifier="None" strength="referencing" description="a relationship to map Classification to its' group">
        <Source multiplicity="(0..*)" roleLabel="is grouped in" polymorphic="true">
            <Class class="Classification"/>
        </Source>
        <Target multiplicity="(1..1)" roleLabel="groups" polymorphic="true">
            <Class class="ClassificationGroup"/>
        </Target>
    </ECRelationshipClass>
```

### ClassificationSpecializesClassification

---

a relationship to map instances of `Classification` to other Classifications they specialize

<u>Naming:</u>

1.  notes that `Classification` specializes other `Classification`

<u>Schema:</u>

```xml
    <ECRelationshipClass typeName="ClassificationSpecializesClassification" modifier="None" strength="referencing" description="a relationship">
        <Source multiplicity="(0..*)" roleLabel="specializes" polymorphic="true">
            <Class class="Classification"/>
        </Source>
        <Target multiplicity="(1..1)" roleLabel="is specialized" polymorphic="true">
            <Class class="Classification"/>
         </Target>
    </ECRelationshipClass>
```

## Domain Standardization of SpatialCategories

## User Control of DrawingCategories

## iModel Bridges using ClassificationSystems

Bridges that do not store `SpatialComposition` relationships natively, may compute and maintain those in their bridge. In the long run it is not sure if the tradeoff of storing and maintaining the persistance of relationships outweighs the performance loss of computing them each time. However a future domain handler API may elect to compute them (as bim software grows more mature).
