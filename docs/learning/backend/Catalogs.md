# Catalogs (CatalogDb)

A **catalog** stores reusable definitions that applications copy into iModels. For example, an application can copy a pipe type from a catalog so that designers can place pipes of that type without needing access to the original catalog each time.

This walkthrough follows that import workflow: open a catalog, select a component, find what it needs, copy it, and record where it came from. It explains which parts iTwin.js provides and which parts your application must implement. It assumes you have a catalog to read and a destination iModel that your application can edit; it is not a complete importer implementation. For background on reading and writing elements, see [Access Elements](./AccessElements.md) and [Create Elements](./CreateElements.md).

## The scenario

Follow the [BIS guide's example](../../bis/guide/data-organization/catalogs.md#a-running-example) of an engineering firm using OpenSite+, a civil site design application. The firm's catalog maintainer publishes a *Piping Catalog* containing **PVC-300**, an illustrative 300&nbsp;mm pipe type stored as a `PhysicalType` element, not an entry from a shipped OpenSite+ catalog.

The steps below follow a designer's pipe-type selection. A second example shows how a project administrator might select a classification tree. The BIS guide explains the roles, catalog concepts, and detailed discovery rules; this page focuses on implementing the import workflow.

## 1. Open the catalog

When a catalog is stored as an iModel, use [CatalogDb]($backend) to open it on the backend. On the frontend, use [CatalogConnection]($frontend). Storing a catalog as an iModel is one possible implementation: other catalog authorities may host and serve definitions differently.

Open the catalog with [CatalogDb.openReadonly]($backend), or [CatalogConnection.openReadonly]($frontend). Both accept [CatalogIModel.OpenArgs]($common):

- For a **local file**, omit `containerId` and pass the file path as `dbName`.
- For a **cloud container**, pass the `containerId` of the [BlobContainer]($backend) that holds the catalog. Set `dbName` if the database name differs from the default, `catalog-db`. You can also supply a semantic-version range in `version`; omitting it selects the newest available version.

Keep the catalog open while reading its contents, and close it when finished. Opening a catalog gives you access to its contents; it does not copy anything into the destination iModel.

### Identify the version you opened

Cloud catalogs are versioned. A request for a version range resolves to a particular version, so record the version actually opened rather than just the requested range. `CatalogDb.getVersion` returns that version, and `CatalogDb.getManifest` returns the manifest when one is present. You will use the catalog's identity and version when recording where the copied definitions came from in step 5.

Published, non-prerelease catalog versions are immutable. If the catalog maintainer changes PVC-300, they publish a new catalog version rather than changing the released version that existing iModels rely on. Publishing APIs are described after the import workflow.

## 2. Select the component's root element

A catalog iModel contains Models and Elements, like any other iModel. Use [ECSQL](../ECSQL.md) to query its contents and the [element-reading APIs](./AccessElements.md) to read the selected elements. The domain schema determines which classes and properties identify the entries your application offers.

For the designer's pipe selection, present a choice such as "PVC-300 pipe type" and resolve that choice to its `PhysicalType` element. That element is the **bundle root**: the highest element of the component the user wants. Do not start with a piece of its template geometry and try to find the pipe type by climbing ancestors.

Selection can also configure the application rather than choose something to place. A classification tree organizes what elements mean according to an industry or company-specific scheme. For example, a project administrator may select a `ClassificationSystem` as the root of an entire tree, rather than an individual classification. See the [OpenSite+ classification-tree example](../../bis/guide/data-organization/catalogs.md#example-a-classification-tree) for the concepts, bundle structure, and application requirements.

## 3. Discover the definitions the component needs

PVC-300's `PhysicalType` is not self-contained. It references a `TemplateRecipe3d`, a definition element whose sub-model contains the reusable 3D template geometry. The geometry references a category, and the type references its physical material. Copying only the pipe type would leave those dependencies missing. Before copying, the application must find all the data needed to use the component. This process is called *dependency discovery*.

The root and the owned and referenced data required to use it form a **definition bundle**. The [pipe-type example](../../bis/guide/data-organization/catalogs.md#example-a-pipe-type) shows how discovery reaches these elements.

Your importer must combine schema-discoverable ownership and navigation-property references with application-supplied link-table traversal rules and special handling for references inside geometry streams or property payloads. Apply the [generic discovery mechanisms](../../bis/guide/data-organization/catalogs.md#generic-discovery-mechanisms) and the following sections on link-table relationships and discovery limits. Those sections define traversal directions, explain why discovery does not automatically expand to source ancestors, and identify dependencies that need special handling.

## 4. Copy the bundle into the destination iModel

`CatalogDb` does not copy definitions into another iModel. Your application implements the transfer, including creating destination elements, mapping source identifiers to destination identifiers, and preserving required relationships. The [element-creation APIs](./CreateElements.md) provide the underlying write operations, not a complete bundle importer.

For PVC-300, copy the type and its discovered dependencies. If the same version of the *Pipes* category or *PVC* material has already been cached, reuse it rather than creating another copy. Update references in the copied data to point to the corresponding destination elements, including references inside geometry streams and JSON.

Transfer also needs valid destination models and parent relationships. Your application or transfer tooling must create or map that structure as needed. This is separate from expanding the selected bundle: needing a destination model does not imply that all elements in the source model should be imported.

The recommended destination organization places catalog-sourced definitions beneath a well-known `DefinitionContainer` for the catalog authority. Follow [Organization of cached definitions](../../bis/guide/data-organization/catalogs.md#organization-of-cached-definitions-in-a-bis-repository) for the container and sub-model conventions.

## 5. Record where the copies came from

The destination iModel stores its own copies. To recognize those definitions later, record their **provenance**: the catalog, catalog version, and entry that each came from. iTwin.js supplies provenance primitives, but the application creates and maintains the associations.

For PVC-300 from Piping Catalog version 1, the [recommended mapping](../../bis/guide/data-organization/catalogs.md#provenance-of-cached-definitions) uses:

- A [RepositoryLink]($backend) to identify Piping Catalog version 1.
- An [ExternalSourceAspect]($backend) on the cached definition to identify its stable catalog entry and associate it with that catalog version.
- The definition's `FederationGuid` to identify the specific version of that definition, so an unchanged definition can be recognized and reused.

Apply that mapping to every catalog-sourced `DefinitionElement` in the bundle, not just the selected pipe type. The BIS guide also explains code scopes, definitions shared across catalog versions, and the distinction between an entry's stable identity and its version identity. Establish these identities as part of copying so that subsequent imports can recognize definitions already cached.

Definitions copied elsewhere when a recipe or template is used may need different provenance handling; that remains application-specific.

## 6. Handle a later catalog update

Suppose the catalog maintainer corrects PVC-300's wall thickness and publishes Piping Catalog version 2. The cached version 1 definition remains unchanged. Your application decides how to discover and offer the update; iTwin.js does not detect catalog changes automatically.

If the application imports the changed pipe type, it creates a new definition with a new definition-version identity. Unchanged dependencies can remain cached once and gain provenance associations for the additional catalog version. See [The example, end to end](../../bis/guide/data-organization/catalogs.md#the-example-end-to-end) for the complete versioning example.

## Reference: a catalog iModel is a StandaloneDb

[CatalogDb]($backend) extends [StandaloneDb]($backend). The [CatalogIModel]($common) TypeScript namespace defines interfaces and types shared by the backend and frontend catalog APIs.

A catalog iModel:

- has `iTwinId` set to [Guid.empty]($bentley) and `BriefcaseId` set to [BriefcaseIdValue.Unassigned]($common),
- has no timeline and cannot apply or generate [changesets](../Glossary.md#changeset), and
- does not use an iModelHub checkout.

By contrast, an iModel managed by iModelHub uses a [BriefcaseDb]($backend), belongs to an iTwin, and records changes on an iModelHub timeline. See [Accessing iModels](./AccessingIModels.md).

## Reference: publishing cloud catalog versions

Catalogs stored in cloud containers use [semantic versioning](https://semver.org), much like [WorkspaceDb]($backend)s. Published versions are immutable unless they are prerelease versions. The provenance conventions above assume immutable catalog versions.

Catalog authorities use these APIs to publish catalogs:

- [CatalogDb.createNewContainer]($backend) creates a cloud container seeded from a local catalog file. It requires administrator authorization.
- [CatalogDb.acquireWriteLock]($backend), [CatalogDb.createNewVersion]($backend), [CatalogDb.openEditable]($backend), and [CatalogDb.releaseWriteLock]($backend) support creating, editing, and publishing a new version. `createNewVersion` copies an existing version and increments it as major, minor, or patch.

Applications still define catalog administration, discovery and selection interfaces, dependency rules, transfer, provenance, and update policies. `CatalogDb` provides access to the catalog storage, not those workflows.
