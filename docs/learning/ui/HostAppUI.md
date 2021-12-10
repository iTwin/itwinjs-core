# Creating an iModelApp that supports Extensible UI

The following topics provide information to help ensure the host iModelApp is properly set up to support packages to augment the basic set of UI component it provides.

## StateManager and ReducerRegistry

Redux is a common package used for maintaining state data in front-end web applications. To allow packages to also use [Redux](https://redux.js.org/) the appui-react package provides the [StateManager]($appui-react) and [ReducerRegistry]($appui-react).  The host app should not create the store itself using the function [createStore](https://redux.js.org/api/createstore) from Redux, but should instead instantiate a StateManager object passing in the set of reducers needed for its own state.  It should not typically include reducers from packages. The StateManager instance will register with the ReducerRegistry to be informed when a Reducer is added to the registry and it will do the work of combining all Reducers into a single Redux store.

See example [StateManager](./appui/appui&#8209;react/State.md#Example&#8209;of&#8209;Defining&#8209;Initial&#8209;Set&#8209;of&#8209;Reducers)

## Building UI using Modular Packages

Any package can provide a class that implements the UiItemsProvider interfaces to add UI items to the host application by registering its UiItemsProvider(s) when it is initialized. Items provided at runtime may be inserted into a Toolbar, StatusBar, Backstage or Widget Panel.

See example [UiItemsProvider](./abstract/UiItemsProvider.md#UiItemsProvider&#8209;Example) implementation.

UI item definitions for Toolbars, Status Bar, and Backstage specify an item priority value. This value is used to order the items in the parent container. It is suggested that an increment of 10 is used between items in the host application. This provides the opportunity for packages to insert their items adjacent to host application items.

## Toolbars

Toolbars provide tool buttons that start registered Tools, execute defined functions, or show a grouping of tools.  Both Horizontal and Vertical toolbars are allowed. The Content Manipulation Tools (also referred to as the ToolsWidget) are displayed on the left side of the content area the View Navigation Tools (also referred to as the NavigationWidget) are displayed on the right.

ToolWidgets should use the ToolWidgetComposer and specify toolbars using the ToolbarComposer component as shown below.

```tsx
<ToolWidgetComposer className={className}
      cornerItem={<BackstageAppButton icon={icon} />}
      horizontalToolbar={<ToolbarComposer items={horizontalItems} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Horizontal} />}
      verticalToolbar={<ToolbarComposer items={verticalItems} usage={ToolbarUsage.ContentManipulation} orientation={ToolbarOrientation.Vertical} />}
    />
 ```

The cornerItem is optional and can be removed if the application is providing a different mechanism to open the backstage. The specification of the icon for the AppButton is also optional, if not specified the 'home' icon is used.

Likewise the NavigationWidget should use the NavigationWidgetComposer.

```tsx
    <NavigationWidgetComposer className={className}
      horizontalToolbar={<ToolbarComposer items={horizontalItems} usage={ToolbarUsage.ViewNavigation} orientation={ToolbarOrientation.Horizontal} />}
      verticalToolbar={<ToolbarComposer items={verticalItems} usage={ToolbarUsage.ViewNavigation} orientation={ToolbarOrientation.Vertical} />}
    />
 ```

The ToolbarComposer class used above will automatically provide an overflow button if specified buttons will not fit in the allowable space. The items passed to ToolbarComposer define properties that satisfy the ToolbarItem interface. This interface supports buttons that initiate an action (ActionButton), buttons that contain a list of child actions (GroupButton), or a CustomButtonDefinition that can be used to specify React specific definitions. The appui-react package contains the [ToolbarHelper]($appui-react) class that will generate items of the proper type given a item definitions used in many toolbars in 1.x of iModeljs.

Both the original item definitions, like ToolItemDef and the newer ToolbarItems definitions support the conditional display of a tool in the toolbar. In fact, the tool button label and icon can also be determined conditionally. There are several examples of specifying conditionals in [CoreTools]($appui-react). Below is one example.  In this case we want to use a different icon based on the viewports current ViewState. If the camera is on in the "active" view then the web-font icon "icon-camera-animation" is to be used else the web-font icon "icon-camera-animation-disabled" is displayed. The [ConditionalStringValue]($appui-abstract) also specifies the SyncUiEventIds that will trigger the conditional function to be re-run.

```ts
  public static get toggleCameraViewCommand() {
    return new ToolItemDef({
      toolId: ViewToggleCameraTool.toolId,
      iconSpec: new ConditionalStringValue(() => {
        const activeContentControl = ContentViewManager.getActiveContentControl();
        if (activeContentControl?.viewport?.view.is3d() && activeContentControl?.viewport?.isCameraOn)
          return "icon-camera-animation";
        return "icon-camera-animation-disabled";
      }, [SyncUiEventId.ActiveContentChanged, SyncUiEventId.ActiveViewportChanged, SyncUiEventId.ViewStateChanged]),
      label: ViewToggleCameraTool.flyover,
      description: ViewToggleCameraTool.description,
      isHidden: new ConditionalBooleanValue(() => {
        const activeContentControl = ContentViewManager.getActiveContentControl();
        return !(activeContentControl?.viewport?.view.is3d() && activeContentControl?.viewport?.view.supportsCamera());
      }, [SyncUiEventId.ActiveContentChanged, SyncUiEventId.ActiveViewportChanged, SyncUiEventId.ViewStateChanged]),
      execute: () => { IModelApp.tools.run(ViewToggleCameraTool.toolId, IModelApp.viewManager.selectedView); },
    });
  }
```

The isHidden property above is specified as a [ConditionalBooleanValue]($appui-abstract) where it evaluates to true if the active view does not support camera usage. For more information on SyncUiEvents see [SyncUi](./appui/appui&#8209;react/Syncui).

## StatusBar

To ensure that packages can add items to the status bar the [StatusBarWidgetControl]($appui-react) must return the
[StatusBarComposer]($app
ui-react) from the getReactNode method. Here is an [example](./appui/appui&#8209;react/StatusBar) of defining a status bar.  Each status bar item definition specifies its position in the status bar using item priority and StatusBarSection.

## Backstage

The Backstage is a menu used to open frontstages and launch commands. It can also open full-screen overlays, or modal stages, presenting application settings and data management to the user. Applications and packages supply Backstage items definition that are combined by the [BackstageComposer]($appui-react) component to generate the Backstage menu. The Backstage menu is passed as props to the ConfigurableUiContent which is in charge of managing the display of frontstages. Here is an [example](./appui/appui&#8209;react/Backstage.md#Defining&#8209;the&#8209;Backstage) of how applications typically define their backstage.

## Selection Context Tools

The appui-react package provide item definitions that can be used to insert a standard set of tool buttons that allow the user to hide, isolate, or emphasize the elements in the active selection set. If the active selection set is empty the tools are not displayed.  These tools are available when using the [BasicToolWidget]($appui-react) or if the stage developer adds the definitions to the items list for the [ToolWidgetComposer]($appui-react) when defining the stage's tool widget.  Below is an excerpt of code that uses the core definitions to specify tool buttons.

```tsx
  if (useCategoryAndModelsContextTools) {
    items.push(
      ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.clearSelectionItemDef),
      ToolbarHelper.createToolbarItemFromItemDef(20, SelectionContextToolDefinitions.clearHideIsolateEmphasizeElementsItemDef),
      ToolbarHelper.createToolbarItemFromItemDef(30, SelectionContextToolDefinitions.hideSectionToolGroup),
      ToolbarHelper.createToolbarItemFromItemDef(40, SelectionContextToolDefinitions.isolateSelectionToolGroup),
      ToolbarHelper.createToolbarItemFromItemDef(50, SelectionContextToolDefinitions.emphasizeElementsItemDef),
    );
  } else {
    items.push(
      ToolbarHelper.createToolbarItemFromItemDef(10, CoreTools.clearSelectionItemDef),
      ToolbarHelper.createToolbarItemFromItemDef(20, SelectionContextToolDefinitions.clearHideIsolateEmphasizeElementsItemDef),
      ToolbarHelper.createToolbarItemFromItemDef(30, SelectionContextToolDefinitions.hideElementsItemDef),
      ToolbarHelper.createToolbarItemFromItemDef(40, SelectionContextToolDefinitions.isolateElementsItemDef),
      ToolbarHelper.createToolbarItemFromItemDef(50, SelectionContextToolDefinitions.emphasizeElementsItemDef),
    );
  }
```

The default processing of these tools are to modify only on the "active" ScreenViewport. There may be special cases where the application may want to apply the hide, isolate, or emphasize processing to more than a single viewport.  When this is the case, the application can register a handler to call once the active viewport is processed. Below is an example of registering a handler.

```ts
HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.addListener(this._onEmphasizeElementsChangedHandler);
```

Below is an example of applying the processing to other viewports.

```tsx
  private async applyVisibilityOverrideToSpatialViewports(frontstageDef: FrontstageDef, processedViewport: ScreenViewport, action: HideIsolateEmphasizeAction) {
    frontstageDef?.contentControls?.forEach(async (cc) => {
      const vp = cc.viewport;
      if (vp !== processedViewport && vp?.view?.isSpatialView() && vp.iModel === processedViewport.iModel) {
        switch (action) {
          case HideIsolateEmphasizeAction.ClearHiddenIsolatedEmphasized:
            HideIsolateEmphasizeManager.clearEmphasize(vp);
            break;
          case HideIsolateEmphasizeAction.EmphasizeSelectedElements:
            await HideIsolateEmphasizeManager.emphasizeSelected(vp);
            break;
          case HideIsolateEmphasizeAction.HideSelectedCategories:
            await HideIsolateEmphasizeManager.hideSelectedElementsCategory(vp);
            break;
          case HideIsolateEmphasizeAction.HideSelectedElements:
            HideIsolateEmphasizeManager.hideSelected(vp);
            break;
          case HideIsolateEmphasizeAction.HideSelectedModels:
            await HideIsolateEmphasizeManager.hideSelectedElementsModel(vp);
            break;
          case HideIsolateEmphasizeAction.IsolateSelectedCategories:
            await HideIsolateEmphasizeManager.isolateSelectedElementsCategory(vp);
            break;
          case HideIsolateEmphasizeAction.IsolateSelectedElements:
            HideIsolateEmphasizeManager.isolateSelected(vp);
            break;
          case HideIsolateEmphasizeAction.IsolateSelectedModels:
            await HideIsolateEmphasizeManager.isolateSelectedElementsModel(vp);
            break;
          default:
            break;
        }
      }
    });
  }
```
