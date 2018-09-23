/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import { WidgetDef, WidgetProps } from "./WidgetDef";
import { ToolWidgetDef } from "./ToolWidget";
import { NavigationWidgetDef } from "./NavigationWidget";

/** Factory class for creating an appropriate Widget definition based on Widget properties.
 */
export class WidgetDefFactory {
  /** Creates an appropriate [[WidgetDef]] based on the given [[WidgetProps]].
   * @param widgetProps  The properties used to create the WidgetDef
   * @returns  The created WidgetDef
   */
  public static create(widgetProps: WidgetProps): WidgetDef {
    if ("appButtonId" in widgetProps) {
      return new ToolWidgetDef(widgetProps);
    } else if ("navigationAidId" in widgetProps) {
      return new NavigationWidgetDef(widgetProps);
    }

    return new WidgetDef(widgetProps);
  }
}

export default WidgetDefFactory;
