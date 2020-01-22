/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export * from "./AccuDraw";
export * from "./AccuSnap";
export * from "./AuxCoordSys";
export * from "./CategorySelectorState";
export * from "./ContextRealityModelState";
export * from "./DevTools";
export * from "./DisplayStyleState";
export * from "./ElementLocateManager";
export * from "./EmphasizeElements";
export * from "./EntityState";
export * from "./FrontendLoggerCategory";
export * from "./FrontendRequestContext";
export * from "./FuzzySearch";
export * from "./GeoServices";
export * from "./HitDetail";
export * from "./IModelApp";
export * from "./IModelConnection";
export * from "./ImageUtil";
export * from "./Marker";
export * from "./ModelSelectorState";
export * from "./ModelState";
export * from "./NoRenderApp";
export * from "./NotificationManager";
export * from "./QuantityFormatter";
export * from "./RelativePosition";
export * from "./RenderCompatibility";
export * from "./RenderScheduleState";
export * from "./SelectionSet";
export * from "./Sheet";
export * from "./SolarCalculate";
export * from "./SpatialClassifiers";
export * from "./Sprites";
export * from "./StandardView";
export * from "./SubCategoriesCache";
export * from "./TentativePoint";
export * from "./TerrainProvider";
export * from "./ViewContext";
export * from "./ViewingSpace";
export * from "./ViewManager";
export * from "./ViewRect";
export * from "./ViewState";
export * from "./Viewport";
export * from "./oidc/OidcBrowserClient";
export * from "./oidc/OidcDesktopClientRenderer";
export * from "./plugin/Plugin";
export * from "./properties/AngleDescription";
export * from "./properties/BaseQuantityDescription";
export * from "./properties/Description";
export * from "./properties/EditorParams";
export * from "./properties/LengthDescription";
export * from "./properties/PrimitiveTypes";
export * from "./properties/Record";
export * from "./properties/ToolSettingsValue";
export * from "./properties/Value";
export * from "./render/FeatureSymbology";
export * from "./FeatureToggleClient";
export * from "./render/GraphicBuilder";
export * from "./render/MockRender";
export * from "./render/System";
export * from "./render/webgl/PerformanceMetrics";
export * from "./render/webgl/Target";
export * from "./tools/AccuDrawTool";
export * from "./tile/internal";
export * from "./tools/ClipViewTool";
export * from "./tools/EditManipulator";
export * from "./tools/ElementSetTool";
export * from "./tools/EventController";
export * from "./tools/IdleTool";
export * from "./tools/MeasureTool";
export * from "./tools/PrimitiveTool";
export * from "./tools/SelectTool";
export * from "./tools/Tool";
export * from "./tools/ToolSettings";
export * from "./tools/ToolAdmin";
export * from "./tools/ToolAssistance";
export * from "./tools/ViewTool";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
declare var BUILD_TYPE: string;
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("imodeljs-frontend", BUILD_SEMVER);
  (window as any).iModelJsVersions.set("buildType", BUILD_TYPE);
}

/** @docs-package-description
 * The imodeljs-frontend package always runs in a web browser. It contains classes for [querying iModels and showing views]($docs/learning/frontend/index.md).
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
 * @docs-group-description OIDC
 * Classes for working with the OpenID Connect (OIDC) protocol
 */
/**
 * @docs-group-description Utils
 * Miscellaneous utility classes.
 */
/**
 * @docs-group-description Logging
 * Logger categories used by this package
 */
/**
 * @docs-group-description SpatialClassification
 * Classes for spatial classification.
 */
/**
 * @docs-group-description Features
 * Classes for Feature Tracking classification.
 */
