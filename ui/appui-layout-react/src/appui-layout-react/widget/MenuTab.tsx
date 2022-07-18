/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./MenuTab.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, Icon } from "@itwin/core-react";
import { TabStateContext } from "./Tab";
import { WidgetStateContext } from "./Widget";
import { assert } from "@itwin/core-bentley";

/** @internal */
export interface WidgetMenuTabProps extends CommonProps {
  badge?: React.ReactNode;
}

/** @internal */
export const WidgetMenuTab = React.memo<WidgetMenuTabProps>(function WidgetMenuTab(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const tab = React.useContext(TabStateContext);
  const widget = React.useContext(WidgetStateContext);
  assert(!!widget);
  const { id } = tab;
  const active = widget.activeTabId === id;
  const className = classnames(
    "nz-widget-menuTab",
    props.className,
  );
  return (
    <div className={className}>
      {props.badge && <div className="nz-badge">
        {props.badge}
      </div>}
      <div className="nz-icon">{tab.iconSpec && <Icon iconSpec={tab.iconSpec} />}</div>
      <span>{tab.label}</span>
      <div className={classnames(
        "nz-checkmark",
        !active && "nz-hidden",
      )} />
    </div>
  );
});
