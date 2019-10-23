/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export * from "./ui-abstract/UiAbstract";
export * from "./ui-abstract/UiAdmin";

export * from "./ui-abstract/items/AbstractConditionalItemProps";
export * from "./ui-abstract/items/AbstractGroupItemProps";
export * from "./ui-abstract/items/AbstractItemProps";
export * from "./ui-abstract/items/AbstractMenuItemProps";
export * from "./ui-abstract/items/AbstractToolbarProps";
export * from "./ui-abstract/items/AnyItemProps";
export * from "./ui-abstract/items/BadgeType";
export * from "./ui-abstract/items/BaseItemState";
export * from "./ui-abstract/items/ConditionalDisplayType";
export * from "./ui-abstract/items/RelativePosition";

export * from "./ui-abstract/plugins/PluginUi";

export * from "./ui-abstract/utils/getClassName";
export * from "./ui-abstract/utils/IconSpecUtilities";
export * from "./ui-abstract/utils/callbacks";
export * from "./ui-abstract/utils/UiError";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
// istanbul ignore next
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("ui-abstract", BUILD_SEMVER);
}

/** @docs-package-description
 * The ui-abstract package contains abstractions for UI controls, such as toolbars, buttons and menus.
 */
/**
 * @docs-group-description Admin
 * Abstractions for UI controls, such as toolbars, buttons and menus and are callable from IModelApp.uiAdmin in imodeljs-frontend.
 */
/**
 * @docs-group-description Item
 * Classes for working with an Item in a Toolbar, Widget, Backstage or Context Menu
 */
/**
 * @docs-group-description Plugins
 * Classes for creating and managing runtime [Plugins]($docs/learning/frontend/Plugins.md)
 */
/**
 * @docs-group-description Utilities
 * Various utility classes for working with a UI.
 */
