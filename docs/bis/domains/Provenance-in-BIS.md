# Provenance in BIS

## Introduction

Provenance concerns the ability to trace an element in a BIS repository back to its native, external source. Several classes are available in the BisCore schema to help capturing provenance information for Elements in a BIS repository. They are particularly important for data-synchronization workflows, while detecting changes in an external source with respect to data stored in a BIS repository.

## Core Concepts

The following class diagrams depict the main classes from the BisCore schema involved in capturing provenance in BIS repositories. See [Class-diagram Conventions](../guide/references/class-diagram-conventions.md) for details about the conventions used.

![Core Classes](../guide/media/external-sources-classes.png)

![SynchronizationConfigLink](../guide/media/external-sources-classes-synclink.png)

### RepositoryLink

A [RepositoryLink](./BisCore.ecschema.md#repositorylink) represents a link to an external repository. External Repositories may be associated with Reality data as well as with data that is synchronized with elements in a BIS repository.

### ExternalSource

An [ExternalSource](./BisCore.ecschema.md#externalsource) represents an `Information Container` within a repository. External repositories are referenced by [RepositoryLink](#repositorylink) instances in a BIS repository.

Some external repositories do not have any data-container concept and therefore, their corresponding [RepositoryLink](#repositorylink) instances will only be associated with one  `ExternalSource` instance.

### ExternalSourceAttachment

An [ExternalSourceAttachment](./BisCore.ecschema.md#externalsourceattachment) enables the representation of hierarchical `Information Container`s or acyclical dependency graphs that can be encountered in some external repositories.

`ExternalSourceAttachment` instances are owned by a `ExternalSource` at the higher level of the hierarchy via the [ExternalSourceOwnsAttachments](./BisCore.ecschema.md#externalsourceownsattachments) relationship.

An instance of `ExternalSourceAttachment` also captures any transformations needed - in the form of translation, scale or rotation - relative to the  `ExternalSource` attaching it.

### ExternalSourceAspect

An [ExternalSourceAspect](./BisCore.ecschema.md#externalsourceaspect) is an [Element Aspect](../guide/fundamentals/elementaspect-fundamentals.md) which is meant to capture the specific details with regards to provenance for its owning Element.

Provenance for a specific Element is captured in terms of:

- An `Identifier` in the source repository (required).
- A `Kind` of object within the source repository.
- A reference to another Element that represents a `Scope` in which the combination of `Identifier` and `Kind` is *typically* unique. This referenced Element is usually a [RepositoryLink](#repositorylink) or an [InformationPartitionElement](./BisCore.ecschema.md#informationpartitionelement). Note that uniqueness among these three attributes in light of a single Element is not enforced by BIS repositories.
- A reference to an [ExternalSource](#externalsource) from which the Element originated (required).
- An optional `Version` of the Element's data captured in the BIS repository.
- An optional `Checksum` - a cryptographic hash (any algorithm) - of the Element's data captured in the BIS repository.
- Optional `JsonProperties` in case additional provenance-related attributes need to be captured.

This provenance properties are very important during data-synchronization workflows. Each data-synchronizer needs to decide what values from entities in the external source to capture in the aforementioned properties. Chosen values need to be sufficient in order to match Elements in an iModel with entities in its external source and efficiently detect changes in the latter that need to be synchronized in the former. It is recommended that data-synchronizers assign not-null values to `Identifier`, `Kind` and `Scope` since they are targeted by aspect-finding-APIs in iTwin.js.

Note that an Element can own more than one `ExternalSourceAspect` if its provenance is associated to multiple source repositories or multiple entities in one external repository. Furthermore, `ExternalSourceAspect`s with the same combination of `Identifier`, `Kind` and `Scope` are allowed on the same Element. In those cases, data-synchronizers can use the `JsonProperties` attribute of each `ExternalSourceAspect` in order to differenciate their provenance, if needed.

The following instance diagram shows an example of three elements synchronized from an external repository consisting of a single Dgn file containing two Dgn models. See [Instance-diagram Conventions](../guide/references/instance-diagram-conventions.md) for details about the conventions used.

![ExternalSource example](../guide/media/external-source-example.png)

### ExternalSourceGroup

An [ExternalSourceGroup](./BisCore.ecschema.md#externalsourcegroup) is an special case of [ExternalSource](#externalsource) intended to be used when there is a potential for duplicate elements across a set of external source files.

One real-world use case is the appearance of the same "Wall", with the same "unique" id, in more than one IFC file. This setup may have been done for the purpose of referencing the same "Wall" from three different IFC files focusing on piping, HVAC and architectural details respectively. This set of IFC files is then considered to be an `ExternalSourceGroup` in a BIS repository. The individual `ExternalSource` instances for each IFC file are then grouped via the `ExternalSourceGroupGroupsSources` relationship. The following instance diagram depics such an example. See [Instance-diagram Conventions](../guide/references/instance-diagram-conventions.md) for details about the conventions used.

![ExternalSourceGroup example](../guide/media/external-source-group.png)

### SynchronizationConfigLink

A [SynchronizationConfigLink](./BisCore.ecschema.md#synchronizationconfiglink) represents a link to the configuration of a synchronization job in a BIS repository. `SynchronizationConfigLink`s specify the associated [ExternalSource](#externalsource) instances that were processed during its execution via the [SynchronizationConfigProcessesSources](./BisCore.ecschema.md#synchronizationconfigprocessessources) relationship.

When the associated `ExternalSource` is the root of a synchronization job, which means that it is used to discover other referenced sources, the [SynchronizationConfigSpecifiesRootSources](./BisCore.ecschema.md#synchronizationconfigspecifiesrootsources) relationship shall be used instead.

The following instance diagram shows an example of a hierarchy of `ExternalSource`s, starting at an instance specified by a `SynchronizationConfigLink`. See [Instance-diagram Conventions](../guide/references/instance-diagram-conventions.md) for details about the conventions used.

![ExternalSources tree](../guide/media/external-sources-synclink.png)

---
| Back to: [Core domains](./core-domains.md)
|:---
