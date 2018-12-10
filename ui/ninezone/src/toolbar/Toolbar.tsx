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

/** Properties of [[PanelsProvider]] component. */
export interface PanelsProviderProps {
  /** Render prop that provides item panels. */
  children?: (histories: React.ReactNode, panels: React.ReactNode) => React.ReactNode;
  /** Items of the toolbar. */
  items?: React.ReactNode;
}

export class PanelsProvider extends React.PureComponent<PanelsProviderProps> {
  public render() {
    const mapped = React.Children.toArray(this.props.items).reduce((acc, item, index) => {
      if (!React.isValidElement<WithExpandableItemProps>(item))
        return acc;

      const panel = (
        <div
          key={item.key || index}
        >
          {item.props.panel}
        </div>
      );

      const history = (
        <div
          key={item.key || index}
        >
          {item.props.history}
        </div>
      );

      acc.panels.push(panel);
      acc.histories.push(history);
      return acc;
    },
      {
        panels: new Array<React.ReactNode>(),
        histories: new Array<React.ReactNode>(),
      });
    return this.props.children && this.props.children(mapped.histories, mapped.panels);
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
    return (
      <PanelsProvider
        items={this.props.items}
      >
        {this._renderItems}
      </PanelsProvider>
    );
  }

  private _renderItems = (histories: React.ReactNode, panels: React.ReactNode) => {
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
          {histories}
        </div>
        <div
          className="nz-expanded nz-panels"
        >
          {panels}
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

/** Properties of [[withExpandableItem]] HOC. */
export interface WithExpandableItemProps {
  /** History of the toolbar. See [[]] */
  history?: React.ReactNode;
  /** Panel of the toolbar. See [[]] */
  panel?: React.ReactNode;
}

/** HOC which will ensure, that wrapped component conforms to expandable item interface. */
export const withExpandableItem = <ComponentProps extends {}>(
  // tslint:disable-next-line:variable-name
  Component: React.ComponentType<ComponentProps>,
) => {
  return class WithExpandableItem extends React.PureComponent<ComponentProps & WithExpandableItemProps> {
    public render() {
      return (
        <Component
          {...this.props}
        />
      );
    }
  };
};
