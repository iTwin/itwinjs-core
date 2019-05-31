/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { UnitProps } from "./Interfaces";

/** This class provides basic implementation of UnitProps interface.
 * @alpha
 */
export class BasicUnit implements UnitProps {
  public name = "";
  public label = "";
  public unitFamily = "";
  public isValid = false;
  public alternateLabels?: string[];

  constructor(name: string, label: string, unitFamily: string, alternateLabels?: string[]) {
    if (name && name.length > 0 && label && label.length > 0 && unitFamily && unitFamily.length > 0) {
      this.name = name;
      this.label = label;
      this.unitFamily = unitFamily;
      this.alternateLabels = alternateLabels;
      this.isValid = true;
    }
  }
}

/** This class is a convenience class that can be returned when a valid Unit cannot be determined.
 * @alpha
 */
export class BadUnit implements UnitProps {
  public name = "";
  public label = "";
  public unitFamily = "";
  public isValid = false;
}
