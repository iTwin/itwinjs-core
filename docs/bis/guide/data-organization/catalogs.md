# Catalogs

A **catalog** is a repository of reusable definitions (component types, templates, materials, styles, and other standards) maintained by a *catalog authority* outside of the BIS repositories that use them. Applications copy the definitions they need from a catalog into a BIS repository so that placed instances can reference them.

This page describes how catalog-sourced definitions are organized inside a BIS repository and how their provenance is recorded. It does not cover how a catalog authority hosts, stores, or serves its catalogs; those are implementation choices of each authority. For the backend APIs that can open a catalog stored as an iModel, see [Catalogs in the backend documentation](../../../learning/backend/Catalogs.md).

> The organization and provenance patterns on this page are evolving conventions adopted by current catalog implementations; they are not yet formalized BIS standards. BIS defines several reusable discovery mechanisms, but it does not yet define a complete, generic way to discover every dependency of a catalog entry. Domain schemas and applications may require additional rules.

## A running example

The sections below follow one example through the catalog lifecycle. A catalog authority publishes a *Piping Catalog* containing pipe types. Version 1 of the catalog includes **PVC-300**, a 300&nbsp;mm PVC pipe type modeled as a `PhysicalType`. PVC-300 references a `TemplateRecipe3d` that supplies its template geometry. An application imports PVC-300 and its dependencies into a BIS repository so that pipes of that type can be placed. Later, the authority corrects PVC-300's wall thickness and publishes version 2 of the catalog.

## Why copy definitions into a BIS repository

The catalog authority remains the source of truth for its definitions. A BIS repository caches only the definitions that are used, or that the user intends to use, rather than entire catalogs. Copying a definition into the BIS repository:

- makes the definition available offline,
- records when the cached definition was added through the BIS repository's change history,
- allows other elements in the BIS repository to reference the definition,
- keeps the type of a placed instance unambiguous,
- lets applications handle components consistently, whether or not they came from a catalog, and
- preserves the meaning of placed instances even if the catalog later changes.

Definitions cached from catalogs must be treated as read-only snapshots of an immutable catalog version. Applications do not modify them in place. When a catalog authority publishes a changed definition, the application caches it as a new `DefinitionElement`, as described in [Provenance of cached definitions](#provenance-of-cached-definitions).

See [Components from Catalogs](../../../learning/backend/IModelContents.md#components-from-catalogs) for guidance on which definitions belong in a BIS repository.

## Components and their dependencies

*Component* commonly refers to a single reusable catalog entry: a pipe type, a valve, a title-block template. In BIS terms, a catalog entry is rooted at a [DefinitionElement](../references/glossary.md#DefinitionElement), typically a [TypeDefinitionElement](../fundamentals/type-definitions.md), but that entry-point element is rarely self-contained. On this page, a *definition bundle* means the entry-point `DefinitionElement` together with the owned and referenced data required to use it. This is descriptive terminology, not a formal BIS construct.

A definition bundle may include:

- `ElementAspect`s and child elements owned by any element in the bundle,
- a sub-model of any `ISubModeledElement` in the bundle and the elements contained in that model,
- for an element discovered in another model, its containing model, that model's modeled element, and the modeled element's parent hierarchy,
- elements referenced through navigation properties, such as a `RecipeDefinitionElement`, `Category`, `PhysicalMaterial`, or `RenderMaterial`, and
- dependency relationships represented by subclasses of [`ElementRefersToElements`](../fundamentals/relationship-fundamentals.md#link-table), together with the element at the opposite endpoint of each link-table relationship.

In the running example, the PVC-300 component is more than its `PhysicalType` element:

```mermaid
graph TD
    PT["PhysicalType<br/>PVC-300 (entry point)"]
    TR["TemplateRecipe3d<br/>PVC-300 geometry"]
    SM["PhysicalModel<br/>template sub-model"]
    GEO["GeometricElement3d<br/>template geometry"]
    CAT["SpatialCategory<br/>Pipes"]
    MAT["PhysicalMaterial<br/>PVC"]
    ASP["ElementAspect<br/>pressure rating"]
    CLS["Classification<br/>Pipes"]
    CLS2["Classification<br/>Manholes"]
    CLSM["DefinitionModel<br/>classification table sub-model"]
    CLST["ClassificationTable<br/>Utility Elements"]
    CLSS["ClassificationSystem<br/>OpenSite Hierarchy"]
    PT2["PhysicalType<br/>PVC-450 (another component)"]

    PT -- "Recipe" --> TR
    TR -- "is sub-modeled by" --> SM
    SM -- "contains" --> GEO
    GEO -- "is in category" --> CAT
    PT -- "references" --> MAT
    PT -- "owns" --> ASP
    CAT <-->|"symbolizes (link table)"| CLS
    CLST -- "is sub-modeled by" --> CLSM
    CLSM -- "contains" --> CLS
    CLSM -- "contains" --> CLS2
    CLST -- "is child of" --> CLSS
    PT2 -. "also references" .-> CAT
    PT2 -. "also references" .-> MAT

    classDef entry fill:#e7f1ff,stroke:#477db3,stroke-width:2px,color:#1f2937
    classDef dep fill:#eef1f4,stroke:#6b7280,stroke-width:1px,color:#1f2937
    classDef shared fill:#fdf3e0,stroke:#b98a2f,stroke-width:1px,color:#1f2937
    classDef other fill:#f4f4f4,stroke:#8a8a8a,stroke-width:1px,color:#1f2937
    class PT entry
    class TR,SM,GEO,ASP,CLSM dep
    class CAT,MAT,CLS,CLS2,CLST,CLSS shared
    class PT2 other
```

The PVC-300 bundle contains every node shown in the diagram except PVC-450. It includes the `PhysicalType`, its referenced `TemplateRecipe3d`, the recipe's template sub-model and geometry, the *Pipes* category, the *PVC* material, the `ElementAspect`, the classification structure, and the relationships among them.

Following the category's link-table relationship discovers the *Pipes* classification. The bundle then includes the classification's `DefinitionModel`, the `ClassificationTable` modeled by that model, and the table's parent `ClassificationSystem`. Because discovery is recursive, the bundle also includes the other elements in the table's sub-model, such as the *Manholes* classification shown here. Newly discovered elements contribute their owned child elements.

The amber nodes are dependencies that may be shared with other components. PVC-450 is shown sharing the *Pipes* category and *PVC* material.

There is currently no single BIS construct that identifies a definition bundle as a unit.

### Generic discovery mechanisms

Starting with the entry-point element, apply these BIS mechanisms recursively to each element they discover:

- Include owned `ElementAspect`s and child elements. Classes expected to own children implement `IParentElement`.
- For each `ISubModeledElement`, include its sub-model and the elements contained in that model. `TemplateRecipe3d` and `DefinitionContainer` are examples of sub-modeled elements.
- When discovery pulls a required element from another model, include the model and its modeled element. If the modeled element is a child element, include its parent and continue through the complete ancestor hierarchy. The other discovery rules then apply recursively to those newly included elements, including their children and sub-model contents.
- Follow navigation properties from the referencing element to the referenced element, not in the reverse direction. Examples include `TypeDefinitionElement.Recipe`, `PhysicalType.PhysicalMaterial`, `GeometricElement3d.Category`, and `PhysicalMaterial.RenderMaterial`.
- Traverse dependency relationships represented by subclasses of `ElementRefersToElements` in either direction, include the link-table relationship, and include the element at the opposite endpoint.

For PVC-300, these mechanisms first follow the `Recipe` navigation property from the `PhysicalType` to its `TemplateRecipe3d`, then include the recipe's sub-model and its contents. The traversal also includes the referenced *Pipes* category and *PVC* material, the owned aspect, and any dependencies discovered from those elements.

### Link-table relationship discovery

Navigation properties and link-table dependency relationships have different traversal rules. A navigation property is followed only from its referencing element to its referenced element. A dependency relationship represented by a subclass of `ElementRefersToElements` is traversed from either endpoint to the other.

The [OpenSite domain schema](https://github.com/iTwin/bis-schemas/blob/master/Domains/4-Application/OpenSite/OpenSite.ecschema.xml) provides an example. Its abstract `CategorySymbolizesClassification` relationship derives from `ElementRefersToElements`; concrete subclasses relate a source `Category` to a target `Classification`. Reaching either endpoint therefore includes the relationship and the other endpoint. In the PVC-300 example, reaching the *Pipes* category discovers the *Pipes* classification. Reaching that classification first would likewise discover the category.

The classification also illustrates model and ownership closure. Its containing `DefinitionModel`, the `ClassificationTable` modeled by that model, and the table's parent `ClassificationSystem` are included. Applying the discovery rules recursively to those elements includes the table's complete sub-model contents and child elements nested beneath the discovered hierarchy. Because a `ClassificationSystem` owns its `ClassificationTable` child elements, the same recursive rules also include any other tables in that system, their sub-model contents, and their nested classifications.

### Discovery limits

These mechanisms do not guarantee discovery of every dependency. They cover dependencies expressed through BIS ownership, sub-modeling, navigation properties, and link-table dependency relationships.

Other dependencies may be encoded in property payloads, geometry streams, or application-defined data. Those dependencies require class-, schema-, or application-specific discovery and copy handling. For example, a geometry stream may refer to a `RenderMaterial`, while a `RenderMaterial` may identify a `Texture` through its `JsonProperties`. These examples are not exhaustive.

A `TemplateRecipe3d` can be referenced by multiple `PhysicalType`s. Whether required dependencies should span separately maintained catalogs, and how versions of those catalogs would be resolved together, remain unresolved. This page does not define a cross-catalog version-resolution policy.

When copying a component:

1. **Copy its required dependencies, not just the entry-point element.** Apply the generic mechanisms above together with any class-, schema-, or application-specific rules. Copying only the entry-point element can produce an incomplete definition.
2. **Dependencies may be shared.** A single `TemplateRecipe3d`, `Category`, or `PhysicalMaterial` may be referenced by more than one component and must be copied only once into the destination BIS repository: if PVC-300 was imported earlier, importing PVC-450 reuses the already-copied *Pipes* category and *PVC* material.

## Organization of cached definitions in a BIS repository

Definitions cached from a catalog authority are organized beneath a well-known `DefinitionContainer` in the [DictionaryModel](../references/glossary.md#DictionaryModel). This container is the *Application-rank* entry point for that authority's cached definitions; the cached definitions themselves do not require an assigned rank. See [Organizing Definition Elements](./organizing-definition-elements.md). The recommended organization is:

- The entry-point `DefinitionContainer` has a [Code](../fundamentals/codes.md) whose `CodeValue` follows the `{organization name}:{application name}:Definitions` convention described in [Organizing Definition Elements](./organizing-definition-elements.md#dictionarymodel-for-global-scoped-definitions).
- The sub-model of that `DefinitionContainer` contains the cached definitions.
- A specific version of a definition is cached **only once per BIS repository**, no matter how many catalogs or catalog versions include it. (A changed definition is a new version and is cached as a new element; see [Provenance of cached definitions](#provenance-of-cached-definitions).)

In the running example, the application creates (or finds) its well-known `DefinitionContainer` in the BIS repository's `DictionaryModel` and copies PVC-300 and its dependencies into that container's sub-model. When PVC-450 is imported later, it lands in the same sub-model, reusing the shared category and material already there.

Local `DefinitionElement`s that an application creates for its own purposes, without any association to a catalog, do not belong under this container. They are stored in `DefinitionModel`s within the application's [Channel](../../../learning/backend/Channel.md).

### Folders

Catalog authorities commonly let users organize catalog entries into folders. Folders, including nested folders, are represented in the BIS repository by nested `DefinitionContainer`s and their sub-models under the authority's entry-point `DefinitionContainer`.

## Provenance of cached definitions

Applications must be able to determine where a cached definition came from (which catalog, which version of that catalog, and which entry in it), for example, to detect that a newer version of the definition is available. The general provenance mechanisms are described in [Provenance in BIS](../../domains/Provenance-in-BIS.md); this section describes their recommended application to catalogs.

A published catalog version is treated as **immutable**: changing anything in a catalog produces a new catalog version.

The mapping applies to every catalog-sourced `DefinitionElement` cached as part of a bundle, not only to the bundle's entry-point element. A locally created `DefinitionElement` that has no catalog source does not require this catalog provenance.

The recommended mapping is:

- **Catalog version → [RepositoryLink](../../domains/Provenance-in-BIS.md#repositorylink).** Each version of a catalog from which definitions were cached is represented by a `RepositoryLink` element identifying that specific, immutable catalog version.
- **Cached definition → [ExternalSourceAspect](../../domains/Provenance-in-BIS.md#externalsourceaspect).** Each cached `DefinitionElement` carries one `ExternalSourceAspect` per catalog version that includes it, with the aspect's `Scope` referencing the corresponding `RepositoryLink`. A definition that appears unchanged across several catalog versions is still cached once, with multiple aspects recording each catalog version it belongs to.
- **Stable entry identity → `ExternalSourceAspect.Identifier`.** The catalog authority's stable identifier for the catalog entry, the identity that persists as the entry evolves across versions, is recorded in the aspect's `Identifier` property. Correcting an existing entry preserves this identifier; a distinct replacement product is a new catalog entry with a new stable identifier.
- **Definition-version identity → [FederationGuid](../fundamentals/federationGuids.md).** The cached `DefinitionElement`'s `FederationGuid` holds the catalog authority's identifier for the *specific version* of the definition. When a changed catalog entry is cached, the new copy is a new `DefinitionElement` with a new `FederationGuid`, while its `CodeValue` and its stable identifier in `ExternalSourceAspect.Identifier` may remain unchanged. A `FederationGuid` normally identifies the real-world entity an Element represents; here, each immutable published version of a definition is treated as a distinct entity, so each version gets its own `FederationGuid`, and the identity that persists across versions is carried by `ExternalSourceAspect.Identifier` instead.
- **Code scope.** The `RepositoryLink` representing the catalog version under which a definition was first cached serves as the `CodeScope` element for that cached `DefinitionElement` (see [Codes](../fundamentals/codes.md)). Scoping the `Code` to a catalog version prevents code collisions between coexisting copies of the same definition: two cached versions of one catalog entry share a `CodeValue` but have different `CodeScope`s.

The `ExternalSourceAspect` class has additional properties, such as `Source` and `Kind`, described in [Provenance in BIS](../../domains/Provenance-in-BIS.md#externalsourceaspect). Their values for catalog-cached definitions are authority-specific and are not standardized by this mapping.

This mapping applies to definitions cached beneath the catalog authority's well-known `DefinitionContainer`. If an application copies a definition elsewhere only when a recipe or template is used, how that copy retains its catalog provenance is application-specific and is not standardized by this mapping.

### The example, end to end

Applying the mapping to the running example:

1. The application imports PVC-300 from Piping Catalog version 1. It creates a `RepositoryLink` for *Piping Catalog v1*, copies the component into the well-known container's sub-model, sets the cached `PhysicalType`'s `FederationGuid` to the authority's identifier for *this version* of PVC-300, scopes the element's `Code` to the v1 `RepositoryLink`, and attaches an `ExternalSourceAspect` with `Identifier` set to the authority's stable identifier for PVC-300 and `Scope` referencing the v1 `RepositoryLink`.
2. The authority corrects PVC-300's wall thickness and publishes catalog version 2. Version 1 is unchanged; it remains valid and immutable.
3. The application detects (by its own means; nothing in the BIS repository does this automatically) that catalog v2 contains a newer PVC-300 and imports it. The updated pipe type is a **new** `DefinitionElement` with a **new** `FederationGuid`, an `ExternalSourceAspect` with the **same** stable `Identifier`, and `Scope` referencing a new *Piping Catalog v2* `RepositoryLink`. Its `CodeValue` is unchanged, but its `Code` is scoped to the v2 `RepositoryLink`, so the two cached copies do not collide.
4. The *PVC* material did not change between v1 and v2. It stays cached once, and gains a second `ExternalSourceAspect` scoped to the v2 `RepositoryLink`.

```mermaid
graph TD
    subgraph DICT["DictionaryModel"]
        DC["Application-rank entry point<br/>DefinitionContainer"]
    end
    subgraph CSM["Sub-model of the DefinitionContainer"]
        D1["PhysicalType PVC-300<br/>FederationGuid = G1<br/>Code = &quot;PVC-300&quot; scoped to v1"]
        MAT["PhysicalMaterial PVC<br/>cached once"]
        D2["PhysicalType PVC-300 (updated)<br/>FederationGuid = G2<br/>Code = &quot;PVC-300&quot; scoped to v2"]
    end
    A1["ExternalSourceAspect<br/>Identifier = PVC-300"]
    A3["ExternalSourceAspect<br/>Identifier = PVC"]
    A4["ExternalSourceAspect<br/>Identifier = PVC"]
    A2["ExternalSourceAspect<br/>Identifier = PVC-300"]
    RL1["RepositoryLink<br/>Piping Catalog v1"]
    RL2["RepositoryLink<br/>Piping Catalog v2"]

    DC -- "is sub-modeled by" --> CSM
    D1 -- "owns" --> A1
    MAT -- "owns" --> A3
    MAT -- "owns" --> A4
    D2 -- "owns" --> A2
    A1 -- "Scope" --> RL1
    A3 -- "Scope" --> RL1
    A4 -- "Scope" --> RL2
    A2 -- "Scope" --> RL2

    classDef model fill:#f4f4f4,stroke:#8a8a8a,stroke-width:1px,color:#1f2937
    classDef def fill:#e7f1ff,stroke:#477db3,stroke-width:1px,color:#1f2937
    classDef prov fill:#fdf3e0,stroke:#b98a2f,stroke-width:1px,color:#1f2937
    classDef link fill:#eef1f4,stroke:#6b7280,stroke-width:1px,color:#1f2937
    class DC def
    class D1,D2,MAT def
    class A1,A2,A3,A4 prov
    class RL1,RL2 link
    style DICT fill:#fafafa,stroke:#b8b8b8,stroke-width:1px,color:#1f2937
    style CSM fill:#f7fbff,stroke:#8fb3d9,stroke-width:1px,color:#1f2937
```

The two cached PVC-300 elements share a stable `Identifier` and a `CodeValue` but have different `FederationGuid`s and `CodeScope`s; the unchanged *PVC* material is cached once with one aspect per catalog version that includes it. To check whether a newer version of a cached definition exists, the application looks up the definition's stable `Identifier` in the latest catalog version and compares the authority's version identifier there against the cached `FederationGuid`.

## Scope and future standardization

The organization and provenance conventions above are intended to apply across catalog authorities. The dependency-discovery mechanisms cover only the BIS patterns described above; domain schemas and applications may define additional rules. Authority-specific concerns (identifier formats, publishing workflows, hosting, storage, and APIs for browsing or downloading catalogs) are outside the scope of BIS and of this page. Broader standards for third-party catalog authorities are deferred until concrete use cases arise.

---

| Next: [3D Guidance](../physical-perspective/3d-guidance.md)
|:---
