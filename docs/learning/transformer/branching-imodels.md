# iModel Transformation and iModel Branching

## What is branching

It can be useful in some applications to take iModels and their linear concept of history, and introduce the concept of
*branching*, where an iModel diverges into two separate iModels after a changeset, allowing each to have new distinct changes and
a distinct history. Typically, one of them is referred to as the *master iModel*, and the other the *branch iModel*,
with the master iModel being the one that existed before the branch was created from it.
Importantly, these branches can often be used to updates to one branch iModel while the master iModel
can received updates from other contexts. Usually the intention is to move the changes in the branch iModel's history back into
the master iModel. It can also be useful to update a branch with changes that the master received since their divergence.

## Provenance

*Provenance* is the tracking of where an entity originated from in an iModel. All connectors
store provenance as they connect entities from some source format into an iModel. The [IModelTransformer]($transformer) will
also store provenance as it makes changes to a target; provenance will be used during synchronizations to identify which element
in the branch came from the master in order to merge and append changes.

The [IModelTransformer]($transformer) has several options defined in the [IModelTransformOptions]($transformer) type
that configure what provenance is stored, and particular configurations are required for performing each branching operation
with the transformer.

Provenance is stored for entities by adding an [ExternalSourceAspect]($backend) to them, which contains properties referencing the original
repository they came from. The ExternalSourceAspects must reference an element that represents the real-world external source from which
their corresponding entity was derived; in the case of transformation where the external source is an external iModel, the iModel is best
conventionally represented with an [ExternalSource]($backend) element in a [RepositoryLink]($backend) element.

### TargetScopeElement

The *Target Scope Element* is the element in the target iModel of a transformation that represents the source repository as a whole,
and is therefore used as the scope of [ExternalSourceAspect]($backend)s. Typically creating a branch iModel includes inserting a new
[RepositoryLink]($backend) and [ExternalSource]($backend) pair representing the master, and then all forward synchronization transformations
will use the master-representing ExternalSource as the Target Scope Element by setting the [IModelTransformOptions.targetScopeElementId]($backend) option.

It is possible to not specify a `targetScopeElementId` for a branch transformation,
which will default to using the target's root subject as the targetScopeElement.
While this works for simple singular branches, it is not recommended because an explicit
external source contains more information, and if you decide to branch your branch iModel,
you will need a unique target scope element for both synchronization directions, one for
the forward synchronizations from master and one for reverse synchronizations from the sub branch.

### More on provenance

Additional notes on provenance from the connector application viewpoint can be found [here](/learning/writeaconnector/#sync).

## Synchronization (implementing branching)

The process of transferring change history between iModels is called *synchronization*, and is implemented by the
[IModelTransformer]($transformer) to support branching concepts.

- *First Synchronization* is the initialization of a new iModel as a branch iModel for some existing "master" iModel.
  The initialization can filter the master iModel arbitrarily using other transformation techniques.
- *Synchronization*, or *Forward Synchronization*, is the transfer of iModel changes from a master iModel to an existing branch iModel.
- *Reverse Synchronization* is the transfer of iModel changes from a branch iModel back to the master iModel from which it was created.

![synchronization diagram](./iModelBranching.drawio.svg)

In the above diagram you can see an example change history of a master and its branch. Each arrow is an application submitting
changesets to the iModel, and each vertical connection (notably an arrow with with two sources) is a transformation reading both
iModels and submitting a changeset to one of them, *synchronizing* them.

Synchronization logic is implemented by the [IModelTransformer]($transformer), which can be configured to perform each type of
synchronization, as shown in the samples below.

## Synchronization Examples

### Creating a branch (First Synchronization)

```ts
// download and open master
const masterDbProps = await BriefcaseManager.downloadBriefcase({
  accessToken: myAccessToken,
  iTwinId: myITwinId,
  iModelId: masterIModelId
});
const masterDb = await BriefcaseDb.open({ fileName: masterDbProps.fileName });

// create a duplicate of master as a good starting point for our branch
const branchIModelId = await IModelHost.hubAccess.createNewIModel({
  iTwinId: myITwinId,
  iModelName: "my-branch-imodel",
  version0: masterDb.pathName
});

// download and open the new branch
const branchDbProps = await BriefcaseManager.downloadBriefcase({
  accessToken: myAccessToken,
  iTwinId: myITwinId,
  iModelId: branchIModelId
});
const branchDb = await BriefcaseDb.open({ fileName: branchDbProps.fileName });

// create an external source and owning repository link to use as our *Target Scope Element* for future synchronizations
const masterLinkRepoId = new RepositoryLink({
  classFullName: RepositoryLink.classFullName,
  code: RepositoryLink.createCode(branchDb, IModelDb.repositoryModelId, "example-code-value"),
  model: IModelDb.repositoryModelId,
  url: "https://wherever-you-got-your-imodel.net",
  format: "iModel",
  repositoryGuid: masterDb.iModelId,
  description: "master iModel repository"
}, branchDb).insert();

const masterExternalSourceId = new ExternalSource({
  classFullName: ExternalSource.classFullName,
  model: IModelDb.rootSubjectId,
  code: Code.createEmpty(),
  repository: new ExternalSourceIsInRepository(masterLinkRepoId),
  connectorName: "iModel Transformer",
  connectorVersion: require("@itwin/core-transformer/package.json").version,
}, branchDb).insert();

// initialize the branch provenance
const branchInitializer = new IModelTransformer(masterDb, newBranchDb, {
  // tells the transformer that we have a raw copy of a source and the target should receive
  // provenance from the source that is necessary for performing synchronizations in the future
  wasSourceIModelCopiedToTarget: true,
  // store the synchronization provenance in the scope of our representation of the external source, master
  targetScopeElementId: masterExternalSourceId,
});
await branchInitializer.processAll();
branchInitializer.dispose();


// save+push our changes to whatever hub we're using
const description = "initialized branch iModel"
branchDb.saveChanges(description);
await branchDb.pushChanges({
  accessToken: myAccessToken,
  description,
});
```

### Update branch with master changes (Forward Synchronization)

```ts
// we assume masterDb and branchDb have already been opened (see the first example)
const masterExternalSourceId = branchDb.elements.queryElementIdByCode(
  RepositoryLink.createCode(masterDb, IModelDb.repositoryModelId, "example-code-value"),
);
const synchronizer = new IModelTransformer(masterDb, branchDb, {
  // read the synchronization provenance in the scope of our representation of the external source, master
  targetScopeElementId: masterExternalSourceId,
});
await synchronizer.processChanges();
synchronizer.dispose();
// save and push
const description = "updated branch with recent master changes"
branchDb.saveChanges(description);
await branchDb.pushChanges({
  accessToken: myAccessToken,
  description,
});
```

### Update master with branch changes (Reverse Synchronization)

```ts
// we assume masterDb and branchDb have already been opened (see the first example)
const masterExternalSourceId = branchDb.elements.queryElementIdByCode(
  RepositoryLink.createCode(masterDb, IModelDb.repositoryModelId, "example-code-value"),
);
const reverseSynchronizer = new IModelTransformer(branchDb, masterDb, {
  // tells the transformer that the branch provenance will be stored in the source
  // since the synchronization direction is reversed
  isReverseSynchronization: true,
  // read the synchronization provenance in the scope of our representation of the external source, master
  // "isReverseSynchronization" actually causes the provenance (and therefore the targetScopeElementId) to
  // be searched for from the source
  targetScopeElementId: masterExternalSourceId,
});
await reverseSynchronizer.processChanges();
reverseSynchronizer.dispose();
// save and push
const description = "merged changes from branch into master"
masterDb.saveChanges(description);
await masterDb.pushChanges({
  accessToken: myAccessToken,
  description,
});
```

For more in depth examples, you can read some of the "branch" tests [here](https://github.com/iTwin/itwinjs-core/blob/master/core/transformer/src/test/standalone/IModelTransformerHub.test.ts)
in the iTwin.js source repository.
