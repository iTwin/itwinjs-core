/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { SpatialClassifier, SpatialClassifierFlags, SpatialClassifiers, SpatialClassifiersContainer } from "@itwin/core-common";
import { TileTreeReference } from "./tile/internal";

/** A [SpatialClassifier]($common) that uses geoemtry produced at run-time to classify a reality model.
 * The geometry is supplied by a [[TileTreeReference]].
 * A simple example of creating and applying a dynamic classifier:
 * ```ts
 * [[include:TileTreeReference_DynamicClassifier]]
 * ```
 * @see [[SpatialClassifiersState]] to configure a reality model's classifiers.
 * @public
 */
export interface DynamicSpatialClassifier {
  /** A reference to the [[TileTree]] that supplies the graphics used to classify the reality model.
   * @see [[TileTreeReference.createFromRenderGraphic]] for one way to produce a tile tree reference.
   */
  tileTreeReference: TileTreeReference;
  /** Flags controlling how to apply the classifier. */
  flags: SpatialClassifierFlags;
  /** A user-friendly name appropriate for use in a user interface. */
  name: string;
}

/** A [SpatialClassifier]($common) that uses geometry from a persistent [[GeometricModelState]] to classify a reality model.
 * @see [[SpatialClassifiersState]] to configure a reality model's classifiers.
 * @public
 */
export type PersistentSpatialClassifier = SpatialClassifier & { tileTreeReference?: never };

/** Describes the source of geometry being used to classify a reality model.
 * @see [[SpatialClassifiersState.activeClassifier]] to change the active classifier for a reality model.
 * @public
 */
export type ActiveSpatialClassifier = DynamicSpatialClassifier | PersistentSpatialClassifier;

/** The front-end representation of [SpatialClassifiers]($common) that adds support for classifying a reality model using non-persistent
 * geometry via [[DynamicSpatialClassifier]].
 *
 * @see [[ContextRealityModelState.classifiers]] or [[SpatialModelState.classifiers]] to access the classifiers for a particular reality model.
 * @public
 */
export class SpatialClassifiersState extends SpatialClassifiers {
  private _dynamicClassifier?: DynamicSpatialClassifier;

  private constructor(container: SpatialClassifiersContainer) {
    super(container);
  }

  /** The classifier currently being used to classify the reality model.
   * This may be either a [SpatialClassifier]($common) already defined in the set of available [SpatialClassifiers]($common), or a [[DynamicSpatialClassifier]].
   * @note Unlike [[PersistentSpatialClassifier]]s, [[DynamicSpatialClassifier]]s are not preserved when saving and recalling a view.
   */
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

