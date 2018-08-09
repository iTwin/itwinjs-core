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
  public static Create(props: WidgetProps): WidgetDef {
    if ("appButtonId" in props) {
      return new ToolWidgetDef(props);
    } else if ("navigationAidId" in props) {
      return new NavigationWidgetDef(props);
    }

    return new WidgetDef(props);
  }
}

export default WidgetDefFactory;
