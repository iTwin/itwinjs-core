# Working With Channels in iModels

A "channel" is a tree of models and elements below a *Channel Subject* element. Channels segregate the contents of an iModel into *sections* to provide access control over which applications may change which data. The concept is *cooperative* in that applications indicate the channels to which they pertain, and any attempt to modify data outside one of those channels is denied with a *channel constraint error* at runtime.

The parent of a Channel Subject is usually the Root Subject of the iModel.

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

> ChannelName is distinct from the Code of the Channel Subject element. It is a key chosen by the application that creates a channel and is not visible to the user. More than one Channel Subject may use the same `chanelName`.

## ChannelAdmin


## Creating Channels


## Allowed Channels

1. Only the owner of a channel can write to it.

- A [Changeset](../Glossary.md#changeset) may contain changes for only a single channel.

## Channels vs. Locks

