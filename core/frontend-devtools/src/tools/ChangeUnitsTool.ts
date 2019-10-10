/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  Tool,
} from "@bentley/imodeljs-frontend";
import { parseToggle } from "./parseToggle";

/** Controls whether quantities are formatted using imperial or metric units.
 * Such formatting is used in many places; one example is the output of the MeasureTool.
 * @beta
 */
export class ChangeUnitsTool extends Tool {
  public static toolId = "ChangeUnits";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(useMetric?: boolean): boolean {
    const fmtr = IModelApp.quantityFormatter;
    const useImperial = undefined !== useMetric ? !useMetric : !fmtr.useImperialFormats;
    if (useImperial !== fmtr.useImperialFormats) {
      fmtr.useImperialFormats = useImperial;
      IModelApp.toolAdmin.startDefaultTool();
    }

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      this.run(enable);

    return true;
  }
}
