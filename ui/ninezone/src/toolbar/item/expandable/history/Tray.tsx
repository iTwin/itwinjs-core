/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import Direction, { DirectionHelpers } from "../../../../utilities/Direction";
import CommonProps, { NoChildrenProps, FlattenChildren } from "../../../../utilities/Props";
import "./Tray.scss";

/** Key to identify history item. */
export type HistoryKey = number | string;

/** A single entry in items history. */
export interface HistoryEntry<TItem> {
  /** Entry key. */
  key: HistoryKey;
  /** Entry item. */
  item: TItem;
}

/** History defines actual structure of history items. */
export type History<TItem> = Array<HistoryEntry<TItem>>;

/** Helper to manage history entries. */
export class HistoryManager {
  public constructor(public readonly maxItemCount: number) {
  }

  /**
   * Adds specified item to history and returns a new state of history.
   * @note Immutable operation.
   */
  public addItem<TItem extends {}>(key: HistoryKey, item: TItem, history: History<TItem>): History<TItem> {
    const itemToRemove = history.findIndex((entry) => {
      return entry.key === key;
    });
    const newHistory = itemToRemove < 0 ? [...history] :
      [
        ...history.slice(0, itemToRemove),
        ...history.slice(itemToRemove + 1),
      ];

    if (newHistory.unshift({ key, item }) > this.maxItemCount)
      newHistory.pop();

    return newHistory;
  }
}

/** History manager as defined by 9-Zone UI specification. */
// tslint:disable-next-line:variable-name
export const DefaultHistoryManager = new HistoryManager(4);

/** Properties of [[Tray]] component. */
export interface TrayProps extends CommonProps, NoChildrenProps {
  /** Extend direction of tray. */
  direction?: Direction;
  /** Describes if the tray is extended. If this is false, at most 1 item is visible. */
  isExtended?: boolean;
  /** Items of tray component. I.e. [[HistoryItem]], [[Icon]] */
  items?: React.ReactNode;
}

/** History tray used in [[ExpandableItem]] component. */
export default class Tray extends React.Component<TrayProps> {
  public render() {
    const items = FlattenChildren(this.props.items);
    const count = React.Children.count(items);
    const isExtendIndicatorVisible = count > 1 && !this.props.isExtended;
    const className = classnames(
      "nz-toolbar-item-expandable-history-tray",
      DirectionHelpers.getCssClassName(this.props.direction || Direction.Left),
      isExtendIndicatorVisible && "nz-extend-is-visible",
      this.props.isExtended && "nz-is-extended",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-items">
          {this.props.items}
        </div>
        <div className="nz-extend-indicator" />
      </div>
    );
  }
}
