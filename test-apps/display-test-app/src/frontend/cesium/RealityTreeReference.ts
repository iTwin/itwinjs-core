/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { RealityModelTileTree, RealityTileTree, RealityTreeReference, SceneContext } from "@itwin/core-frontend";

/** @internal */
export class CesiumRealityTreeReference extends RealityTreeReference {
  public constructor(props: RealityModelTileTree.ReferenceProps) {
    super(props);
  }

  public override get modelId() { return "cesium prototype reality data set attachment"; }

  // public get treeOwner(): TileTreeOwner {
  //   return realityTreeSupplier.getOwner(this.createTreeId(this.modelId), this.iModel);
  // }

  // protected override _createGeometryTreeReference(options?: GeometryTileTreeReferenceOptions): GeometryTileTreeReference {
  //   const ref = new RealityTreeReference({
  //     iModel: this.iModel,
  //     modelId: this.modelId,
  //     source: this._source,
  //     rdSourceKey: this._rdSourceKey,
  //     name: this._name,
  //     produceGeometry: options?.reprojectGeometry ? "reproject" : "yes",
  //     getDisplaySettings: () => RealityModelDisplaySettings.defaults,
  //   });

  //   assert(undefined !== ref.collectTileGeometry);
  //   return ref as GeometryTileTreeReference;
  // }

  // public override createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
  //   // For global reality models (OSM Building layer only) - offset the reality model by the BIM elevation bias.  This would not be necessary
  //   // if iModels had their elevation set correctly but unfortunately many GCS erroneously report Sea (Geoid) elevation rather than
  //   // Geodetic.
  //   const tree = this.treeOwner.load();
  //   if (undefined === tree)
  //     return undefined;

  //   const drawArgs = super.createDrawArgs(context);
  //   if (drawArgs !== undefined && this.iModel.isGeoLocated && tree.isContentUnbounded) {
  //     const elevationBias = context.viewport.view.displayStyle.backgroundMapElevationBias;

  //     if (undefined !== elevationBias)
  //       drawArgs.location.origin.z -= elevationBias;
  //   }

  //   return drawArgs;
  // }

  public override addToScene(_context: SceneContext): void {
    const rdSourceKey = this._rdSourceKey;
    // assume that id is url (default tileset provider path) - RealityDataProvider.TilesetUrl
    console.log(`rdSourceKey.id = ${  rdSourceKey.id}`);

    // const tree = this.treeOwner.tileTree as RealityTileTree;
    // if (undefined !== tree && context.viewport.iModel.isGeoLocated && (tree.loader as RealityModelTileLoader).doDrapeBackgroundMap) {
    //   // NB: We save this off strictly so that discloseTileTrees() can find it...better option?
    //   this._mapDrapeTree = context.viewport.backgroundDrapeMap;
    //   context.addBackgroundDrapedModel(this, undefined);
    // }

    // super.addToScene(context);
  }

  // public override canSupplyToolTip(hit: HitDetail): boolean {
  //   const classifier = this._classifier?.activeClassifier?.tileTreeReference;
  //   if (classifier && classifier.canSupplyToolTip(hit)) {
  //     return true;
  //   }

  //   const tree = this.treeOwner.tileTree;
  //   return tree instanceof RealityTileTree && hit.iModel === tree.iModel && undefined !== tree.batchTableProperties?.getFeatureProperties(hit.sourceId);
  // }

  // public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined> {
  //   const tooltip = this._getToolTip(hit);
  //   if (tooltip) {
  //     return tooltip;
  //   }

  //   const classifierTree = this._classifier?.activeClassifier?.tileTreeReference;
  //   if (classifierTree) {
  //     return classifierTree.getToolTip(hit);
  //   }

  //   return undefined;
  // }

  // private _getToolTip(hit: HitDetail): HTMLElement | string | undefined {
  //   const tree = this.treeOwner.tileTree;
  //   if (!(tree instanceof RealityTileTree) || hit.iModel !== tree.iModel)
  //     return undefined;

  //   const batch = tree.batchTableProperties?.getFeatureProperties(hit.sourceId);
  //   if (undefined === batch && tree.modelId !== hit.sourceId)
  //     return undefined;

  //   const strings = [];

  //   const loader = (tree as RealityModelTileTree).loader;
  //   const type = (loader as RealityModelTileLoader).tree.dataSource.realityDataType;

  //   // If a type is specified, display it
  //   if (type !== undefined) {
  //     // Case insensitive
  //     switch (type.toUpperCase()) {
  //       case DefaultSupportedTypes.RealityMesh3dTiles.toUpperCase():
  //         strings.push(IModelApp.localization.getLocalizedString("iModelJs:RealityModelTypes.RealityMesh3DTiles"));
  //         break;
  //       case DefaultSupportedTypes.Terrain3dTiles.toUpperCase():
  //         strings.push(IModelApp.localization.getLocalizedString("iModelJs:RealityModelTypes.Terrain3DTiles"));
  //         break;
  //       case DefaultSupportedTypes.Cesium3dTiles.toUpperCase():
  //         strings.push(IModelApp.localization.getLocalizedString("iModelJs:RealityModelTypes.Cesium3DTiles"));
  //         break;
  //     }
  //   }

  //   if (this._name) {
  //     strings.push(`${IModelApp.localization.getLocalizedString("iModelJs:TooltipInfo.Name")} ${this._name}`);
  //   } else {
  //     const cesiumAsset = this._rdSourceKey.provider === RealityDataProvider.CesiumIonAsset ? CesiumIonAssetProvider.parseCesiumUrl(this._rdSourceKey.id) : undefined;
  //     strings.push(cesiumAsset ? `Cesium Asset: ${cesiumAsset.id}` : this._rdSourceKey.id);
  //   }

  //   if (batch !== undefined)
  //     for (const key of Object.keys(batch))
  //       if (-1 === key.indexOf("#"))     // Avoid internal cesium
  //         strings.push(`${key}: ${JSON.stringify(batch[key])}`);

  //   const div = document.createElement("div");
  //   div.innerHTML = strings.join("<br>");
  //   return div;
  // }

    // /** @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [addAttributions] instead. */
  // public override addLogoCards(cards: HTMLTableElement): void {
  //   if (this._rdSourceKey.provider === RealityDataProvider.CesiumIonAsset && !cards.dataset.openStreetMapLogoCard) {
  //     cards.dataset.openStreetMapLogoCard = "true";
  //     cards.appendChild(IModelApp.makeLogoCard({ heading: "OpenStreetMap", notice: `&copy;<a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> ${IModelApp.localization.getLocalizedString("iModelJs:BackgroundMap:OpenStreetMapContributors")}` }));
  //   }
  // }

  // public override async addAttributions(cards: HTMLTableElement, vp: ScreenViewport): Promise<void> {
  //   const provider = IModelApp.realityDataSourceProviders.find(this._rdSourceKey.provider);
  //   if (provider?.addAttributions) {
  //     await provider.addAttributions(cards, vp);
  //   }
  // }

  // public override decorate(_context: DecorateContext): void {
  //   const provider = IModelApp.realityDataSourceProviders.find(this._rdSourceKey.provider);
  //   if (provider?.decorate) {
  //     provider.decorate(_context);
  //   }
  // }
}
