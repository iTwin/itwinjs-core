/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import Direction, { OrthogonalDirection } from "../utilities/Direction";
import Indicator from "./scroll/Indicator";
import Toolbar, { ToolbarProps } from "./Toolbar";
import Items from "./Items";
import "./Scrollable.scss";

/** Properties of [[Scrollable]] component. See [[ScrollableDefaultProps]] */
export interface ScrollableProps extends ToolbarProps {
  /** Describes number of visible elements. Should not be lower than 3. */
  visibleItemThreshold?: number;
  /** Function called when component scrolls. */
  onScroll?: () => void;
}

/** Default properties of [[ScrollableProps]] used in [[Scrollable]] component. */
export interface ScrollableDefaultProps extends ScrollableProps {
  /** Defaults to 5. */
  visibleItemThreshold: number;
}

/** State of [[Scrollable]] component. */
export interface ScrollableState {
  /** Describes component scroll offset. */
  scrollOffset: number;
}

/** A [[Toolbar]] with scroll overflow strategy. */
export default class Scrollable extends React.Component<ScrollableProps, ScrollableState> {
  private static readonly DESKTOP_ITEM_WIDTH = 40;
  private static readonly DESKTOP_ITEM_HEIGHT = Scrollable.DESKTOP_ITEM_WIDTH;
  private static readonly BORDER_WIDTH = 1;

  public static readonly defaultProps: Partial<ScrollableDefaultProps> = {
    visibleItemThreshold: 5,
  };

  public readonly state: Readonly<ScrollableState> = {
    scrollOffset: 0,
  };

  /** @returns True if props is [[ScrollableDefaultProps]] */
  public static isWithDefaultProps(props: ScrollableProps): props is ScrollableDefaultProps {
    if (props.visibleItemThreshold === undefined)
      return false;
    return true;
  }

  private getVisibleItemCount() {
    if (!Scrollable.isWithDefaultProps(this.props))
      throw new TypeError();
    const threshold = this.props.visibleItemThreshold;
    const itemCount = Toolbar.getItemCount(this.props);
    return Math.min(threshold, itemCount);
  }

  private getViewportLength(itemLength: number) {
    let length = this.getVisibleItemCount() * itemLength;
    if (this.isLeftMostScrolled())
      length += Scrollable.BORDER_WIDTH;
    if (this.isRightMostScrolled())
      length += Scrollable.BORDER_WIDTH;
    return length;
  }

  private getViewportStyle(direction: OrthogonalDirection) {
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

  private getHistoryViewportLength(itemLength: number) {
    let length = this.getVisibleItemCount() * itemLength;
    if (this.isLeftScrollIndicatorVisible()) {
      length -= itemLength;
    }
    if (this.isRightScrollIndicatorVisible())
      length -= itemLength;
    return length;
  }

  private getHistoryViewportOffset(itemLength: number) {
    let top = 0;
    if (this.isLeftScrollIndicatorVisible()) {
      top += itemLength - Scrollable.BORDER_WIDTH;
    }
    if (!this.isLeftMostScrolled() && this.isRightMostScrolled()) {
      top -= Scrollable.BORDER_WIDTH;
    }
    return top;
  }

  private getHistoryViewportStyle(direction: OrthogonalDirection): React.CSSProperties {
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

  private getHistoryScrolledStyle(direction: OrthogonalDirection): React.CSSProperties {
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

  private getScrollOffset(itemLength: number) {
    let offset = this.state.scrollOffset * itemLength;
    if (this.isLeftScrollIndicatorVisible())
      offset += Scrollable.BORDER_WIDTH;
    if (!this.isLeftMostScrolled() && this.isRightMostScrolled())
      offset += Scrollable.BORDER_WIDTH;
    return -offset;
  }

  private getScrolledStyle(direction: OrthogonalDirection) {
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
        const itemCnt = Toolbar.getItemCount(props);
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
    const itemCnt = Toolbar.getItemCount(this.props);
    return itemCnt - this.getVisibleItemCount() - this.state.scrollOffset > 0;
  }

  private isLeftMostScrolled() {
    return this.state.scrollOffset === 0;
  }

  private isRightMostScrolled() {
    const itemCnt = Toolbar.getItemCount(this.props);
    return itemCnt - this.getVisibleItemCount() - this.state.scrollOffset === 0;
  }

  public render() {
    const isLeftScrollIndicatorVisible = this.isLeftScrollIndicatorVisible();
    const isRightScrollIndicatorVisible = this.isRightScrollIndicatorVisible();
    const direction = Toolbar.getToolbarDirection(this.props);

    const { className, ...props } = this.props;
    const scrollableClassName = classnames(
      "nz-toolbar-scrollable",
      isLeftScrollIndicatorVisible && !isRightScrollIndicatorVisible && "nz-scroll-indicator-left-only",
      !isLeftScrollIndicatorVisible && isRightScrollIndicatorVisible && "nz-scroll-indicator-right-only",
      className);

    const leftScrollIndicatorClassName = classnames(
      "nz-left",
      isLeftScrollIndicatorVisible && "nz-is-visible",
    );
    const rightScrollIndicatorClassName = classnames(
      "nz-right",
      isRightScrollIndicatorVisible && "nz-is-visible",
    );

    const viewportStyle = this.getViewportStyle(direction);
    const scrolledStyle = this.getScrolledStyle(direction);
    return (
      <Toolbar
        className={scrollableClassName}
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
              onClick={this.handleLeftScroll}
            />
            <Indicator
              className={rightScrollIndicatorClassName}
              direction={direction === OrthogonalDirection.Vertical ? Direction.Bottom : Direction.Right}
              onClick={this.handleRightScroll}
            />
          </div>
        )}
        renderHistoryItems={(historyItems) => (
          <div
            className="nz-expanded nz-history"
          >
            <div
              className="nz-viewport"
              style={this.getHistoryViewportStyle(direction)}
            >
              <div
                className="nz-container"
                style={this.getHistoryScrolledStyle(direction)}
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
        {...props}
      />
    );
  }
}
