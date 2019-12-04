/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StatusBar */

import * as React from "react";
import { StatusBarSpaceBetween, StatusBarLeftSection, StatusBarCenterSection, StatusBarRightSection } from "./StatusBar";
import { StatusBarSection, StatusBarItem } from "./StatusBarItem";
import { StatusBarItemsManager } from "./StatusBarItemsManager";

/** Properties for the [[StatusBarComposer]] React components
 * @beta
 */
export interface StatusBarComposerProps {
  /** StatusBar items manager containing status fields */
  itemsManager: StatusBarItemsManager;
}

/** @internal */
interface StatusBarComposerState {
  statusBarItems: ReadonlyArray<StatusBarItem>;
}

/** StatusBar component composed from [[StatusBarItem]].
 * @beta
 */
export class StatusBarComposer extends React.PureComponent<StatusBarComposerProps, StatusBarComposerState> {
  /** @internal */
  public readonly state: StatusBarComposerState = {
    statusBarItems: [],
  };

  /** @internal */
  public componentDidMount() {
    this.props.itemsManager.onItemsChanged.addListener(this._handleStatusBarItemsChanged);
    this.setState((_, props) => ({ statusBarItems: props.itemsManager.items }));
  }

  /** @internal */
  public componentWillUnmount() {
    this.props.itemsManager.onItemsChanged.removeListener(this._handleStatusBarItemsChanged);
  }

  /** @internal */
  public componentDidUpdate(prevProps: StatusBarComposerProps) {
    if (this.props.itemsManager !== prevProps.itemsManager) {
      prevProps.itemsManager.onItemsChanged.removeListener(this._handleStatusBarItemsChanged);
      this.props.itemsManager.onItemsChanged.addListener(this._handleStatusBarItemsChanged);
      this.setState((_, props) => ({ statusBarItems: props.itemsManager.items }));
    }
  }

  private _handleStatusBarItemsChanged = () => {
    this.setState((_, props) => ({ statusBarItems: props.itemsManager.items }));
  }

  private getSectionItems(section: StatusBarSection): React.ReactNode[] {
    const sectionItems = this.state.statusBarItems
      .filter((item) => item.section === section && item.isVisible)
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
        <StatusBarLeftSection>
          {leftItems}
        </StatusBarLeftSection>
        <StatusBarCenterSection>
          {centerItems}
        </StatusBarCenterSection>
        <StatusBarRightSection>
          {rightItems}
        </StatusBarRightSection>
      </StatusBarSpaceBetween>
    );
  }
}
