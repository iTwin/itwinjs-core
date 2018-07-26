/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import { WidgetDef } from "./WidgetDef";

import "./configurableui.scss";

/** Props for the WidgetWithDef component.
 */
export interface WidgetComponentProps {
  widgetDef: WidgetDef;
}

/** Widget React component with a [[WidgetDef]].
 */
export class WidgetWithDef extends React.Component<WidgetComponentProps> {

  public render(): React.ReactNode {
    if (this.props.widgetDef) {
      const widgetControl = this.props.widgetDef.widgetControl;

      if (widgetControl && widgetControl.reactElement) {
        return widgetControl.reactElement;
      }
    }

    return null;
  }
}
