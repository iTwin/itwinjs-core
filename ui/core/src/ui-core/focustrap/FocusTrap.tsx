/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as React from "react";
import { Logger } from "@bentley/bentleyjs-core";
import { UiCore } from "../UiCore";

// cSpell:ignore focusable

/** Properties supported by FocusTrap component.
 * @beta
 */
interface Props extends React.AllHTMLAttributes<any> {
  /** if active is not true then no trapping of focus is attempted. */
  active?: boolean;
  /** restore focus to element that had focus before trap was activated */
  returnFocusOnDeactivate: boolean;
  /** Optional referent to element to receive focus when trap is activated. Optionally a CSS Selector
   * string can be supplied to locate an element in the FocusTrap container. If no specification is defined
   * the first focusable element is used.
   */
  initialFocusElement?: React.RefObject<HTMLElement> | string;
}

/** Internal state of FocusTrap component.
 * @beta
 */
interface State {
  /** if active is not true then no trapping of focus is attempted. */
  active: boolean;
  initialFocusElement?: HTMLElement;
}

/** Trap Focus in container while trap is active.
 * @beta
 */
export class FocusTrap extends React.Component<Props, State> {
  private _restoreFocusElement: HTMLElement | null = null;
  private _focusContainer: HTMLDivElement | null = null;
  private _initialFocusElementProcessed = false;

  constructor(props: Props) {
    super(props);
    this.state = {
      active: !!props.active,
    };
  }

  private getInitialFocusElement(): HTMLElement | null {
    // istanbul ignore else
    if (this.props.initialFocusElement && this._focusContainer) {
      if (typeof this.props.initialFocusElement === "string") {
        const node = this._focusContainer.querySelector(this.props.initialFocusElement as string);
        // istanbul ignore else
        if (node) {
          return node as HTMLElement;
        } else {
          Logger.logError(UiCore.loggerCategory(this), `Unable to locate element via selector ${this.props.initialFocusElement}`);
        }
      } else {
        return this.props.initialFocusElement.current;
      }
    }
    return this.findFirstFocusableDescendant();
  }

  private focusSpecifiedOrFirst(): void {
    if (this.state.initialFocusElement)
      this.attemptFocus(this.state.initialFocusElement);
  }

  public componentWillUnmount() {
    if (this.props.returnFocusOnDeactivate && this._restoreFocusElement)
      this._restoreFocusElement.focus();
  }

  // We must wait until we have the HTMLElementRefs populate before we can attempt to set focus
  public componentDidUpdate(prevProps: Props, prevState: State): void {
    let newActiveState = !!this.props.active;
    let initialFocusElement: HTMLElement | null = this.state.initialFocusElement ? this.state.initialFocusElement : null;

    // istanbul ignore else
    if ((newActiveState !== prevState.active) || (this.props.initialFocusElement !== prevProps.initialFocusElement) || !this._initialFocusElementProcessed) {
      this._initialFocusElementProcessed = false;
      initialFocusElement = this.getInitialFocusElement();
      this._initialFocusElementProcessed = true;
      newActiveState = initialFocusElement ? true : false;
      // istanbul ignore else
      if (initialFocusElement !== prevState.initialFocusElement || newActiveState !== prevState.active) {
        this.setState({ active: newActiveState, initialFocusElement: initialFocusElement ? initialFocusElement : undefined }, () => {
          // istanbul ignore else
          if (this.state.active) {
            // istanbul ignore else
            if (this.props.returnFocusOnDeactivate) // && (!this._restoreFocusElement || (this.props.initialFocusElement !== prevProps.initialFocusElement)))
              this._restoreFocusElement = document.activeElement as HTMLElement;

            // delay setting focus immediately because in some browsers other focus events happen when popup is initially opened.
            setTimeout(() => {
              this.focusSpecifiedOrFirst();
            }, 60);
          }
        });
      }
    }
  }

  public isFocusable(element: HTMLElement): boolean {
    // istanbul ignore next
    if (!element)
      return false;

    // istanbul ignore next
    if (element.tabIndex > 0 || (element.tabIndex === 0 && element.getAttribute("tabIndex") !== null)) {
      return true;
    }

    // istanbul ignore next
    if (element.getAttribute && (typeof element.getAttribute === "function") && element.getAttribute("disabled") !== null)
      return false;

    switch (element.nodeName) {
      case "A":
        const anchorElement = element as HTMLAnchorElement;
        return !!anchorElement.href && anchorElement.rel !== "ignore";
      case "INPUT":
        const inputElement = element as HTMLInputElement;
        return inputElement.type !== "hidden" && inputElement.type !== "file";
      case "BUTTON":
      case "SELECT":
      case "TEXTAREA":
        return true;
      default:
        return false;
    }

    return true;
  }

  private attemptFocus(element: HTMLElement): boolean {
    if (!this.isFocusable(element)) {
      return false;
    }

    try {
      element.focus();
    } catch (e) {
      // istanbul ignore next
      return false;
    }
    return (document.activeElement === element);
  } // end attemptFocus

  private processFindFocusableDescendant(element: HTMLElement | null): HTMLElement | null {
    // istanbul ignore next
    if (!element)
      return null;

    for (const child of element.childNodes) {
      // istanbul ignore else
      if (this.isFocusable(child as HTMLElement))
        return child as HTMLElement;

      const focusable = this.processFindFocusableDescendant(child as HTMLElement);
      if (focusable)
        return focusable;
    }
    return null;
  }

  private findFirstFocusableDescendant(): HTMLElement | null {
    return this.processFindFocusableDescendant(this._focusContainer);
  }

  private processFindLastFocusableDescendant(element: HTMLElement | null): HTMLElement | null {
    // istanbul ignore next
    if (!element)
      return null;

    for (let i = element.childNodes.length - 1; i >= 0; i--) {
      const child = element.childNodes[i] as HTMLElement;

      const focusable = this.processFindLastFocusableDescendant(child as HTMLElement);
      // istanbul ignore else
      if (focusable)
        return focusable;

      // istanbul ignore else
      if (this.isFocusable(child as HTMLElement))
        return child as HTMLElement;
    }
    return null;
  }

  private findLastFocusableDescendant(): HTMLElement | null {
    return this.processFindLastFocusableDescendant(this._focusContainer);
  }

  // this is hit if Shift tab is used.
  private _cycleFocusToEnd = (event: React.FocusEvent<HTMLDivElement>) => {
    // istanbul ignore else
    if (this.state.active) {
      if (event.target === this._focusContainer) {
        event.stopPropagation();
        event.preventDefault();
        const focusable = this.findLastFocusableDescendant();
        if (focusable)
          focusable.focus();
      }
    }
  }

  // this is hit if tab is used on last item it child container.
  private _cycleFocusToStart = (event: React.FocusEvent<HTMLDivElement>) => {
    // istanbul ignore else
    if (this.state.active) {
      event.stopPropagation();
      const focusable = this.findFirstFocusableDescendant();
      if (focusable)
        focusable.focus();
    }
  }

  public render() {
    if (this.props.children) {
      const children = React.Children.only(this.props.children);
      // istanbul ignore else
      if (children) {
        return (
          <>
            <div data-testid="focus-trap-div" onFocus={this._cycleFocusToEnd} ref={(element: HTMLDivElement) => { this._focusContainer = element; }} tabIndex={0}>
              {children}
            </div>
            <div data-testid="focus-trap-limit-div" onFocus={this._cycleFocusToStart} tabIndex={0} />
          </>
        );
      }
    }
    return null;
  }
}
