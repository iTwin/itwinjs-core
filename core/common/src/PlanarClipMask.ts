/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { JsonUtils } from "@bentley/bentleyjs-core";

export class PlanarClipMask {
  public readonly maskAllHigherPriorityModels?: boolean;

  /** Create a new SubCategoryOverride from a JSON object */
  public static fromJSON(json?: PlanarClipMaskProps): PlanarClipMask {
    return undefined !== json ? new PlanarClipMask(json) : this.defaults;
  }

  public toJSON(): PlanarClipMaskProps {
    return { maskAllHigherPriorityModels: this.maskAllHigherPriorityModels };
  }

  public get anyDefined(): boolean { return this.maskAllHigherPriorityModels === true; }

  public equals(other: PlanarClipMask): boolean {
    return this.maskAllHigherPriorityModels === other.maskAllHigherPriorityModels;
  }

  private constructor(props: PlanarClipMaskProps) {
    if (undefined !== props.maskAllHigherPriorityModels) this.maskAllHigherPriorityModels = JsonUtils.asBool(props.maskAllHigherPriorityModels);
  }
  /** A default PlanarClipMask which masks nothing. */
  public static defaults = new PlanarClipMask({});
}

export interface PlanarClipMaskProps {
  maskAllHigherPriorityModels?: boolean;
}

