/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { StatusBarSpaceBetween, StatusBarLeftSection, StatusBarCenterSection, StatusBarRightSection } from "./StatusBar";
import { UiFramework } from "../UiFramework";
import { StatusBarSection, StatusBarItem } from "./StatusBarItem";
import { StatusBarItemsManager } from "./StatusBarItemsManager";

/** @internal */
interface StatusBarComposerState {
  statusBarItems: ReadonlyArray<StatusBarItem>;
}

/** StatusBar component composed from [[StatusBarItem]].
 * @beta
 */
export class StatusBarComposer extends React.PureComponent<{}, StatusBarComposerState> {

  /** @internal */
  public readonly state: StatusBarComposerState = {
    statusBarItems: [],
  };

  /** @internal */
  public componentDidMount() {
    StatusBarItemsManager.onStatusBarItemsChanged.addListener(this._handleStatusBarItemsChanged);
    this.setState({ statusBarItems: UiFramework.statusBarManager.itemsManager.items });
  }

  /** @internal */
  public componentWillUnmount() {
    StatusBarItemsManager.onStatusBarItemsChanged.removeListener(this._handleStatusBarItemsChanged);
  }

  private _handleStatusBarItemsChanged = () => {
    this.setState({ statusBarItems: UiFramework.statusBarManager.itemsManager.items });
  }

  private getSectionItems(section: StatusBarSection): React.ReactNode[] {
    const sectionItems = this.state.statusBarItems
      .filter((item) => item.section === section)
      .sort((a, b) => a.itemPriority - b.itemPriority);

    return sectionItems.map((sectionItem) => (
      <React.Fragment key={sectionItem.id}>
        {sectionItem.component}
      </React.Fragment>
    ));
  }

  /** @internal */
  public render() {
    const leftItems = this.getSectionItems(StatusBarSection.Left);
    const centerItems = this.getSectionItems(StatusBarSection.Center);
    const rightItems = this.getSectionItems(StatusBarSection.Right);

    return (
      <StatusBarSpaceBetween>
        {leftItems.length > 0 &&
          <StatusBarLeftSection>
            {leftItems}
          </StatusBarLeftSection>
        }
        {centerItems.length > 0 &&
          <StatusBarCenterSection>
            {centerItems}
          </StatusBarCenterSection>
        }
        {rightItems.length > 0 &&
          <StatusBarRightSection>
            {rightItems}
          </StatusBarRightSection>
        }
      </StatusBarSpaceBetween>
    );
  }
}
