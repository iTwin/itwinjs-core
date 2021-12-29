# iModel Transformation and iModel Branching

## What is branching

It can be useful in some applications to take iModels and their linear concept of history, and introduce the concept of
*branching*, where an iModel diverges into two separate iModels after a changeset, allowing each to have new distinct changes and
a distinct history. Typically, one of them is referred to as the *master iModel*, and the other the *branch iModel*,
with the master iModel being the one that existed before the branch was created from it.
Importantly, these branches can often be used to isolate a set of changes from others being made to the master iModel
in other contexts. Usually the intention is to move the changes in the branch iModel's history back into
the master iModel. It can also be useful to update a branch with changes that the master received since their divergence.

## Provenance

*Provenance* is the tracking of where an entity originated from when it was connected to an iModel. All connectors
store provenance as they translate entities from some source format into an iModel. The [IModelTransformer]($transformer) will
also store its own provenance, especially in the cases of synchronization since provenance will be used by the transformer
during synchronizations to identify which element in the branch came from the master in order to merge and append changes.

The [IModelTransformer]($transformer) has several options defined in the [IModelTransformOptions]($transformer) type
that configure what provenance is stored, and particular configurations are required for performing each branching operation
with the transformer.

Some additional notes on provenance from the connector application viewpoint can be found [here](/learning/writeaconnector/#sync).

### TargetScopeElement

The *Target Scope Element* is the element in the *target* iModel of a transformation that represents the source repository as a whole,
and is therefore used as the scope of all [ExternalSourceAspect]($backend)s.
When transforming, and generally when the external source is another iModel, the element typically inserted to represent it is a
[RepositoryLink]($backend).

## Synchronization (implementing branching)

The process of transferring change history between iModels is called *synchronization*, and is implemented by the
[IModelTransformer]($transformer) to support branching concepts.

- *First Synchronization* is the initialization of a new iModel as a branch iModel for some existing iModel, the master iModel.
  The initialization can create an arbitrary transformation of the master iModel, hiding pieces, or even adding relevant ones.
- *Synchronization* is the transfer of iModel changes from a master iModel to an existing branch iModel.
- *Reverse Synchronization* is the transfer of iModel changes from a branch iModel back to the master iModel from which it was created.

![synchronization diagram](./iModelBranching.drawio.svg)

In the above diagram you can see an example change history of a master and its branch. Each arrow is an application submitting
changesets to the iModel, and each vertical connection (notably an arrow with with two sources) is a transformation reading both
iModels and submitting a changeset to one of them, *synchronizing them*.

Synchronization logic is implemented by the [IModelTransformer]($transformer), which can be configured to perform each type of
synchronization. Move to the examples

## Synchronization Examples

The following examples use snapshot iModels for simple demonstration. For an online iModel with an actual change history,
you will need to create your iModels through whatever management hub you use, such as iModel Hub.

### Creating a branch (First Synchronization)

```ts
const masterDb = yourChosenHubImpl.openMyIModel("my-master-id");
// create a duplicate
const newBranchDb = yourChosenHubImpl.createDuplicateOfExistingIModel("my-master-id");
// the branch is an identical duplicate, update it with the provenance required for the transformer to perform future synchronizations
const transformer = new IModelTransformer(masterDb, newBranchDb, { wasSourceIModelCopiedToTarget: true });
await transformer.processAll();
// create an external source to use as our *Target Scope Element* for future synchronizations
const masterRepoLinkId = new RepositoryLink({
  classFullName: RepositoryLink.classFullName, // TODO: confirm this is necessary
  code: RepositoryLink.createCode(masterDb, IModelDb.rootSubjectId, 'example-master-repo-link-id'),
  model: IModelDb.rootSubjectId,
  repositoryGuid: masterDb.iModelId, // by convention the repositoryGuid of an external source that is an iModel is that iModel's id
  format: "example-format-iModel",
}).insert();
// save/push our changes to whatever hub we're using
yourChosenHubImpl.saveAndPushChanges(newBranchDb);
```

### Update branch with master changes (Forward Synchronization)

```ts
const masterDb = yourChosenHubImpl.openMyIModel("my-master-id");
const branchDb = yourChosenHubImpl.openMyIModel("my-branch-id");
// the branch is an identical duplicate, update it with the provenance required for the transformer to perform future synchronizations
const transformer = new IModelTransformer(masterDb, branchDb, {
  // tells the transformer that we have a raw copy of a source and the target should be filled with provenance external source aspects
  // that are necessary for performing synchronizations in the future
  wasSourceIModelCopiedToTarget: true
});
await transformer.processAll();
```

### Update master with branch changes (Reverse Synchronization)

```ts
const masterDb = yourChosenHubImpl.openMyIModel("my-master-id");
const branchDb = yourChosenHubImpl.openMyIModel("my-branch-id");
const transformer = new IModelTransformer(branchDb, masterDb, {
  // disables the transformer's normal provenance storage
  noProvenance: true,
  // tells the transformer that the branch provenance will be stored in the source since the synchronization direction is reversed
  isReverseSynchronization: true,
});
await transformer.processAll();
```

For more in depth examples, you can read some of the ["branch" tests](https://github.com/iTwin/itwinjs-core/blob/master/core/transformer/src/test/standalone/IModelTransformer.test.ts)
in the iTwin.js source repository.
