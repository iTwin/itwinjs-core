# Global Events
** Global Events require service accounts. Service accounts are currently only available to internal Bentley products. **

iModelHub sends [IModelHubGlobalEvent]($clients)s for operations occuring on any iModel in iModelHub.

To receive events, the service has to:
1. [Subscribe to global events](#creating-global-events-subscription), specifying [types of events](#global-event-types) it wants to receive.
2. Get a [GlobalEventSAS]($clients) token, that is used to authenticate to Global Events service. See [GlobalEventHandler.getSASToken]($clients) or [getting global events](#getting-global-events).
3. Send a request to get the first event from that subscription's queue. See [getting global events](#getting-global-events).

Instead of repeating steps 2 and 3, it's possible to [create a listener](#create-a-global-events-listener) that continuously receives events from a subscription.

# Global Event Types
When a user [subscribes to global events](#creating-global-events-subscription), they have to provide [GlobalEventType]($clients)s of [IModelHubGlobalEvent]($clients)s they want to receive. iModelHub sends these global events:

| Type | Description |
|---|---|
| [ChangeSetCreatedEvent]($clients) | [ChangeSet]($clients) was created. |
| [HardiModelDeleteEvent]($clients) | iModel was completely deleted from archive. |
| [IModelCreatedEvent]($clients) | iModel was created. |
| [NamedVersionCreatedEvent]($clients) | Named [Version]($clients) was created. |
| [SoftiModelDeleteEvent]($clients) | iModel was deleted and placed into archive. |

# Creating Global Events Subscription
To receive [IModelHubGlobalEvent]($clients)s, service has to create a [GlobalEventSubscription]($clients). Creating a subscription requires the service to specify an array of [global event types](#global-event-types) it wants to receive.

Creating subscription requires service to have an [access token]($docs/learning/common/AccessToken.md). Service has to specify an Guid identifier that service would have stored securely. It can be used later to retrieve same subscription.

> Number of subscriptions is limited. It is required to reuse previously created subscriptions rather than creating new ones.

Example:
```ts
[[include:GlobalEventSubscriptionsHandler.create.example-code]]
```

After creating the subscription, ``subscription.wsgId`` can be used when subscription id is requested. If this id is forgotten, a repeated [GlobalEventSubscriptionHandler.create]($clients) with same Guid will return the same subscription instead of creating a new one.

Each subscription contains its own queue of events. Subscriptions expire after a month of inactivity.

## Getting global events
To get events, service has to have [access token]($docs/learning/common/AccessToken.md) and have a [global event subscription](#creating-global-events-subscription).

First service has to get an [GlobalEventSAS]($clients) token.
```ts
[[include:GlobalEventHandler.getSASToken.example-code]]
```

Then service can get the first event from its subscription's queue. This will immediately delete the event from the queue.
```ts
[[include:GlobalEventHandler.getEvent.example-code]]
```

If [GlobalEventHandler.getEvent]($clients) is called with a timeout duration specified, this request will perform long polling. If this request didn't find a global event on the queue, it would wait until one is available or the timeout expires. This way the event reaches the service faster and less requests are sent between the client service and iModelHub.

[GlobalEventHandler.getEvent]($clients) can fail because [GlobalEventSAS]($clients) has expired. It can also return undefined if no events have been found.

### Non-destructive read
Instead of immediately removing global events from the queue, it's possible to peek and lock them. Locked events will not appear in the queue when doing subsequent [GlobalEventHandler.getEvent]($clients) requests.

Service will have to delete locked event after they finish processing it. If service doesn't delete the event in a minute, the lock will expire and the event will reappear in the queue.

When getting event, service has to specify that they want to use [GetEventOperationType.Peek]($clients):
```ts
[[include:GlobalEventHandler.getEvent.lock.example-code]]
```

Then after processing the event, service has to delete it:
```ts
[[include:GlobalEventHandler.getEvent.delete.example-code]]
```

# Create a Global Events Listener
[GlobalEventHandler.createListener]($clients) can be used to handle repeated calls to [GlobalEventHandler.getEvent]($clients) and [GlobalEventHandler.getSASToken]($clients). Listener will use always delete events when retrieving them. If you want to use non-destructive [GlobalEventHandler.getEvent]($clients), see [getting events](#getting-global-events).

Authentication callback example, similar to [getting access token]($docs/learning/common/AccessToken.md). [AuthorizationToken]($clients) could be retrieved from credentials stored somewhere else or refreshed before it expires.
```ts
[[include:GlobalEventHandler.createListener.authenticate.example-code]]
```

Listener callback example. This callback just logs the type of the [IModelHubGlobalEvent]($clients) received.
```ts
[[include:GlobalEventHandler.createListener.callback.example-code]]
```

To create the listener itself, user has to have a [global event subscription](#creating-global-events-subscription).
```ts
[[include:GlobalEventHandler.createListener.create.example-code]]
```

Deleting the listener after it's no longer necessary is just calling the callback received when creating it.
```ts
[[include:GlobalEventHandler.createListener.delete.example-code]]
```

Event listener will work in the background, continuously getting events for a specific [GlobalEventSubscription]($clients). Once an [IModelHubGlobalEvent]($clients) is received, all registered listener callbacks for that subscription are called. If [GlobalEventSAS]($clients) expires, [GlobalEventHandler.getSASToken]($clients) will be called automatically. If [AccessToken]($clients) expires, authentication callback will be called to refresh that token.

Event listener will stop if there's an error getting events for that subscription or when all listeners for it are deleted. In the latter case, any outstanding long polling requests could still complete.

Listeners for the same subscription will only make a single event request at a time. Listeners for different subscriptions work independently.
