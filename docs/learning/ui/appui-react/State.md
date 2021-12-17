# State

[State]($appui-react:State) refers to the runtime application state that is managed by the Redux store. For detailed information about Redux and its API see  [Redux](https://redux.js.org/).

## Reducer Registry

The [ReducerRegistry]($appui-react) class provides a registry of individual reducers that are used to define names actions dispatched to change the state of the Redux store. The use of the Reducer Registry allows the redux store to be incrementally constructed as different code is loaded.  This allows independently developed packages to register their specific reducers without the parent application having to know at build time that the Redux store should include reducers from the other modules. As reducers are registered the [StateManager]($appui-react) is informed of them and the StageManager will combine the new reducer with all the existing reducers and update the Redux store.

## StateManager

The [StateManager]($appui-react) manages a collection of Reducers. There is a default set of reducers specified when the StateManager is created. The StateManager will combine these default reducers with dynamically specified reducers registered using the call to method `ReducerRegistryInstance.registerReducer`. The StateManager also provides a store property `StateManager.store` that will return the current Redux store.

## Example of Defining Initial Set of Reducers

The following is an example of an application initializing the StateManager. If the FrameworkReducer is not specified when the StateManager is constructed it will be automatically added. If specified the name of the FrameworkReducer must be `frameworkState`.

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

## Example of Defining Dynamic Reducer needed by a Package

The code snippet below defines a class that provides a Reducer and registers it with the ReducerRegistry in its initialize `SamplePackageStateManager.method`. Note that the createActionName method return a lowercase string, this allows the action name to serve as the SyncUiEventId when the state is changed via a call to ([UiFramework.dispatchActionToStore]($appui-react)).

```ts
// Class that specifies Redux Reducer for a package
interface ISamplePackageState {
  packageUiVisible?: boolean;
}

class SamplePackageStateManager {
  public static packageStateManagerLoaded = false;

  private static _initialState: ISamplePackageState = {
    packageUiVisible: true,
  };

  private static _reducerName = "samplePackageState";

  public static SET_PACKAGE_UI_VISIBLE = SamplePackageStateManager.createActionName("SET_PACKAGE_UI_VISIBLE");

  private static _packageActions: ActionCreatorsObject = {
    setDialogVisible: (packageUiVisible: boolean) =>
      createAction(SamplePackageStateManager.SET_PACKAGE_UI_VISIBLE, packageUiVisible),
  };

  private static createActionName(name: string) {
    // convert to lower case so it can serve as a sync event when called via UiFramework.dispatchActionToStore
    return `${SamplePackageStateManager._reducerName}:${name}`.toLowerCase();
  }

  // reducer
  public static reducer(
    state: ISamplePackageState = SamplePackageStateManager._initialState,
    action: any,
  ): ISamplePackageState {
    type PackageActionsUnion = ActionsUnion<typeof SamplePackageStateManager._packageActions>;

    const packageActionsParam = action as PackageActionsUnion;

    switch (packageActionsParam.type) {
      case SamplePackageStateManager.SET_PACKAGE_UI_VISIBLE:
        return { ...state, packageUiVisible: action.payload };
      default:
        return state;
    }
  }

  public static initialize() {
    ReducerRegistryInstance.registerReducer(
      SamplePackageStateManager._reducerName,
      SamplePackageStateManager.reducer,
    );
    SamplePackageStateManager.packageStateManagerLoaded = true;
  }

  public static get isPackageUiVisible(): boolean {
    if (StateManager.isInitialized()) {
      return StateManager.store.getState().samplePackageState.packageUiVisible;
    } else {
      return false;
    }
  }

  public static set isPackageUiVisible(visible: boolean) {
    // dispatch both action to update store and UiSyncEvent.
    UiFramework.dispatchActionToStore(SamplePackageStateManager.SET_PACKAGE_UI_VISIBLE, visible, true);
  }
}
```
