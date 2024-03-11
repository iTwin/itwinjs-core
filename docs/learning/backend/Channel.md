# Working With Channels in iModels

A "channel" is a tree of models and elements starting at one or more *Channel* root elements. Channels segregate the contents of an iModel into *sections* to provide access control over which applications may change which data. The concept is *cooperative* in that applications indicate the channels to which they pertain, and any attempt to modify data outside one of those channels is denied with a *channel constraint* exception at runtime. Instances of `InformationPartitionElement` subclasses are used as *Channel* root elements in the large majority of cases. `DefinitionContainer`s can be used as *Channel* root elements when needed at the repository-global scope.

To help visualize how channels are used, imagine an iModel with the following breakdown:

RootSubject
- DefinitionPartition
  - DictionaryModel
    - DefinitionContainer11
      - DefinitionModel
        - Elements ...
    - <span style="color:green;font-weight:bold">DefinitionContainer21</span>
      - <span style="color:green">DefinitionModel</span>
        - <span style="color:green">Elements ...</span>
- Subject0
  - PhysicalPartition01
    - Model01
      - Elements ...
- Subject1
  - <span style="color:red;font-weight:bold">PhysicalParition11</span>
    - <span style="color:red">Model11</span>
      - <span style="color:red">Elements ...</span>

- Subject2
  - <span style="color:blue;font-weight:bold">PhysicalParition21</span>
    - <span style="color:blue">Model21</span>
      - <span style="color:blue">Elements ...</span>
  - Subject21
    - <span style="color:blue;font-weight:bold">PhysicalParition211</span>
      - <span style="color:blue">Model211</span>
        - <span style="color:blue">Elements ...</span>

In this example, <span style="color:green;font-weight:bold">DefinitionContainer21</span>, <span style="color:red;font-weight:bold">PhysicalParition11</span>, <span style="color:blue;font-weight:bold">PhysicalParition21</span> and <span style="color:blue;font-weight:bold">PhysicalParition211</span> are the channel roots. All of the elements and models under them are in their respective channels. Color-coding is used to identify the three channels in this example. Everything in <span style="color:red">green</span> is in the first channel, <span style="color:red">red</span> is in the second channel. Everything in <span style="color:blue">blue</span> is in the third channel.

Not everything in an iModel is in a channel. Everything that is not below a Channel root element is considered part of the *Shared Channel*. The Shared Channel may be modified by all applications. In the diagram above, everything in black is in the Shared Channel.

## ChannelKeys

Every channel has a `channelKey` that is used for controlling write access to it.

>Note: `channelKey` is distinct from the Code of the Channel root element. It is a key chosen by the application that creates a channel and is not visible to the user. More than one Channel root Elements may use the same `channelKey`. The third Channel in the the example above assumes there are two Channel root elements using the same `channelKey`.

## ChannelControl

Every `IModelDb` has a member [IModelDb.channels]($backend) of type [ChannelControl]($backend) that supplies methods for controlling which channels are editable during a session.

The method [ChannelControl.getChannelKey]($backend) will return the `channelKey` for an element given an `ElementId`.

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

> Note: The "shared" channel is editable by default, so it is automatically in the set of allowed channels. To disallow writing to the shared channel, you can call `imodel.channels.removeAllowedChannel("shared")`

### Creating New Channels

A Channel is created by defining one or more elements as a Channel root element with the `channelKey` identifying the new channel. To do this, use [ChannelControl.makeChannelRoot]($backend).

E.g.:

```ts
  imodel.channels.makeChannelRoot({ elementId: partitionId, channelKey: "surface-stubs" });
```

Note that channels may not nest. Attempts to create a Channel root element within an exiting channel will throw an exception.

## Channels vs. Locks

Locks and Channels are orthogonal concepts. To edit an element, its channel must be allowed AND its lock must be held.

Each is possible without the other:
  - If another user holds the lock on an element, editing is denied even though it is an allowed channel.
  - An element may have been edited in a previous session or by another application in the same session. In that case the lock may be held, but further edits are denied if its channel is not allowed.
