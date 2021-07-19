/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import "./Overflow.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, useRefs, useResizeObserver } from "@bentley/ui-core";
import { Ellipsis } from "@bentley/ui-ninezone";
import { UiFramework } from "../UiFramework";

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
// eslint-disable-next-line react/display-name, @typescript-eslint/naming-convention
export const StatusBarOverflow = React.memo(
  React.forwardRef<HTMLDivElement, StatusBarOverflowProps>(
    function StatusBarOverflow(props, ref) { // eslint-disable-line @typescript-eslint/no-shadow, @typescript-eslint/naming-convention
      const roRef = useResizeObserver<HTMLDivElement>(props.onResize);
      const refs = useRefs(roRef, ref);
      const className = classnames(
        "uifw-statusbar-overflow",
        props.className,
      );
      const title = React.useRef(UiFramework.translate("statusBar.overflow"));

      return (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events
        <div
          className={className}
          onClick={props.onClick}
          ref={refs}
          style={props.style}
          role="button"
          tabIndex={-1}
          title={title.current}
        >
          <Ellipsis />
        </div>
      );
    },
  ),
);
