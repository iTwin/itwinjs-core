/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tabs
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../utils/Props";
import { Orientation } from "../enums/Orientation";
import { ItemKeyboardNavigator } from "../focus/ItemKeyboardNavigator";

/** Properties for the [[HorizontalTabs]] and [[VerticalTabs]] components
 * @public
 */
export interface TabsProps extends React.AllHTMLAttributes<HTMLUListElement>, CommonProps {
  /** Text shown for each tab */
  labels: string[];
  /** Handler for activating a tab */
  onActivateTab?: (index: number) => any;
  /** Index of the initial active tab */
  activeIndex?: number;
  /** Indicates whether the bar on the active tab is green instead of the default blue */
  green?: boolean;

  /** Handler for clicking on a label
   * @deprecated Use `onActivateTab` instead
   */
  onClickLabel?: (index: number) => any;
}

/** State for [[Tabs]] component
 * @internal
 */
interface TabsState {
  activeIndex: number;
}

/** Properties for the base [[Tabs]] component
 * @public
 */
export interface MainTabsProps extends TabsProps {
  /** Main CSS class name */
  mainClassName: string;
  /** Orientation of the Tabs list */
  orientation: Orientation;
}

/** Tabs meant to represent the current position in a page/section
 * @public
 */
export class Tabs extends React.PureComponent<MainTabsProps, TabsState> {
  private _anchorRefs: Array<React.RefObject<HTMLAnchorElement>> = [];
  private _itemKeyboardNavigator: ItemKeyboardNavigator;

  constructor(props: MainTabsProps) {
    super(props);

    const activeIndex = this.validateActiveIndex(props.activeIndex);
    this.state = {
      activeIndex,
    };

    props.labels.forEach(() => this._anchorRefs.push(React.createRef<HTMLAnchorElement>()));
    this._itemKeyboardNavigator = new ItemKeyboardNavigator(this._handleFocusItem, this._activateTab);
  }

  private validateActiveIndex(idx?: number): number {
    let activeIndex = 0;
    if (idx && idx >= 0 && idx < this.props.labels.length)
      activeIndex = idx;
    return activeIndex;
  }

  /** @internal */
  public componentDidMount() {
    this._itemKeyboardNavigator.itemCount = this.props.labels.length;
    this._itemKeyboardNavigator.orientation = this.props.orientation;
  }

  /** @internal */
  public componentDidUpdate(prevProps: MainTabsProps) {
    if (prevProps.labels !== this.props.labels)
      this._itemKeyboardNavigator.itemCount = this.props.labels.length;

    if (prevProps.orientation !== this.props.orientation)
      this._itemKeyboardNavigator.orientation = this.props.orientation;

    if (prevProps.activeIndex !== this.props.activeIndex) {
      let hadFocus = false;
      const element = this._anchorRefs[this.state.activeIndex].current;
      // istanbul ignore else
      if (element && document.activeElement === element)
        hadFocus = true;
      const activeIndex = this.validateActiveIndex(this.props.activeIndex);

      this.setState(
        () => ({ activeIndex }),
        () => {
          // istanbul ignore else
          if (hadFocus) {
            const newElement = this._anchorRefs[activeIndex].current;
            // istanbul ignore else
            if (newElement)
              newElement.focus();
          }
        });
    }
  }

  private _handleFocusItem = (index: number) => {
    const itemRef = this._anchorRefs[index];
    // istanbul ignore else
    if (itemRef && itemRef.current)
      itemRef.current.focus();
  };

  private _handleTabClick = (index: number) => {
    this._activateTab(index);
  };

  /** Handle keydown on tabs */
  private _handleKeyDownEvent(event: React.KeyboardEvent, index: number) {
    this._itemKeyboardNavigator.handleKeyDownEvent(event, index);
  }

  /** Handle keyup on tabs */
  private _handleKeyUpEvent(event: React.KeyboardEvent, index: number) {
    this._itemKeyboardNavigator.handleKeyUpEvent(event, index);
  }

  private _activateTab = (index: number) => {
    this.props.onClickLabel && this.props.onClickLabel(index);  // eslint-disable-line deprecation/deprecation
    this.props.onActivateTab && this.props.onActivateTab(index);
    this.setState({ activeIndex: index });
  };

  /** @internal */
  public render(): JSX.Element {
    const ulClassNames = classnames(
      this.props.mainClassName,
      this.props.green && "uicore-tabs-green",
      this.props.className,
    );

    return (
      <ul className={ulClassNames} style={this.props.style}
        role="tablist"
        aria-orientation={this.props.orientation === Orientation.Vertical ? "vertical" : "horizontal"}
      >
        {this.props.labels.map((label: string, index: number) =>
          <li key={index}
            className={classnames({ "core-active": index === this.state.activeIndex })}
            role="tab"
            aria-selected={index === this.state.activeIndex}
          >
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a ref={this._anchorRefs[index]}
              tabIndex={index === this.state.activeIndex ? 0 : -1}
              onClick={() => this._handleTabClick(index)}
              onKeyDown={(event) => this._handleKeyDownEvent(event, index)}
              onKeyUp={(event) => this._handleKeyUpEvent(event, index)}
              role="button"
            >
              {label}
            </a>
          </li>,
        )}
      </ul>
    );
  }
}
