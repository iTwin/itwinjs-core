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
import { TabStateContext, useTabInteractions } from "./Tab";
import { WidgetStateContext } from "./Widget";
import { assert } from "@itwin/core-bentley";
import { WidgetOverflowContext } from "./Overflow";
import { ShowWidgetIconContext } from "../base/NineZone";

/** @internal */
export interface WidgetMenuTabProps extends CommonProps {
  badge?: React.ReactNode;
}

/** @internal */
export const WidgetMenuTab = React.memo<WidgetMenuTabProps>(function WidgetMenuTab(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const tab = React.useContext(TabStateContext);
  const widget = React.useContext(WidgetStateContext);
  assert(!!widget);
  const overflowContext = React.useContext(WidgetOverflowContext);
  assert(!!overflowContext);
  const showWidgetIcon = React.useContext(ShowWidgetIconContext);
  const { id } = tab;
  const closeOverflow = React.useCallback(() => {
    overflowContext.close();
  }, [overflowContext]);
  const ref = useTabInteractions({
    onDragStart: closeOverflow,
    onClick: closeOverflow,
    onDoubleClick: closeOverflow,
  });
  const active = widget.activeTabId === id;
  const className = classnames(
    "nz-widget-menuTab",
    !showWidgetIcon && "nz-no-icon",
    props.className,
  );
  return (
    <div
      className={className}
      ref={ref}
      title={tab.label}
    >
      {props.badge && <div className="nz-badge">
        {props.badge}
      </div>}
      {showWidgetIcon && <div className="nz-icon">
        {tab.iconSpec && <Icon iconSpec={tab.iconSpec} />}
      </div>}
      <span>{tab.label}</span>
      <div className={classnames(
        "nz-checkmark",
        // istanbul ignore next
        !active && "nz-hidden",
      )} />
    </div>
  );
});
