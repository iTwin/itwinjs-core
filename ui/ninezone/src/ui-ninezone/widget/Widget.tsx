/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { WidgetTabs } from "./Tabs";
import { WidgetState, useWidgetById } from "../base/NineZone";
import { useWidgetPanelSide, isHorizontalWidgetPanelSide } from "../widget-panels/Panel";
import "./Widget.scss";

/** @internal */
export interface WidgetComponentProps extends CommonProps {
  children?: React.ReactNode;
  id: WidgetState["id"];
}

/** @internal */
export function WidgetComponent(props: WidgetComponentProps) {
  const side = useWidgetPanelSide();
  const widget = useWidgetById(props.id);
  const style: React.CSSProperties = {
    ...widget.minimized ? undefined : { flexGrow: 1 },
    ...props.style,
  };
  const className = classnames(
    "nz-widget-widget",
    widget.minimized && "nz-minimized",
    isHorizontalWidgetPanelSide(side) && "nz-horizontal",
    props.className,
  );
  return (
    <WidgetIdContext.Provider value={props.id}>
      <div
        className={className}
        style={style}
      >
        <div className="nz-tabs">
          <WidgetTabs />
        </div>
        <div className="nz-content">
          {props.children}
        </div>
      </div>
    </WidgetIdContext.Provider>
  );
}

/** @internal */
export const WidgetIdContext = React.createContext<WidgetState["id"]>(null!); // tslint:disable-line: variable-name

/** @internal */
export function useWidgetId() {
  return React.useContext(WidgetIdContext);
}
