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

/** Properties for [[Textarea]] component
 * @public
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, CommonProps {
  /** Number of textarea rows. Default is 3. */
  rows?: number;
  /** Indicates whether to set focus to the textarea element */
  setFocus?: boolean;
}

/** Basic textarea component
 * @public
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(props, ref) {
    const { className, style, rows, setFocus, ...otherProps } = props; // eslint-disable-line @typescript-eslint/no-unused-vars
    const textRows = undefined !== rows ? rows : 3;
    const textAreaElementRef = React.useRef<HTMLTextAreaElement>();
    const refs = useRefs(textAreaElementRef, ref);  // combine ref needed for target with the forwardRef needed by the Parent when parent is a Type Editor.

    React.useEffect(() => {
      if (textAreaElementRef.current && setFocus)
        textAreaElementRef.current.focus();
    }, [setFocus]);

    const handleFocus = React.useCallback((event: React.FocusEvent<HTMLTextAreaElement>) => {
      event.currentTarget.select();
    }, []);

    return (
      <textarea {...otherProps}
        ref={refs}
        rows={textRows}
        onFocus={handleFocus}
        className={classnames("uicore-inputs-textarea", className)} style={style} />
    );
  }
);
