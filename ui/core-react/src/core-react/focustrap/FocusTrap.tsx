/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Popup
 */

import * as React from "react";
import { Logger } from "@itwin/core-bentley";
import { UiCore } from "../UiCore";

// cSpell:ignore focusable

function isFocusable(element: HTMLElement): boolean {
  if (!element || element.tabIndex < 0)
    return false;

  if (element.classList && element.classList.contains("core-focus-trap-ignore-initial"))
    return false;

  if (element.getAttribute && (typeof element.getAttribute === "function") && element.getAttribute("disabled") !== null)
    return false;

  if (element.tabIndex > 0 || (element.tabIndex === 0 && element.getAttribute("tabIndex") !== null))
    return true;

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

    const focusable = processFindLastFocusableDescendant(child);
    // istanbul ignore else
    if (focusable)
      return focusable;

    // istanbul ignore else
    if (isFocusable(child))
      return child;
  }
  return null;
}

function findLastFocusableDescendant(focusContainer: HTMLDivElement): HTMLElement | null {
  return processFindLastFocusableDescendant(focusContainer);
}

function getInitialFocusElement(focusContainer: HTMLDivElement | null, initialFocusSpec: React.RefObject<HTMLElement> | string | undefined): HTMLElement | null {
  // istanbul ignore next
  if (!focusContainer)
    return null;

  if (initialFocusSpec) {
    if (typeof initialFocusSpec === "string") {
      const node = focusContainer.querySelector(initialFocusSpec);
      if (node) {
        return node as HTMLElement;
      } else {
        Logger.logError(`${UiCore.packageName}.FocusTrap`, `Unable to locate element via selector ${initialFocusSpec}`);
      }
    } else {
      return initialFocusSpec.current;
    }
  }
  return findFirstFocusableDescendant(focusContainer);
}

function attemptFocus(element: HTMLElement, preventScroll: boolean): boolean {
  // istanbul ignore next
  if (!isFocusable(element))
    return false;

  try {
    // istanbul ignore else
    if (document.activeElement !== element)
      element.focus({ preventScroll: preventScroll ? true : /* istanbul ignore next */ false });
  } catch (e) {
    // istanbul ignore next
    return false;
  }
  return (document.activeElement === element);
} // end attemptFocus

/** Focus into first focusable element of a container.
 * @internal
 */
export function focusIntoContainer(focusContainer: HTMLDivElement, initialFocusElement?: React.RefObject<HTMLElement> | string): boolean {
  let result = false;
  const focusElement = getInitialFocusElement(focusContainer, initialFocusElement);
  if (focusElement) {
    // delay setting focus immediately because in some browsers other focus events happen when popup is initially opened.
    setTimeout(() => {
      attemptFocus(focusElement, true);
    }, 60);
    result = true;
  }
  return result;
}

/** Properties supported by [[FocusTrap]] component.
 * @internal
 */
export interface FocusTrapProps extends React.AllHTMLAttributes<any> {
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

/** Trap Focus in container while trap is active.
 * @internal
 */
export function FocusTrap(props: FocusTrapProps) {
  const restoreFocusElement = React.useRef<Element | null>(null);
  const initialFocusElement = React.useRef<Element | null>(null);
  const focusContainer = React.useRef<HTMLDivElement | null>(null);
  const isInitialMount = React.useRef(true);
  const timeoutRef = React.useRef<number | undefined>();

  // Run on initial mount and when dependencies change. which could happen often.
  React.useEffect(() => {
    // istanbul ignore else
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (props.active) {
        if (props.returnFocusOnDeactivate) {
          restoreFocusElement.current = document.activeElement;
        }

        initialFocusElement.current = getInitialFocusElement(focusContainer.current, props.initialFocusElement);
        if (initialFocusElement.current) {
          // delay setting focus immediately because in some browsers other focus events happen when popup is initially opened.
          timeoutRef.current = window.setTimeout(() => {
            attemptFocus((initialFocusElement.current as HTMLElement), true);
          }, 60);
        }
      }
    }
  }, [props.children, props.initialFocusElement, props.active, props.returnFocusOnDeactivate]);

  // Return function to run only when FocusTrap is unmounted to restore focus
  React.useEffect(() => {
    return () => {
      window.clearTimeout(timeoutRef.current);
      if (restoreFocusElement.current)
        (restoreFocusElement.current as HTMLElement).focus({ preventScroll: true });
    };
  }, []);

  // this is hit if Shift tab is used.
  const cycleFocusToEnd = React.useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    // istanbul ignore next
    if (!props.active)
      return;

    if (focusContainer.current && event.target === focusContainer.current) {
      event.stopPropagation();
      event.preventDefault();
      const focusable = findLastFocusableDescendant(focusContainer.current);

      // istanbul ignore else
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
    // istanbul ignore next
    if (!props.active)
      return;

    event.stopPropagation();
    // istanbul ignore else
    if (initialFocusElement.current && initialFocusElement.current !== document.activeElement)
      (initialFocusElement.current as HTMLElement).focus();
  }, [props.active]);

  if (!props.children)
    return null;
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div data-testid="focus-trap-div" onFocus={cycleFocusToEnd} ref={focusContainer} tabIndex={0}
        // eslint-disable-next-line @typescript-eslint/naming-convention
        style={{ outline: "none", WebkitTapHighlightColor: "rgba(0,0,0,0)" }}>
        {props.children}
      </div>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div data-testid="focus-trap-limit-div" onFocus={cycleFocusToStart} tabIndex={0} />
    </>
  );
}
