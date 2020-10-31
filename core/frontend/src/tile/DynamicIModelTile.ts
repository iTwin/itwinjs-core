/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import {
  assert, compareStrings, DbOpcode, Id64, Id64Array, Id64String, SortedArray,
} from "@bentley/bentleyjs-core";
import { Range3d, Transform } from "@bentley/geometry-core";
import {
  BatchType, ElementGeometryChange, FeatureAppearance, FeatureAppearanceProvider, FeatureOverrides, GeometryClass,
} from "@bentley/imodeljs-common";
import { RenderSystem } from "../render/RenderSystem";
import { Viewport } from "../Viewport";
import {
  RootIModelTile, Tile, TileContent, TileDrawArgs, TileParams, TileRequest, TileTree,
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

  /** Select tiles for display, requesting content for tiles as necessary. */
  public abstract selectTiles(selected: Tile[], args: TileDrawArgs): void;
}

/** The root tile. Each of its children represent a newly-inserted or modified element. */
class RootTile extends DynamicIModelTile implements FeatureAppearanceProvider {
  private readonly _hiddenElements: Id64.Uint32Set;
  public readonly transformToTree: Transform;
  private readonly _elements: SortedArray<ElementTile>;

  private get _imodelRoot() { return this.parent as RootIModelTile; }

  private get elementChildren(): ElementTile[] {
    assert(undefined !== this.children);
    return this.children as ElementTile[];
  }

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
    this._elements = new SortedArray<ElementTile>((lhs, rhs) => compareStrings(lhs.contentId, rhs.contentId));

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
    assert(undefined !== this.children);

    for (const change of changes) {
      if (change.type !== DbOpcode.Insert)
        this._hiddenElements.addId(change.id);

      let tile = this._elements.findEquivalent((tile: ElementTile) => compareStrings(tile.contentId, change.id));
      if (change.type === DbOpcode.Delete) {
        if (tile) {
          this._elements.remove(tile);
          const childIndex = this.children.indexOf(tile);
          assert(-1 !== childIndex);
          this.children.splice(childIndex, 1);
        }
      } else {
        const range = change.range.isNull ? change.range.clone() : this.transformToTree.multiplyRange(change.range);
        if (tile) {
          range.clone(tile.range);
        } else {
          this._elements.insert(tile = new ElementTile(this, change.id, range));
          this.children.push(tile);
        }
      }
    }

    // Recompute range.
    this.range.setNull();
    for (const element of this._elements)
      this.range.extendRange(element.range);

    this._imodelRoot.updateDynamicRange(this);
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

  public selectTiles(selected: Tile[], args: TileDrawArgs): void {
    for (const child of this.elementChildren)
      child.selectTiles(selected, args);
  }
}

/** Represents a single element that has been inserted or had its geometric properties modified during the current [[InteractiveEditingSession]].
 * It has no graphics of its own; it has any number of child tiles, each of which have graphics of a different level of detail.
 * Its contentId is the element's Id.
 */
class ElementTile extends Tile {
  public constructor(parent: RootTile, elementId: Id64String, range: Range3d) {
    super({
      parent,
      isLeaf: false,
      contentId: elementId,
      range,
      maximumSize: parent.maximumSize,
    }, parent.tree);

    this.loadChildren();
    this.setIsReady();
  }

  protected _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void {
    // Invoked from constructor. We'll add child tiles later as needed.
    resolve([]);
  }

  public async requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> {
    assert(false, "ElementTile has no content");
    return undefined;
  }

  public async readContent(_data: TileRequest.ResponseData, _system: RenderSystem, _isCanceled: () => boolean): Promise<TileContent> {
    throw new Error("ElementTile has no content");
  }

  public selectTiles(selected: Tile[], args: TileDrawArgs): void {
    if (this.isEmpty || this.isRegionCulled(args))
      return;

    args.markUsed(this);
    args.markUsed(this.parent!);

    // ###TODO: Test content range culled.

    // Compute the ideal chord tolerance.
    const pixelSize = args.getPixelSize(this);
    assert(pixelSize > 0);

    // Round down to the nearest power of ten.
    const toleranceLog10 = Math.floor(Math.log10(pixelSize));

    // Find (or create) a child tile of desired tolerance. Also find a child tile that can be substituted for the desired tile if that tile's content is not yet loaded.
    // NB: Children are sorted in descending order by log10(tolerance)
    assert(undefined !== this.children);
    const children = this.children as GraphicsTile[];
    let closestMatch: GraphicsTile | undefined;
    let exactMatch: GraphicsTile | undefined;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const tol = child.toleranceLog10;
      if (tol > toleranceLog10) {
        assert(undefined === exactMatch);
        if (child.hasGraphics)
          closestMatch = child;
      } else if (tol === toleranceLog10) {
        exactMatch = child;
      } else if (tol < toleranceLog10) {
        if (!exactMatch)
          children.splice(i++, 0, exactMatch = new GraphicsTile(this, toleranceLog10));

        if (child.hasGraphics && (!closestMatch || closestMatch.toleranceLog10 > toleranceLog10))
          closestMatch = child;
      }
    }

    if (!exactMatch) {
      assert(children.length === 0 || children[children.length - 1].toleranceLog10 > toleranceLog10);
      children.push(exactMatch = new GraphicsTile(this, toleranceLog10));
    }

    if (!exactMatch.isReady) {
      args.insertMissing(exactMatch);
      if (closestMatch) {
        selected.push(closestMatch);
        args.markUsed(closestMatch);
      }
    } else if (exactMatch.hasGraphics) {
      selected.push(exactMatch);
      args.markUsed(exactMatch);
    }
  }
}

/** Supplies graphics of a specific LOD for a single element. */
class GraphicsTile extends Tile {
  public readonly toleranceLog10: number;
  public readonly tolerance: number;

  public constructor(parent: ElementTile, toleranceLog10: number) {
    assert(Math.round(toleranceLog10) === toleranceLog10);
    super({
      parent,
      isLeaf: true,
      contentId: `${parent.contentId}_${toleranceLog10}`,
      range: parent.range,
      maximumSize: parent.maximumSize,
    }, parent.tree);

    this.toleranceLog10 = toleranceLog10;
    this.tolerance = 10 ** toleranceLog10;
  }

  public computeLoadPriority(_viewports: Iterable<Viewport>): number {
    // We want the element's graphics to be updated as soon as possible
    return 0;
  }

  public _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void {
    resolve(undefined);
  }

  public async requestContent(_isCanceled: () => boolean): Promise<TileRequest.Response> {
    // ###TODO
    return undefined;
  }

  public async readContent(_data: TileRequest.ResponseData, _system: RenderSystem, _isCanceled: () => boolean): Promise<TileContent> {
    // ###TODO
    throw new Error("TODO");
  }
}
