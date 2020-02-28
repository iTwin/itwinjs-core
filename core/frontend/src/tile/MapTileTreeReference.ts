/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { Range3d } from "@bentley/geometry-core";
import {
  createDefaultViewFlagOverrides,
  ImageryProvider,
  Tile,
  TileDrawArgs,
  TileGraphicType,
  TileTree,
  TileTreeReference,
} from "./internal";
import {
  ScreenViewport,
  Viewport,
} from "../Viewport";
import { SceneContext } from "../ViewContext";
import { FeatureSymbology } from "../render/FeatureSymbology";

const viewFlagOverrides = createDefaultViewFlagOverrides({ clipVolume: false });

/** A reference to a TileTree used for drawing tiled map graphics into a Viewport.
 * @internal
 */
export abstract class MapTileTreeReference extends TileTreeReference {
  private _overrides?: FeatureSymbology.Overrides;

  protected abstract get _groundBias(): number;
  protected abstract get _graphicType(): TileGraphicType;
  protected abstract get _imageryProvider(): ImageryProvider | undefined;
  protected abstract get _transparency(): number | undefined;

  /** Map tiles do not contribute to the range used by "fit view". */
  public unionFitRange(_range: Range3d): void { }

  /** Select the tiles that would be displayed in the viewport. */
  public getTilesForView(viewport: Viewport): Tile[] {
    const sceneContext = viewport.createSceneContext();
    const args = this.createDrawArgs(sceneContext);

    let tiles: Tile[] = [];
    if (undefined !== args)
      tiles = args.tree.selectTiles(args);

    return tiles;
  }

  /** Add logo cards to container div. */
  public addLogoCards(cards: HTMLTableElement, vp: ScreenViewport): void {
    const provider = this._imageryProvider;
    if (undefined === provider)
      return;

    const imagAttr = provider.getImageryLogo(this, vp);
    if (undefined !== imagAttr)
      cards.appendChild(imagAttr);

    const geomProv = provider.geometryAttributionProvider;
    if (undefined !== geomProv) {
      const geomAttr = geomProv.getGeometryLogo(this, vp);
      if (undefined !== geomAttr)
        cards.appendChild(geomAttr);
    }

  }

  /** Draw the tiles into the viewport. */
  public draw(args: TileDrawArgs): void {
    args.context.withGraphicType(this._graphicType, () => args.tree.draw(args));
  }

  protected getViewFlagOverrides(_tree: TileTree) {
    return viewFlagOverrides;
  }

  protected getSymbologyOverrides(_tree: TileTree) {
    return this.symbologyOverrides;
  }

  protected get symbologyOverrides(): FeatureSymbology.Overrides | undefined {
    if (undefined === this._overrides || this._overrides.defaultOverrides.transparency !== this._transparency) {
      this._overrides = new FeatureSymbology.Overrides();
      const json: FeatureSymbology.AppearanceProps = {
        transparency: this._transparency,
        nonLocatable: true,
      };
      this._overrides.setDefaultOverrides(FeatureSymbology.Appearance.fromJSON(json));
    }

    return this._overrides;
  }
}
