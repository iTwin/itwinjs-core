/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import { WidgetDef } from "./WidgetDef";

function isGenerated(value: WidgetDef["id"]) {
  return value.startsWith("Widget-");
}

/** Proxy will return `stableId` if target [[WidgetDef]] id is auto-generated.
 * @internal @deprecated
 */
export function createStableWidgetDef(widgetDef: WidgetDef, stableId: string): WidgetDef {
  return new Proxy(widgetDef, {
    get(target, name, receiver) {
      const idName: keyof Pick<WidgetDef, "id"> = "id";
      const value = Reflect.get(target, name, receiver);
      if (name === idName && isGenerated(value)) {
        return stableId;
      }
      return value;
    },
  });
}
