/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
export * from "./ui-ninezone/backstage/Backstage";
export * from "./ui-ninezone/backstage/Item";
export * from "./ui-ninezone/backstage/Separator";
export * from "./ui-ninezone/backstage/UserProfile";

export * from "./ui-ninezone/base/WithContainIn";

export * from "./ui-ninezone/footer/dialog/Button";
export * from "./ui-ninezone/footer/dialog/Dialog";
export * from "./ui-ninezone/footer/dialog/TitleBar";

export * from "./ui-ninezone/footer/message/Button";
export * from "./ui-ninezone/footer/message/Hyperlink";
export * from "./ui-ninezone/footer/message/Layout";
export * from "./ui-ninezone/footer/message/Message";
export * from "./ui-ninezone/footer/message/Progress";
export * from "./ui-ninezone/footer/message/Status";
export * from "./ui-ninezone/footer/message/Toast";

export * from "./ui-ninezone/footer/message-center/Dialog";
export * from "./ui-ninezone/footer/message-center/Indicator";
export * from "./ui-ninezone/footer/message-center/Message";
export * from "./ui-ninezone/footer/message-center/Tab";

export * from "./ui-ninezone/footer/snap-mode/Indicator";
export * from "./ui-ninezone/footer/snap-mode/Panel";
export * from "./ui-ninezone/footer/snap-mode/Snap";

export * from "./ui-ninezone/footer/tool-assistance/Dialog";
export * from "./ui-ninezone/footer/tool-assistance/Indicator";
export * from "./ui-ninezone/footer/tool-assistance/Item";
export * from "./ui-ninezone/footer/tool-assistance/Separator";

export * from "./ui-ninezone/footer/Footer";
export * from "./ui-ninezone/footer/Indicator";
export * from "./ui-ninezone/footer/Popup";
export * from "./ui-ninezone/footer/Separator";

export * from "./ui-ninezone/manager/NestedStagePanels";
export * from "./ui-ninezone/manager/NineZone";
export * from "./ui-ninezone/manager/StagePanel";
export * from "./ui-ninezone/manager/StagePanelPane";
export * from "./ui-ninezone/manager/StagePanels";

export * from "./ui-ninezone/popup/Tooltip";

export * from "./ui-ninezone/stage-panels/Splitter";
export * from "./ui-ninezone/stage-panels/StagePanel";
export * from "./ui-ninezone/stage-panels/StagePanels";

export * from "./ui-ninezone/stage-panels/manager/NestedStagePanels";
export * from "./ui-ninezone/stage-panels/manager/StagePanel";
export * from "./ui-ninezone/stage-panels/manager/StagePanels";

export * from "./ui-ninezone/toolbar/item/Item";
export * from "./ui-ninezone/toolbar/item/Overflow";
export * from "./ui-ninezone/toolbar/item/expandable/Expandable";

export * from "./ui-ninezone/toolbar/item/expandable/group/BackArrow";
export * from "./ui-ninezone/toolbar/item/expandable/group/Column";
export * from "./ui-ninezone/toolbar/item/expandable/group/Columns";
export * from "./ui-ninezone/toolbar/item/expandable/group/Group";
export * from "./ui-ninezone/toolbar/item/expandable/group/Nested";
export * from "./ui-ninezone/toolbar/item/expandable/group/Panel";
export * from "./ui-ninezone/toolbar/item/expandable/group/Title";

export * from "./ui-ninezone/toolbar/item/expandable/group/tool/Expander";
export * from "./ui-ninezone/toolbar/item/expandable/group/tool/Tool";

export * from "./ui-ninezone/toolbar/item/expandable/history/Icon";
export * from "./ui-ninezone/toolbar/item/expandable/history/Item";
export * from "./ui-ninezone/toolbar/item/expandable/history/Tray";

export * from "./ui-ninezone/toolbar/scroll/Chevron";
export * from "./ui-ninezone/toolbar/scroll/Indicator";

export * from "./ui-ninezone/toolbar/Items";
export * from "./ui-ninezone/toolbar/Scrollable";
export * from "./ui-ninezone/toolbar/Toolbar";

export * from "./ui-ninezone/utilities/Cell";
export * from "./ui-ninezone/utilities/Css";
export * from "./ui-ninezone/utilities/Direction";
export * from "./ui-ninezone/utilities/Point";
export * from "./ui-ninezone/utilities/Rectangle";
export * from "./ui-ninezone/utilities/Size";

export * from "./ui-ninezone/widget/Stacked";
export * from "./ui-ninezone/widget/Tools";
export * from "./ui-ninezone/widget/ToolSettings";

export * from "./ui-ninezone/widget/tools/button/App";
export * from "./ui-ninezone/widget/tools/button/Back";
export * from "./ui-ninezone/widget/tools/button/Button";
export * from "./ui-ninezone/widget/tools/button/Expandable";
export * from "./ui-ninezone/widget/tools/button/Icon";

export * from "./ui-ninezone/widget/rectangular/Content";
export * from "./ui-ninezone/widget/rectangular/ResizeGrip";
export * from "./ui-ninezone/widget/rectangular/ResizeHandle";

export * from "./ui-ninezone/widget/rectangular/tab/Group";
export * from "./ui-ninezone/widget/rectangular/tab/Separator";
export * from "./ui-ninezone/widget/rectangular/tab/Tab";

export * from "./ui-ninezone/widget/tool-settings/Nested";
export * from "./ui-ninezone/widget/tool-settings/Popup";
export * from "./ui-ninezone/widget/tool-settings/Scrollable";
export * from "./ui-ninezone/widget/tool-settings/Tab";

export * from "./ui-ninezone/zones/Outline";
export * from "./ui-ninezone/zones/Zone";
export * from "./ui-ninezone/zones/Zones";

export * from "./ui-ninezone/zones/manager/Target";
export * from "./ui-ninezone/zones/manager/Widget";
export * from "./ui-ninezone/zones/manager/Zone";
export * from "./ui-ninezone/zones/manager/Zones";

export * from "./ui-ninezone/zones/manager/layout/Layout";
export * from "./ui-ninezone/zones/manager/layout/Layouts";
export * from "./ui-ninezone/zones/manager/layout/Root";

export * from "./ui-ninezone/zones/target/Back";
export * from "./ui-ninezone/zones/target/Merge";
export * from "./ui-ninezone/zones/target/Splitter";
export * from "./ui-ninezone/zones/target/SplitterPane";
export * from "./ui-ninezone/zones/target/StagePanel";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
/* istanbul ignore next */
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("ui-ninezone", BUILD_SEMVER);
}

/** @docs-package-description
 * The ui-ninezone package contains React components for application user interface layouts following the Bentley 9-Zone pattern.
 * For more information, see [learning about ui-ninezone]($docs/learning/ninezone/index.md).
 */
/**
 * @docs-group-description Backstage
 * Classes for working with a Backstage
 */
/**
 * @docs-group-description Footer
 * Classes for working with a Footer or Status Bar
 */
/**
 * @docs-group-description Message
 * Classes for working with Messages
 */
/**
 * @docs-group-description MessageCenter
 * Classes for working with the MessageCenter
 */
/**
 * @docs-group-description Popup
 * Classes for working with a Popup
 */
/**
 * @docs-group-description SnapMode
 * Classes for working with SnapMode UI
 */
/**
 * @docs-group-description StagePanels
 * Classes for working with stage panels
 */
/**
 * @docs-group-description ToolAssistance
 * Classes for working with Tool Assistance
 */
/**
 * @docs-group-description Toolbar
 * Classes for working with a Toolbar
 */
/**
 * @docs-group-description ToolSettings
 * Classes for working with Tool Settings
 */
/**
 * @docs-group-description Utilities
 * Utility classes for working with the 9-Zone pattern
 */
/**
 * @docs-group-description Widget
 * Classes for working a Widget
 */
/**
 * @docs-group-description Zone
 * Classes for working a Zone
 */
