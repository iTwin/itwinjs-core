/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import type { UnitProps } from "./Interfaces";

/** This class provides basic implementation of UnitProps interface.
 * @beta
 */
export class BasicUnit implements UnitProps {
  public name = "";
  public label = "";
  public phenomenon = "";
  public isValid = false;
  public system: string = "unknown";

  constructor(name: string, label: string, phenomenon: string, system?: string) {
    if (name && name.length > 0 && label && label.length > 0 && phenomenon && phenomenon.length > 0) {
      this.name = name;
      this.label = label;
      this.phenomenon = phenomenon;
      this.isValid = true;
      if (system)
        this.system = system;
    }
  }
}

/** This class is a convenience class that can be returned when a valid Unit cannot be determined.
 * @beta
 */
export class BadUnit implements UnitProps {
  public name = "";
  public label = "";
  public phenomenon = "";
  public isValid = false;
  public system = "unknown";
}
