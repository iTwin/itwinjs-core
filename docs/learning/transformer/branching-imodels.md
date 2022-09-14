# iModel Transformation and iModel Branching

## What is branching

It can be useful in some applications to take iModels and their linear concept of history, and introduce the concept of
*branching*, where an iModel diverges into two separate iModels after a changeset, allowing each to have new distinct changes and
a distinct history. Typically, one of them is referred to as the *master iModel*, and the other as the *branch iModel*,
with the master iModel being the one that existed before the branch was created from it.
Importantly, these branches can often be used to make updates to one branch iModel while the master iModel
can receive updates from other contexts. Usually the intention is to move the changes in the branch's history back into
the master. It can also be useful to update a branch with changes that the master received since their divergence,
to keep them synchronized.

## Provenance

*Provenance* is the tracking of where an entity originated from in an iModel. All connectors
store provenance as they connect entities from some source format into an iModel. The [IModelTransformer]($transformer) will
also store provenance as it makes changes to a target; provenance will be used during
[synchronizations](#synchronization-implementing-branching) to identify which elements
in the branch correspond to those in the master, in order to find conflicts in changes.

The [IModelTransformer]($transformer) has several options defined in the [IModelTransformOptions]($transformer) type
that configure what provenance is stored, and particular configurations are required for performing each branching operation
with the transformer.

Provenance is stored for entities by adding an [ExternalSourceAspect]($backend) to them, which contains properties referencing the original
repository they came from. The ExternalSourceAspects must reference an element that represents the real-world external source from which
their corresponding entity was derived; in the case of transformation where the external source is an external iModel, the iModel is best
conventionally represented with an [ExternalSource]($backend) element in a [RepositoryLink]($backend) element.

Additional notes on provenance from the connector application viewpoint can be found [here](/learning/writeaconnector/#sync).

### TargetScopeElement

The *Target Scope Element* is the element in the target iModel of a transformation that represents the source repository as a whole,
and is therefore used as the scope of [ExternalSourceAspect]($backend)s. Typically creating a branch iModel includes inserting a new
[RepositoryLink]($backend) and [ExternalSource]($backend) pair representing the master, and then all forward synchronization transformations
will use the master-representing ExternalSource as the Target Scope Element by setting the `targetScopeElementId` option in the [IModelTransformOptions]($transformer) option.

It is possible to not specify a `targetScopeElementId` for a branch transformation,
which will default to using the target's root subject as the targetScopeElement.
While this works for simple singular branches, it is not recommended because an explicit
external source contains more information, and if you decide to branch your branch iModel,
you will need a unique target scope element for both synchronization directions, one for
the forward synchronizations from master and one for reverse synchronizations from the sub branch.

### Provenance, element Ids, and federation guids

When correlating elements between branches, it is important to know how to tell which elements correspond to each other.
Element Ids are [local to an iModel](/learning/common/id64), and transformations do not preserve them. However, federation guids
(globally-unique-identifiers) are preserved. Neither are a substitute for provenance.
Only provenance can correctly correlate all elements between branches and must be used for any comparisons between them unless restrictions are
used.

Generally, it is not possible to map elements between iModels without provenance, because there is not always a one-to-one relationship of
elements between iModels. It is possible, for example, that a transformation involves operations such as "splitting" an existing element
into multiple different elements. In that case, federation guids and element Ids cannot be used to correlate the new multiple elements to the
original one since they must be unique so it is impossible for the multiple elements to share an Id.

## Synchronization (implementing branching)

The process of transferring change history between iModels is called *synchronization*, and is implemented by the
[IModelTransformer]($transformer) to support branching concepts.

- *First Synchronization* is the initialization of a new iModel as a branch iModel for some existing master iModel.
  The initialization can filter the master iModel arbitrarily using other transformation techniques.
- *Synchronization*, or *Forward Synchronization*, is the transfer of iModel changes from a master iModel to an existing branch iModel.
- *Reverse Synchronization* is the transfer of iModel changes from a branch iModel back to the master iModel from which it was created.

![synchronization diagram](./iModelBranching.drawio.svg)

TODO: 9/22 - Update/remove Link
In the above diagram you can see an example change history of a master and its branch. Each arrow is an application submitting
[ChangeSets](/learning/imodelhub/briefcases) to the iModel, and each vertical connection (notably an arrow with with two sources) is
a transformation reading both iModels and submitting a [ChangeSet](/learning/glossary/#changeset) to one of them, *synchronizing* them.

Synchronization logic is implemented by the [IModelTransformer]($transformer), which can be configured to perform each type of
synchronization, as shown in the samples below.

### Squashing changesets

TODO: 9/22 - Update/remove Link
In the above diagram, the synchronizations occur after several [ChangeSets](/learning/imodelhub/briefcases), each synchronization here *squashes* several changesets
from the synchronization source into the synchronization target. Alternatively, one could run a synchronization per changeset
in the source of the synchronization, so that the synchronization target has a changeset corresponding to each one in the
synchronization source, keeping the changeset granularity intact in the history. A combination of both can be done, such as
only squashing when reverse synchronizing (squashing branch changes) but keeping changeset data from the master intact during
forward synchronizations.

### Synchronization conflicts

Conflicts during a transformation are resolved in favor of the element which was modified most recently, as stored in the `LastMod` property
of an element.  Elements in transformations are considered in conflict when their [code](/bis/fundamentals/foundation/codes) is the same.

You can override the method [`IModelTransformer.hasElementChanged`](/reference/core-transformer/imodels/imodeltransformer/haselementchanged/)
in your transformer implementation to use more specific logic for determining if an element should be considered changed.

Some other data in the iModel follows more specific rules for conflicts:

- [ECSchemas](/bis/ec/ec-schema/) will not be inserted into the target if the same version already exists in it
<!-- (see [dynamic schemas](/docs/bis/fundamentals/schema-evolution/schema-customization.md#Dynamic-Schema-Minor-Change-Considerations)) -->
- File properties<!--missing documentation--> are not carried over through transformations

Synchronization conflicts are not to be confused with concurrent edit conflicts which are handled by the
[ConcurrencyControl API](/learning/backend/concurrencycontrol).

## Synchronization examples

### Creating a branch (First Synchronization)

```ts
[[include:IModelBranchingOperations_initialize]]
```

### Update branch with master changes (Forward Synchronization)

```ts
[[include:IModelBranchingOperations_forwardSync]]
```

### Update master with branch changes (Reverse Synchronization)

```ts
[[include:IModelBranchingOperations_reverseSync]]
```

### Synchronization workflow examples

More in depth samples exist in the [tests](https://github.com/iTwin/itwinjs-core/blob/master/core/transformer/src/test/standalone/IModelTransformerHub.test.ts) for the `@itwin/core-transformer` package.
