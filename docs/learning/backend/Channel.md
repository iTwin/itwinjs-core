# Working With Channels in iModels

A "channel" is a tree of models and elements below a *Channel Subject* element. Channels segregate the contents of an iModel into *sections* to provide access control over which applications may change which data. The concept is *cooperative* in that applications indicate the channels to which they pertain, and any attempt to modify data outside one of those channels is denied with a *channel constraint* exception at runtime.

To help visualize how channels are used, imagine an iModel with the following breakdown:

RootSubject
- DictionaryModel
  - Elements ...
- Subject0
  - PhysicalPartition01
    - Model01
      - Elements ...
- <span style="color:red;font-weight:bold">Subject1</span>
  - <span style="color:red">PhysicalParition11</span>
    - <span style="color:red">Model11</span>
      - <span style="color:red">Elements ...</span>

- <span style="color:blue;font-weight:bold">Subject2</span>
  - <span style="color:blue">PhysicalParition21</span>
    - <span style="color:blue">Model21</span>
      - <span style="color:blue">Elements ...</span>
  - <span style="color:blue">Subject21</span>
    - <span style="color:blue">PhysicalParition211</span>
      - <span style="color:blue">...</span>

In this example, <span style="color:red;font-weight:bold">Subject1</span> and <span style="color:blue;font-weight:bold">Subject2</span> are the channel roots. All of the elements and models under them are in their respective channels. Color-coding is used to identify each tree. Everything in <span style="color:red">red</span> is in Subject1's channel. Everything in <span style="color:blue">blue</span> is in Subject2's channel.

Not everything in an iModel is in a channel. Everything that is not below a Channel Subject is considered part of the *Shared Channel*. The Shared Channel may be modified by all applications. In the diagram above, everything in black is in the Shared Channel.

## ChannelNames

Every channel has a `channelName` that is used as the key for controlling write access to it.

>Note: `channelName` is distinct from the Code of the Channel Subject element. It is a key chosen by the application that creates a channel and is not visible to the user. More than one Channel Subject may use the same `chanelName`.

## ChannelControl

Every `IModelDb` has a member [IModelDb.channels]($backend) of type [ChannelControl]($backend) that supplies methods for controlling which channels are editable during a session.

The method [ChannelControl.getChannel]($backend) will return the `channelName` for an element given an `ElementId`.

### Allowed Channels

The `ChannelControl` member of an IModelDb holds a set of allowed (i.e. editable) channels. Any attempt to add/delete/update an [Element]($backend), [ElementAspect]($backend), or [Model]($backend) whose `channelName` is not in the set of Allowed Channels will generate a `ChannelConstraintViolation` exception.

After opening an `IModelDb` but before editing it, applications should call [ChannelControl.addAllowedChannel]($backend) one or more times with the `channelName`(s) for which editing should be allowed. To stop editing a channel, call [ChannelControl.removeAllowedChannel]($backend).

For example:

```ts
    imodel.channels.addAllowedChannel("structural-members");
```

Later, to disallow editing of that channel call:

```ts
    imodel.channels.removeAllowedChannel("structural-members");
```

> Note: The "shared" channel is editable by default, so it is automatically in the set of allowed channels. To disallow writing to the shared channel, you can call `imodel.channels.removeAllowedChannel("shared")`

### Creating New Channels

To create a new Channel Subject element (and thereby a new channel), use [ChannelControl.insertChannelSubject]($backend).

E.g.:

```ts
  imodel.channels.insertChannelSubject({ subjectName: "Chester", channelName: "surface-stubs" });
```

Generally, Channel Subject elements are created as an child of the Root Subject. However,  `insertChannelSubject` accepts an optional `parentSubjectId` argument so that Channel Subjects can appear elsewhere in the Subject hierarchy. However, channels may not nest. Attempts to create a Channel Subject within an exiting channel will throw an exception.

## Channels vs. Locks

Locks and Channels are orthogonal concepts. To edit an element, its channel must be allowed AND its lock must be held.

Each is possible without the other:
  - If another user holds the lock on an element, editing is denied even though it is an allowed channel.
  - An element may have been edited in a previous session or by another application in the same session. In that case the lock may be held, but further edits are denied if its channel is not allowed.
