/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ConfigurableUiManager } from "../configurableui/ConfigurableUiManager";
import { StatusBarComposer } from "../statusbar/StatusBarComposer";
import { StatusBarItem } from "../statusbar/StatusBarItem";
import { StatusBarWidgetControl } from "../statusbar/StatusBarWidgetControl";

/** Properties that can be used to append items to the default set of toolbar items of [[SimpleStatusBar]].
 * @public
 */
export interface SimpleStatusBarProps {
  /** optional default set of status bar items */
  items?: StatusBarItem[];
}

/** Simple Status bar widget that can specify a default set of status bar items and also be populated by UiItemsProviders.
 *  @example
 * ```
 *  const items = [
 *    StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 10, <ToolAssistance />),
 *    StatusBarItemUtilities.createStatusBarItem("ToolAssistanceSeparator", StatusBarSection.Left, 15, (<FooterMode> <FooterSeparator /> </FooterMode>)),
 *    StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 20, <MessageCenter />),
 *    StatusBarItemUtilities.createStatusBarItem("MessageCenterSeparator", StatusBarSection.Left, 25, (<FooterMode> <FooterSeparator /> </FooterMode>)),
 *    StatusBarItemUtilities.createStatusBarItem("ActivityCenter", StatusBarSection.Left, 30, <ActivityCenter />),
 *    StatusBarItemUtilities.createStatusBarItem("SnapMode", StatusBarSection.Center, 10, <SnapMode />, { isHidden: isHiddenCondition }),
 *  ];
 *
 * <SimpleStatusBar items={items} />
 * ```
 * @beta
 */
export function SimpleStatusBar(props: SimpleStatusBarProps) {
  return (
    <StatusBarComposer items={props.items ?? []} />
  );
}

/**
 * @beta
 */
export class SimpleStatusBarWidgetControl extends StatusBarWidgetControl {
  public getReactNode(): React.ReactNode {
    return (
      <SimpleStatusBar />
    );
  }
}

ConfigurableUiManager.registerControl("SimpleStatusBar", SimpleStatusBarWidgetControl);

