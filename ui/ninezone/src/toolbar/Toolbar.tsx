/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { Direction, DirectionHelpers, OrthogonalDirection, OrthogonalDirectionHelpers } from "../utilities/Direction";
import { CommonProps, NoChildrenProps } from "../utilities/Props";
import { Items } from "./Items";
import "./Toolbar.scss";

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
  /** History placeholders of the toolbar. See [[HistoryPlaceholder]] */
  histories?: React.ReactNode;
  /** Items of the toolbar. I.e. [[ExpandableItem]], [[Icon]], [[Item]], [[Overflow]] */
  items?: React.ReactNode;
  /** Describes how expanded panels are aligned. Defaults to: [[ToolbarPanelAlignment.Start]] */
  panelAlignment?: ToolbarPanelAlignment;
  /** Panel placeholders of the toolbar. See [[PanelPlaceholder]] */
  panels?: React.ReactNode;
}

export const getToolbarDirection = (expandsTo: Direction): OrthogonalDirection => {
  const orthogonalDirection = DirectionHelpers.getOrthogonalDirection(expandsTo);
  return OrthogonalDirectionHelpers.inverse(orthogonalDirection);
};

/**
 * A toolbar that may contain items.
 * @note See [[Scrollable]] for toolbar with scroll overflow strategy.
 */
export class Toolbar extends React.PureComponent<ToolbarProps> {
  public static readonly defaultProps = {
    expandsTo: Direction.Bottom,
    panelAlignment: ToolbarPanelAlignment.Start,
  };

  public render() {
    const direction = getToolbarDirection(this.props.expandsTo!);
    const className = classnames(
      "nz-toolbar-toolbar",
      DirectionHelpers.getCssClassName(this.props.expandsTo!),
      OrthogonalDirectionHelpers.getCssClassName(direction),
      ToolbarPanelAlignmentHelpers.getCssClassName(this.props.panelAlignment!),
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div
          className="nz-expanded nz-histories"
        >
          {this.props.histories}
        </div>
        <div
          className="nz-expanded nz-panels"
        >
          {this.props.panels}
        </div>
        <Items
          className="nz-items"
          direction={direction}
        >
          {this.props.items}
        </Items>
      </div >
    );
  }
}
