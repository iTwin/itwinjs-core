/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import Direction, { OrthogonalDirection } from "../utilities/Direction";
import Toolbar, { ToolbarProps } from "./Toolbar";
import Items from "./Items";
import Indicator from "./scroll/Indicator";
import "./Scrollable.scss";

export interface ScrollableProps extends ToolbarProps {
  children?: React.ReactNode;
  visibleItemThreshold?: number; // defaults to 5
  onScroll?: () => void;
}

export interface ScrollableState {
  scrollOffset: number;
}

export default class Scrollable extends React.Component<ScrollableProps, ScrollableState> {
  public static readonly DEFAULT_VISIBLE_ITEM_COUNT = 5;
  private static readonly DESKTOP_ITEM_WIDTH = 40;
  private static readonly DESKTOP_ITEM_HEIGHT = Scrollable.DESKTOP_ITEM_WIDTH;
  private static readonly BORDER_WIDTH = 1;

  public readonly state: Readonly<ScrollableState> = {
    scrollOffset: 0,
  };

  public static getVisibleItemThreshold(props: ScrollableProps) {
    if (props.visibleItemThreshold)
      return props.visibleItemThreshold;
    return Scrollable.DEFAULT_VISIBLE_ITEM_COUNT;
  }

  public static getItemCount(props: ScrollableProps) {
    if (props.children)
      return React.Children.count(props.children);
    return 0;
  }

  public static getVisibleItemCount(props: ScrollableProps) {
    const threshold = Scrollable.getVisibleItemThreshold(props);
    const itemCount = Scrollable.getItemCount(props);
    return Math.min(threshold, itemCount);
  }

  public getViewportLength(itemLength: number) {
    let length = Scrollable.getVisibleItemCount(this.props) * itemLength;
    if (this.isLeftMostScrolled())
      length += Scrollable.BORDER_WIDTH;
    if (this.isRightMostScrolled())
      length += Scrollable.BORDER_WIDTH;
    return length;
  }

  public get expandsTo() {
    return Toolbar.getExpandsToDirection(this.props);
  }

  public getViewportStyle() {
    const direction = Toolbar.getToolbarDirection(this.expandsTo);
    switch (direction) {
      case OrthogonalDirection.Vertical: {
        const verticalStyle: React.CSSProperties = {
          height: this.getViewportLength(Scrollable.DESKTOP_ITEM_HEIGHT),
        };
        return verticalStyle;
      }
      case OrthogonalDirection.Horizontal: {
        const horizontalStyle: React.CSSProperties = {
          width: this.getViewportLength(Scrollable.DESKTOP_ITEM_WIDTH),
        };
        return horizontalStyle;
      }
    }
  }

  public getHistoryViewportLength(itemLength: number) {
    let length = Scrollable.getVisibleItemCount(this.props) * itemLength;
    if (this.isLeftScrollIndicatorVisible()) {
      length -= itemLength;
    }
    if (this.isRightScrollIndicatorVisible())
      length -= itemLength;
    return length;
  }

  public getHistoryViewportOffset(itemLength: number) {
    let top = 0;
    if (this.isLeftScrollIndicatorVisible()) {
      top += itemLength - Scrollable.BORDER_WIDTH;
    }
    if (!this.isLeftMostScrolled() && this.isRightMostScrolled()) {
      top -= Scrollable.BORDER_WIDTH;
    }
    return top;
  }

  public getHistoryViewportStyle(): React.CSSProperties {
    const direction = Toolbar.getToolbarDirection(this.expandsTo);
    switch (direction) {
      case OrthogonalDirection.Vertical: {
        const height = this.getHistoryViewportLength(Scrollable.DESKTOP_ITEM_HEIGHT);
        const top = this.getHistoryViewportOffset(Scrollable.DESKTOP_ITEM_HEIGHT);
        return {
          height,
          top,
        };
      }
      case OrthogonalDirection.Horizontal: {
        const width = this.getHistoryViewportLength(Scrollable.DESKTOP_ITEM_WIDTH);
        const left = this.getHistoryViewportOffset(Scrollable.DESKTOP_ITEM_WIDTH);
        return {
          width,
          left,
        };
      }
    }
  }

  public getHistoryScrolledStyle(): React.CSSProperties {
    const direction = Toolbar.getToolbarDirection(this.expandsTo);
    const isLeftScrollIndicatorVisible = this.isLeftScrollIndicatorVisible();
    switch (direction) {
      case OrthogonalDirection.Vertical: {
        const marginTop = this.state.scrollOffset * -Scrollable.DESKTOP_ITEM_HEIGHT;
        let top = 0;
        if (isLeftScrollIndicatorVisible) {
          top -= Scrollable.DESKTOP_ITEM_HEIGHT;
        }
        return {
          marginTop,
          top,
        };
      }
      case OrthogonalDirection.Horizontal: {
        const marginLeft = this.state.scrollOffset * -Scrollable.DESKTOP_ITEM_WIDTH;
        let left = 0;
        if (isLeftScrollIndicatorVisible) {
          left -= Scrollable.DESKTOP_ITEM_WIDTH;
        }
        return {
          marginLeft,
          left,
        };
      }
    }
  }

  public getScrollOffset(itemLength: number) {
    let offset = this.state.scrollOffset * itemLength;
    if (this.isLeftScrollIndicatorVisible())
      offset += Scrollable.BORDER_WIDTH;
    if (!this.isLeftMostScrolled() && this.isRightMostScrolled())
      offset += Scrollable.BORDER_WIDTH;
    return -offset;
  }

  private getScrolledStyle() {
    const direction = Toolbar.getToolbarDirection(this.expandsTo);
    switch (direction) {
      case OrthogonalDirection.Vertical: {
        const marginTop = this.getScrollOffset(Scrollable.DESKTOP_ITEM_HEIGHT);
        const verticalStyle: React.CSSProperties = { marginTop };
        return verticalStyle;
      }
      case OrthogonalDirection.Horizontal: {
        const marginLeft = this.getScrollOffset(Scrollable.DESKTOP_ITEM_WIDTH);
        const horizontalStyle: React.CSSProperties = { marginLeft };
        return horizontalStyle;
      }
    }
  }

  private handleLeftScroll = () => {
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

  private handleRightScroll = () => {
    this.setState(
      (prevState, props) => {
        const childrenCnt = Scrollable.getItemCount(props);
        let scrollOffset = prevState.scrollOffset + 1;
        scrollOffset = Math.min(childrenCnt - Scrollable.getVisibleItemCount(props), scrollOffset);
        return {
          ...prevState,
          scrollOffset,
        };
      },
      () => this.props.onScroll && this.props.onScroll(),
    );
  }

  public isLeftScrollIndicatorVisible() {
    return this.state.scrollOffset > 0;
  }

  public isRightScrollIndicatorVisible() {
    const itemCnt = Scrollable.getItemCount(this.props);
    return itemCnt - Scrollable.getVisibleItemCount(this.props) - this.state.scrollOffset > 0;
  }

  public isLeftMostScrolled() {
    return this.state.scrollOffset === 0;
  }

  public isRightMostScrolled() {
    const itemCnt = Scrollable.getItemCount(this.props);
    return itemCnt - Scrollable.getVisibleItemCount(this.props) - this.state.scrollOffset === 0;
  }

  public render() {
    const isLeftScrollIndicatorVisible = this.isLeftScrollIndicatorVisible();
    const isRightScrollIndicatorVisible = this.isRightScrollIndicatorVisible();

    const direction = Toolbar.getToolbarDirection(this.expandsTo);
    const className = classnames(
      "nz-toolbar-scrollable",
      isLeftScrollIndicatorVisible && !isRightScrollIndicatorVisible && "nz-scroll-indicator-left-only",
      !isLeftScrollIndicatorVisible && isRightScrollIndicatorVisible && "nz-scroll-indicator-right-only",
      this.props.className);

    const leftScrollIndicatorClassName = classnames(
      "nz-left",
      isLeftScrollIndicatorVisible && "nz-is-visible",
    );
    const rightScrollIndicatorClassName = classnames(
      "nz-right",
      isRightScrollIndicatorVisible && "nz-is-visible",
    );

    const viewportStyle = this.getViewportStyle();
    const scrolledStyle = this.getScrolledStyle();
    return (
      <Toolbar
        className={className}
        style={this.props.style}
        renderItems={(items) => (
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
              className={leftScrollIndicatorClassName}
              direction={direction === OrthogonalDirection.Vertical ? Direction.Top : Direction.Left}
              onScroll={this.handleLeftScroll}
            />
            <Indicator
              className={rightScrollIndicatorClassName}
              direction={direction === OrthogonalDirection.Vertical ? Direction.Bottom : Direction.Right}
              onScroll={this.handleRightScroll}
            />
          </div>
        )}
        renderHistoryItems={(historyItems) => (
          <div
            className="nz-expanded nz-history"
          >
            <div
              className="nz-viewport"
              style={this.getHistoryViewportStyle()}
            >
              <div
                className="nz-container"
                style={this.getHistoryScrolledStyle()}
              >
                {historyItems}
              </div>
            </div>
          </div>
        )}
        renderPanelItems={(panelItems) => (
          <div
            className="nz-expanded nz-panels"
            style={scrolledStyle}
          >
            {panelItems}
          </div>
        )}
        {...this.props}
      />
    );
  }
}
