/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

import * as React from "react";

/** Properties for [[withOnOutsideClick]] React higher-order component
 * @public
 */
export interface WithOnOutsideClickProps {
  /** Outside click callback function */
  onOutsideClick?: (event: MouseEvent) => any;
  /** If false outside click processing and closing are skipped if click occurs in another Popup component, default to false. */
  closeOnNestedPopupOutsideClick?: boolean;
}

/** withOnOutsideClick is a React higher-order component that adds outside click support.
 * @public
 */
export const withOnOutsideClick = <ComponentProps extends {}>(
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Component: React.ComponentType<ComponentProps>,
  defaultOnOutsideClick?: (event: MouseEvent) => any,
  useCapture: boolean = true,
  usePointerEvents: boolean = true,
) => {
  return class WithOnOutsideClick extends React.PureComponent<ComponentProps & WithOnOutsideClickProps> {
    /** @internal */
    public ref = React.createRef<HTMLDivElement>();
    /** @internal */
    public isDownOutside = false;

    /** @internal */
    public componentDidMount() {
      if (usePointerEvents) {
        document.addEventListener("pointerdown", this.handleDocumentPointerDown, useCapture);
        document.addEventListener("pointerup", this.handleDocumentPointerUp, useCapture);
      } else
        document.addEventListener("click", this.handleDocumentClick, useCapture);
    }

    /** @internal */
    public componentWillUnmount() {
      if (usePointerEvents) {
        document.removeEventListener("pointerdown", this.handleDocumentPointerDown, useCapture);
        document.removeEventListener("pointerup", this.handleDocumentPointerUp, useCapture);
      } else
        document.removeEventListener("click", this.handleDocumentClick, useCapture);
    }

    /** @internal */
    public isInCorePopup(element: HTMLElement): boolean {
      if (element.nodeName === "DIV") {
        if (element.classList && element.classList.contains("core-popup"))
          return true;
        if (element.parentElement && this.isInCorePopup(element.parentElement))
          return true;
      } else {
        // istanbul ignore else
        if (element.parentElement && this.isInCorePopup(element.parentElement))
          return true;
      }
      return false;
    }

    /** @internal */
    public onOutsideClick(e: MouseEvent) {
      // istanbul ignore else
      if (e.target instanceof Node && e.target.nodeType === Node.ELEMENT_NODE) {
        // istanbul ignore else
        if (!this.props.closeOnNestedPopupOutsideClick && this.isInCorePopup(e.target as HTMLElement))
          return;
      }

      if (this.props.onOutsideClick)
        return this.props.onOutsideClick(e);
      else if (defaultOnOutsideClick)
        return defaultOnOutsideClick(e);
    }

    /** @internal */
    public handleDocumentClick = (e: MouseEvent) => {
      if (!this.ref.current || !(e.target instanceof Node) || this.ref.current.contains(e.target))
        return;

      return this.onOutsideClick(e);
    };

    /** @internal */
    public handleDocumentPointerDown = (e: PointerEvent) => {
      this.isDownOutside = !!this.ref.current && (e.target instanceof Node) && !this.ref.current.contains(e.target);
    };

    /** @internal */
    public handleDocumentPointerUp = (e: PointerEvent) => {
      const isOutsideClick = this.ref.current && e.target instanceof Node && !this.ref.current.contains(e.target) && this.isDownOutside;
      this.isDownOutside = false;
      return isOutsideClick ? this.onOutsideClick(e) : 0;
    };

    public render() {
      const { onOutsideClick, closeOnNestedPopupOutsideClick, ...props } = this.props; // eslint-disable-line @typescript-eslint/no-unused-vars
      return (
        <div ref={this.ref}>
          <Component {...props as ComponentProps} />
        </div>
      );
    }
  };
};
