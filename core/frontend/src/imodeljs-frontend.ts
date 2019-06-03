/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export * from "./tools/AccuDrawTool";
export * from "./tools/EditManipulator";
export * from "./tools/ElementSetTool";
export * from "./tools/EventController";
export * from "./tools/MeasureTool";
export * from "./tools/SelectTool";
export * from "./tools/ToolAdmin";
export * from "./tools/Tool";
export * from "./tools/ViewTool";
export * from "./tools/ClipViewTool";
export * from "./tools/PrimitiveTool";
export * from "./tools/IdleTool";
export * from "./AccuDraw";
export * from "./AccuSnap";
export * from "./AuxCoordSys";
export * from "./DevTools";
export * from "./FrontendRequestContext";
export * from "./CategorySelectorState";
export * from "./ContextRealityModelState";
export * from "./SpatialClassification";
export * from "./DisplayStyleState";
export * from "./ElementLocateManager";
export * from "./EmphasizeElements";
export * from "./EntityState";
export * from "./FuzzySearch";
export * from "./GeoServices";
export * from "./HitDetail";
export * from "./IModelConnection";
export * from "./ImageUtil";
export * from "./FrontendLoggerCategory";
export * from "./Marker";
export * from "./ModelSelectorState";
export * from "./ModelState";
export * from "./NotificationManager";
export * from "./Plugin";
export * from "./SelectionSet";
export * from "./Sheet";
export * from "./Sprites";
export * from "./StandardView";
export * from "./SubCategoriesCache";
export * from "./TentativePoint";
export * from "./QuantityFormatter";
export * from "./ViewContext";
export * from "./ViewManager";
export * from "./Viewport";
export * from "./ViewState";
export * from "./IModelApp";
export * from "./NoRenderApp";
export * from "./tile/TileAdmin";
export * from "./tile/TileTree";
export * from "./tile/WebMapTileTree";
export * from "./render/FeatureSymbology";
export * from "./render/GraphicBuilder";
export * from "./render/MockRender";
export * from "./render/System";
export * from "./render/webgl/Target";
export * from "./oidc/OidcBrowserClient";
export * from "./TiledGraphicsProvider";
export * from "./TerrainProvider";
export * from "./properties/Description";
export * from "./properties/EditorParams";
export * from "./properties/Record";
export * from "./properties/Value";
export * from "./properties/ToolSettingsValue";
export * from "./properties/PrimitiveTypes";
export * from "./SolarCalculate";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("imodeljs-frontend", BUILD_SEMVER);
}

/** @docs-package-description
 * The ($frontend) package always runs in a web browser. It contains classes for [querying iModels and showing views]($docs/learning/frontend/index.md).
 */

/**
 * @docs-group-description IModelApp
 * Classes for configuring and administering an iModel.js application.
 * See [the learning articles]($docs/learning/frontend/index.md).
 */
/**
 * @docs-group-description IModelConnection
 * Classes for working with a connection to an [iModel briefcase]($docs/learning/IModels.md)
 */
/**
 * @docs-group-description ElementState
 * Classes for working with the *state* of Elements in the frontend.
 * See [the learning articles]($docs/learning/frontend/index.md).
 */
/**
 * @docs-group-description ModelState
 * Classes for working with the *state* of Models in the frontend.
 * See [the learning articles]($docs/learning/frontend/index.md).
 */
/**
 * @docs-group-description Tools
 * Classes for [working with Tools]($docs/learning/frontend/Tools.md)
 */
/**
 * @docs-group-description Views
 * Classes for [working with Views]($docs/learning/frontend/Views.md)
 */
/**
 * @docs-group-description LocatingElements
 * Classes for locating and snapping to elements in views.
 * See [the learning articles]($docs/learning/frontend/index.md).
 */
/**
 * @docs-group-description AccuDraw
 * AccuDraw provides helpful assistance for creating and modifying elements in a view.
 * See [the learning articles]($docs/learning/frontend/index.md).
 */
/**
 * @docs-group-description Notifications
 * Notifications provide feedback to the user of something of interest.
 * See [the learning articles]($docs/learning/frontend/index.md).
 */
/**
 * @docs-group-description Plugins
 * Classes for creating and managing runtime [Plugins]($docs/learning/frontend/Plugins.md)
 */
/**
 * @docs-group-description Properties
 * Classes for working with property records and descriptions.
 */
/**
 * @docs-group-description Rendering
 * Classes for rendering the contents of views.
 */
/**
 * @docs-group-description SelectionSet
 * Classes for working with the set of selected elements.
 * See [the learning articles]($docs/learning/frontend/index.md).
 */
/**
 * @docs-group-description Tile
 * Classes for selecting and drawing tiles in views.
 */
/**
 * @docs-group-description WebGL
 * Classes for interfacing to WebGL in browsers.
 */
