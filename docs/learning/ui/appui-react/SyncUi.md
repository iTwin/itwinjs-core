# SyncUi

[SyncUi]($appui-react:SyncUi) is used to send one or more eventIds to registered listeners. These listeners are typically UI Components that listen for specific events which may require the display of the component to be refreshed.

## SyncUi Dispatcher

The [SyncUiEventDispatcher]($appui-react) is called to dispatch syncEventIds to register listeners.  The caller can choose to dispatch the syncEventId immediately ([SyncUiEventDispatcher.dispatchImmediateSyncUiEvent]($appui-react)) or the default way ([SyncUiEventDispatcher.dispatchSyncUiEvent]($appui-react)), which uses a timer. Usually, the timer version is preferable so multiple refreshes of the same component can be avoided. Dispatching with the timer will attempt to wait until no new syncEventIds have been dispatched before calling the registered listeners.

## Sync EventId

A SyncEventId is just a unique string that represents an action that may require the listener to refresh its display. The string should be in lower-case so the comparison of Ids can be as quick as possible. Typically an enum is used to define all the supported SyncEventIds for a sub-system.

## SyncUi Listener

A listener may be registered by adding a listener to [SyncUiEventDispatcher.onSyncUiEvent]($appui-react). This listener will be called with a Set of SyncEventId strings each time the SyncUiDispatcher has events to dispatch.  The listener must determine if they are interested in any of the dispatched event Ids. This is commonly done by calling `mySyncIds.some((value: string): boolean => args.eventIds.has(value));` where `mySyncIds` is any array of one or more strings that specify the event ids of interest. Many of the ConfigurableUi components provided in the UiFramework package allow an array of SyncUIEvent Ids to be defined. These components also typically contain the definition of a `stateFunc` which is run when an eventId of interest is encountered. These 'state' functions generate a new state for the component and if the new state is different from the current state the component is refreshed.

## Redux and SyncUi

The method `UiFramework.dispatchActionToStore` is available to both dispatch an action on the Redux store and to call `dispatchSyncUiEvent` with the same action string. This allows the Redux store to be updated allowing the SyncUiEvent listener to query the new value from it. To be consistent with the SyncUiEventIds, the action strings should be lower-cased.
