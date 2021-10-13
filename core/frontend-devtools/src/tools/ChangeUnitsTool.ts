/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { IModelApp, Tool } from "@itwin/core-frontend";
import { parseToggle } from "./parseToggle";

// CSpell: ignore fmtr

/** Controls whether quantities are formatted using imperial or metric units.
 * Such formatting is used in many places; one example is the output of the MeasureTool.
 * @beta
 */
export class ChangeUnitsTool extends Tool {
  public static override toolId = "ChangeUnits";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  // support boolean for backwards compatibility
  public override async run(useMetric?: boolean): Promise<boolean> {
    const fmtr = IModelApp.quantityFormatter;

    // if no arg then toggle to metric from any non-metric unit system
    const useImperial = undefined !== useMetric ? !useMetric : fmtr.activeUnitSystem === "metric";
    const unitSystem = useImperial ? "imperial" : "metric";

    if (unitSystem !== fmtr.activeUnitSystem) {
      await fmtr.setActiveUnitSystem(unitSystem);
      await IModelApp.toolAdmin.startDefaultTool();
    }

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      await this.run(enable);

    return true;
  }
}
