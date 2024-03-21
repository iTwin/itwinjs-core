# Editing Channels in iModels

A "Channel" is a tree of models and elements below one *Channel Root* `Subject` element. Channels segregate the contents of an iModel into *sections* to provide access control over which applications may change which data. The concept is *cooperative* in that applications indicate the channels to which they pertain, and any attempt to modify data outside one of those channels is denied with a *channel constraint* exception at runtime.

To help visualize how channels are used, imagine an iModel with the following breakdown:

RootSubject
- Subject0
  - PhysicalPartition01
    - Model01
      - Elements ...
- <span style="color:green;font-weight:bold">Subject1</span>
  - <span style="color:green">PhysicalPartition11</span>
    - <span style="color:green">Model11</span>
      - <span style="color:green">Elements ...</span>

- <span style="color:blue;font-weight:bold">Subject2</span>
  - <span style="color:blue">PhysicalPartition21</span>
    - <span style="color:blue">Model21</span>
      - <span style="color:blue">Elements ...</span>
  - <span style="color:blue;font-weight:bold">Subject21</span>
    - <span style="color:blue">PhysicalPartition211</span>
      - <span style="color:blue">Model211</span>
        - <span style="color:blue">Elements ...</span>

In this example, <span style="color:green;font-weight:bold">Subject1</span> and <span style="color:blue;font-weight:bold">Subject2</span> are channel root elements. All of the elements and models under them are in their respective channels. Color-coding is used to identify the two channels in this example. Everything in <span style="color:green">green</span> is in the first channel, <span style="color:blue">blue</span> is in the second channel.

Not everything in an iModel is in a channel. Everything that is not below a *Channel Root* `Subject` element is considered part of the *Shared Channel*. The Shared Channel may be modified by all applications. In the diagram above, everything in black is in the Shared Channel.

## ChannelKeys

Every channel has a `channelKey` that is used for controlling write access to it.

>Note: `channelKey` is distinct from the Code of the Channel root element. It is a key chosen by the application that creates a channel and is not visible to the user. A particular `channelKey` can only be used by one Channel root Element in an iModel.

## ChannelControl

Every `IModelDb` has a member [IModelDb.channels]($backend) of type [ChannelControl]($backend) that supplies methods for controlling which channels are editable during a session.

The method [ChannelControl.getChannelKey]($backend) will return the `channelKey` for an element given an `ElementId`.
The method [ChannelControl.queryChannelRoot]($backend) will return the `ElementId` of the ChannelRoot element for a given `channelKey`, if one exists.

### Allowed Channels

The `ChannelControl` member of an IModelDb holds a set of allowed (i.e. editable) channels. Any attempt to add/delete/update an [Element]($backend), [ElementAspect]($backend), or [Model]($backend) whose `channelKey` is not in the set of Allowed Channels will generate a `ChannelConstraintViolation` exception.

After opening an `IModelDb` but before editing it, applications should call [ChannelControl.addAllowedChannel]($backend) one or more times with the `channelKey`(s) for which editing should be allowed. To stop editing a channel, call [ChannelControl.removeAllowedChannel]($backend).

For example:

```ts
    imodel.channels.addAllowedChannel("structural-members");
```

Later, to disallow editing of that channel call:

```ts
    imodel.channels.removeAllowedChannel("structural-members");
```

> Note: The "shared" channel is not editable by default. To allow writing to the shared channel, you need to call `imodel.channels.addAllowedChannel(ChannelControl.sharedChannelName)`

### Creating New Channels

To create a new *Channel Root* `Subject` element (and thereby a new channel), use [ChannelControl.insertChannelSubject]($backend) with the `channelKey` identifying the new channel.

E.g.:

```ts
  imodel.channels.insertChannelSubject({ subjectName: "Chester", channelKey: "surface-stubs" });
```

Generally, *Channel Root* `Subject` elements are created as an child of the *Root Subject*. However, `insertChannelSubject` accepts an optional `parentSubjectId` argument so that *Channel Root* Subjects can appear elsewhere in the Subject hierarchy. However, channels may not nest. Attempts to create a *Channel Root* element within an existing channel other than the "shared" Channel will throw an exception.

## Channels vs. Locks

Locks and Channels are orthogonal concepts. To edit an element, its channel must be allowed AND its lock must be held.

Each is possible without the other:
  - If another user holds the lock on an element, editing is denied even though it is an allowed channel.
  - An element may have been edited in a previous session or by another application in the same session. In that case the lock may be held, but further edits are denied if its channel is not allowed.
