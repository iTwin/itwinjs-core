/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./Tab.scss";
import * as React from "react";
import { WidgetTab } from "@bentley/ui-ninezone";
import { useWidgetDef } from "./Content";
import { BadgeUtilities } from "@bentley/ui-core";
import { BadgeType } from "@bentley/ui-abstract";

/** @internal */
export function WidgetPanelsTab() {
  const widgetDef = useWidgetDef();
  const badgeType = widgetDef?.badgeType;
  const badgeClassName = getBadgeClassName(badgeType);
  const badge = React.useMemo(() => BadgeUtilities.getComponentForBadgeType(badgeType), [badgeType]);
  return (
    <WidgetTab
      className={badgeClassName}
      badge={badge}
    />
  );
}

/** @internal */
export function getBadgeClassName(badgeType: BadgeType | undefined) {
  if (badgeType === BadgeType.New)
    return "uifw-badge-new";
  else if (badgeType === BadgeType.TechnicalPreview)
    return "uifw-badge-tp";
  return undefined;
}
