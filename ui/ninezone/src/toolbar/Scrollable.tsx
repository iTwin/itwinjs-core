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
  private static readonly _DESKTOP_ITEM_WIDTH = 40;
  private static readonly _DESKTOP_ITEM_HEIGHT = Scrollable._DESKTOP_ITEM_WIDTH;
  private static readonly _DESKTOP_SEPARATOR_SIZE = 1;
  private static readonly _BORDER_WIDTH = 1;

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

  public componentDidUpdate(prevProps: Readonly<ScrollableProps>): void {
    const prevCount = Toolbar.getItemCount(prevProps);
    const count = Toolbar.getItemCount(this.props);
    if (prevCount !== count)
      this.setState(() => ({ scrollOffset: 0 }));
  }

  private getVisibleItemCount() {
    if (!Scrollable.isWithDefaultProps(this.props))
      throw new TypeError();
    const threshold = this.props.visibleItemThreshold;
    const itemCount = Toolbar.getItemCount(this.props);
    return Math.min(threshold, itemCount);
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
              onClick={this._handleLeftScroll}
            />
            <Indicator
              className={rightScrollIndicatorClassName}
              direction={direction === OrthogonalDirection.Vertical ? Direction.Bottom : Direction.Right}
              onClick={this._handleRightScroll}
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
