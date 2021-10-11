# Channels

A "channel" is a tree of elements. The root of the tree is called the channel "root" element. The tree includes the root and all of its child elements and sub-models, recursively. Channels do not nest.

To be a channel root, an element must have a [ChannelRootAspect]($backend). (Legacy iModel connectors mark their channel roots with a special JSON property.)

To help visualize what a channel is, imagine an iModel with the following breakdown:

RootSubject

- DictionaryModel
  - Elements ...
- RealityModels ...
- Subject0
  - PhysicalPartition01
    - Elements ...
- Subject1

  - <span style="color:red">**_PhysicalParition11_**</span>
    - <span style="color:red">Model11</span>
      - <span style="color:red">Elements ...</span>

- <span style="color:blue">**_Subject2_**</span>
  - <span style="color:blue">PhysicalParition21</span>
    - <span style="color:blue">Model21</span>
      - <span style="color:blue">Elements ...</span>
  - <span style="color:blue">Subject21</span>
    - <span style="color:blue">PhysicalParition211</span>
      - <span style="color:blue">...</span>

In this example, PhysicalPartition11 and Subject2 are the channel roots. They are shown in bold. All of the elements and models under them are in their respective channels. Color-coding is used to identify each tree. Everything in <span style="color:red">red</span> is in PhysicalPartition11's channel. Everything in <span style="color:blue">blue</span> is in Subject2's channel.

Not everything in an iModel is in a channel. Everything that is not in a specially marked channel is, by default, assigned to the special "repository channel". In the diagram above, everything in black is in the repository channel.

## Channel Constraints

A read-write app does not _have to_ create a channel before it can write to an iModel. The app must, nevertheless, follow the rules when regarding channels that were created by other apps.

There are two fundamental rules that apply to (non-repository) channels:

1. Only the owner of a channel can write to it.
1. All changes to a given channel must be isolated from changes to all other channels.

Additional rules follow from them:

- An app must be _in_ a channel before attempting to lock the channel root or modify anything in it.
- All changes to a given channel must be pushed before another channel can be changed.
- A [ChangeSet]($imodelhub-client) may contain changes for only a single channel.

A [ChannelConstraintError]($backend) is thrown when an app breaks one of these rules. That happens most often when an app is "in" one channel and tries to write to another. The error in these cases look like this:

- "cannot write to the channel owned by A while in the channel owned by B"
- "cannot write to the channel owned by A while in the repository channel"
- "cannot write to the repository channel while in the channel owned by B"

You will get this error if you try to change channels without pushing your changes first:

- "Must push changes before changing channel"

## Channel Ownership

> An app should not get into or try to modify a channel that it does not own.

A channel has an owner. The owner is the app that created the channel and knows what it is for. The concept of a channel was first developed for connectors. A connector reads data from an external source and writes it to a channel that it owns. You might say that the channel is "tuned" to the external source and receives its data from there. It makes no sense for any other app to change the data in that channel, since the source of truth is the external source.

The rules of locking are slightly different for channels:

- When you lock a channel root element, you effectively lock everything in it.
- You can only lock the channel that you are _in_.

## Connectors and Channels

A connector always works in a channel. A connector does not create channels or change the channel. A supervisor calls some connector methods in the repository channel and others in the connector's own private channel. The channel is locked by the supervisor.

## Non-Connector Apps and Channels

An app other than a connector _may_ create and work in a channel. That is not required. If your app wants to work in a channel, here is an example.

The first example is how to create a channel and then get into it and write to it. Note how changes must be pushed in between changing channels.

```ts
// Get a briefcase
const props = await BriefcaseManager.downloadBriefcase(user, { iTwinId: testProjectId, iModelId: readWriteTestIModel.id });
const imodel1 = await BriefcaseDb.open(user, { fileName: props.fileName });

// Create the channel root. Note that, initially, we are in the repository channel.
const channel3 = imodel1.elements.insertElement(Subject.create(imodel1, imodel1.elements.getRootSubject().id, "channel3"));
const channel3Info = "this is channel3"; // could be an object or anything you like
ChannelRootAspect.insert(imodel1, channel3, channel3Info); // Create one of the channels using the new aspect in the way iTwin.js apps would set them up.

// Push the change to the repository channel.
imodel1.saveChanges();
await imodel1.pushChanges( {user, description: "channel3 root created"} );

// Now enter channel3 and write to it.
const m3 = createAndInsertPhysicalPartitionAndModel(imodel1, "m3", true, channel3; // some function that creates a model

// Push the changes to channel3
imodel1.saveChanges();
await imodel1.pushChanges( {user, description:  "channel3 populated"});
```

The next example is how to enter an existing channel and lock it in a pessimistic locking situation.

```ts
// Get the channel root element
const channel3 = imodel1.elements.getElement<Subject>({code: "channel3"});


// Lock that channel. That effectively locks everything in that channel.
await iMode1.locks.acquireExclusiveLock(channel3);

... make changes to elements and models in this channel.

// Push the changes to channel3
imodel1.saveChanges();
await imodel1.pushChanges({ user, description: "channel3 populated"});
```
