/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { SpatialClassifier, SpatialClassifiers, SpatialClassifiersContainer } from "@itwin/core-common";
import { TileTreeReference } from "./tile/internal";

export type DynamicSpatialClassifier = Omit<SpatialClassifier, "expand"> & { tileTreeReference: TileTreeReference; expand?: never; };
export type PersistentSpatialClassifier = SpatialClassifier & { tileTreeReference?: never };
export type ActiveSpatialClassifier = DynamicSpatialClassifier | PersistentSpatialClassifier;

export class SpatialClassifiersState extends SpatialClassifiers {
  private _dynamicClassifier?: DynamicSpatialClassifier;

  private constructor(container: SpatialClassifiersContainer) {
    super(container);
  }
  
  public get activeClassifier(): ActiveSpatialClassifier | undefined {
    return this._dynamicClassifier ?? this.active;
  }

  public set activeClassifier(active: ActiveSpatialClassifier | undefined) {
    if (active === this.activeClassifier) {
      return;
    }
      
    this._dynamicClassifier = undefined;
    if (active?.tileTreeReference) {
      this._dynamicClassifier = active;
    } else {
      this.setActive(active);
    }
  }

  /** @internal */
  public static create(container: SpatialClassifiersContainer) {
    return new SpatialClassifiersState(container);
  }
}

