/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import Direction, { DirectionHelpers, OrthogonalDirection, OrthogonalDirectionHelpers } from "../utilities/Direction";
import CommonProps, { NoChildrenProps, FlattenChildren } from "../utilities/Props";
import { ExpandableItemProps } from "./item/expandable/Expandable";
import Items from "./Items";
import "./Toolbar.scss";

interface ToolbarItem {
  item: React.ReactNode;
  panel: React.ReactNode;
  history: React.ReactNode;
}

/** Available alignment modes of [[Toolbar]] panels. */
export enum ToolbarPanelAlignment {
  Start,
  End,
}

export class ToolbarPanelAlignmentHelpers {
  /** Class name of [[ToolbarPanelAlignment.Start]] */
  public static readonly START_CLASS_NAME = "nz-panel-alignment-start";
  /** Class name of [[ToolbarPanelAlignment.End]] */
  public static readonly END_CLASS_NAME = "nz-panel-alignment-end";

  /** @returns Class name of specified [[ToolbarPanelAlignment]] */
  public static getCssClassName(panelAlignment: ToolbarPanelAlignment): string {
    switch (panelAlignment) {
      case ToolbarPanelAlignment.Start:
        return ToolbarPanelAlignmentHelpers.START_CLASS_NAME;
      case ToolbarPanelAlignment.End:
        return ToolbarPanelAlignmentHelpers.END_CLASS_NAME;
    }
  }
}

/** Properties of [[Toolbar]] component. */
export interface ToolbarProps extends CommonProps, NoChildrenProps {
  /** Describes to which direction the history/panel items are expanded. Defaults to: [[Direction.Bottom]] */
  expandsTo?: Direction;
  /** Items of the toolbar. I.e. [[ExpandableItem]], [[Icon]], [[Item]], [[Overflow]] */
  items?: React.ReactNode;
  /** Describes how expanded panels are aligned. Defaults to: [[ToolbarPanelAlignment.Start]] */
  panelAlignment?: ToolbarPanelAlignment;
  /** Function called to render history items. */
  renderHistoryItems?: (historyItems: React.ReactNode) => React.ReactNode;
  /** Function called to render items. */
  renderItems?: (items: React.ReactNode) => React.ReactNode;
  /** Function called to render panel items. */
  renderPanelItems?: (panelItems: React.ReactNode) => React.ReactNode;
}

/**
 * A toolbar that may contain items.
 * @note See [[Scrollable]] for toolbar with scroll overflow strategy.
 */
export default class Toolbar extends React.Component<ToolbarProps> {
  /** @returns Toolbar direction based on [[ToolbarProps.expandsTo]] */
  public static getToolbarDirection(props: ToolbarProps): OrthogonalDirection {
    const expandsTo = Toolbar.getExpandsTo(props);
    const orthogonalDirection = DirectionHelpers.getOrthogonalDirection(expandsTo);
    return OrthogonalDirectionHelpers.inverse(orthogonalDirection);
  }

  /** @returns Count of toolbar items. */
  public static getItemCount(props: ToolbarProps) {
    const items = FlattenChildren(props.items);
    return React.Children.count(items);
  }

  /** @returns True if item is [[ExpandableItem]] */
  private static isExpandableItem(item: React.ReactChild): item is React.ReactElement<ExpandableItemProps> {
    if (React.isValidElement<ExpandableItemProps>(item))
      return true;
    return false;
  }

  private static getExpandsTo(props: ToolbarProps) {
    return props.expandsTo === undefined ? Direction.Bottom : props.expandsTo;
  }

  private static getPanelAlignment(props: ToolbarProps) {
    return props.panelAlignment === undefined ? ToolbarPanelAlignment.Start : props.panelAlignment;
  }

  private getToolbarItems(): ToolbarItem[] {
    const items = FlattenChildren(this.props.items);

    const toolbarItems = React.Children.map<ToolbarItem>(items, (child, index) => {
      const key = React.isValidElement(child) && child.key ? child.key : index;

      const panelRef = React.createRef<HTMLDivElement>();
      const panel = (
        <div
          key={key}
          className="nz-item"
          ref={panelRef}
        >
        </div>
      );

      const historyRef = React.createRef<HTMLDivElement>();
      const history = (
        <div
          key={key}
          className="nz-item"
          ref={historyRef}
        >
        </div>
      );

      const item = !Toolbar.isExpandableItem(child) ? child :
        React.cloneElement<ExpandableItemProps>(child, {
          key,
          renderHistoryTo: () => {
            if (!historyRef.current)
              throw new ReferenceError();
            return historyRef.current;
          },
          renderPanelTo: () => {
            if (!panelRef.current)
              throw new ReferenceError();
            return panelRef.current;
          },
        });

      return {
        item,
        panel,
        history,
      };
    });

    if (!toolbarItems)
      return [];
    return toolbarItems;
  }

  public render() {
    const orthogonalDirection = Toolbar.getToolbarDirection(this.props);
    const expandsTo = Toolbar.getExpandsTo(this.props);
    const panelAlignment = Toolbar.getPanelAlignment(this.props);
    const className = classnames(
      "nz-toolbar-toolbar",
      DirectionHelpers.getCssClassName(expandsTo),
      OrthogonalDirectionHelpers.getCssClassName(orthogonalDirection),
      ToolbarPanelAlignmentHelpers.getCssClassName(panelAlignment),
      this.props.className);

    const toolbarItems = this.getToolbarItems();
    const items = toolbarItems.map((toolbarItem) => toolbarItem.item);
    const historyItems = toolbarItems.map((toolbarItem) => toolbarItem.history);
    const panelItems = toolbarItems.map((toolbarItem) => toolbarItem.panel);
    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.renderHistoryItems ? this.props.renderHistoryItems(historyItems) :
          <div
            className="nz-expanded nz-history"
          >
            {historyItems}
          </div>
        }
        {this.props.renderPanelItems ? this.props.renderPanelItems(panelItems) :
          <div
            className="nz-expanded nz-panels"
          >
            {panelItems}
          </div>
        }
        {this.props.renderItems ? this.props.renderItems(items) :
          <Items
            className="nz-items"
            direction={orthogonalDirection}
          >
            {items}
          </Items>
        }
      </div >
    );
  }
}
