# SyncUi

[SyncUi]($appui-react:SyncUi) is used to send one or more eventIds to registered listeners. These listeners are typically UI Components that listen for specific events which may require the display of the component to be refreshed.

## SyncUi Dispatcher

The [SyncUiEventDispatcher]($appui-react) is called to dispatch syncEventIds to register listeners.  The caller can choose to dispatch the syncEventId immediately ([SyncUiEventDispatcher.dispatchImmediateSyncUiEvent]($appui-react)) or the default way ([SyncUiEventDispatcher.dispatchSyncUiEvent]($appui-react)), which uses a timer. Most of the time using the timer version is preferable so multiple refreshes of the same component can be avoided. The timer version of dispatching will attempt to wait until no new syncEventIds have been dispatched before calling the registered listeners.

## Sync EventId

A SyncEventId is just a unique string that represents an action that may require the listener to refresh its display. The string should be in lower-case so the comparison of Ids can be as quick as possible. Typically an enum is used to define all the supported SyncEventIds for a sub-system.

## SyncUi Listener

A listener may be registered by adding a listener to [SyncUiEventDispatcher.onSyncUiEvent]($appui-react). This listener will be called with a Set of SyncEventId strings each time the SyncUiDispatcher has events to dispatch.  The listener must determine if they are interested in any of the dispatched event Ids. This is commonly done by calling `mySyncIds.some((value: string): boolean => args.eventIds.has(value));` where `mySyncIds` is any array of one or more strings that specify the event ids of interest. Many of the ConfigurableUi components provided in the UiFramework package allow an array of SyncUIEvent Ids to be defined. These components also typically contain the definition of a `stateFunc` which is run when an eventId of interest is encountered. These 'state' functions generate a new state for the component and if the new state is different from the current state the component is refreshed.

## Redux and SyncUi

The method `UiFramework.dispatchActionToStore` is available to both dispatch an action on the Redux store and to call `dispatchSyncUiEvent` with the same action string. This allows the Redux store to be updated allowing the SyncUiEvent listener to query the new value from it. To be consistent with the SyncUiEventIds, the action strings should be lower-cased.

## Example of Opening or Closing a Widget

The following is an example of a Widget that is open or closed when the selection set changes.
In this example, the bottom-right zone in a frontstage contains a Widget component with a `syncEventIds` prop containing `SyncUiEventId.SelectionSetChanged` and a `stateFunc` that references the `_determineWidgetStateForSelectionSet` function listed below.

```tsx
bottomRight={
  <Zone defaultState={ZoneState.Open} allowsMerging={true}
    widgets={[
      <Widget id="Properties" control={PropertyGridWidget} defaultState={WidgetState.Closed} fillZone={true}
        iconSpec="icon-properties-list" labelKey="NineZoneSample:components.properties"
        applicationData={{
          iModelConnection: NineZoneSampleApp.store.getState().sampleAppState!.currentIModelConnection,
          rulesetId: this._rulesetId,
        }}
        syncEventIds={[SyncUiEventId.SelectionSetChanged]}
        stateFunc={this._determineWidgetStateForSelectionSet}
      />,
    ]}
  />
}
```

The `_determineWidgetStateForSelectionSet` function checks the selection set and returns `WidgetState.Open` when there is a selection set or `WidgetState.Closed` when there is none. This effectively opens or closes the widget based on the selection set.

```ts
/** Determine the WidgetState based on the Selection Set */
private _determineWidgetStateForSelectionSet = (): WidgetState => {
  const activeContentControl = ContentViewManager.getActiveContentControl();
  if (activeContentControl && activeContentControl.viewport && (activeContentControl.viewport.view.iModel.selectionSet.size > 0))
    return WidgetState.Open;
  return WidgetState.Closed;
}
```
