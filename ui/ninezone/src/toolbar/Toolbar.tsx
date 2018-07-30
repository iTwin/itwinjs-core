/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../utilities/Props";
import "./Toolbar.scss";
import { ExpandableItemProps } from "./item/expandable/Expandable";
import Items from "./Items";
import Direction, { DirectionHelpers, OrthogonalDirection, OrthogonalDirectionHelpers } from "../utilities/Direction";

interface ToolbarItem {
  item: React.ReactNode;
  panel: React.ReactNode;
  history: React.ReactNode;
}

export interface ToolbarProps extends CommonProps {
  expandsTo?: Direction;
  renderItems?: (items: React.ReactNode) => React.ReactNode;
  renderHistoryItems?: (historyItems: React.ReactNode) => React.ReactNode;
  renderPanelItems?: (panelItems: React.ReactNode) => React.ReactNode;
}

export default class Toolbar extends React.Component<ToolbarProps> {
  private _panelRefs = new Map<React.Key, React.RefObject<HTMLDivElement>>();
  private _panelsToRender = new Map<React.Key, HTMLElement>();

  private _historyRefs = new Map<React.Key, React.RefObject<HTMLDivElement>>();
  private _historyItemsToRender = new Map<React.Key, HTMLElement>();

  public static getToolbarDirection(direction: Direction): OrthogonalDirection {
    switch (direction) {
      case Direction.Left:
      case Direction.Right:
        return OrthogonalDirection.Vertical;
      case Direction.Top:
      case Direction.Bottom:
        return OrthogonalDirection.Horizontal;
    }
  }

  public static getExpandsToDirection(props: ToolbarProps) {
    if (props.expandsTo !== undefined)
      return props.expandsTo;
    return Direction.Bottom;
  }

  public static isExpandableItem(item: React.ReactChild): item is React.ReactElement<ExpandableItemProps> {
    if (React.isValidElement<ExpandableItemProps>(item))
      return true;
    return false;
  }

  public componentDidMount(): void {
    this._panelsToRender.forEach((panelToRender, key) => {
      const panelRef = this._panelRefs.get(key);
      if (!panelRef || !panelRef.current)
        return;

      panelRef.current.appendChild(panelToRender);
    });
    this._panelsToRender.clear();
    this._panelRefs.clear();

    this._historyItemsToRender.forEach((item, key) => {
      const historyRef = this._historyRefs.get(key);
      if (!historyRef || !historyRef.current)
        return;

      historyRef.current.appendChild(item);
    });
    this._historyItemsToRender.clear();
    this._historyRefs.clear();
  }

  private handleRenderPanel(key: React.Key, panel: HTMLElement) {
    this._panelsToRender.set(key, panel);
  }

  private handleRenderHistory(key: React.Key, panel: HTMLElement) {
    this._historyItemsToRender.set(key, panel);
  }

  private getToolbarItems(): ToolbarItem[] {
    if (!this.props.children)
      return [];

    return React.Children.map<ToolbarItem>(this.props.children, (child, index) => {
      const key = React.isValidElement(child) && child.key ? child.key : index;

      const panelRef = React.createRef<HTMLDivElement>();
      const panel = (
        <div
          key={key}
          ref={panelRef}
          className="nz-item"
        >
        </div>
      );
      this._panelRefs.set(key, panelRef);

      const historyRef = React.createRef<HTMLDivElement>();
      const history = (
        <div
          key={key}
          ref={historyRef}
          className="nz-item"
        >
        </div>
      );
      this._historyRefs.set(key, historyRef);

      const item = !Toolbar.isExpandableItem(child) ? child :
        React.cloneElement(child, {
          key,
          renderPanel: (el) => {
            this.handleRenderPanel(key, el);
          },
          renderHistory: (el) => {
            this.handleRenderHistory(key, el);
          },
        } as ExpandableItemProps);

      return {
        item,
        panel,
        history,
      };
    });
  }

  public render() {
    const expandsTo = Toolbar.getExpandsToDirection(this.props);
    const orthogonalDirection = Toolbar.getToolbarDirection(expandsTo);
    const className = classnames(
      "nz-toolbar-toolbar",
      DirectionHelpers.getCssClassName(expandsTo),
      OrthogonalDirectionHelpers.getCssClassName(orthogonalDirection),
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
        {this.props.renderItems ? this.props.renderItems(items) :
          <Items
            className="nz-items"
            direction={orthogonalDirection}
          >
            {items}
          </Items>
        }
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
      </div >
    );
  }
}
