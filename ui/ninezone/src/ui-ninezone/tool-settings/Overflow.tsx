/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import "./Overflow.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, useRefs, useResizeObserver } from "@bentley/ui-core";
import { Ellipsis } from "../base/Ellipsis";

/** Properties of [[ToolSettingsOverflow]] component.
 * @internal
 */
export interface DockedToolSettingsOverflowProps extends CommonProps {
  /** Function called when button is clicked. */
  onClick?: () => void;
  /** Function called when button is resized. */
  onResize?: (w: number) => void;
}

/** Entry point to overflown tool settings of [[DockedToolSettings]] component.
 * @internal
 */
export const DockedToolSettingsOverflow = React.memo( // tslint:disable-line: variable-name
  React.forwardRef<HTMLDivElement, DockedToolSettingsOverflowProps>(
    function DockedToolSettingsOverflow(props, ref) {  // tslint:disable-line: no-shadowed-variable
      const roRef = useResizeObserver<HTMLDivElement>(props.onResize);
      const refs = useRefs(roRef, ref);
      const className = classnames(
        "nz-toolSettings-overflow",
        props.className,
      );
      return (
        <div
          className={className}
          onClick={props.onClick}
          ref={refs}
          style={props.style}
        >
          <Ellipsis />
        </div>
      );
    },
  ),
);
