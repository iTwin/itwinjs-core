# State

[State]($ui-framework:State) refers to the runtime application state that is managed by the Redux store. For detailed information about Redux and its API see  [Redux](https://redux.js.org/).

## Reducer Registry

The [ReducerRegistry]($ui-framework) class provides a registry of individual reducers that are used to define names actions which are dispatched to change the state of the Redux store. The use of the Reducer Registry allow the redux store to be incrementally constructed as different code is loaded.  This allows independently developed packages or plugin to register their specific reducers without the parent application having to know at build time that the Redux store should include reducers from the other modules. As reducers are registered the [StateManager]($ui-framework) is informed of them and the StageManager will combine the new reducer with all the existing reducers and update the Redux store.

## StateManager

The [StateManager]($ui-framework) manages a collection of Reducers. There are a default set of reducers that are specified when the StateManager is created. The StateManage will combine these default reducers with dynamically specified reducers register using the call to method `ReducerRegistryInstance.registerReducer`. The StateManager also provide a store property `StateManager.store` that will return the current Redux store.

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

The code snippet below defines a class that provides a Reducer and registers it with the ReducerRegistry in its initialize `SamplePluginStateManager.method`. Note that the createActionName method return a lowercase string, this allows the action name to server as the SyncUiEventId when the state is changed via a call to ([UiFramework.dispatchActionToStore]($ui-framework)).

```ts
// Class that specifies Redux Reducer for a plugin
interface ISamplePluginState {
  pluginUiVisible?: boolean;
}

class SamplePluginStateManager {
  public static pluginStateManagerLoaded = false;

  private static _initialState: ISamplePluginState = {
    pluginUiVisible: true,
  };

  private static _reducerName = "samplePluginState";

  public static SET_PLUGIN_UI_VISIBLE = SamplePluginStateManager.createActionName("SET_PLUGIN_UI_VISIBLE");

  private static _pluginActions: ActionCreatorsObject = {
    setDialogVisible: (pluginUiVisible: boolean) =>
      createAction(SamplePluginStateManager.SET_PLUGIN_UI_VISIBLE, pluginUiVisible),
  };

  private static createActionName(name: string) {
    // convert to lower case so it can serve as a sync event when called via UiFramework.dispatchActionToStore
    return `${SamplePluginStateManager._reducerName}:${name}`.toLowerCase();
  }

  // reducer
  public static pluginReducer(
    state: ISamplePluginState = SamplePluginStateManager._initialState,
    action: any,
  ): ISamplePluginState {
    type PluginActionsUnion = ActionsUnion<typeof SamplePluginStateManager._pluginActions>;

    const pluginActionsParam = action as PluginActionsUnion;

    switch (pluginActionsParam.type) {
      case SamplePluginStateManager.SET_PLUGIN_UI_VISIBLE:
        return { ...state, pluginUiVisible: action.payload };
      default:
        return state;
    }
  }

  public static initialize() {
    ReducerRegistryInstance.registerReducer(
      SamplePluginStateManager._reducerName,
      SamplePluginStateManager.pluginReducer,
    );
    SamplePluginStateManager.pluginStateManagerLoaded = true;
  }

  public static get isPluginUiVisible(): boolean {
    if (StateManager.isInitialized()) {
      return StateManager.store.getState().samplePluginState.pluginUiVisible;
    } else {
      return false;
    }
  }

  public static set isPluginUiVisible(visible: boolean) {
    // dispatch both action to update store and UiSyncEvent.
    UiFramework.dispatchActionToStore(SamplePluginStateManager.SET_PLUGIN_UI_VISIBLE, visible, true);
  }
}
```
