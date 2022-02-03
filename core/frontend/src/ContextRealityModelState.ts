/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import type { Id64String } from "@itwin/core-bentley";
import type { ContextRealityModelProps, RealityDataSourceKey } from "@itwin/core-common";
import { ContextRealityModel, FeatureAppearance, RealityDataFormat } from "@itwin/core-common";
import type { DisplayStyleState } from "./DisplayStyleState";
import type { IModelConnection } from "./IModelConnection";
import { PlanarClipMaskState } from "./PlanarClipMaskState";
import { RealityDataSource } from "./RealityDataSource";
import type { TileTreeReference } from "./tile/internal";
import { createOrbitGtTileTreeReference, createRealityTileTreeReference, RealityModelTileTree } from "./tile/internal";

/** A [ContextRealityModel]($common) attached to a [[DisplayStyleState]] supplying a [[TileTreeReference]] used to draw the
 * reality model in a [[Viewport]].
 * @see [DisplayStyleSettings.contextRealityModels]($common).
 * @see [[DisplayStyleState.contextRealityModelStates]].
 * @see [[DisplayStyleState.attachRealityModel]].
 * @public
 */
export class ContextRealityModelState extends ContextRealityModel {
  private readonly _treeRef: RealityModelTileTree.Reference;
  /** The iModel with which the reality model is associated. */
  public readonly iModel: IModelConnection;
  /** The reality data source key with which the reality model is associated. */
  public override readonly rdSourceKey: RealityDataSourceKey;

  /** @internal */
  public constructor(props: ContextRealityModelProps, iModel: IModelConnection, displayStyle: DisplayStyleState) {
    super(props);
    this.iModel = iModel;
    this._appearanceOverrides = props.appearanceOverrides ? FeatureAppearance.fromJSON(props.appearanceOverrides) : undefined;
    if (undefined === props.orbitGtBlob) {
      this.rdSourceKey = props.rdSourceKey ? props.rdSourceKey : RealityDataSource.createKeyFromUrl(props.tilesetUrl);
    } else {
      this.rdSourceKey = props.rdSourceKey ? props.rdSourceKey : RealityDataSource.createKeyFromOrbitGtBlobProps(props.orbitGtBlob);
    }
    const useOrbitGtTileTreeReference = this.rdSourceKey.format === RealityDataFormat.OPC;
    this._treeRef = (!useOrbitGtTileTreeReference) ?
      createRealityTileTreeReference({
        iModel,
        source: displayStyle,
        rdSourceKey: this.rdSourceKey,
        url: props.tilesetUrl,
        name: props.name,
        classifiers: this.classifiers,
        planarClipMask: this.planarClipMaskSettings,
      }) :
      createOrbitGtTileTreeReference({
        iModel,
        orbitGtBlob: props.orbitGtBlob!,
        rdSourceKey: this.rdSourceKey,
        name: props.name,
        classifiers: this.classifiers,
        source: displayStyle,
      });

    this.onPlanarClipMaskChanged.addListener((newSettings) => {
      this._treeRef.planarClipMask = newSettings ? PlanarClipMaskState.create(newSettings) : undefined;
    });
  }

  /** The tile tree reference responsible for drawing the reality model into a [[Viewport]]. */
  public get treeRef(): TileTreeReference { return this._treeRef; }

  /** The transient Id assigned to this reality model at run-time. */
  public get modelId(): Id64String | undefined {
    return (this._treeRef instanceof RealityModelTileTree.Reference) ? this._treeRef.modelId : undefined;
  }

  /** Whether the reality model spans the entire globe ellipsoid. */
  public get isGlobal(): boolean {
    return this.treeRef.isGlobal;
  }
}
