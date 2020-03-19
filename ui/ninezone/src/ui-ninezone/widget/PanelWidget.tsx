/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { WidgetsStateContext } from "../base/NineZone";
import { WidgetState } from "../base/NineZoneState";
import { isHorizontalPanelSide, PanelSideContext } from "../widget-panels/Panel";
import { Widget, WidgetProvider } from "./Widget";
import { WidgetTitleBar } from "./TitleBar";
import { WidgetContentContainer } from "./ContentContainer";
import "./PanelWidget.scss";

/** @internal */
export interface PanelWidgetProps {
  widgetId: WidgetState["id"];
}

/** @internal */
export const PanelWidget = React.memo<PanelWidgetProps>(function PanelWidget(props) { // tslint:disable-line: variable-name no-shadowed-variable
  const side = React.useContext(PanelSideContext);
  const widgets = React.useContext(WidgetsStateContext);
  const widget = widgets[props.widgetId];
  const style = React.useMemo(() => {
    return widget.minimized ? undefined : { flexGrow: 1 };
  }, [widget.minimized]);
  const className = React.useMemo(() => classnames(
    "nz-widget-panelWidget",
    side && isHorizontalPanelSide(side) && "nz-horizontal",
  ), [side]);
  return (
    <WidgetProvider
      widget={widget}
    >
      <PanelWidgetComponent
        className={className}
        style={style}
      />
    </WidgetProvider>
  );
});

const PanelWidgetComponent = React.memo<CommonProps>(function PanelWidgetComponent(props) { // tslint:disable-line: no-shadowed-variable variable-name
  return (
    <Widget
      className={props.className}
      style={props.style}
    >
      <WidgetTitleBar />
      <WidgetContentContainer />
    </Widget>
  );
});
