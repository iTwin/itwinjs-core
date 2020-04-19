/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Popup
 */

import * as React from "react";
import { Logger } from "@bentley/bentleyjs-core";

// cSpell:ignore focusable

function isFocusable(element: HTMLElement): boolean {
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
}

function processFindFocusableDescendant(element: HTMLElement | null): HTMLElement | null {
  // istanbul ignore next
  if (!element)
    return null;

  for (const child of element.childNodes) {
    // istanbul ignore else
    if (isFocusable(child as HTMLElement))
      return child as HTMLElement;

    const focusable = processFindFocusableDescendant(child as HTMLElement);
    if (focusable)
      return focusable;
  }
  return null;
}

function findFirstFocusableDescendant(focusContainer: HTMLDivElement | null): HTMLElement | null {
  return processFindFocusableDescendant(focusContainer);
}

function processFindLastFocusableDescendant(element: HTMLElement): HTMLElement | null {
  for (let i = element.childNodes.length - 1; i >= 0; i--) {
    const child = element.childNodes[i] as HTMLElement;

    const focusable = processFindLastFocusableDescendant(child as HTMLElement);
    // istanbul ignore else
    if (focusable)
      return focusable;

    // istanbul ignore else
    if (isFocusable(child as HTMLElement))
      return child as HTMLElement;
  }
  return null;
}

function findLastFocusableDescendant(focusContainer: HTMLDivElement): HTMLElement | null {
  return processFindLastFocusableDescendant(focusContainer);
}

function getInitialFocusElement(focusContainer: HTMLDivElement | null, initialFocusSpec: React.RefObject<HTMLElement> | string | undefined): HTMLElement | null {
  if (!focusContainer)
    return null;

  // istanbul ignore else
  if (initialFocusSpec) {
    if (typeof initialFocusSpec === "string") {
      const node = focusContainer.querySelector(initialFocusSpec as string);
      if (node) {
        return node as HTMLElement;
      } else {
        Logger.logError("FocusTrap", `Unable to locate element via selector ${initialFocusSpec}`);
      }
    } else {
      return initialFocusSpec.current;
    }
  }
  return findFirstFocusableDescendant(focusContainer);
}

/** Properties supported by FocusTrap component.
 * @internal
 */
interface Props extends React.AllHTMLAttributes<any> {
  /** child components */
  children: React.ReactNode;
  /** if active is not true then no trapping of focus is attempted. */
  active?: boolean;
  /** restore focus to element that had focus before trap was activated */
  returnFocusOnDeactivate: boolean;
  /** Optional reference to element to receive focus when trap is activated. Optionally a CSS Selector
   * string can be supplied to locate an element in the FocusTrap container. If no specification is defined
   * the first focusable element is used.
   */
  initialFocusElement?: React.RefObject<HTMLElement> | string;
}

function attemptFocus(element: HTMLElement, preventScroll: boolean): boolean {
  if (!isFocusable(element)) {
    return false;
  }

  try {
    if (document.activeElement !== element)
      element.focus({ preventScroll: preventScroll ? true : false });
  } catch (e) {
    // istanbul ignore next
    return false;
  }
  return (document.activeElement === element);
} // end attemptFocus

/** Trap Focus in container while trap is active.
 * @internal
 */
export function FocusTrap(props: Props) {
  const restoreFocusElement = React.useRef<Element | null>(null);
  const initialFocusElement = React.useRef<Element | null>(null);
  const focusContainer = React.useRef<HTMLDivElement | null>(null);
  const isInitialMount = React.useRef(true);

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (props.active) {
        if (props.returnFocusOnDeactivate) {
          restoreFocusElement.current = document.activeElement;
        }

        initialFocusElement.current = getInitialFocusElement(focusContainer.current, props.initialFocusElement);
        if (initialFocusElement.current) {
          // delay setting focus immediately because in some browsers other focus events happen when popup is initially opened.
          setTimeout(() => {
            attemptFocus((initialFocusElement.current as HTMLElement), true);
          }, 60);
        }
      }
    }
    return () => {
      if (restoreFocusElement.current && props.active)
        (restoreFocusElement.current as HTMLElement).focus({ preventScroll: true });
    };
  }, [props.children, props.initialFocusElement, props.active, props.returnFocusOnDeactivate]);

  // this is hit if Shift tab is used.
  const cycleFocusToEnd = React.useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    if (!props.active)
      return;

    if (focusContainer.current && event.target === focusContainer.current) {
      event.stopPropagation();
      event.preventDefault();
      const focusable = findLastFocusableDescendant(focusContainer.current);
      if (focusable) {
        focusable.focus();

      } else {
        if (initialFocusElement.current && initialFocusElement.current !== document.activeElement)
          attemptFocus((initialFocusElement.current as HTMLElement), true);
      }
    }
  }, [props.active]);

  // this is hit if tab is used on last focusable item in child container.
  const cycleFocusToStart = React.useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    if (!props.active)
      return;

    event.stopPropagation();
    if (initialFocusElement.current && initialFocusElement.current !== document.activeElement)
      (initialFocusElement.current as HTMLElement).focus();
  }, [props.active]);

  if (!props.children)
    return null;
  return (
    <>
      <div data-testid="focus-trap-div" onFocus={cycleFocusToEnd} ref={focusContainer} tabIndex={0}
        style={{ outline: "none", WebkitTapHighlightColor: "rgba(0,0,0,0)" }}>
        {props.children}
      </div>
      <div data-testid="focus-trap-limit-div" onFocus={cycleFocusToStart} tabIndex={0} />
    </>
  );
}
