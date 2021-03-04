/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { BeTimePoint, Dictionary, dispose, Id64Array, IModelStatus } from "@bentley/bentleyjs-core";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { TileTree, TileTreeLoadStatus, TileTreeOwner, TileTreeSupplier } from "./tile/internal";

class TreeOwner implements TileTreeOwner {
  private _tileTree?: TileTree;
  private _loadStatus: TileTreeLoadStatus = TileTreeLoadStatus.NotLoaded;
  private readonly _supplier: TileTreeSupplier;
  private readonly _iModel: IModelConnection;

  public readonly id: any;

  public get tileTree(): TileTree | undefined { return this._tileTree; }
  public get loadStatus(): TileTreeLoadStatus { return this._loadStatus; }
  public get iModel(): IModelConnection { return this._iModel; }

  public constructor(id: any, supplier: TileTreeSupplier, iModel: IModelConnection) {
    this.id = id;
    this._supplier = supplier;
    this._iModel = iModel;
  }

  public load(): TileTree | undefined {
    this._load(); // eslint-disable-line @typescript-eslint/no-floating-promises
    return this.tileTree;
  }

  public async loadTree(): Promise<TileTree | undefined> {
    await this._load();
    return this.tileTree;
  }

  public dispose(): void {
    this._tileTree = dispose(this._tileTree);
    this._loadStatus = TileTreeLoadStatus.NotLoaded;
  }

  private async _load(): Promise<void> {
    if (TileTreeLoadStatus.NotLoaded !== this.loadStatus)
      return;

    this._loadStatus = TileTreeLoadStatus.Loading;
    let tree: TileTree | undefined;
    let newStatus: TileTreeLoadStatus;
    try {
      tree = await this._supplier.createTileTree(this.id, this._iModel);
      newStatus = undefined !== tree && !tree.rootTile.contentRange.isNull ? TileTreeLoadStatus.Loaded : TileTreeLoadStatus.NotFound;
    } catch (err) {
      newStatus = (err.errorNumber && err.errorNumber === IModelStatus.ServerTimeout) ? TileTreeLoadStatus.NotLoaded : TileTreeLoadStatus.NotFound;
    }

    if (TileTreeLoadStatus.Loading === this._loadStatus) {
      this._tileTree = tree;
      this._loadStatus = newStatus;
      IModelApp.tileAdmin.onTileTreeLoad.raiseEvent(this);
    }
  }
}

/** Provides access to [[TileTree]]s associated with an [[IModelConnection]].
 * @beta
 */
export class Tiles {
  private _iModel: IModelConnection;
  private readonly _treesBySupplier = new Map<TileTreeSupplier, Dictionary<any, TreeOwner>>();
  private _disposed = false;

  /** @internal */
  public get isDisposed() { return this._disposed; }

  constructor(iModel: IModelConnection) { this._iModel = iModel; }

  /** @internal */
  public dispose(): void {
    this.reset();
    this._disposed = true;
  }

  /** Intended strictly for tests.
   * @internal
   */
  public reset(): void {
    for (const supplier of this._treesBySupplier)
      supplier[1].forEach((_key, value) => value.dispose());

    this._treesBySupplier.clear();
  }

  /** @internal */
  public async purgeTileTrees(modelIds: Id64Array | undefined): Promise<void> {
    return IModelApp.tileAdmin.purgeTileTrees(this._iModel, modelIds);
  }

  /** Obtain the owner of a TileTree. The `id` is unique within all tile trees associated with `supplier`; its specific structure is an implementation detail known only to the supplier. */
  public getTileTreeOwner(id: any, supplier: TileTreeSupplier): TileTreeOwner {
    let trees = this._treesBySupplier.get(supplier);
    if (undefined === trees) {
      trees = new Dictionary<any, TreeOwner>((lhs, rhs) => supplier.compareTileTreeIds(lhs, rhs));
      this._treesBySupplier.set(supplier, trees);
    }

    let tree = trees.get(id);
    if (undefined === tree) {
      tree = new TreeOwner(id, supplier, this._iModel);
      trees.set(id, tree);
    }

    return tree;
  }

  /** Disposes of all [[TileTree]]s belonging to `supplier` and removes `supplier` from the set of known tile tree suppliers. */
  public dropSupplier(supplier: TileTreeSupplier): void {
    const trees = this._treesBySupplier.get(supplier);
    if (undefined === trees)
      return;

    trees.forEach((_key, value) => value.dispose());
    this._treesBySupplier.delete(supplier);
  }

  /** Invokes a function on each extant TileTreeOwner. */
  public forEachTreeOwner(func: (owner: TileTreeOwner) => void): void {
    for (const dict of this._treesBySupplier.values())
      dict.forEach((_key, value) => func(value));
  }

  /** Obtain the TileTreeOwners supplied by the specified supplier. */
  public getTreeOwnersForSupplier(supplier: TileTreeSupplier): Iterable<{ id: any, owner: TileTreeOwner }> {
    function* iterator(trees: Dictionary<any, TreeOwner> | undefined) {
      if (trees)
        for (const entry of trees)
          yield { id: entry.key, owner: entry.value };
    }

    return {
      [Symbol.iterator]: () => iterator(this._treesBySupplier.get(supplier)),
    };
  }

  /** Unload any tile trees which have not been drawn since at least the specified time, excluding any of the specified TileTrees. */
  public purge(olderThan: BeTimePoint, exclude?: Set<TileTree>): void {
    // NB: It would be nice to be able to detect completely useless leftover Owners or Suppliers, but we can't know if any TileTreeReferences exist pointing to a given Owner.
    for (const entry of this._treesBySupplier) {
      const dict = entry[1];
      dict.forEach((_treeId, owner) => {
        const tree = owner.tileTree;
        if (undefined !== tree && tree.lastSelectedTime.milliseconds < olderThan.milliseconds)
          if (undefined === exclude || !exclude.has(tree))
            owner.dispose();
      });
    }
  }

  /** @internal */
  public onEcefChanged(): void {
    for (const supplier of this._treesBySupplier.keys()) {
      if (supplier.isEcefDependent)
        this.dropSupplier(supplier);
    }
  }
}
