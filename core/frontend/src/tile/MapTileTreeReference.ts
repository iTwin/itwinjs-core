/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  Plane3dByOriginAndUnitNormal,
  Point3d,
  Range3d,
} from "@bentley/geometry-core";
import {
  ImageryProvider,
  Tile,
  TileGraphicType,
  TileTreeReference,
} from "./internal";
import {
  ScreenViewport,
  Viewport,
} from "../Viewport";
import { SceneContext } from "../ViewContext";
import { FeatureSymbology } from "../render/FeatureSymbology";

/** A reference to a TileTree used for drawing tiled map graphics into a Viewport.
 * @internal
 */
export abstract class MapTileTreeReference extends TileTreeReference {
  private _overrides?: FeatureSymbology.Overrides;
  private _plane?: {
    plane: Plane3dByOriginAndUnitNormal,
    height: number,
  };

  protected abstract get _groundBias(): number;
  protected abstract get _graphicType(): TileGraphicType;
  protected abstract get _imageryProvider(): ImageryProvider | undefined;
  protected abstract get _transparency(): number | undefined;

  public get plane(): Plane3dByOriginAndUnitNormal {
    const height = this._groundBias;
    if (undefined === this._plane || this._plane.height !== height)
      this._plane = { height, plane: Plane3dByOriginAndUnitNormal.createXYPlane(new Point3d(0, 0, height)) };

    return this._plane.plane;
  }

  /** Map tiles do not contribute to the range used by "fit view". */
  public unionFitRange(_range: Range3d): void { }

  public addPlanes(planes: Plane3dByOriginAndUnitNormal[]): void {
    const tree = this.treeOwner.tileTree;
    const heightRange = undefined !== tree ? (tree.loader as any).heightRange : undefined;
    if (undefined !== heightRange) {
      planes.push(Plane3dByOriginAndUnitNormal.createXYPlane(new Point3d(0, 0, heightRange.low)));
      planes.push(Plane3dByOriginAndUnitNormal.createXYPlane(new Point3d(0, 0, heightRange.high)));
      return;
    }

    if (undefined !== this.plane)
      planes.push(this.plane);
  }

  /** Select the tiles that would be displayed in the viewport. */
  public getTilesForView(viewport: Viewport): Tile[] {
    let tiles: Tile[] = [];
    const tree = this.treeOwner.tileTree;
    if (undefined !== tree) {
      const sceneContext = viewport.createSceneContext();
      sceneContext.withGraphicTypeAndPlane(this._graphicType, this.plane, () => tiles = tree.selectTilesForScene(sceneContext));
    }

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
  public addToScene(context: SceneContext): void {
    const tree = this.treeOwner.load();
    if (undefined === tree)
      return;

    const args = tree.createDrawArgs(context);
    args.graphics.symbologyOverrides = this._symbologyOverrides;

    context.withGraphicTypeAndPlane(this._graphicType, this.plane, () => tree.draw(args));
  }

  private get _symbologyOverrides(): FeatureSymbology.Overrides {
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
