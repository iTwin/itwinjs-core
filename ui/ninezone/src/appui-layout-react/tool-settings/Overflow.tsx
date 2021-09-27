/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ToolSettings
 */

import "./Overflow.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, useRefs, useResizeObserver } from "@itwin/core-react";
import { Ellipsis } from "../base/Ellipsis";
import { useLabel } from "../base/NineZone";

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
export const DockedToolSettingsOverflow = React.memo( // eslint-disable-line @typescript-eslint/naming-convention, react/display-name
  React.forwardRef<HTMLDivElement, DockedToolSettingsOverflowProps>(
    function DockedToolSettingsOverflow(props, ref) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
      const roRef = useResizeObserver<HTMLDivElement>(props.onResize);
      const refs = useRefs(roRef, ref);
      const className = classnames(
        "nz-toolSettings-overflow",
        props.className,
      );
      const moreToolSettingsTitle = useLabel("moreToolSettingsTitle");

      return (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events
        <div
          className={className}
          onClick={props.onClick}
          ref={refs}
          style={props.style}
          role="button"
          tabIndex={-1}
          title={moreToolSettingsTitle}
        >
          <Ellipsis />
        </div>
      );
    },
  ),
);
