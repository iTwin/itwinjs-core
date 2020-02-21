/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WidgetPanels */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Content.scss";

/** Properties of [[WidgetPanelContent]] component.
 * @internal
 */
export interface WidgetPanelContentProps extends CommonProps {
  children?: React.ReactNode;
  pinnedLeft?: boolean;
  pinnedRight?: boolean;
  pinnedTop?: boolean;
  pinnedBottom?: boolean;
}

/** Component that displays widget panel content.
 * @internal
 */
export function WidgetPanelContent(props: WidgetPanelContentProps) {
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
      style={props.style}
    >
      {props.children}
    </div>
  );
}
