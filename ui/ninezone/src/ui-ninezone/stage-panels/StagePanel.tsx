/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module StagePanels */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { ResizeGrip, ResizeDirection, ResizeGripResizeArgs } from "../widget/rectangular/ResizeGrip";
import { Point } from "../utilities/Point";
import { Rectangle } from "../utilities/Rectangle";
import "./StagePanel.scss";

/** Describes available stage panel types.
 * @beta
 */
export enum StagePanelType {
  Bottom,
  Left,
  Top,
  Right,
}

/** Helpers for [[StagePanelType]].
 * @internal
 */
export class StagePanelTypeHelpers {
  /** @returns Class name of specified [[StagePanelType]] */
  public static getCssClassName(type: StagePanelType): string {
    switch (type) {
      case StagePanelType.Bottom:
        return "nz-panel-bottom";
      case StagePanelType.Left:
        return "nz-panel-left";
      case StagePanelType.Right:
        return "nz-panel-right";
      case StagePanelType.Top:
        return "nz-panel-top";
    }
  }

  /** Returns true if stage panel with specified [[StagePanelType]] is vertical. */
  public static isVertical(type: StagePanelType): boolean {
    switch (type) {
      case StagePanelType.Bottom:
      case StagePanelType.Top:
        return false;
      case StagePanelType.Left:
      case StagePanelType.Right:
        return true;
    }
  }
}

/** Properties of [[StagePanel]] component.
 * @beta
 */
export interface StagePanelProps extends CommonProps {
  /** Stage panel content. */
  children?: React.ReactNode;
  /** Function called when stage panel collapse mode is toggled. */
  onToggleCollapse?: () => void;
  /** Function called when resize action is performed. */
  onResize?: (resizeBy: number) => void;
  /** Stage panel size. */
  size?: number;
  /** Stage panel type. */
  type: StagePanelType;
}

/** Stage panel used in [[StagePanels]] component.
 * @beta
 */
export class StagePanel extends React.PureComponent<StagePanelProps> {
  private _lastPosition?: Point;
  private _relativePosition?: Point;

  public render() {
    const className = classnames(
      "nz-stagePanels-stagePanel",
      StagePanelTypeHelpers.getCssClassName(this.props.type),
      this.props.className);
    const isVertical = StagePanelTypeHelpers.isVertical(this.props.type);
    const style = {
      ...this.props.size === undefined ? {} :
        isVertical ? { width: `${this.props.size}px` } : { height: `${this.props.size}px` },
      ...this.props.style,
    };
    return (
      <div
        className={className}
        style={style}
      >
        <div>
          {this.props.children}
        </div>
        {this.props.onResize && <ResizeGrip
          className="nz-resize-grip"
          direction={isVertical ? ResizeDirection.EastWest : ResizeDirection.NorthSouth}
          onClick={this.props.onToggleCollapse}
          onResize={this._handleResize}
          onResizeEnd={this._handleResizeEnd}
          onResizeStart={this._handleResizeStart}
        />}
      </div >
    );
  }

  private _handleResize = (args: ResizeGripResizeArgs) => {
    if (!this._lastPosition || !this._relativePosition)
      return;

    const bounds = Rectangle.create(args.bounds);
    const relativePosition = bounds.topLeft().getOffsetTo(args.position);
    const resizeOffset = this._relativePosition.getOffsetTo(relativePosition);
    const dragOffset = this._lastPosition.getOffsetTo(args.position);

    const isVertical = StagePanelTypeHelpers.isVertical(this.props.type);
    const dragBy = isVertical ? dragOffset.x : dragOffset.y;
    const resizeBy = isVertical ? resizeOffset.x : resizeOffset.y;

    this._lastPosition = Point.create(args.position);

    if (dragBy * resizeBy <= 0)
      return;

    const direction = this.props.type === StagePanelType.Left || this.props.type === StagePanelType.Top ? 1 : -1;
    this.props.onResize && this.props.onResize(direction * resizeBy);
  }

  private _handleResizeEnd = () => {
    this._lastPosition = undefined;
    this._relativePosition = undefined;
  }

  private _handleResizeStart = (args: ResizeGripResizeArgs) => {
    const bounds = Rectangle.create(args.bounds);
    this._relativePosition = bounds.topLeft().getOffsetTo(args.position);
    this._lastPosition = Point.create(args.position);
  }
}
