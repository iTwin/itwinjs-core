# Events

iModelHub sends [IModelHubEvent]($imodelhub-client)s for operations that occur on a particular iModel.

To receive events, the user has to:

1. [Subscribe to events](#creating-events-subscription) from a single iModel, specifying [types of events](#event-types) they want to receive.
2. Get an [EventSAS]($imodelhub-client) token, that is used to authenticate to Events service. See [getting events](#getting-events).
3. Send a request to get and delete the first event from that subscription's queue. See [getting events](#getting-events).

Instead of repeating steps 2 and 3, it's possible to [create a listener](#creating-events-listener) that continuously receives events from a subscription.

## Event Types

When a user [subscribes to events](#creating-events-subscription), they have to provide [EventType]($imodelhub-client)s of [IModelHubEvent]($imodelhub-client)s they want to receive. iModelHub sends these events:

| Type | Description |
|---|---|
| [AllCodesDeletedEvent]($imodelhub-client) | All [HubCode]($imodelhub-client)s for a [Briefcase]($imodelhub-client) are deleted. |
| [AllLocksDeletedEvent]($imodelhub-client) | All [Lock]($imodelhub-client)s for a [Briefcase]($imodelhub-client) are deleted. |
| [BriefcaseDeletedEvent]($imodelhub-client) | A [Briefcase]($imodelhub-client) was deleted. |
| [ChangeSetPostPushEvent]($imodelhub-client) | A [[ChangeSet]($imodelhub-client) was successfully pushed. |
| [ChangeSetPrePushEvent]($imodelhub-client) | A [[ChangeSet]($imodelhub-client) push has started. |
| [CodeEvent]($imodelhub-client) | One or more [HubCode]($imodelhub-client)s were updated. |
| [IModelDeletedEvent]($imodelhub-client) | An iModel was deleted. |
| [LockEvent]($imodelhub-client) | One or more [Lock]($imodelhub-client)s were updated. |
| [VersionEvent]($imodelhub-client) | A new named [Version]($imodelhub-client) was created. |

> [CodeEvent]($imodelhub-client) and [LockEvent]($imodelhub-client) includes every updated [HubCode]($imodelhub-client) or [Lock]($imodelhub-client) value, so it tends to be quite chatty. It's recommended to not subscribe to these events, unless they are necessary for your workflow.

## Creating Events Subscription

To receive [IModelHubEvent]($imodelhub-client)s, user has to create an [EventSubscription]($imodelhub-client). Creating a subscription requires the user to specify an array of [event types](#event-types) they want to receive.

Creating subscription requires user to have an [access token]($docs/learning/common/AccessToken.md) and have a valid [iModel id](./imodels/GetiModel.md).

Example:

```ts
[[include:EventSubscriptionsHandler.create.example-code]]
```

After creating the subscription, ``subscription.wsgId`` can be used when subscription id is requested.

Each subscription contains its own queue of events. Subscriptions expire after an hour of inactivity.

## Getting events

First user has to get an [EventSAS]($imodelhub-client) token.

```ts
[[include:EventHandler.getSASToken.example-code]]
```

Then they can get the first event from their subscription's queue. This will immediately delete the event from the queue.

```ts
[[include:EventHandler.getEvent.example-code]]
```

If [EventHandler.getEvent]($imodelhub-client) is called with a timeout duration specified, this request will perform long polling. If this request didn't find an event on the queue, it would wait until one is available or the timeout expires. This way the event reaches the client faster and less requests are sent between the client and the service.

[EventHandler.getEvent]($imodelhub-client) can fail because [EventSAS]($imodelhub-client) has expired. It can also return undefined if no events have been found.

## Creating Events Listener

[EventHandler.createListener]($imodelhub-client) can be used to handle repeated calls to [EventHandler.getEvent]($imodelhub-client) and [EventHandler.getSASToken]($imodelhub-client).

Authentication callback example, similar to [getting access token]($docs/learning/common/AccessToken.md). [AuthorizationToken]($clients) could be retrieved from credentials stored somewhere else or refreshed before it expires.

```ts
[[include:EventHandler.createListener.authenticate.example-code]]
```

Listener callback example. This callback just logs the type of the [IModelHubEvent]($imodelhub-client) received.

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

Event listener will work in the background, continuously getting events for a specific [EventSubscription]($imodelhub-client). Once an [IModelHubEvent]($imodelhub-client) is received, all registered listener callbacks for that subscription are called. If [EventSAS]($imodelhub-client) expires, [EventHandler.getSASToken]($imodelhub-client) will be called automatically. If [AccessToken]($clients) expires, authentication callback will be called to refresh that token.

Event listener will stop if there's an error getting events for that subscription or when all listeners for it are deleted. In the latter case, any outstanding long polling requests could still complete.

Listeners for the same subscription will only make a single event request at a time. Listeners for different subscriptions work independently.
