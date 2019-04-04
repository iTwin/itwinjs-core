/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { Direction, OrthogonalDirection, DirectionHelpers, OrthogonalDirectionHelpers } from "../utilities/Direction";
import { FlattenChildren } from "../utilities/Props";
import { Indicator } from "./scroll/Indicator";
import { ToolbarProps, getToolbarDirection, ToolbarPanelAlignmentHelpers, PanelsProvider, Toolbar } from "./Toolbar";
import { Items } from "./Items";
import "./Scrollable.scss";

/** Properties of [[Scrollable]] component. */
export interface ScrollableProps extends ToolbarProps {
  /** Describes number of visible elements. Should not be lower than 3. */
  visibleItemThreshold: number;
  /** Function called when component scrolls. */
  onScroll?: () => void;
}

/** State of [[Scrollable]] component. */
export interface ScrollableState {
  /** Describes component scroll offset. */
  scrollOffset: number;
}

const getItemCount = (props: ToolbarProps) => {
  const items = FlattenChildren(props.items);
  return React.Children.count(items);
};

export type ScrollableDefaultProps = Pick<ScrollableProps, "visibleItemThreshold">;

/** A [[Toolbar]] with scroll overflow strategy. */
export class Scrollable extends React.PureComponent<ScrollableProps, ScrollableState> {
  private static readonly _DESKTOP_ITEM_WIDTH = 40;
  private static readonly _DESKTOP_ITEM_HEIGHT = Scrollable._DESKTOP_ITEM_WIDTH;
  private static readonly _DESKTOP_SEPARATOR_SIZE = 1;
  private static readonly _BORDER_WIDTH = 1;

  private _histories = React.createRef<HTMLDivElement>();
  private _panels = React.createRef<HTMLDivElement>();

  public static readonly defaultProps: ScrollableDefaultProps = {
    ...Toolbar.defaultProps,
    visibleItemThreshold: 5,
  };

  public readonly state: Readonly<ScrollableState> = {
    scrollOffset: 0,
  };

  public componentDidUpdate(prevProps: Readonly<ScrollableProps>): void {
    const prevCount = getItemCount(prevProps);
    const count = getItemCount(this.props);
    if (prevCount !== count)
      this.setState(() => ({ scrollOffset: 0 }));
  }

  public render() {
    return (
      <PanelsProvider
        histories={this._histories}
        items={this.props.items}
        panels={this._panels}
      >
        {this._renderItems}
      </PanelsProvider>
    );
  }

  private getVisibleItemCount() {
    const itemCount = getItemCount(this.props);
    return Math.min(this.props.visibleItemThreshold!, itemCount);
  }

  private getViewportLength(itemLength: number) {
    const visibleItemCount = this.getVisibleItemCount();
    const itemsLength = visibleItemCount * itemLength;
    const separatorsLength = Math.max(0, visibleItemCount - 1) * Scrollable._DESKTOP_SEPARATOR_SIZE;
    let length = itemsLength + separatorsLength;
    if (this.isLeftMostScrolled())
      length += Scrollable._BORDER_WIDTH;
    if (this.isRightMostScrolled())
      length += Scrollable._BORDER_WIDTH;
    return length;
  }

  private getViewportStyle(direction: OrthogonalDirection): React.CSSProperties {
    switch (direction) {
      case OrthogonalDirection.Vertical: {
        return {
          height: this.getViewportLength(Scrollable._DESKTOP_ITEM_HEIGHT),
        };
      }
      case OrthogonalDirection.Horizontal: {
        return {
          width: this.getViewportLength(Scrollable._DESKTOP_ITEM_WIDTH),
        };
      }
    }
  }

  private getVisibleHistoryItemCount() {
    let itemCount = this.getVisibleItemCount();
    if (this.isLeftScrollIndicatorVisible()) {
      itemCount -= 1;
    }
    if (this.isRightScrollIndicatorVisible()) {
      itemCount -= 1;
    }
    return itemCount;
  }

  private getHistoryViewportLength(itemLength: number) {
    const itemCount = this.getVisibleHistoryItemCount();
    const itemsLength = itemCount * itemLength;
    const separatorsLength = itemCount * Scrollable._DESKTOP_SEPARATOR_SIZE;
    const length = itemsLength + separatorsLength;
    return length;
  }

  private getHistoryViewportOffset(itemLength: number) {
    let offset = 0;
    if (this.isLeftScrollIndicatorVisible()) {
      offset += itemLength + Scrollable._BORDER_WIDTH;
    }
    if (!this.isLeftMostScrolled() && this.isRightMostScrolled()) {
      offset -= Scrollable._BORDER_WIDTH;
    }
    return offset;
  }

  private getHistoryViewportStyle(direction: OrthogonalDirection): React.CSSProperties {
    switch (direction) {
      case OrthogonalDirection.Vertical: {
        const height = this.getHistoryViewportLength(Scrollable._DESKTOP_ITEM_HEIGHT);
        const top = this.getHistoryViewportOffset(Scrollable._DESKTOP_ITEM_HEIGHT);
        return {
          height,
          top,
        };
      }
      case OrthogonalDirection.Horizontal: {
        const width = this.getHistoryViewportLength(Scrollable._DESKTOP_ITEM_WIDTH);
        const left = this.getHistoryViewportOffset(Scrollable._DESKTOP_ITEM_WIDTH);
        return {
          width,
          left,
        };
      }
    }
  }

  private getHistoryScrolledStyle(direction: OrthogonalDirection): React.CSSProperties {
    switch (direction) {
      case OrthogonalDirection.Vertical: {
        const marginTop = this.getScrollOffset(Scrollable._DESKTOP_ITEM_HEIGHT);
        const top = -this.getHistoryViewportOffset(Scrollable._DESKTOP_ITEM_HEIGHT);
        return {
          marginTop,
          top,
        };
      }
      case OrthogonalDirection.Horizontal: {
        const marginLeft = this.getScrollOffset(Scrollable._DESKTOP_ITEM_WIDTH);
        const left = -this.getHistoryViewportOffset(Scrollable._DESKTOP_ITEM_WIDTH);
        return {
          marginLeft,
          left,
        };
      }
    }
  }

  private getScrollOffset(itemLength: number) {
    const itemsLength = this.state.scrollOffset * itemLength;
    const separatorsLength = this.state.scrollOffset * Scrollable._DESKTOP_SEPARATOR_SIZE;
    let offset = itemsLength + separatorsLength;
    if (!this.isLeftMostScrolled() && this.isRightMostScrolled())
      offset += Scrollable._BORDER_WIDTH;
    return -offset;
  }

  private getScrolledStyle(direction: OrthogonalDirection): React.CSSProperties {
    switch (direction) {
      case OrthogonalDirection.Vertical: {
        const marginTop = this.getScrollOffset(Scrollable._DESKTOP_ITEM_HEIGHT);
        return { marginTop };
      }
      case OrthogonalDirection.Horizontal: {
        const marginLeft = this.getScrollOffset(Scrollable._DESKTOP_ITEM_WIDTH);
        return { marginLeft };
      }
    }
  }

  private _handleLeftScroll = () => {
    this.setState(
      (prevState) => {
        let scrollOffset = prevState.scrollOffset - 1;
        scrollOffset = Math.max(0, scrollOffset);
        return {
          ...prevState,
          scrollOffset,
        };
      },
      () => this.props.onScroll && this.props.onScroll(),
    );
  }

  private _handleRightScroll = () => {
    this.setState(
      (prevState, props) => {
        const itemCnt = getItemCount(props);
        let scrollOffset = prevState.scrollOffset + 1;
        scrollOffset = Math.min(itemCnt - this.getVisibleItemCount(), scrollOffset);
        return {
          ...prevState,
          scrollOffset,
        };
      },
      () => this.props.onScroll && this.props.onScroll(),
    );
  }

  private isLeftScrollIndicatorVisible() {
    return this.state.scrollOffset > 0;
  }

  private isRightScrollIndicatorVisible() {
    const itemCnt = getItemCount(this.props);
    return itemCnt - this.getVisibleItemCount() - this.state.scrollOffset > 0;
  }

  private isLeftMostScrolled() {
    return this.state.scrollOffset === 0;
  }

  private isRightMostScrolled() {
    const itemCnt = getItemCount(this.props);
    return itemCnt - this.getVisibleItemCount() - this.state.scrollOffset === 0;
  }

  private _renderItems = (items: React.ReactNode) => {
    const isLeftScrollIndicatorVisible = this.isLeftScrollIndicatorVisible();
    const isRightScrollIndicatorVisible = this.isRightScrollIndicatorVisible();
    const direction = getToolbarDirection(this.props.expandsTo!);

    const className = classnames(
      "nz-toolbar-scrollable",
      DirectionHelpers.getCssClassName(this.props.expandsTo!),
      OrthogonalDirectionHelpers.getCssClassName(direction),
      ToolbarPanelAlignmentHelpers.getCssClassName(this.props.panelAlignment!),
      isLeftScrollIndicatorVisible && !isRightScrollIndicatorVisible && "nz-scroll-indicator-left-only",
      !isLeftScrollIndicatorVisible && isRightScrollIndicatorVisible && "nz-scroll-indicator-right-only",
      this.props.className);

    const leftIndicatorClassName = classnames(
      "nz-left",
      isLeftScrollIndicatorVisible && "nz-visible",
    );
    const rightIndicatorClassName = classnames(
      "nz-right",
      isRightScrollIndicatorVisible && "nz-visible",
    );

    const viewportStyle = this.getViewportStyle(direction);
    const scrolledStyle = this.getScrolledStyle(direction);
    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div
          className="nz-expanded nz-histories"
        >
          <div
            className="nz-viewport"
            style={this.getHistoryViewportStyle(direction)}
          >
            <div
              className="nz-container"
              style={this.getHistoryScrolledStyle(direction)}
              ref={this._histories}
            >
            </div>
          </div>
        </div>
        <div
          className="nz-expanded nz-panels"
          style={scrolledStyle}
          ref={this._panels}
        >
        </div>
        <div
          className="nz-items-viewport"
          style={viewportStyle}
        >
          <Items
            className="nz-items"
            direction={direction}
            style={scrolledStyle}
          >
            {items}
          </Items>
          <Indicator
            className={leftIndicatorClassName}
            direction={direction === OrthogonalDirection.Vertical ? Direction.Top : Direction.Left}
            onClick={this._handleLeftScroll}
          />
          <Indicator
            className={rightIndicatorClassName}
            direction={direction === OrthogonalDirection.Vertical ? Direction.Bottom : Direction.Right}
            onClick={this._handleRightScroll}
          />
        </div>
      </div >
    );
  }
}
