/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import * as React from "react";
import { Orientation, useResizeObserver } from "@bentley/ui-core";

import { AccuDrawFieldContainer } from "./AccuDrawFieldContainer";
import { ConfigurableCreateInfo } from "../configurableui/ConfigurableUiControl";
import { WidgetControl } from "../widgets/WidgetControl";
import { UiFramework } from "../UiFramework";

/** AccuDraw Widget Control
 * @alpha
 */
export class AccuDrawWidgetControl extends WidgetControl {

  public static id = "AccuDrawWidget";

  public static get label(): string {
    return UiFramework.translate("accuDraw.dialogTitle");
  }

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <AccuDrawWidget />;
  }
}

/** AccuDraw Widget
 * @alpha
 */
export function AccuDrawWidget() {
  const [orientation, setOrientation] = React.useState(Orientation.Vertical);
  const breakpoint = 400;

  // istanbul ignore next - currently unable to replicate resizing in unit test
  const handleResize = React.useCallback((w: number, _h: number) => {
    setOrientation(w <= breakpoint ? Orientation.Vertical : Orientation.Horizontal);
  }, []);

  const ref = useResizeObserver<HTMLDivElement>(handleResize);

  return (
    <div ref={ref}>
      <AccuDrawFieldContainer orientation={orientation} />
    </div>
  );
}
