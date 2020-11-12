/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import classnames from "classnames";
import * as React from "react";
import { useRefs } from "../utils/hooks/useRefs";
import { CommonProps } from "../utils/Props";

/** Properties for the [[Input]] component
 * @public
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, CommonProps {
  /** Indicates whether to set focus to the input element */
  setFocus?: boolean;
  nativeKeyHandler?: (e: KeyboardEvent) => void;
}

/** Basic text input, is a wrapper for the `<input type="text">` HTML element.
 * @public
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(props, ref) {
    const { className, style, setFocus, nativeKeyHandler, ...otherProps } = props; // eslint-disable-line @typescript-eslint/no-unused-vars
    const inputElementRef = React.useRef<HTMLInputElement>();
    const refs = useRefs(inputElementRef, ref);  // combine ref needed for target with the forwardRef needed by the Parent when parent is a Type Editor.

    React.useEffect(() => {
      const currentElement = inputElementRef.current;
      const currentHandler = nativeKeyHandler;

      if (currentElement && currentHandler) {
        currentElement.addEventListener("keydown", currentHandler);
      }
      return () => {
        if (currentHandler && currentElement) {
          currentElement.removeEventListener("keydown", currentHandler);
        }
      };
    }, [nativeKeyHandler]);

    React.useEffect(() => {
      if (inputElementRef.current && setFocus)
        inputElementRef.current.focus();
    }, [setFocus]);

    const handleFocus = React.useCallback((event: React.FocusEvent<HTMLInputElement>) => {
      event.currentTarget.select();
    }, []);

    return (
      <input ref={refs} type="text" {...otherProps} onFocus={handleFocus}
        className={classnames("uicore-inputs-input", className)} style={style} />
    );
  }
);
