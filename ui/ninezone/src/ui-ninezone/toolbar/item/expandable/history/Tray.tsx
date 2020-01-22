/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps, flattenChildren } from "@bentley/ui-core";
import { Direction, DirectionHelpers } from "../../../../utilities/Direction";
import "./Tray.scss";

// tslint:disable: deprecation

/** Key to identify history item.
 * @alpha
 * @deprecated History tray removed from design standard.
 */
export type HistoryKey = number | string;

/** A single entry in items history.
 * @alpha
 * @deprecated History tray removed from design standard.
 */
export interface HistoryEntry<TItem> {
  /** Entry key. */
  key: HistoryKey; // tslint:disable-line: deprecation
  /** Entry item. */
  item: TItem;
}

/** History defines actual structure of history items.
 * @alpha
 * @deprecated History tray removed from design standard.
 */
export type History<TItem> = Array<HistoryEntry<TItem>>; // tslint:disable-line: deprecation

/** Helper to manage history entries.
 * @alpha
 * @deprecated History tray removed from design standard.
 */
export class HistoryManager {
  public constructor(public readonly maxItemCount: number) {
  }

  /**
   * Adds specified item to history and returns a new state of history.
   * @note Immutable operation.
   */
  public addItem<TItem extends {}>(key: HistoryKey, item: TItem, history: History<TItem>): History<TItem> { // tslint:disable-line: deprecation
    const itemToRemove = history.findIndex((entry) => {
      return entry.key === key;
    });
    const newHistory = itemToRemove < 0 ? [...history] : [
      ...history.slice(0, itemToRemove),
      ...history.slice(itemToRemove + 1),
    ];

    if (newHistory.unshift({ key, item }) > this.maxItemCount)
      newHistory.pop();

    return newHistory;
  }
}

/** History manager as defined by 9-Zone UI specification.
 * @alpha
 * @deprecated History tray removed from design standard.
 */
// tslint:disable-next-line:variable-name
export const DefaultHistoryManager = new HistoryManager(4); // tslint:disable-line: deprecation

/** Properties of [[HistoryTray]] component.
 * @alpha
 * @deprecated History tray removed from design standard.
 */
export interface HistoryTrayProps extends CommonProps, NoChildrenProps {
  /** Extend direction of tray. */
  direction?: Direction;
  /** Describes if the tray is extended. If this is false, at most 1 item is visible. */
  isExtended?: boolean;
  /** Items of tray component. I.e. [[HistoryItem]], [[Icon]] */
  items?: React.ReactNode;
  /** Function called when history tray should be extended or shrank. */
  onIsHistoryExtendedChange?: (isExtended: boolean) => void;
}

/** History tray used in [[ExpandableItem]] component.
 * @alpha
 * @deprecated History tray removed from design standard.
 */
export class HistoryTray extends React.PureComponent<HistoryTrayProps> { // tslint:disable-line: deprecation
  public render() {
    const items = flattenChildren(this.props.items);
    const count = React.Children.count(items);
    const isExtendIndicatorVisible = count > 1 && !this.props.isExtended;
    const className = classnames(
      "nz-toolbar-item-expandable-history-tray",
      DirectionHelpers.getCssClassName(this.props.direction || Direction.Left),
      isExtendIndicatorVisible && "nz-extend-visible",
      this.props.isExtended && "nz-extended",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        onMouseEnter={this._handleMouseEnter}
        onMouseLeave={this._handleMouseLeave}
      >
        <div className="nz-items">
          {this.props.items}
        </div>
        <div className="nz-extend-indicator" />
      </div>
    );
  }

  private _handleMouseEnter = () => {
    this.props.onIsHistoryExtendedChange && this.props.onIsHistoryExtendedChange(true);
  }

  private _handleMouseLeave = () => {
    this.props.onIsHistoryExtendedChange && this.props.onIsHistoryExtendedChange(false);
  }
}
