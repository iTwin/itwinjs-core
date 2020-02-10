/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { useRefEffect } from "./useRefEffect";
import "./PointerCaptor.scss";

/** Properties of [[PointerCaptor]] component.
 * @internal
 */
export interface PointerCaptorProps extends CommonProps {
  /** Describes if the pointer is down. */
  isPointerDown: boolean;
  /** Function called when component is clicked. */
  onClick?: () => void;
  /** Function called when the pointer is pressed. */
  onPointerDown?: (e: PointerEvent) => void;
  /** Function called when the pointer is moved. */
  onPointerMove?: (e: PointerEvent) => void;
  /** Function called when the pointer is released. */
  onPointerUp?: (e: PointerEvent) => void;
}

/** A component which will capture the pointer down event.
 * @internal
 */
export class PointerCaptor extends React.PureComponent<PointerCaptorProps> {
  public componentDidMount() {
    document.addEventListener("pointerup", this._handleDocumentPointerUp);
    document.addEventListener("pointermove", this._handleDocumentPointerMove);
  }

  public componentWillUnmount() {
    document.removeEventListener("pointerup", this._handleDocumentPointerUp);
    document.removeEventListener("pointermove", this._handleDocumentPointerMove);
  }

  public render() {
    const className = classnames(
      "nz-base-pointerCaptor",
      this.props.isPointerDown && "nz-captured",
      this.props.className);
    return (
      <div
        className={className}
        onPointerDown={this._handlePointerDown}
        onClick={this.props.onClick}
        style={this.props.style}
      >
        <div className="nz-overlay" />
        {this.props.children}
      </div>
    );
  }

  private _handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    this.props.onPointerDown && this.props.onPointerDown(e.nativeEvent);
  }

  private _handleDocumentPointerUp = (e: PointerEvent) => {
    if (!this.props.isPointerDown)
      return;
    this.props.onPointerUp && this.props.onPointerUp(e);
  }

  private _handleDocumentPointerMove = (e: PointerEvent) => {
    if (!this.props.isPointerDown)
      return;
    this.props.onPointerMove && this.props.onPointerMove(e);
  }
}

/** Captures pointer events of an element. Used in drag or resize interactions.
 * @internal
 */
export const usePointerCaptor = <T extends HTMLElement>(
  onPointerDown?: (e: PointerEvent) => void,
  onPointerMove?: (e: PointerEvent) => void,
  onPointerUp?: (e: PointerEvent) => void,
) => {
  const isDown = React.useRef(false);
  React.useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      isDown.current && onPointerMove && onPointerMove(e);
    };
    document.addEventListener("pointermove", handlePointerMove);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
    };
  }, [onPointerMove]);
  React.useEffect(() => {
    const handlePointerUp = (e: PointerEvent) => {
      isDown.current && onPointerUp && onPointerUp(e);
      isDown.current = false;
    };
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onPointerUp]);
  const setRef = useRefEffect((instance: T | null) => {
    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      onPointerDown && onPointerDown(e);
      isDown.current = true;
    };
    instance && instance.addEventListener("pointerdown", handlePointerDown);
    return () => {
      instance && instance.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onPointerDown]);
  return setRef;
};
