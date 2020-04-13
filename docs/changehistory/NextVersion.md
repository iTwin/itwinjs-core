---
ignore: true
---
# NextVersion

## Update to iModel.js Build System

The iModel.js 1.0 build system relied on a single package (`@bentley/webpack-tools`) to build iModel.js backends, frontends and plugins.  With the release of 2.0, there are significant improvements to the build system to help with both clarity and usability to make creating an app based on the latest technologies easier.  To aid in this, the build system is now split into 3 separate components:

- Build of an iModel.js backend, and agent, with the `@bentley/backend-webpack-tools`
- Webpack/bundling of an iModel.js Extension (formerly Plugin) with `@bentley/extension-webpack-tools`
- The iModel.js frontend build system is now using Create-React-App as its base.  More details in the [iModel.js frontend build updates](#frontend-build-updates)

### Frontend Build Updates

Quick overview... create-react-app (CRA) is a very popular way to start writing React applications and is actually maintained by Facebook (the creators/maintainers of React).  React-scripts is the webpack/build configuration that is used by CRA and therefore most react-based applications.

There are a lot of details about CRA and how it works on their website [here](https://create-react-app.dev/).  Then more information in the [README](https://dev.azure.com/bentleycs/iModelTechnologies/_git/react-scripts?path=%2FREADME-bentley.md&version=GBbentley) for the Bentley/iModel.js fork of the react-scripts and why we need/want it.

Here I'd like to cover just the changes made to our current test-apps to make compatible with CRA/react-scripts.  One of the main principles of CRA is that you have a `src` folder with a `index.ts` at the root, which is the entry point of an app, and a `public` folder with a `index.html` at the root.  Everything within the `src` folder is then subject to webpacking, including all of the assets that are parsed via loader (i.e. scss, css, json, etc.), and everything in the `public` folder is expected to live at the webroot when it's deployed so it's copied into the build output appropriately.

With the above in mind, the quickest/easiest migration pattern for all existing apps is,

1. Move the current `index.html`, that now most likely lives within `src/frontend/index.html`, to `public/index.html`
1. Update the `index.html` to remove the following lines,

    ```html
    <!-- check the browser to verify it is supported. -->
    <script type="text/javascript" src="v<%= htmlWebpackPlugin.options.loaderVersion %>/checkbrowser.js"></script>

    <script type="text/javascript" src="v<%= htmlWebpackPlugin.options.runtimeVersion %>/runtime.js"></script>
    <script type="text/javascript" src="v<%= htmlWebpackPlugin.options.loaderVersion %>/IModelJsLoader.js"
    data-imjsversions='<%= htmlWebpackPlugin.options.imjsVersions %>'></script>
    ```

   and replace it with,

    ```html
    <script type="text/javascript" src="%PUBLIC_URL%/scripts/checkbrowser.js"></script>
    ```

1. Add a `src/index.ts` file which references the current entry point of your app.  For example, if the entry point is currently, `./src/frontend/index.ts`, then the new `./src/index.ts` will be as simple as the new [ui-test-app/src/index.ts](https://dev.azure.com/bentleycs/iModelTechnologies/_git/imodeljs/pullrequest/74170?_a=files&path=%2Ftest-apps%2Fui-test-app%2Fsrc%2Findex.ts) file

## Update to Electron 8

iModel.js has officially moved up to the [latest stable version](https://www.electronjs.org/docs/tutorial/electron-timelines) of Electron.

## 3D Globe Background Map Display

The background map can now be displayed as either a plane or a three-dimensional globe. This is controlled by the [GlobeMode]($common) property of the [DisplayStyleSettings.backgroundMap]($common) associated with a [DisplayStyleState]($frontend) or [DisplayStyle]($backend).

* [GlobeMode.Plane]($common) projects the map onto the XY plane.
* [GlobeMode.Ellipsoid]($common) - the default mode - projects the map onto the [WGS84](https://en.wikipedia.org/wiki/World_Geodetic_System) ellipsoid when sufficiently zoomed-out.

In Plane mode, or in 3d mode when sufficiently zoomed-in on the iModel, the iModel's [geographic coordinate system](https://www.imodeljs.org/learning/geolocation/#the-geographic-coordinate-system) is used to transform the map into the iModel's coordinate space.

![Plane mode](assets/ColumbusMapProjection.png)
<p align="center">Plane mode</p>

![Globe mode](assets/3DMapProjection.png)
<p align="center">Ellipsoid mode</p>

### Globe View Tools

The following are view tools that allow a user to navigate a plane or three-dimensional globe. All of these tools operate on the selected view.

* [ViewGlobeSatelliteTool]($frontend) views a location on the background map from a satellite's perspective; the viewed location is derived from the position of the current camera's eye above the map.
* [ViewGlobeBirdTool]($frontend) views a location on the background map from a bird's eye perspective; the viewed location is derived from the position of the current camera's eye above the globe.
* [ViewGlobeLocationTool]($frontend) views a location on the background map corresponding to a specified string. This will either look down at the location using a bird's eye height, or, if a range is available, the entire range corresponding to the location will be viewed.
* [ViewGlobeIModelTool]($frontend) views the current iModel on the background map so that the extent of the project is visible.

[ViewGlobeSatelliteTool]($frontend), [ViewGlobeBirdTool]($frontend), and [ViewGlobeIModelTool]($frontend) run in the following manner:

* The tool, once constructed, will execute when its `onDataButtonDown` or `onPostInstall` methods are called.
* `onDataButtonDown` will execute the tool if its `BeButtonEvent` argument has a defined `viewport` property. It will use that viewport.
* `onPostInstall` will use the viewport specified in the tool's constructor. If that does not exist, it will use `IModelApp.viewManager.selectedView`.

[ViewGlobeLocationTool]($frontend) runs in the following manner:

* The tool, once constructed, will execute when its `parseAndRun` method is called.
* To navigate to a precise latitude/longitude location on the map, specify exactly two numeric arguments to `parseAndRun`. The first will be the latitude and the second will be the longitude. These are specified in degrees.
* To search for and possibly navigate to a named location, specify any number of string arguments to `parseAndRun`. They will be joined with single spaces between them. If a location corresponding to the joined strings can be found, the tool will navigate there.

## Customizable Scene Lighting

Previously, lighting of 3d scenes was entirely hard-coded with the exception of the sun direction used only when shadows were enabled. Now, nearly all lighting parameters can be customized using the [LightSettings]($common) associated with a [DisplayStyle3dSettings]($common). This includes new support for hemisphere lighting, greatly expanding the variety of display styles that can be achieved.

![Example display styles](assets/display-styles.jpg)
<p align="center">Clockwise from top-left: Default, Illustration, Sun-dappled, Moonlit, Glossy, Soft</p>

## Monochrome Mode

iModel.js now supports two monochrome display modes via [DisplayStyleSettings.monochromeMode]($common). The original mode, `Scaled`, preserves contrast and material textures. The new mode, `Flat`, applies the monochrome color uniformly to all surfaces.

![Scaled (left) vs Flat (right) monochrome modes](assets/monochrome-mode.png)
<p align="center">Scaled (left) vs Flat (right) monochrome modes</p>

## Colorizing Clip Regions

[Viewport]($frontend) now contains the following properties which control the color of pixels outside or inside a clip region. If either of these are defined, the corresponding pixels will be shown using the specified color; otherwise, no color override occurs and clipping proceeds normally for that area of the clip region. By default, these are both undefined.

* `outsideClipColor` - Either a [ColorDef]($common) or undefined. This setting controls the color override for pixels outside a clip region.
* `insideClipColor` - Either a [ColorDef]($common) or undefined. This setting controls the color override for pixels inside a clip region.

![Clipped geometry drawn in yellow](assets/section-color.png)
<p align="center">Clipped geometry drawn in yellow - arrow indicates direction of clip plane</p>

## Incremental Precompilation of Shaders

Previously, shader programs used by the [RenderSystem]($frontend) were never compiled until the first time they were used. This could produce very noticeable delays when the user interacts with a [Viewport]($frontend). The [RenderSystem]($frontend) can now precompile shader programs before any [Viewport]($frontend) is opened.

* To enable this functionality, set the `doIdleWork` property of the `RenderSystem.Options` object passed to `IModelApp.startup` to true.
* Applications should consider enabling this feature if they do not open a Viewport immediately upon startup - for example, if the user is first expected to select an iModel and  a view through the user interface.
* Shader precompilation will cease once all shader programs have been compiled, or when a Viewport is opened (registered with the [ViewManager]($frontend)).

## Thematic Display

[ViewFlags]($common) now contains a `thematicDisplay` property of type `boolean`; when set to `true`, this will enable thematic display for surfaces.
* The thematic display will be configured based on the `thematic` property of type [ThematicDisplay]($common) on [DisplayStyle3dSettings]($common).
  * This property controls the thematic display settings of the 3d display style when thematic display is enabled.
  * [ThematicDisplay]($common) is immutable and must be constructed and altered using an underlying JSON representation. See the corresponding underlying [ThematicDisplayProps]($common) on the [DisplayStyle3dSettingsProps]($common).
* Within the `gradientSettings` property on [ThematicDisplay]($common), the display system currently supports a `mode` value of `ThematicGradientMode.Smooth` of type [ThematicGradientMode]($common). Using this mode, the color gradient will be smoothly interpolated based on the value specified for `colorScheme` on the `gradientSettings` property of [ThematicDisplay]($common). If the `colorScheme` property of `gradientSettings` is `ThematicGradientColorScheme.Custom`, then the `customKeys` property must be properly configured with values.
* For the `displayMode` property of [ThematicDisplay]($common), the display system currently supports a value of `ThematicDisplayMode.Height`. Using this mode, the color gradient will be mapped to surface geometry based on world height in meters.

See the following snippet for the JSON representation of a [ThematicDisplay]($common) configuration object:

```ts
/** JSON representation of the thematic display setup of a [[DisplayStyle3d]].
 * @beta
 */
export interface ThematicDisplayProps {
  /** The thematic display mode. This determines how to apply the thematic color gradient to the geometry. Defaults to [[ThematicDisplayMode.Height]]. */
  displayMode?: ThematicDisplayMode;
  /** The settings used to create a color gradient applied to the geometry. The mode currently must be [[Gradient.ThematicMode.Smooth]]. Defaults to an instantiation using [[ThematicGradientSettings.fromJSON]] with no arguments. */
  gradientSettings?: ThematicGradientSettingsProps;
  /** The range in which to apply the thematic gradient. For [[ThematicDisplayMode.Height]], this is world space in meters. Defaults to a null range. */
  range?: Range1dProps;
  /** For [[ThematicDisplayMode.Height]], this is the axis along which to apply the thematic gradient in the scene. Defaults to {0,0,0}. */
  axis?: XYZProps;
}
```

Consult the following code example demonstrating how to enable thematic display and configure the thematic display:

```ts
const _scratchViewFlags = new ViewFlags();

const isThematicDisplaySupported = (view: ViewState) => view.is3d();

function enableAndConfigureThematicDisplay(viewport: Viewport): boolean {
  const view = viewport.view;

  if (!isThematicDisplaySupported(view))
    return false; // Thematic display settings are only valid for 3d views

  // Clone and reconfigure the Viewport's viewFlags to have thematic display enabled
  const vf = viewport.viewFlags.clone(_scratchViewFlags);
  vf.thematicDisplay = true;
  viewport.viewFlags = vf;

  // Create a ThematicDisplayProps object with the desired thematic settings
  const thematicProps: ThematicDisplayProps = {
    displayMode: ThematicDisplayMode.Height, // The only currently supported thematic display mode
    gradientSettings: {
      mode: ThematicGradientMode.Smooth, // The only currently supported thematic gradient mode
      stepCount: 0, // Only relevant for ThematicGradientMode.Stepped, which is currently unsupported.
      marginColor: new ColorDef(ColorByName.blanchedAlmond), // The color used when outside the range to apply the gradient
      colorScheme: ThematicGradientColorScheme.BlueRed, // The color scheme used to construct the gradient; if using ThematicColorScheme.Custom, must also specify customKeys property.
    },
    range: { low: -900.0, high: 1000.0 }, // For ThematicDisplayMode.Height, the range in world meters to apply the gradient
    axis: [0.0, 0.0, 1.0], // For ThematicDisplayMode.Height, the axis (direction) along which to apply the gradient (Up along Z in this case)
  };

  // Create a ThematicDisplay object using the props created above
  const thematicDisplay = ThematicDisplay.fromJSON(thematicProps);

  // Change the thematic object on the 3d display style state to contain the new object
  (view as ViewState3d).getDisplayStyle3d().settings.thematic = thematicDisplay;

  // Sync the viewport with the new view state
  viewport.synchWithView();
}
```
![Thematic height mode with a smooth "sea mountain" color gradient applied to surfaces](assets/ThematicDisplay_HeightSmooth.png)
<p align="center">Thematic height mode with a smooth "sea mountain" color gradient applied to surfaces</p>

## Opening iModels

The API now allows opening iModels (briefcases) at the backend with a new [SyncMode.pullOnly]($backend) option. e.g.,
```ts
const iModel = await BriefcaseDb.open(requestContext, projectId, iModelId, OpenParams.pullOnly());
```
* Opening with this new option establishes a local briefcase that allows change sets to be pulled from the iModel Hub and merged in. e.g.,
  ```ts
  iModel.pullAndMergeChanges(requestContext, IModelVersion.latest());
  ```
*  Upon open a new briefcase is *acquired* from the iModel Hub and is meant for exclusive use by that user.
* The briefcase is opened ReadWrite to allow merging of change sets even if no changes can be made to it.

## Solar Calculation APIs

The solar calculation functions [calculateSolarAngles]($common), [calculateSolarDirection]($common), and [calculateSunriseOrSunset]($common) have moved from imodeljs-frontend to imodeljs-common.

## Deprecation Errors

Previously, the default tslint configuration reported [usage of deprecated APIs](https://palantir.github.io/tslint/rules/deprecation/) as warnings. It will now produce errors instead. Before deprecating an API, please first remove all usage of it within the iModel.js repository.

## Breaking API changes

With a new major version of the iModel.js library come breaking API changes. The majority of those changes result from the removal of previously deprecated APIs. In addition, the following APIs have changed in ways that may require calling code to be adjusted:

### Authorization

* The deprecated SAML based authentication utilities, ImsActiveSecureTokenClient and ImsDelegationSecureTokenClient have now been removed. All authentication must be done using OIDC.
* The deprecated OidcAgentClientV1 for SAML based authentication of agents has been removed.

#### OidcBrowserClient

OIDC functionality in the browser has been overhauled to better support iModel.js Extensions that might require the user to authenticate with other services.

- [IOidcFrontendClient](/core/clients/src/oidc/OidcFrontendClient.ts) has been supplanted by [IFrontendAuthorizationClient](/core/clients/src/oidc/IFrontendAuthorizationClient.ts)
  - All existing classes which previously implemented [IOidcFrontendClient](/core/clients/src/oidc/OidcFrontendClient.ts), now implement [IFrontendAuthorizationClient](/core/clients/src/oidc/IFrontendAuthorizationClient.ts)
    - [OidcDesktopClient](/core/backend/src/oidc/OidcDesktopClient.ts)
    - [OidcDesktopClientRenderer](/core/frontend/src/oidc/OidcDesktopClientRenderer.ts)
    - [OidcIOSClient](/core/frontend/src/oidc/OidcIOSClient.ts)
- [OidcBrowserClient](/core/frontend/src/oidc/OidcBrowserClient.ts) has been marked as `@deprecated` and split into the following classes:
  - [BrowserAuthorizationClient](/core/clients/src/oidc/browser/BrowserAuthorizationClient.ts)
    - implements [IFrontendAuthorizationClient](/core/clients/src/oidc/IFrontendAuthorizationClient.ts)
    - used to `signIn()` and `signOut()` the user, in a similar manner to [OidcBrowserClient](/core/frontend/src/oidc/OidcBrowserClient.ts)
  - [BrowserAuthorizationCallbackHandler](/core/clients/src/oidc/browser/BrowserAuthorizationCallbackHandler.ts)
    - handles (via `handleSigninCallback()`) all OIDC callbacks received as a result of `signIn()` / `signOut()` calls made by [BrowserAuthorizationClient](/core/clients/src/oidc/browser/BrowserAuthorizationClient.ts)

Previously, signing a user in through [OidcBrowserClient](/core/frontend/src/oidc/OidcBrowserClient.ts) involved the following process:

```ts
const oidcConfiguration: BrowserAuthorizationClientConfiguration = {
  clientId: "imodeljs-spa-test",
  redirectUri: "http://localhost:3000/signin-callback",
  scope: "openid email profile organization imodelhub context-registry-service:read-only product-settings-service projectwise-share urlps-third-party",
  responseType: "code",
};
const browserClient = new OidcBrowserClient(oidcConfiguration);
await browserClient.initialize(new ClientRequestContext());
await browserClient.signIn();
```

The equivalent process for signing in via [BrowserAuthorizationClient](/core/clients/src/oidc/browser/BrowserAuthorizationClient.ts):

```ts
const oidcConfiguration: BrowserAuthorizationClientConfiguration = {
  clientId: "imodeljs-spa-test",
  redirectUri: "http://localhost:3000/signin-callback",
  scope: "openid email profile organization imodelhub context-registry-service:read-only product-settings-service projectwise-share urlps-third-party",
  responseType: "code",
};
await BrowserAuthorizationCallbackHandler.handleSigninCallback(oidcConfiguration.redirectUri);
const browserClient = new BrowserAuthorizationClient(oidcConfiguration);
await browserClient.signIn();
```

Notably, unlike [OidcBrowserClient](/core/frontend/src/oidc/OidcBrowserClient.ts), [BrowserAuthorizationClient](/core/clients/src/oidc/browser/BrowserAuthorizationClient.ts) does not require a call to `initialize()` before calling `signIn()`. Once the class instance has been constructed, `signIn()` may be called at any point.
However, because [OidcBrowserClient](/core/frontend/src/oidc/OidcBrowserClient.ts)`.initialize()` was where the OIDC callback was being handled before, [BrowserAuthorizationCallbackHandler](/core/clients/src/oidc/browser/BrowserAuthorizationCallbackHandler.ts) must be used in conjunction with [BrowserAuthorizationClient](/core/clients/src/oidc/browser/BrowserAuthorizationClient.ts) to now complete an OIDC signin.

Aside from the `signIn()` function supported by all [IFrontendAuthorizationClient](/core/clients/src/oidc/IFrontendAuthorizationClient.ts) implementations, there are also three new functions specific to [BrowserAuthorizationClient](/core/clients/src/oidc/browser/BrowserAuthorizationClient.ts) — `signInSilent()`, `signInPopup()`, and `signInRedirect()` (which is an alias of `signIn()`) — allowing more flexibility in how the signin is performed.

For situations where a signin is delayed until after app startup, `signInPopup()` is encouraged as a way to direct the user towards a login page without redirecting them away from their current UI state.

Signin callbacks generated by any of the `signIn` methods can be handled easily using a single call to [BrowserAuthorizationCallbackHandler](/core/clients/src/oidc/browser/BrowserAuthorizationCallbackHandler.ts)`.handleSigninCallback()`.

### IModel, IModelConnection, IModelDb

The properties formerly under `IModel.iModelToken` have been promoted to [IModel]($common). These renames affect [IModelConnection]($frontend) and [IModelDb]($backend):

* `IModel.iModelToken.contextId` --> [IModel.contextId]($common)
* `IModel.iModelToken.iModelId` --> [IModel.iModelId]($common)
* `IModel.iModelToken.changeSetId` --> [IModel.changeSetId]($common)

And for RPC implementations, the following method has been added to replace other uses of `IModel.iModelToken`:

* [IModel.getRpcProps]($common)
  * This method returns an object of type [IModelRpcProps]($common) which replaces `IModelToken` and `IModelTokenProps` but maintains the same property names as before.

And the following method has been renamed/refactored to *find* based on a key:

* `IModelDb.find` --> [IModelDb.findByKey]

### Briefcase iModels

The methods for working with Briefcase iModels (those that are synchronized with iModelHub) have been moved into a new [BriefcaseDb]($backend) class, which is a breaking change.
The following methods have been moved from (the now abstract) [IModelDb]($backend) class:

* `IModelDb.open` --> [BriefcaseDb.open]($backend)
* `IModelDb.create` --> [BriefcaseDb.create]($backend)
* `IModelDb.pullAndMergeChanges` --> [BriefcaseDb.pullAndMergeChanges]($backend)
* `IModelDb.pushChanges` --> [BriefcaseDb.pushChanges]($backend)
* `IModelDb.reverseChanges` --> [BriefcaseDb.reverseChanges]($backend)
* `IModelDb.reinstateChanges` --> [BriefcaseDb.reinstateChanges]($backend)
* `IModelDb.concurrencyControl` --> [BriefcaseDb.concurrencyControl]($backend)

Corresponding changes have been made to the frontend. The following methods have been moved from (the now abstract) [IModelConnection]($frontend) class:

* `IModelConnection.open` --> [BriefcaseConnection.open]($frontend)

### Snapshot iModels

The methods for working with snapshot iModels have been moved into a new [SnapshotDb]($backend) class, which is a breaking change.
The following renames are required:

* `IModelDb.createSnapshot` (static) --> [SnapshotDb.createEmpty]($backend)
* `IModelDb.createSnapshot` --> [SnapshotDb.createFrom]($backend)
* `IModelDb.openSnapshot` --> [SnapshotDb.openFile]($backend)
* `IModelDb.closeSnapshot` --> [SnapshotDb.close]($backend)

Corresponding changes have been made to the frontend. The following methods have been moved from (the now abstract) [IModelConnection]($frontend) class:

* `IModelConnection.openSnapshot` --> [SnapshotConnection.openFile]($frontend)
* `IModelConnection.closeSnapshot` --> [IModelConnection.close]($frontend) (abstract) and [SnapshotConnection.close]($frontend) (concrete)

### BlankConnection

A new [BlankConnection]($frontend) subclass of of [IModelConnection]($frontend) has been introduced for working with reality data services without requiring an iModel.
The following renames are required:

* `IModelConnection.createBlank` --> [BlankConnection.create]($frontend)

### BriefcaseId / ReservedBriefcaseId

The former `BriefcaseId` class has been replaced by the [BriefcaseId]($backend) type (which is just `number`) and the [ReservedBriefcaseId]($backend) enumeration.

### GeometryStream Iteration

The [GeometryStreamIteratorEntry]($common) exposed by a [GeometryStreamIterator]($common) has been simplified down to only four members. Access the geometric primitive associated with the entry by type-switching on its `type` property. For example, code that previously looked like:

```ts
function tryTransformGeometry(entry: GeometryStreamIteratorEntry, transform: Transform): void {
  if (undefined !== entry.geometryQuery)
    return entry.geometryQuery.tryTransformInPlace(transform);

  if (undefined !== entry.textString) {
    entry.textString.transformInPlace(transform);
    return true;
  } else if (undefined !== entry.image)
    entry.image.transformInPlace(transform);
    return true;
  }
  // etc...
}
```

Is now written as:

```ts
function tryTransformGeometry(entry: GeometryStreamIteratorEntry, transform: Transform): void {
  switch (entry.primitive.type) {
    case "geometryQuery":
      // The compiler knows that entry.primitive is of type AnyGeometryQuery
      return entry.primitive.geometryQuery.tryTransformInPlace(transform);
    case "textString":
    case "image":
      // The compiler knows that entry.primitive is a TextString or an ImageGraphic, both of which have a transformInPlace() method
      entry.primitive.transformInPlace(transform);
      return true;
    // etc...
  }
}
```

### Immutable Color Types

[ColorDef]($common) is now an immutable type. Naturally, mutating methods like `setTransparency` have been removed; they are replaced by methods like `withTransparency` which return a modified copy of the original `ColorDef`. The constructor is now private; replace usage of `new ColorDef(x)` with `ColorDef.create(x)`.

[HSVColor]($common) and [HSLColor]($common) are also now immutable.

### PropertyRecord classes moved to `ui-abstract` package

This includes the classes in the following files:

* Description.ts
* EditorParams.ts
* PrimitiveTypes.ts
* Record.ts
* Value.ts

The deprecated ToolSettingsValue.ts has been removed.

### API Changes in `ui-components` Package

#### Hard-Deprecation

A couple of already `@deprecated` APIs are now being hard-deprecated by adding a `DEPRECATED_` prefix to increase consumers' awareness about future removal of the APIs:

* `Tree` to `DEPRECATED_Tree`
* `withTreeDragDrop` to `DEPRECATED_withTreeDragDrop`

As a short term solution consumers can simply do a rename when importing the module, e.g.:

```ts
import { DEPRECATED_Tree as Tree } from "@bentley/ui-components";
```

#### Removals and Changes

* Renamed `ITreeNodeLoaderWithProvider.getDataProvider()` to `ITreeNodeLoaderWithProvider.dataProvider`.
* Renamed `PagedTreeNodeLoader.getPageSize()` to `PagedTreeNodeLoader.pageSize`.
* Renamed `TreeCheckboxStateChangeEvent` to `TreeCheckboxStateChangeEventArgs`.
* Renamed `TreeNodeEvent` to `TreeNodeEventArgs`.
* Renamed `TreeSelectionModificationEvent` to `TreeSelectionModificationEventArgs`.
* Renamed `TreeSelectionReplacementEvent` to `TreeSelectionReplacementEventArgs`.
* Renamed `useModelSource` to `useTreeModelSource`.
* Renamed `useNodeLoader` to `useTreeNodeLoader`.
* Renamed `usePagedNodeLoader` to `usePagedTreeNodeLoader`.
* Changed `IPropertyValueRenderer.render` to only be allowed to return `ReactNode` (do not allow `Promise<ReactNode>` anymore). This makes the calling code much simpler at the cost of a few more complex renderers. To help handle async rendering, a helper `useAsyncValue` hook has been added. Example usage:

  ```ts
  import { useAsyncValue } from "@bentley/ui-components";
  const MyComponent = (props: { asyncValue : Promise<string> }) => {
    const value = useAsyncValue(props.asyncValue);
    return value ?? "Loading...";
  };
  ```

* Changed type of `label` attribute from `string` to `PropertyRecord` for these types:
  * `BreadcrumbNodeProps`
  * `TreeModelNode`
  * `MutableTreeModelNode`
  * `TreeModelNodeInput`

  Also removed `labelDefinition` attribute in `PropertyData` and `TreeNodeItem` in favor of `label` whose type changed from `string` to `PropertyRecord`.

  To render `PropertyRecords` we suggest using `PropertyValueRendererManager` API:

  ```ts
  import { PropertyValueRendererManager } from "@bentley/ui-components";
  const MyComponent = (props: { label: PropertyRecord }) => {
    return PropertyValueRendererManager.defaultManager.render(props.label);
  };
  ```

* Removed `HorizontalAlignment`. Use the `HorizontalAlignment` in @bentley/ui-core instead.

### API Changes in `ui-framework` Package

#### Renames

A couple of types were renamed to better match their intention:

* `VisibilityTree` to `ModelsTree`
* `IModelConnectedVisibilityTree` to `IModelConnectedModelsTree`

#### Removal of Deprecated APIs

The following items that were marked as @deprecated in the 1.x time frame have been removed:

* FrontstageDef.inheritZoneStates (never implemented in iModel.js)
* FrontstageDef.hubEnabled (never implemented in iModel.js)
* FrontstageDef.contextToolbarEnabled (never implemented in iModel.js)
* IconSpec (Use IconSpec in @bentley/ui-core instead)
* IconProps (Use IconProps in @bentley/ui-core instead)
* Icon (Use the Icon component in @bentley/ui-core instead)
* ItemDefBase.betaBadge (use badgeType instead)
* ItemProps.betaBadge  (use badgeType instead)
* WidgetDef.betaBadge (use badgeType instead)
* WidgetProps.betaBadge (use badgeType instead)

#### Other changes

* Removed `useControlledTree` flag from the following *Prop* types:
  * `CategoryTreeProps`
  * `ModelsTreeProps`
  * `SpatialContainmentTreeProps`
  * `VisibilityComponentProps`

  The components now always use controlled tree as the internal tree implementation.

* Removed `UiFramework.getDefaultRulesetId()` and `UiFramework.setDefaultRulesetId()`. Each component
should decide what ruleset it wants to use.

* Custom registered ToolUiProviders should now return a 'horizontalToolSettingNodes' property that contain an array of ToolSettingsEntry items.
These items define the label and editor to use for each value when the Tool Settings container is in its default Horizontal orientation. The existing 'toolSettingsNode' property is still used to specify the UI if the Tool Settings are shown in a floating/rectangular container.

*When using the DefaultToolSettingsProvider as specified in the `ToolUiManager`, the toolSettingsProperty argument to `ToolUiManager.initializeToolSettingsData()` has been changed from `ToolSettingsPropertyRecord[]` to `DialogItem[]`. `DialogItem` is an interface that you will find in the ui-abstract package in the file DialogItem.ts. The classes in the file ToolSettingsValue.ts have been deprecated and removed from the source tree.

### API changes in `ui-core` package

#### Removal of Deprecated APIs

The following items that were marked as @deprecated in the 1.x time frame have been removed:

* UiError (use UiError in @bentley/ui-abstract instead)
* Position for Popup component (Use RelativePosition in @bentley/ui-abstract instead)

### API Changes in `presentation-common` Package

#### RPC Changes

The following endpoints have been either changed or removed:

* `PresentationRpcInterface.getDisplayLabel` removed in favor of `PresentationRpcInterface.getDisplayLabelDefinition`.
* `PresentationRpcInterface.getDisplayLabels` removed in favor of `PresentationRpcInterface.getDisplayLabelDefinitions`.
* `PresentationRpcInterface.getDisplayLabelsDefinitions` renamed to `PresentationRpcInterface.getDisplayLabelDefinitions`.
* `RequestOptionsWithRuleset` required either `rulesetId` or `rulesetOrId` (both optional). Now it only has a required attribute `rulesetOrId`.

In addition, support for stateful backed was removed.

Because of the above breaking `PresentationRpcInterface` changes its version was changed to `2.0`.

#### Hard-Deprecation

Some of already `@deprecated` APIs are now being hard-deprecated by adding a `DEPRECATED_` prefix to increase consumers' awareness about future removal of the APIs:

* `AllInstanceNodesSpecification` to `DEPRECATED_AllInstanceNodesSpecification`
* `AllRelatedInstanceNodesSpecification` to `DEPRECATED_AllRelatedInstanceNodesSpecification`
* `ChildNodeSpecificationTypes.AllInstanceNodes` to `ChildNodeSpecificationTypes.DEPRECATED_AllInstanceNodes`
* `ChildNodeSpecificationTypes.AllRelatedInstanceNodes` to `ChildNodeSpecificationTypes.DEPRECATED_AllRelatedInstanceNodes`
* `PropertiesDisplaySpecification` to `DEPRECATED_PropertiesDisplaySpecification`
* `PropertyEditorsSpecification` to `DEPRECATED_PropertyEditorsSpecification`
* `PropertiesDisplaySpecification` to `DEPRECATED_PropertiesDisplaySpecification`
* `PropertyEditorsSpecification` to `DEPRECATED_PropertyEditorsSpecification`

As a short term solution consumers can simply do a rename when importing the module, e.g.:

```ts
import { DEPRECATED_PropertiesDisplaySpecification as PropertiesDisplaySpecification } from "@bentley/presentation-common";
```

#### Removals and Changes

* Removed `@deprecated` APIs: `ECInstanceNodeKey`, `ECInstanceNodeKeyJSON`, `ECInstancesNodeKey.instanceKey`, `NodeKey.isInstanceNodeKey`, `StandardNodeTypes.ECInstanceNode`. Instead, the multi-ECInstance type of node should be used, since ECInstance nodes may be created off of more than one ECInstance. Matching APIs: `ECInstancesNodeKey`, `ECInstancesNodeKeyJSON`, `ECInstancesNodeKey.instanceKeys`, `NodeKey.isInstancesNodeKey`, `StandardNodeTypes.ECInstancesNode`.
* Removed `Item.labelDefinition` and `Node.labelDefinition`. Instead, `Item.label` and `Node.label` should be used, whose type has been changed from `string` to `LabelDefinition`. The `LabelDefinition` type has not only display value, but also raw value and type information which allows localizing and formatting raw value.
* Removed `PersistentKeysContainer`. Instead, `KeySetJSON` should be used.
* Changed `RulesetsFactory.createSimilarInstancesRuleset` to async. Removed `RulesetsFactory.createSimilarInstancesRulesetAsync`.

### API Changes in `presentation-backend` Package

#### Removals and Changes

* `PresentationManager.getDisplayLabel` was removed in favor of `PresentationManager.getDisplayLabelDefinition`
* `PresentationManager.getDisplayLabels` was removed in favor of `PresentationManager.getDisplayLabelDefinitions`
* `PresentationManager.getDisplayLabelsDefinitions` was renamed to `PresentationManager.getDisplayLabelDefinitions`
* `RulesetEmbedder` now takes a "props" object instead of arguments' list in its constructor. Example fix:

  ```ts
  const embedder = new RulesetEmbedder({ imodel });
  ```

  instead of:

  ```ts
  const embedder = new RulesetEmbedder(imodel);
  ```

### API Changes in `presentation-frontend` Package

#### Removals and Changes

* `Presentation.initialize` is now async.
* `PresentationManager.getDisplayLabel` was removed in favor of `PresentationManager.getDisplayLabelDefinition`
* `PresentationManager.getDisplayLabels` was removed in favor of `PresentationManager.getDisplayLabelDefinitions`
* `PresentationManager.getDisplayLabelsDefinitions` was renamed to `PresentationManager.getDisplayLabelDefinitions`
* `PersistenceHelper` was removed in favor of `KeySet` and its `toJSON` and `fromJSON` functions.
* `HiliteSetProvider` and `SelectionHandler` now take a "props" object instead of arguments' list in constructor. Example fix:

  ```ts
  const provider = new HiliteSetProvider({ imodel });
  ```

  instead of:

  ```ts
  const provider = new HiliteSetProvider(imodel);
  ```

### API Changes in `presentation-components` Package

#### Hard-Deprecation

Some of already `@deprecated` APIs are now being hard-deprecated by adding a `DEPRECATED_` prefix to increase consumers' awareness about future removal of the APIs:

* `controlledTreeWithFilteringSupport` renamed to `DEPRECATED_controlledTreeWithFilteringSupport`.
* `controlledTreeWithVisibleNodes` renamed to `DEPRECATED_controlledTreeWithVisibleNodes`.
* `treeWithFilteringSupport` renamed to `DEPRECATED_treeWithFilteringSupport`.
* `treeWithUnifiedSelection` renamed to `DEPRECATED_treeWithUnifiedSelection`.

As a short term solution consumers can simply do a rename when importing the module, e.g.:

```ts
import { DEPRECATED_treeWithUnifiedSelection as treeWithUnifiedSelection } from "@bentley/presentation-components";
```

#### Removals and Changes

* All presentation data providers that used to memoize all requests now only memoize the last one to preserve consumed memory.
* All presentation data providers are now `IDisposable`. This means their `dispose()` method has to be called whenever they're stopped being used. In the context of a hooks-based React component this can be done like this:

  ```ts
  import { useDisposable } from "@bentley/ui-core";
  import { IPresentationDataProvider } from "@bentley/presentation-components";
  const MyComponent = () => {
    const dataProvider = useDisposable(useCallback(() => createSomeDataProvider(), []));
    // can use `dataProvider` here - it'll be disposed as needed
  };
  ```

  In a class based React component the providers have to be disposed in either `componentWillUnmount` or `componentDidUpdate` callbacks, whenever the provider becomes unnecessary.
* APIs that now take a "props" object instead of arguments' list:
  * `ContentDataProvider`
  * `PresentationLabelsProvider`
  * `PresentationPropertyDataProvider`
  * `PresentationTreeDataProvider`
  * `useControlledTreeFiltering`
  * `useUnifiedSelectionTreeEventHandler`
  Example fix:

  ```ts
  const provider = new PresentationLabelsProvider({ imodel });
  ```

  instead of:

  ```ts
  const provider = new PresentationLabelsProvider(imodel);
  ```

* Removed `FavoritePropertiesDataProvider.customRulesetId`. Now it can be supplied when constructing the provider through `FavoritePropertiesDataProviderProps.ruleset`.
* Renamed `LabelsProvider` to `PresentationLabelsProvider`.
* Renamed `PresentationNodeLoaderProps` to `PresentationTreeNodeLoaderProps`.
* Renamed `PresentationTreeNodeLoaderProps.rulesetId` to `PresentationTreeNodeLoaderProps.ruleset`.
* Renamed `usePresentationNodeLoader` to `usePresentationTreeNodeLoader`.
* Renamed `useUnifiedSelectionEventHandler` to `useUnifiedSelectionTreeEventHandler`.
* Removed attributes from `UnifiedSelectionTreeEventHandlerParams`: `dataProvider`, `modelSource`. They're now taken from `nodeLoader`.

### API Changes in `presentation-testing` Package

#### Removals and Changes

* `initialize` helper function is now async.
* `ContentBuilder` and `HierarchyBuilder` now take a "props" object instead of arguments' list. Example fix:

  ```ts
  const builder = new ContentBuilder({ imodel, dataProvider });
  ```

  instead of:

  ```ts
  const builder = new ContentBuilder(imodel, dataProvider);
  ```

## Geometry

### Remove deprecated methods

* `CurveCurve` intersection methods which formerly returned a pair of arrays (with matched length and corresponding CurveLocationDetail entries) now return a single array whose entries each have the two corresponding CurveLocationDetails.
  * The affected methods are
    * For computing intersections among of the (simple xy projection of) curves:
      * old `CurveCurve.intersectionXY (...) : CurveLocationDetailArrayPair`
      * new `CurveCurve.intersectionXYPairs (...) : CurveLocationDetailPair[]`
    * For computing intersections among projections of curves with 4d (i.e. perspective) projection:
      * old `CurveCurve.intersectionProjectedXY (...) : CurveLocationDetailArrayPair`
      * new `CurveCurve.intersectionProjectedXYPairs (...) : CurveLocationDetailPair[]`
  * If `oldIntersections` is the old pair of arrays and `newIntersections` is the new array of pairs,
    * change   `oldIntersections.dataA[i]`
    * to `newIntersections[i].detailA`
    * old `intersections.dataB[i]`
    * to `newIntersections[i].detailB`
  * The method `CurveCurveIntersectXY.grabResults()` is removed -- `grabPairedResults` is the modernized form.
* `GrowableXYZArray` method `myArray.distance(i,j)` for distance between points identified by indices `(i,j)` is replaced by
  * old:   `myArray.distance(i,j)`
  * new:   `myArray.distanceIndexIndex(i,j)`
  * this clarifies the difference among distance methods:
    * `myArray.distanceIndexToPoint(i: number, point: Point3d)`
    * `myArray.distanceSquaredIndexIndex(i: number, point: Point3d)`
* In `PointHelpers`, the methods to parse variant XYZ data are removed.
  * In the replacements, the original single callback is replaced by an callback object that can receive start-end callbacks in addition to the primary xyz or xyz pair callback.
  * old `Point3dArray.streamXYZ (.. )` is removed.
  * new `VariantPointDataStream.streamXYZ (..)`
  * old `Point3dArray.streamXYZXYZ(..)` is removed.
  * new `VariantPointDataStream.streamXYZXYZ (..)`
* `PolyfaceBuilder`
  * old (impropertly cased) method `findOrAddNormalnLineString` is removed. The properly spelled replacement is `findOrAddNormalInLineString` (note the added capital `I`)
* `ArcSweep`
  * old (improperly cased) method `radiansArraytoPositivePeriodicFractions` is renamed `radiansArrayToPositivePeriodicFractions` (Note the capital "T")
* `ClipPlane`
  * `ClipPlane` supports the `PlaneAltitudeEvaluator` interface.
  * This allows services previously seen as specific to `ClipPlane` to be supported with other plane types (especially `Plane3dByOriginAndNormal`)
  * old instance method `myClipPlane.evaluatePoint(point)` is replaced by `myClipPlane.altitude (point)`
  * old instance method `myClipPlane.dotProductVector(point)` is replaced by `myClipPlane.velocity (point)`
  * old instance method `myClipPlane.convexPolygonClipInPlace (. . )` is replaced by (static) `Point3dArrayPolygonOps.convexPolygonClipInPlace`
  * old instance method `myClipPlane.polygonCrossings(polygonPoints, crossings)` is replaced by (static) Point3dArrayPolygonOps.polygonPlaneCrossings (clipPlane, polygonPoints, crossings)`
  * old static  method `myClipPlane.intersectRangeConvexPolygonInPlace (. . )` is replaced by (static) `IndexedXYZCollectionPolygonOps.intersectRangeConvexPolygonInPlace`
* Various methods (usually static createXXXX) that accept `MultiLineStringDataVariant` have previously been marked as deprecated, with replacement methods that include the words `FromVariant` data.  This decision has been reversed, and that short names are again considered ok.   This includes:
  * `LineString3d.createArrayOfLineString3d (variantLinestringData:MultiLineStringDataVariant): LineString3d[]` is un-deprecated, and the mangled name `createArrayOfLineString3dFromVariantData` is deprecated.

### Various method name changes (breaking)

* On Arc3d, there were previously (confusingly) two "get" properties for the internal matrix of the Arc3d.
  * arc.matrixRef
    * This returns a reference to the matrix.
    * This is not changed.
    * Direct access to the matrix is dangerous, but the "Ref" qualifier makes that clear.
  * arc.matrix
    * this formerly returned a clone of the matrix.
    * Cloning is expensive.
    * this is removed.
    * It is replaced by a method (not property)  `arc3d.matrixClone ()`
    * `arc3d.matrixClone()` clones the matrix.
  * `Ellipsoid` API changed to eliminate use of `Point2d` as carrier for a pair of angles.
    * angle pairs are instead returned in strongly typed`LongitudeLatitudeNumber` objects.
    * method `ellipsoid.surfaceNormalToRadians` is removed.
      Use `ellipsoid.surfaceNormalToAngles` for the same result in proper `LongitudeLatitudeNumber` form.
    * method `ellipsoid.intersectRay (ray, rayFractions[], xyz[], thetaPhiRadians[])` now returns `thetaPhiRadians` as an array of strongly typed `LongitutdeLatitudeNumber`.
      * Changes made to callers in core\frontend\BackgroundMapGeometry.ts
    * `SurfaceLocationDetail` has a new (constructor-like) static method `createUVNumbersPoint (surface, u, v, point)` with the surface `u` and `v` parameters as separate numeric values (previously packaged as `Point2d`)
    * `SphereImplicit.intersectSphereRay` returns its surface angle data as `LongitudeLatitudePoint` instead of as `Point2d`.

### Bug fixes

* Apply on-plane tolerances in mesh-plane clip. (https://bentleycs.visualstudio.com/iModelTechnologies/_workitems/edit/273249/)
* `ClipUtils.selectIntervals01` announces fractional intervals of clipped geometry.  The logic previously considered any non-zero interval to be a valid candidate, resulting in extremely small arcs with seep angle less than the smallest non-zero angle.   This logic is modified so that any fractional interval shorter than `Geometry.smallFractionalResult` is ignored.

### Small angle arc issues

* Angle methods for converting an angle to a fraction of an `AngleSweep` interval have added args to specify default return value on near-zero length intervals.
  * static `AngleSweep.radiansToPositivePeriodicFraction(radians: number, zeroSweepDefault?: number): number;`
  * instance method `angleSweep.radiansToPositivePeriodicFraction(radians: number, zeroSweepDefault?: number): number;`
* static const `Geometry.smallFraction` is a typical value (1.0e-10) to consider a fraction interval small.

### Polyface clipping

* New class `ClippedPolyfaceBuilders` is carries output data and options from clip operations
* static `ClipUtilities.announceLoopsOfConvexClipPlaneSetIntersectRange(convexSet: ConvexClipPlaneSet | ClipPlane, range: Range3d, loopFunction: (loopPoints: GrowableXYZArray) => void, includeConvexSetFaces?: boolean, includeRangeFaces?: boolean, ignoreInvisiblePlanes?: boolean): void;`
  * Accepts simple `ClipPlane` in addition to `ConvexClipPlaneSet`
* static `ClipUtilities.loopsOfConvexClipPlaneIntersectionWithRange(allClippers: ConvexClipPlaneSet | UnionOfConvexClipPlaneSets | ClipPlane, range: Range3d, includeConvexSetFaces?: boolean, includeRangeFaces?: boolean, ignoreInvisiblePlanes?: boolean): GeometryQuery[]`
  * accepts `UnionOfConvexClipPlaneSets` and `ClipPlane` in addition to `ConvexClipPlaneSet`
* static `ConvexClipPlaneSet.clipInsidePushOutside(xyz: GrowableXYZArray, outsideFragments: GrowableXYZArray[], arrayCache: GrowableXYZArrayCache): GrowableXYZArray | undefined;`
  * clips `xyz` polygon to the clip plane set.   Inside result is the return argument; outside fragments (possibly many) are pushed to the `outsideFragments` array (which is not cleared first.)
* `PolyfaceClip` methods to do both inside and outside clip of polyfaces.
  * static `PolyfaceClip.clipPolyfaceClipPlane(polyface: Polyface, clipper: ClipPlane, insideClip?: boolean, buildClosureFaces?: boolean): Polyface;`
  * static `PolyfaceClip.clipPolyfaceClipPlaneWithClosureFace(polyface: Polyface, clipper: ClipPlane, insideClip?: boolean, buildClosureFaces?: boolean): Polyface;`

## ecschema-metadata Package

### Remove deprecated API

* Class `SchemaFileLocater` has been moved to the `ecschema-locaters` package.
* Class `SchemaJsonFileLocater` has been moved to the `ecschema-locaters` package.
* Class `SchemaFileLocater` has been moved to the `ecschema-locaters` package.
* In `Schema`, the methods for (de)serializing to/from JSON have been renamed.
  * `Schema.toJson()` renamed to `Schema.toJSON()`
  * `Schema.deserialize(...)` renamed to `Schema.fromJSON(...)`
  * `Schema.deserializeSync(...)` renamed to `Schema.fromJSONSync(...)`
* In `Property` and all classes deriving from `Property`, the methods for (de)serializing to/from JSON have been renamed.
  * `Property.toJson()` renamed to `Property.toJSON()`
  * `Property.deserialize(...)` renamed to `Property.fromJSON(s...)`
  * `Property.deserializeSync(...)` renamed to `Property.fromJSONSync(...)`
* In `SchemaItem` and all classes deriving directly or indirectly from `SchemaItem`, the methods for (de)serializing to/from JSON have been renamed.
  * `SchemaItem.toJson()` renamed to `SchemaItem.toJSON()`
  * `SchemaItem.deserialize(...)` renamed to `SchemaItem.fromJSON(...)`
  * `SchemaItem.deserializeSync(...)` renamed to `SchemaItem.fromJSONSync(...)`
