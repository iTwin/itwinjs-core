/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { Edge } from "../utilities/Rectangle";
import Content from "./rectangular/Content";
import ResizeGrip, { ResizeDirection } from "./rectangular/ResizeGrip";
import ResizeHandle from "./rectangular/ResizeHandle";
import CommonProps, { NoChildrenProps } from "../utilities/Props";
import "./Stacked.scss";

/** Available [[Stacked]] widget horizontal anchors. */
export enum HorizontalAnchor {
  Left,
  Right,
}

/** Available [[Stacked]] widget vertical anchors. */
export enum VerticalAnchor {
  Middle,
  Bottom,
}

/** Helpers for [[HorizontalAnchor]]. */
export class HorizontalAnchorHelpers {
  /** Class name of [[HorizontalAnchor.Left]] */
  public static readonly LEFT_CLASS_NAME = "nz-left-anchor";
  /** Class name of [[HorizontalAnchor.Right]] */
  public static readonly RIGHT_CLASS_NAME = "nz-right-anchor";

  /** @returns Class name of specified [[HorizontalAnchor]] */
  public static getCssClassName(anchor: HorizontalAnchor): string {
    switch (anchor) {
      case HorizontalAnchor.Left:
        return HorizontalAnchorHelpers.LEFT_CLASS_NAME;
      case HorizontalAnchor.Right:
        return HorizontalAnchorHelpers.RIGHT_CLASS_NAME;
    }
  }
}

/** Helpers for [[Anchor]]. */
export class VerticalAnchorHelpers {
  /** Class name of [[VerticalAnchor.Start]] */
  public static readonly MIDDLE_CLASS_NAME = "nz-middle-anchor";
  /** Class name of [[VerticalAnchor.End]] */
  public static readonly BOTTOM_CLASS_NAME = "nz-bottom-anchor";

  /** @returns Class name of specified [[VerticalAnchor]] */
  public static getCssClassName(anchor: VerticalAnchor): string {
    switch (anchor) {
      case VerticalAnchor.Middle:
        return VerticalAnchorHelpers.MIDDLE_CLASS_NAME;
      case VerticalAnchor.Bottom:
        return VerticalAnchorHelpers.BOTTOM_CLASS_NAME;
    }
  }
}

/** Properties of [[Stacked]] component. */
export interface StackedProps extends CommonProps, NoChildrenProps {
  /** Content of this widget. */
  content?: React.ReactNode;
  /** Describes if the widget should fill the zone. */
  fillZone?: boolean;
  /** Describes to which side the widget is horizontally anchored. Defaults to [[HorizontalAnchor.Right]] */
  horizontalAnchor?: HorizontalAnchor;
  /** Describes if the widget is being dragged. */
  isDragged?: boolean;
  /** True if widget is open, false otherwise. */
  isOpen?: boolean;
  /** Function called when resize action is performed. */
  onResize?: (x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) => void;
  /** Widget tabs. See: [[Draggable]], [[TabSeparator]], [[Tab]], [[Group]] */
  tabs?: React.ReactNode;
  /** Describes to which side the widget is vertically anchored. Defaults to [[VerticalAnchor.Middle]] */
  verticalAnchor?: VerticalAnchor;
}

/**
 * Stacked widget is used to display multiple tabs and some content.
 * @note Should be placed in [[Zone]] component.
 */
// tslint:disable-next-line:variable-name
export class Stacked extends React.PureComponent<StackedProps> {
  private _widget = React.createRef<HTMLDivElement>();

  private _getFilledHeightDiff(): number {
    if (this.props.fillZone)
      return 0;

    const widget = this._widget.current;
    if (!widget)
      return 0;

    const heightStyle = widget.style.height;
    const height = widget.clientHeight;

    widget.style.height = "100%";
    const filledHeight = widget.clientHeight;

    widget.style.height = heightStyle;

    const offset = filledHeight - height;
    return offset;
  }

  private _handleTabsGripResize = (x: number) => {
    const filledHeightDiff = this._getFilledHeightDiff();
    const horizontalAnchor = this.props.horizontalAnchor === undefined ? HorizontalAnchor.Right : this.props.horizontalAnchor;
    switch (horizontalAnchor) {
      case HorizontalAnchor.Left: {
        this.props.onResize && this.props.onResize(x, 0, Edge.Right, filledHeightDiff);
        break;
      }
      case HorizontalAnchor.Right: {
        this.props.onResize && this.props.onResize(x, 0, Edge.Left, filledHeightDiff);
        break;
      }
    }
  }

  private _handleContentGripResize = (x: number) => {
    this.props.onResize && this.props.onResize(x, 0, Edge.Right, 0);
  }

  private _handleTopGripResize = (_x: number, y: number) => {
    const filledHeightDiff = this._getFilledHeightDiff();
    this.props.onResize && this.props.onResize(0, y, Edge.Top, filledHeightDiff);
  }

  private _handleBottomGripResize = (_x: number, y: number) => {
    const filledHeightDiff = this._getFilledHeightDiff();
    this.props.onResize && this.props.onResize(0, y, Edge.Bottom, filledHeightDiff);
  }

  public render() {
    const horizontalAnchor = this.props.horizontalAnchor === undefined ? HorizontalAnchor.Right : this.props.horizontalAnchor;
    const className = classnames(
      "nz-widget-stacked",
      HorizontalAnchorHelpers.getCssClassName(horizontalAnchor),
      VerticalAnchorHelpers.getCssClassName(this.props.verticalAnchor === undefined ? VerticalAnchor.Middle : this.props.verticalAnchor),
      !this.props.isOpen && "nz-is-closed",
      this.props.isDragged && "nz-is-dragged",
      this.props.fillZone && "nz-fill-zone",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        ref={this._widget}
      >
        <div className="nz-content-area">
          <Content
            className="nz-content"
            anchor={horizontalAnchor}
            content={this.props.content}
          />
          <ResizeGrip
            className="nz-bottom-grip"
            direction={ResizeDirection.NorthSouth}
            onResize={this._handleBottomGripResize}
          />
          <ResizeGrip
            className="nz-content-grip"
            direction={ResizeDirection.EastWest}
            onResize={this._handleContentGripResize}
          />
        </div>
        <div className="nz-tabs-column">
          <div className="nz-tabs">
            {this.props.tabs}
          </div>
          <div className="nz-tabs-grip-container">
            <ResizeGrip
              className="nz-tabs-grip"
              direction={ResizeDirection.EastWest}
              onResize={this._handleTabsGripResize}
            />
          </div>
        </div>
        <ResizeGrip
          className="nz-top-grip"
          direction={ResizeDirection.NorthSouth}
          onResize={this._handleTopGripResize}
        />
      </div>
    );
  }
}

export default Stacked;
