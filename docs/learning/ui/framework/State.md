# State

[State]($appui-react:State) refers to the runtime application state that is managed by the Redux store. For detailed information about Redux and its API see  [Redux](https://redux.js.org/).

## Reducer Registry

The [ReducerRegistry]($appui-react) class provides a registry of individual reducers that are used to define names actions which are dispatched to change the state of the Redux store. The use of the Reducer Registry allow the redux store to be incrementally constructed as different code is loaded.  This allows independently developed packages or plugin to register their specific reducers without the parent application having to know at build time that the Redux store should include reducers from the other modules. As reducers are registered the [StateManager]($appui-react) is informed of them and the StageManager will combine the new reducer with all the existing reducers and update the Redux store.

## StateManager

The [StateManager]($appui-react) manages a collection of Reducers. There are a default set of reducers that are specified when the StateManager is created. The StateManage will combine these default reducers with dynamically specified reducers register using the call to method `ReducerRegistryInstance.registerReducer`. The StateManager also provide a store property `StateManager.store` that will return the current Redux store.

## Example of Defining Initial Set of Reducers

The following is an example of a application initialize the StateManager. If the FrameworkReducer is not specified when the StateManager is constructed it will be automatically added. If specified the name of the FrameworkReducer must be `frameworkState`.

```ts
export class MyIModelApp {
  private static _appStateManager: StateManager | undefined;
  ...

  public static startup(opts?: IModelAppOptions): void {
  ...
    if (!this._appStateManager) {
      this._appStateManager = new StateManager({
        myAppState: MyAppReducer,
        frameworkState: FrameworkReducer,
      });
    }
    ...
  }
}
```

## Example of Defining Dynamic Reducer needed by a Plugin

The code snippet below defines a class that provides a Reducer and registers it with the ReducerRegistry in its initialize `SampleExtensionStateManager.method`. Note that the createActionName method return a lowercase string, this allows the action name to server as the SyncUiEventId when the state is changed via a call to ([UiFramework.dispatchActionToStore]($appui-react)).

```ts
// Class that specifies Redux Reducer for a plugin
interface ISamplePluginState {
  pluginUiVisible?: boolean;
}

class SampleExtensionStateManager {
  public static pluginStateManagerLoaded = false;

  private static _initialState: ISamplePluginState = {
    pluginUiVisible: true,
  };

  private static _reducerName = "samplePluginState";

  public static SET_EXTENSION_UI_VISIBLE = SampleExtensionStateManager.createActionName("SET_EXTENSION_UI_VISIBLE");

  private static _extensionActions: ActionCreatorsObject = {
    setDialogVisible: (pluginUiVisible: boolean) =>
      createAction(SampleExtensionStateManager.SET_EXTENSION_UI_VISIBLE, pluginUiVisible),
  };

  private static createActionName(name: string) {
    // convert to lower case so it can serve as a sync event when called via UiFramework.dispatchActionToStore
    return `${SampleExtensionStateManager._reducerName}:${name}`.toLowerCase();
  }

  // reducer
  public static reducer(
    state: ISamplePluginState = SampleExtensionStateManager._initialState,
    action: any,
  ): ISamplePluginState {
    type ExtensionActionsUnion = ActionsUnion<typeof SampleExtensionStateManager._extensionActions>;

    const pluginActionsParam = action as ExtensionActionsUnion;

    switch (pluginActionsParam.type) {
      case SampleExtensionStateManager.SET_EXTENSION_UI_VISIBLE:
        return { ...state, pluginUiVisible: action.payload };
      default:
        return state;
    }
  }

  public static initialize() {
    ReducerRegistryInstance.registerReducer(
      SampleExtensionStateManager._reducerName,
      SampleExtensionStateManager.reducer,
    );
    SampleExtensionStateManager.pluginStateManagerLoaded = true;
  }

  public static get isExtensionUiVisible(): boolean {
    if (StateManager.isInitialized()) {
      return StateManager.store.getState().samplePluginState.pluginUiVisible;
    } else {
      return false;
    }
  }

  public static set isExtensionUiVisible(visible: boolean) {
    // dispatch both action to update store and UiSyncEvent.
    UiFramework.dispatchActionToStore(SampleExtensionStateManager.SET_EXTENSION_UI_VISIBLE, visible, true);
  }
}
```
