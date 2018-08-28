/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import * as ReactDOM from "react-dom";
import PointerCaptor from "../../../base/PointerCaptor";
import Point, { PointProps } from "../../../utilities/Point";
import Tab, { TabProps } from "./Tab";
import "./Draggable.scss";

/** Properties of [[Draggable]] component. */
export interface DraggableProps extends TabProps {
  /** Last pointer position of draggable tab. */
  lastPosition: PointProps | undefined;
  /** Function called when tab is dragged. */
  onDrag?: (dragged: PointProps) => void;
  /** Function called when tab drag action is started. */
  onDragStart?: (initialPosition: PointProps, widgetOffset: PointProps) => void;
  /** Function called when tab drag action is finished. */
  onDragFinish?: () => void;
}

/** Draggable tab of rectangular widget. Used in [[Stacked]] component. */
export default class Draggable extends React.Component<DraggableProps> {
  private _initial: Point | undefined = undefined;

  public render() {
    const { className, onClick, children, ...props } = this.props;
    const tabClassName = classnames(
      "nz-widget-rectangular-tab-draggable",
      className);

    return (
      <Tab
        className={tabClassName}
        {...props}
      >
        {children}
        <PointerCaptor
          className="nz-draggable"
          initialIsMouseDown={this.props.lastPosition ? true : false}
          onMouseDown={this._handleMouseDown}
          onMouseUp={this._handleMouseUp}
          onMouseMove={this._handleMouseMove}
        />
      </Tab>
    );
  }

  private _handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();

    this._initial = new Point(e.clientX, e.clientY);
  }

  private _handleMouseUp = () => {
    this._initial = undefined;
    if (this.props.lastPosition) {
      this.props.onDragFinish && this.props.onDragFinish();
      return;
    }

    this.props.onClick && this.props.onClick();
  }

  private _getFirstTab(): HTMLElement {
    const tab = ReactDOM.findDOMNode(this);
    if (!tab || !(tab instanceof HTMLElement))
      throw new TypeError();

    let firstTab = tab;
    while (firstTab.previousSibling) {
      if (!(firstTab.previousSibling instanceof HTMLElement))
        break;
      if (firstTab.previousSibling.classList.contains("nz-widget-rectangular-tab-separator"))
        break;
      firstTab = firstTab.previousSibling;
    }
    return firstTab;
  }

  private _handleMouseMove = (e: MouseEvent) => {
    const current = new Point(e.clientX, e.clientY);
    if (this.props.lastPosition) {
      const dragged = Point.create(this.props.lastPosition).getOffsetTo(current);
      this.props.onDrag && this.props.onDrag(dragged);
      return;
    }

    if (this._initial && current.getDistanceTo(this._initial) >= 6) {
      const firstTab = this._getFirstTab();
      if (!firstTab.parentNode || !(firstTab.parentNode instanceof HTMLElement))
        return;

      const tabRect = firstTab.getBoundingClientRect();
      const parentRect = firstTab.parentNode.getBoundingClientRect();
      const offset: PointProps = {
        x: tabRect.left - parentRect.left,
        y: tabRect.top - parentRect.top,
      };

      this.props.onDragStart && this.props.onDragStart(this._initial, offset);
    }
  }
}
