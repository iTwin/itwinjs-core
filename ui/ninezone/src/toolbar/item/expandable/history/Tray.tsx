/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import Direction, { DirectionHelpers } from "../../../../utilities/Direction";
import CommonProps from "../../../../utilities/Props";

import "./Tray.scss";

export interface Entry<TItem> {
  key: string;
  item: TItem;
}

export interface HistoryProps<TItem> extends Array<Entry<TItem>> {
}

export const MAX_ITEM_CNT = 4;

export const addItem = <TItem extends {}>(key: string, item: TItem, props: HistoryProps<TItem>): HistoryProps<TItem> => {
  const itemToRemove = props.findIndex((entry) => {
    return entry.key === key;
  });
  if (itemToRemove > -1)
    props.splice(itemToRemove, 1);

  if (props.unshift({ key, item }) > MAX_ITEM_CNT)
    props.pop();

  return props;
};

export interface TrayProps extends CommonProps {
  direction?: Direction;
  isExpanded?: boolean;
  onIsExpandedChange?: (isExpanded: boolean) => void;
}

export default class Tray extends React.Component<TrayProps> {
  public render() {
    const count = React.Children.count(this.props.children);
    const tabVisible = count > 1 && !this.props.isExpanded;
    const className = classnames(
      "nz-toolbar-item-expandable-history-tray",
      DirectionHelpers.getCssClassName(this.props.direction || Direction.Left),
      tabVisible && "nz-tab-is-visible",
      this.props.isExpanded && "nz-is-extended",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        onMouseEnter={this.handleOnMouseEnter}
        onMouseLeave={this.handleOnMouseLeave}
      >
        <div className="nz-items">
          {this.props.children}
        </div>
        <div className="nz-tab">
          <div className="nz-triangle" />
        </div>
      </div>
    );
  }

  private handleOnMouseEnter = () => {
    this.props.onIsExpandedChange && this.props.onIsExpandedChange(true);
  }

  private handleOnMouseLeave = () => {
    this.props.onIsExpandedChange && this.props.onIsExpandedChange(false);
  }
}
