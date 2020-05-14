/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import _ from "lodash";
import * as React from "react";
import { Geometry } from "@bentley/geometry-core";
import { Omit, Orientation, RatioChangeResult } from "@bentley/ui-core";
import { PropertyCategory } from "../PropertyDataProvider";
import { PropertyCategoryBlock, PropertyCategoryBlockProps } from "./PropertyCategoryBlock";
import { PropertyList, PropertyListProps } from "./PropertyList";

/** @internal */
export interface ResizeHandlingSelectablePropertyBlockProps extends PropertyCategoryBlockProps, Omit<PropertyListProps, "onColumnChanged" | "columnRatio" |
  "isResizeHandleHovered" | "onResizeHandleHoverChanged" | "isResizeHandleBeingDragged" | "onResizeHandleDragChanged" | "columnInfo"> {
  /* The property category to display */
  category: PropertyCategory;
  /** Custom CSS class name for the property list */
  listClassName?: string;
  /** Custom CSS Style for the property list */
  listStyle?: React.CSSProperties;
  /** Minimum allowed label column width, after which resizing stops */
  minLabelWidth?: number;
  /** Minimum allowed value column width, after which resizing stops */
  minValueWidth?: number;
  /** Fixed action button column width */
  actionButtonWidth?: number;
}

/** @internal */
export interface ResizeHandlingSelectablePropertyBlockState {
  columnRatio: number;
  isResizeHandleHovered: boolean;
  isResizeHandleBeingDragged: boolean;
  isMinimumColumnSizeEnabled: boolean;
}

/**
 * Wrapped PropertyCategoryBlock React component with list of properties and render optimization
 * @internal
 */
export class ResizeHandlingSelectablePropertyBlock
  extends React.Component<ResizeHandlingSelectablePropertyBlockProps, ResizeHandlingSelectablePropertyBlockState> {
  private readonly _initialRatio = 0.25;
  private readonly _defaultMinRatio = 0.15;
  private readonly _defaultMaxRatio = 0.6;
  private _minRatio = this._defaultMinRatio;
  private _maxRatio = this._defaultMaxRatio;

  public state: ResizeHandlingSelectablePropertyBlockState = {
    columnRatio: this._initialRatio,
    isResizeHandleHovered: false,
    isResizeHandleBeingDragged: false,
    isMinimumColumnSizeEnabled: true,
  };

  public static defaultProps: Partial<ResizeHandlingSelectablePropertyBlockProps> = {
    minLabelWidth: 128,
    minValueWidth: 150,
    actionButtonWidth: 90,
  };

  private _onColumnRatioChanged = (ratio: number): RatioChangeResult => {
    ratio = Geometry.clamp(ratio, this._minRatio, this._maxRatio);
    if (this.state.columnRatio === ratio)
      return { ratio };

    this.setState({ columnRatio: ratio });
    return { ratio };
  }

  private _onResizeHandleHoverChanged = (isHovered: boolean) => {
    this.setState({ isResizeHandleHovered: isHovered });
  }

  private _onResizeHandleDragChanged = (isDragStarted: boolean) => {
    this.setState({ isResizeHandleBeingDragged: isDragStarted });
  }

  private _onListWidthChange = (width: number) => {
    if (this.props.orientation !== Orientation.Horizontal)
      return;

    // Restore default behavior for screens that are too small to have minimum column widths
    if (width < this.props.minLabelWidth! + 1 + this.props.minValueWidth! + this.props.actionButtonWidth!) {
      this._minRatio = this._defaultMinRatio;
      this._maxRatio = this._defaultMaxRatio;
      if (this.state.isMinimumColumnSizeEnabled)
        this.setState({ isMinimumColumnSizeEnabled: false });

      return;
    }

    this._minRatio = this.props.minLabelWidth! / width;
    this._maxRatio = (width - this.props.actionButtonWidth! - this.props.minValueWidth!) / width;
    if (!this.state.isMinimumColumnSizeEnabled)
      this.setState({ isMinimumColumnSizeEnabled: true });
  }

  private getValidColumnRatio(): number {
    return Geometry.clamp(this.state.columnRatio, this._minRatio, this._maxRatio);
  }

  public render() {
    const { children, onExpansionToggled, className, style, listClassName, listStyle, ...props } = this.props;

    const listProps: PropertyListProps = {
      ...props,
      className: listClassName,
      style: listStyle,
      onColumnChanged: this._onColumnRatioChanged,
      columnRatio: this.getValidColumnRatio(),
      isResizeHandleHovered: this.state.isResizeHandleHovered,
      onResizeHandleHoverChanged: this._onResizeHandleHoverChanged,
      isResizeHandleBeingDragged: this.state.isResizeHandleBeingDragged,
      onResizeHandleDragChanged: this._onResizeHandleDragChanged,
      onListWidthChanged: this._onListWidthChange,
      columnInfo: {
        minLabelWidth: this.props.minLabelWidth!,
        minValueWidth: this.props.minValueWidth!,
        actionButtonWidth: this.props.actionButtonWidth!,
        isMinimumColumnSizeEnabled: this.state.isMinimumColumnSizeEnabled,
      },
    };

    return (
      <PropertyCategoryBlock category={this.props.category}
        onExpansionToggled={onExpansionToggled}
        className={className}
        style={style}
      >
        <PropertyList {...listProps} />
      </PropertyCategoryBlock>
    );
  }
}
