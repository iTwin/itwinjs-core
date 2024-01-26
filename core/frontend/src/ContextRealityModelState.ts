/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64String } from "@itwin/core-bentley";
import { ContextRealityModel, ContextRealityModelProps, FeatureAppearance, RealityDataFormat, RealityDataSourceKey } from "@itwin/core-common";
import { DisplayStyleState } from "./DisplayStyleState";
import { IModelConnection } from "./IModelConnection";
import { PlanarClipMaskState } from "./PlanarClipMaskState";
import { RealityDataSource } from "./RealityDataSource";
import { createOrbitGtTileTreeReference, createRealityTileTreeReference, RealityModelTileTree, RealityTileTree, TileTreeReference } from "./tile/internal";

/** A [ContextRealityModel]($common) attached to a [[DisplayStyleState]] supplying a [[TileTreeReference]] used to draw the
 * reality model in a [[Viewport]].
 * @see [DisplayStyleSettings.contextRealityModels]($common).
 * @see [[DisplayStyleState.contextRealityModelStates]].
 * @see [[DisplayStyleState.attachRealityModel]].
 * @public
 * @extensions
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
        getDisplaySettings: () => this.displaySettings,
      }) :
      createOrbitGtTileTreeReference({
        iModel,
        orbitGtBlob: props.orbitGtBlob!,
        rdSourceKey: this.rdSourceKey,
        name: props.name,
        classifiers: this.classifiers,
        source: displayStyle,
        getDisplaySettings: () => this.displaySettings,
      });

    this.onPlanarClipMaskChanged.addListener((newSettings) => {
      this._treeRef.planarClipMask = newSettings ? PlanarClipMaskState.create(newSettings) : undefined;
    });
  }

  /** The tile tree reference responsible for drawing the reality model into a [[Viewport]]. */
  public get treeRef(): TileTreeReference { return this._treeRef; }

  private get _realityTreeRef(): RealityModelTileTree.Reference | undefined {
    return this._treeRef instanceof RealityModelTileTree.Reference ? this._treeRef : undefined;
  }

  /** The transient Id assigned to this reality model at run-time. */
  public get modelId(): Id64String | undefined {
    return this._realityTreeRef?.modelId;
  }

  /** Obtain the properties for a feature specified in this reality model's [batch table](https://github.com/CesiumGS/3d-tiles/tree/main/specification/TileFormats/BatchTable).
   * A ContextRealityModelState may refer to a tileset in one of the 3D Tiles 1.0 format (b3dm, i3dm, cmpt, or pnts).
   * Tiles within such tilesets may include a "batch table" describing subcomponents ("features") within the tile. For example, a tileset representing a building
   * may encode each door, window, and wall as separate features.
   * The batch table may additionally contain metadata in JSON format describing each feature.
   * During tile decoding, iTwin.js assigns unique, transient [Id64String]($bentley)s to each unique feature within the tileset.
   * When interacting with tileset features (e.g., via the [][SelectionSet]] or a [[HitDetail]]), the features are identified by these transient Ids.
   * getFeatureProperties takes the transient Id and returns the JSON properties of the corresponding feature, or `undefined` if no properties exist for the specified feature.
   * @beta
   */
  public getFeatureProperties(featureId: Id64String): any {
    const tree = this._realityTreeRef?.treeOwner.tileTree;
    if (!tree || !(tree instanceof RealityTileTree))
      return undefined;

    const map = tree.loader.getBatchIdMap();
    return map?.getBatchProperties(featureId);
  }

  /** Whether the reality model spans the entire globe ellipsoid. */
  public get isGlobal(): boolean {
    return this.treeRef.isGlobal;
  }
}
