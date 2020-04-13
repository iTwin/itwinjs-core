/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import classnames from "classnames";
import * as React from "react";
import { useResizeObserver, CommonProps } from "@bentley/ui-core";
import { Ellipsis } from "@bentley/ui-ninezone";
import "./Overflow.scss";

/** Properties of [[StatusBarOverflow]] component.
 * @internal
 */
export interface StatusBarOverflowProps extends CommonProps {
  /** Function called when button is clicked. */
  onClick?: () => void;
  /** Function called when button is resized. */
  onResize?: (w: number) => void;
}

/** Entry point to overflow status bar items of [[StatusBarComposer]] component.
 * @internal
 */
export const StatusBarOverflow = React.memo(function StatusBarOverflow(props: StatusBarOverflowProps) { // tslint:disable-line: variable-name no-shadowed-variable
  const ref = useResizeObserver<HTMLDivElement>(props.onResize);
  const className = classnames(
    "uifw-statusbar-overflow",
    props.className,
  );
  return (
    <div
      className={className}
      onClick={props.onClick}
      ref={ref}
      style={props.style}
    >
      <Ellipsis />
    </div>
  );
});
