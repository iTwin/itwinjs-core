# Events
iModelHub sends [IModelHubEvent]($clients)s for operations occuring on a particular iModel.

To receive events, the user has to:
1. [Subscribe to events](#creating-events-subscription) from a single iModel, specifying [types of events](#event-types) they want to receive.
2. Get an [EventSAS]($clients) token, that is used to authenticate to Events service. See [getting events](#getting-events).
3. Send a request to get and delete the first event from that subscription's queue. See [getting events](#getting-events).

Instead of repeating steps 2 and 3, it's possible to [create a listener](#creating-events-listener) that continuously receives events from a subscription.

## Event Types
When a user [subscribes to events](#creating-events-subscription), they have to provide [EventType]($clients)s of [IModelHubEvent]($clients)s they want to receive. iModelHub sends these events:

| Type | Description |
|---|---|
| [AllCodesDeletedEvent]($clients) | All [HubCode]($clients)s for a [Briefcase]($clients) are deleted. |
| [AllLocksDeletedEvent]($clients) | All [Lock]($clients)s for a [Briefcase]($clients) are deleted. |
| [BriefcaseDeletedEvent]($clients) | A [Briefcase]($clients) was deleted. |
| [ChangeSetPostPushEvent]($clients) | A [ChangeSet]($clients) was successfully pushed. |
| [ChangeSetPrePushEvent]($clients) | A [ChangeSet]($clients) push has started. |
| [CodeEvent]($clients) | One or more [HubCode]($clients)s were updated. |
| [IModelDeletedEvent]($clients) | An iModel was deleted. |
| [LockEvent]($clients) | One or more [Lock]($clients)s were updated. |
| [VersionEvent]($clients) | A new named [Version]($clients) was created. |

> [CodeEvent]($clients) and [LockEvent]($clients) includes every updated [HubCode]($clients) or [Lock]($clients) value, so it tends to be quite chatty. It's recommended to not subscribe to these events, unless they are necessary for your workflow.

## Creating Events Subscription
To receive [IModelHubEvent]($clients)s, user has to create an [EventSubscription]($clients). Creating a subscription requires the user to specify an array of [event types](#event-types) they want to receive.

Creating subscription requires user to have an [access token]($docs/learning/common/AccessToken.md) and have a valid [iModel id](./imodels/GetiModel.md).

Example:
```ts
[[include:EventSubscriptionsHandler.create.example-code]]
```

After creating the subscription, ``subscription.wsgId`` can be used when subscription id is requested.

Each subscription contains its own queue of events. Subscriptions expire after an hour of inactivity.

## Getting events
First user has to get an [EventSAS]($clients) token.
```ts
[[include:EventHandler.getSASToken.example-code]]
```

Then they can get the first event from their subscription's queue. This will immediately delete the event from the queue.
```ts
[[include:EventHandler.getEvent.example-code]]
```

If [EventHandler.getEvent]($clients) is called with a timeout duration specified, this request will perform long polling. If this request didn't find an event on the queue, it would wait until one is available or the timeout expires. This way the event reaches the client faster and less requests are sent between the client and the service.

[EventHandler.getEvent]($clients) can fail because [EventSAS]($clients) has expired. It can also return undefined if no events have been found.

## Creating Events Listener
[EventHandler.createListener]($clients) can be used to handle repeated calls to [EventHandler.getEvent]($clients) and [EventHandler.getSASToken]($clients).

Authentication callback example, similar to [getting access token]($docs/learning/common/AccessToken.md). [AuthorizationToken]($clients) could be retrieved from credentials stored somewhere else or refreshed before it expires.
```ts
[[include:EventHandler.createListener.authenticate.example-code]]
```

Listener callback example. This callback just logs the type of the [IModelHubEvent]($clients) received.
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

Event listener will work in the background, continuously getting events for a specific [EventSubscription]($clients). Once an [IModelHubEvent]($clients) is received, all registered listener callbacks for that subscription are called. If [EventSAS]($clients) expires, [EventHandler.getSASToken]($clients) will be called automatically. If [AccessToken]($clients) expires, authentication callback will be called to refresh that token.

Event listener will stop if there's an error getting events for that subscription or when all listeners for it are deleted. In the latter case, any outstanding long polling requests could still complete.

Listeners for the same subscription will only make a single event request at a time. Listeners for different subscriptions work independently.
