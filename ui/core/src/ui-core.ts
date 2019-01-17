/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
export * from "./ui-core/UiCore";
export { CommonProps } from "./ui-core/Props";

export * from "./ui-core/base/Div";
export * from "./ui-core/base/WebFontIcon";
export * from "./ui-core/base/WaitSpinner";
export * from "./ui-core/base/UiEvent";

export { CheckListBox, CheckListBoxItem, CheckListBoxSeparator } from "./ui-core/checklistbox/CheckListBox";

export * from "./ui-core/contextmenu/ContextMenu";

export * from "./ui-core/cube/Cube";

export { Dialog, DialogProps, GlobalDialog, GlobalDialogProps, ButtonCluster, ButtonStyle, ButtonType } from "./ui-core/dialog/Dialog";

export * from "./ui-core/elementseparator/ElementSeparator";

export * from "./ui-core/enums/Alignment";
export * from "./ui-core/enums/CheckBoxState";
export * from "./ui-core/enums/DateFormat";
export * from "./ui-core/enums/Orientation";
export * from "./ui-core/enums/SortDirection";
export * from "./ui-core/enums/TimeFormat";

export { ExpandableList } from "./ui-core/expandable/ExpandableList";
export { ExpandableBlock } from "./ui-core/expandable/ExpandableBlock";

export { withIsPressed, WithIsPressedProps } from "./ui-core/hocs/withIsPressed";
export { withOnOutsideClick, WithOnOutsideClickProps } from "./ui-core/hocs/withOnOutsideClick";
export { withTimeout, WithTimeoutProps } from "./ui-core/hocs/withTimeout";

export { MessageBox, MessageBoxProps, MessageSeverity, MessageContainer } from "./ui-core/messagebox/MessageBox";

export { Popup, Position } from "./ui-core/popup/Popup";

export * from "./ui-core/radialmenu/RadialMenu";
export * from "./ui-core/radialmenu/Annulus";

export { SearchBox, SearchBoxProps } from "./ui-core/searchbox/SearchBox";

export * from "./ui-core/splitbutton/SplitButton";

export * from "./ui-core/toggle/Toggle";

export { default as ExpansionToggle, ExpansionToggleProps } from "./ui-core/tree/ExpansionToggle";
export { default as TreeBranch, TreeBranchProps } from "./ui-core/tree/Branch";
export { default as TreeNode, NodeProps } from "./ui-core/tree/Node";
export { default as Tree, TreeProps } from "./ui-core/tree/Tree";
export { default as TreeNodePlaceholder, PlaceholderProps as TreeNodePlaceholderProps } from "./ui-core/tree/Placeholder";

export * from "./ui-core/uisettings/UiSettings";
export * from "./ui-core/uisettings/LocalUiSettings";

export { default as Timer } from "./ui-core/utils/Timer";
export * from "./ui-core/utils/getDisplayName";
export * from "./ui-core/utils/shallowDiffers";
export * from "./ui-core/utils/typeUtils";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("ui-core", BUILD_SEMVER);
}

/** @docs-package-description
 * The ui-core package contains general purpose React components, such as Dialog, MessageBox, SearchBox, RadialMenu and SplitButton.
 * For more information, see [learning about ui-core]($docs/learning/core/index.md).
 */
/**
 * @docs-group-description Base
 * Low-level classes and components for building application UI.
 */
/**
 * @docs-group-description CheckBoxList
 * Classes for working with a CheckBox list.
 */
/**
 * @docs-group-description Common
 * Common classes used across various UI components.
 */
/**
 * @docs-group-description ContextMenu
 * Classes for working with a Context Menu.
 */
/**
 * @docs-group-description Cube
 * Component for 3D Cube.
 */
/**
 * @docs-group-description Dialog
 * Classes for working with a Dialog.
 */
/**
 * @docs-group-description ElementSeparator
 * Classes for working with a ElementSeparator.
 */
/**
 * @docs-group-description Expandable
 * Classes for working with a ExpandableBlock or ExpandableList.
 */
/**
 * @docs-group-description MessageBox
 * Classes for working with a MessageBox.
 */
/**
 * @docs-group-description Popup
 * Classes for working with a Popup.
 */
/**
 * @docs-group-description RadialMenu
 * Classes for working with a RadialMenu.
 */
/**
 * @docs-group-description SearchBox
 * Classes for working with a SearchBox.
 */
/**
 * @docs-group-description SplitButton
 * Classes for working with a SplitButton.
 */
/**
 * @docs-group-description Toggle
 * Classes for working with a Toggle.
 */
/**
 * @docs-group-description Tree
 * Classes for working with a Tree.
 */
/**
 * @docs-group-description UiSettings
 * Interfaces for working with persistent UI settings.
 */
/**
 * @docs-group-description Utilities
 * Various utility classes for working with a UI.
 */
