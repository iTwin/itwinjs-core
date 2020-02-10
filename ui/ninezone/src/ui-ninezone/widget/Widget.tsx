/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { usePane } from "../widget-panels/Panes";
import { WidgetTabs } from "./Tabs";
import "./Widget.scss";

/** @internal */
export interface WidgetProps extends CommonProps {
  children?: React.ReactNode;
  tabs?: React.ReactNode;
}

/** Component that displays a side panel widget.
 * @internal future
 */
export function Widget(props: WidgetProps) {
  const tabs = useFlattenRootFragment(props.tabs);
  const pane = usePane();
  const className = classnames(
    "nz-widget-widget",
    pane.minimized && "nz-minimized",
    pane.horizontal && "nz-horizontal",
    props.className,
  );
  return (
    <div
      className={className}
      style={props.style}
    >
      <div className="nz-tabs">
        <WidgetTabs
          children={tabs}
        />
      </div>
      <div className="nz-content">
        {props.children}
      </div>
    </div>
  );
}

/** @internal */
export function useFlattenRootFragment(node: React.ReactNode) {
  return React.useMemo(() => {
    if (React.isValidElement<{ children?: React.ReactNode }>(node) && node.type === React.Fragment)
      return node.props.children;
    return node;
  }, [node]);
}
