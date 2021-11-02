# Events

iModelHub sends `IModelHubEvent`s for operations that occur on a particular iModel.

To receive events, the user has to:

- [Events](#events)
  - [Event Types](#event-types)
  - [Creating Events Subscription](#creating-events-subscription)
  - [Getting events](#getting-events)
  - [Creating Events Listener](#creating-events-listener)

Instead of repeating steps 2 and 3, it's possible to [create a listener](#creating-events-listener) that continuously receives events from a subscription.

## Event Types

When a user [subscribes to events](#creating-events-subscription), they have to provide `EventType`s of `IModelHubEvent`s they want to receive. iModelHub sends these events:

| Type                     | Description                                   |
| ------------------------ | --------------------------------------------- |
| `AllCodesDeletedEvent`   | All `HubCode`s for a `Briefcase` are deleted. |
| `AllLocksDeletedEvent`   | All `Lock`s for a `Briefcase` are deleted.    |
| `BriefcaseDeletedEvent`  | A `Briefcase` was deleted.                    |
| `ChangeSetPostPushEvent` | A `ChangeSet` was successfully pushed.        |
| `ChangeSetPrePushEvent`  | A `ChangeSet` push has started.               |
| `CodeEvent`              | One or more `HubCode`s were updated.          |
| `IModelDeletedEvent`     | An iModel was deleted.                        |
| `LockEvent`              | One or more `Lock`s were updated.             |
| `VersionEvent`           | A new named `Version` was created.            |

> `CodeEvent` and `LockEvent` includes every updated `HubCode` or `Lock` value, so it tends to be quite chatty. It's recommended to not subscribe to these events, unless they are necessary for your workflow.

## Creating Events Subscription

To receive `IModelHubEvent`s, user has to create an `EventSubscription`. Creating a subscription requires the user to specify an array of [event types](#event-types) they want to receive.

Creating subscription requires user to have an [access token]($docs/learning/common/AccessToken.md) and have a valid [iModel id](./imodels/GetiModel.md).

Example:

```ts
[[include:EventSubscriptionsHandler.create.example-code]]
```

After creating the subscription, ``subscription.wsgId`` can be used when subscription id is requested.

Each subscription contains its own queue of events. Subscriptions expire after an hour of inactivity.

## Getting events

First user has to get an `EventSAS` token.

```ts
[[include:EventHandler.getSASToken.example-code]]
```

Then they can get the first event from their subscription's queue. This will immediately delete the event from the queue.

```ts
[[include:EventHandler.getEvent.example-code]]
```

If `EventHandler.getEvent` is called with a timeout duration specified, this request will perform long polling. If this request didn't find an event on the queue, it would wait until one is available or the timeout expires. This way the event reaches the client faster and less requests are sent between the client and the service.

`EventHandler.getEvent` can fail because `EventSAS` has expired. It can also return undefined if no events have been found.

## Creating Events Listener

`EventHandler.createListener` can be used to handle repeated calls to `EventHandler.getEvent` and `EventHandler.getSASToken`.

Authentication callback example, similar to [getting access token]($docs/learning/common/AccessToken.md). `AccessToken` could be retrieved from credentials stored somewhere else or refreshed before it expires.

```ts
[[include:EventHandler.createListener.authenticate.example-code]]
```

Listener callback example. This callback just logs the type of the `IModelHubEvent` received.

```ts
[[include:EventHandler.createListener.callback.example-code]]
```

To create the listener itself, user has to have an [iModel id](./imodels/GetiModel.md) and have an [event subscription](#creating-events-subscription).

```ts
[[include:EventHandler.createListener.create.example-code]]
```

Deleting the listener after it's no longer necessary is just calling the callback received when creating it.

```ts
[[include:EventHandler.createListener.delete.example-code]]
```

Event listener will work in the background, continuously getting events for a specific `EventSubscription`. Once an `IModelHubEvent` is received, all registered listener callbacks for that subscription are called. If `EventSAS` expires, `EventHandler.getSASToken` will be called automatically. If `AccessToken` expires, authentication callback will be called to refresh that token.

Event listener will stop if there's an error getting events for that subscription or when all listeners for it are deleted. In the latter case, any outstanding long polling requests could still complete.

Listeners for the same subscription will only make a single event request at a time. Listeners for different subscriptions work independently.
