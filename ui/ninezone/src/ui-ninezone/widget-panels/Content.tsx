/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./Content.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";

/** Properties of [[WidgetPanelsContentProps]] component.
 * @internal
 */
export interface WidgetPanelsContentProps extends CommonProps {
  children?: React.ReactNode;
  pinnedLeft?: boolean;
  pinnedRight?: boolean;
  pinnedTop?: boolean;
  pinnedBottom?: boolean;
}

/** Component that displays widget panels content.
 * @internal
 */
const WidgetPanelsContentComponent = React.forwardRef<HTMLDivElement, WidgetPanelsContentProps>( // eslint-disable-line @typescript-eslint/naming-convention
  function WidgetPanelsContent(props, ref) {   // eslint-disable-line no-shadow
    const className = classnames(
      "nz-widgetPanels-content",
      props.pinnedLeft && "nz-pinned-left",
      props.pinnedRight && "nz-pinned-right",
      props.pinnedTop && "nz-pinned-top",
      props.pinnedBottom && "nz-pinned-bottom",
      props.className,
    );
    return (
      <div
        className={className}
        ref={ref}
        style={props.style}
      >
        {props.children}
      </div>
    );
  },
);

/** @internal */
export const WidgetPanelsContent = React.memo(WidgetPanelsContentComponent); // eslint-disable-line @typescript-eslint/naming-convention
