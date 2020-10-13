/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, DbOpcode, Id64, Id64Array } from "@bentley/bentleyjs-core";
import { Range3d, Transform } from "@bentley/geometry-core";
import {
  BatchType, ElementGeometryChange, FeatureAppearance, FeatureAppearanceProvider, FeatureOverrides, GeometryClass,
} from "@bentley/imodeljs-common";
import { InteractiveEditingSession } from "../InteractiveEditingSession";
import { RenderSystem } from "../render/RenderSystem";
import {
  RootIModelTile, Tile, TileContent, TileParams, TileRequest, TileTree,
} from "./internal";

/** The root tile for the branch of an [[IModelTileTree]] containing graphics for elements that have been modified during the current
 * Not intended for direct consumption - exported for use by [[IModelTileTree]].
 * [[InteractiveEditingSession]].
 * @internal
 */
export abstract class DynamicIModelTile extends Tile {
  protected constructor(params: TileParams, tree: TileTree) {
    super(params, tree);
  }

  public static create(root: RootIModelTile, elements: Iterable<ElementGeometryChange>): DynamicIModelTile {
    return new RootTile(root, elements);
  }

  /** Updates the tiles when elements are modified during the editing session. */
  public abstract handleGeometryChanges(changes: Iterable<ElementGeometryChange>): void;

  /** Overrides symbology of the *static* [[IModelTile]]s to hide elements that have been deleted or modified. */
  public abstract get appearanceProvider(): FeatureAppearanceProvider;

  /** Exposed strictly for tests. */
  public abstract get hiddenElements(): Id64Array;
}

/** The root tile. Each of its children represent a newly-inserted or modified element. */
class RootTile extends DynamicIModelTile implements FeatureAppearanceProvider {
  private readonly _hiddenElements: Id64.Uint32Set;
  public readonly transformToTree: Transform;

  private get _imodelRoot() { return this.parent as RootIModelTile; }

  public constructor(parent: RootIModelTile, elements: Iterable<ElementGeometryChange>) {
    const range = Range3d.createNull();
    const params: TileParams = {
      parent,
      isLeaf: false,
      contentId: "dynamic",
      range: Range3d.createNull(),
      maximumSize: parent.maximumSize,
    };

    super(params, parent.tree);

    this._hiddenElements = new Id64.Uint32Set();

    const inverseTransform = parent.tree.iModelTransform.inverse();
    assert(undefined !== inverseTransform);
    this.transformToTree = inverseTransform;

    this.loadChildren(); // initially empty.
    this.setIsReady();
    this.handleGeometryChanges(elements);
  }

  public get hiddenElements(): Id64Array {
    return this._hiddenElements.toId64Array();
  }

  public get appearanceProvider(): FeatureAppearanceProvider {
    return this;
  }

  public getFeatureAppearance(overrides: FeatureOverrides, elemLo: number, elemHi: number, subcatLo: number, subcatHi: number, geomClass: GeometryClass, modelLo: number, modelHi: number, type: BatchType, animationNodeId: number): FeatureAppearance | undefined {
    if (this._hiddenElements.has(elemLo, elemHi))
      return undefined;

    return overrides.getAppearance(elemLo, elemHi, subcatLo, subcatHi, geomClass, modelLo, modelHi, type, animationNodeId);
  }

  public handleGeometryChanges(changes: Iterable<ElementGeometryChange>): void {
    let updateRange = false;
    let haveNewTiles = false;

    for (const change of changes) {
      updateRange = true;
      if (change.type !== DbOpcode.Insert)
        this._hiddenElements.addId(change.id);

      // ###TODO create/update/delete child tiles...
    }

    if (updateRange)
      this.updateRange();
  }

  protected _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (errpr: Error) => void): void {
    // This is invoked from constructor. We will add a child per element later - for now just mark the children as having been loaded.
    resolve([]);
  }

  public async requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> {
    assert(false, "Root dynamic tile has no content");
    return undefined;
  }

  public async readContent(_data: TileRequest.ResponseData, _system: RenderSystem, _isCanceled: () => boolean): Promise<TileContent> {
    throw new Error("Root dynamic tile has no content");
  }

  private updateRange(): void {
    const session = InteractiveEditingSession.get(this.iModel)!;
    const changes = session.getGeometryChangesForModel(this.tree.modelId);
    assert(undefined !== changes);

    const scratchRange = Range3d.createNull();
    this.range.setNull();
    for (const change of changes) {
      if (change.type !== DbOpcode.Delete && !change.range.isNull) {
        const range = this.transformToTree.multiplyRange(change.range, scratchRange);
        this.range.extendRange(range);
      }
    }

    this._imodelRoot.updateDynamicRange(this);
  }
}
