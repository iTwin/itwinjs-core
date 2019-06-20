/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SpatialClassification */
import { compareStrings, Id64String, Id64 } from "@bentley/bentleyjs-core";
import { IModelConnection } from "./IModelConnection";
import { SceneContext } from "./ViewContext";
import { BatchType, SpatialClassificationProps } from "@bentley/imodeljs-common";
import { IModelApp } from "./IModelApp";
import { IModelTile } from "./tile/IModelTile";
import { TileTree } from "./tile/TileTree";

interface ClassifierTreeId extends IModelTile.ClassifierTreeId {
  modelId: Id64String;
}

// ###TODO A 3d model can supply EITHER a planar classifier tile tree OR a volumetric one - yet the planarity is encoded into the ID of the request for the tile tree.
// We should instead request the ONE-AND-ONLY classifier tile tree and determine planarity from result.
// For now assume all classifiers are planar.
class ClassifierTreeSupplier implements TileTree.Supplier {
  private readonly  _nonexistentTreeOwner: TileTree.Owner = {
    tileTree: undefined,
    loadStatus: TileTree.LoadStatus.NotFound,
    load: () => undefined,
  };

  public compareTileTreeIds(lhs: ClassifierTreeId, rhs: ClassifierTreeId): number {
    const cmp = compareStrings(lhs.modelId, rhs.modelId);
    return 0 === cmp ? IModelTile.compareTreeIds(lhs, rhs) : cmp;
  }

  public async createTileTree(id: ClassifierTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    const idStr = IModelTile.treeIdToString(id.modelId, id);
    const props = await iModel.tiles.getTileTreeProps(idStr);

    const loader = new IModelTile.Loader(iModel, props.formatVersion, BatchType.PlanarClassifier, false, false);
    props.rootTile.contentId = loader.rootContentId;
    const params = TileTree.paramsFromJSON(props, iModel, true, loader, id.modelId);
    return new TileTree(params);
  }

  public getOwner(id: ClassifierTreeId, iModel: IModelConnection): TileTree.Owner {
    return Id64.isValid(id.modelId) ? iModel.tiles.getTileTreeOwner(id, this) : this._nonexistentTreeOwner;
  }
}

const classifierTreeSupplier = new ClassifierTreeSupplier();

class ClassifierTreeReference extends TileTree.Reference {
  private _id: ClassifierTreeId;
  private readonly _classifiers: SpatialClassifiers;
  private readonly _iModel: IModelConnection;
  private readonly _classifiedTree: TileTree.Reference;
  private _owner: TileTree.Owner;

  public constructor(classifiers: SpatialClassifiers, classifiedTree: TileTree.Reference, iModel: IModelConnection) {
    super();
    this._id = this.createId(classifiers);
    this._iModel = iModel;
    this._classifiers = classifiers;
    this._classifiedTree = classifiedTree;
    this._owner = classifierTreeSupplier.getOwner(this._id, iModel);
  }

  public get treeOwner(): TileTree.Owner {
    const newId = this.createId(this._classifiers);
    if (newId.modelId !== this._id.modelId || newId.expansion !== this._id.expansion) {
      this._id = newId;
      this._owner = classifierTreeSupplier.getOwner(this._id, this._iModel);
    }

    return this._owner;
  }

  public discloseTileTrees(trees: Set<TileTree>): void {
    // NB: We do NOT call super because we don't use our tree if no classifier is active.
    this._classifiedTree.discloseTileTrees(trees);

    const classifier = this._classifiers.active;
    const classifierTree = undefined !== classifier ? this.treeOwner.tileTree : undefined;
    if (undefined !== classifierTree)
      trees.add(classifierTree);
  }

  public addToScene(context: SceneContext): void {
    const classifiedTree = this._classifiedTree.treeOwner.tileTree;
    if (undefined === classifiedTree)
      return;

    const classifier = this._classifiers.active;
    const classifierTree = undefined !== classifier ? this.treeOwner.load() : undefined;
    if (undefined === classifier || undefined === classifierTree)
      return;

    context.modelClassifiers.set(classifiedTree.modelId, classifier.modelId);
    if (BatchType.PlanarClassifier === this._id.type) {
      if (!context.getPlanarClassifier(classifier.modelId)) {
        const pc = IModelApp.renderSystem.createPlanarClassifier(classifier, classifierTree, classifiedTree, context);
        context.setPlanarClassifier(classifier.modelId, pc!);
      }
    } else {
      classifierTree.drawScene(context);
    }
  }

  private createId(classifiers: SpatialClassifiers): ClassifierTreeId {
    const active = classifiers.active;
    return {
      modelId: undefined !== active ? active.modelId : Id64.invalid,
      type: BatchType.PlanarClassifier,
      expansion: undefined !== active ? active.expand : 0,
    };
  }
}

/** @internal */
export function createClassifierTileTreeReference(classifiers: SpatialClassifiers, classifiedTree: TileTree.Reference, iModel: IModelConnection): TileTree.Reference {
  return new ClassifierTreeReference(classifiers, classifiedTree, iModel);
}

/** Exposes a list of classifiers that allow one [[ModelState]] to classify another [[SpatialModel]] or reality model.
 * A spatial model can have a list of any number of available classifiers; at most one of those classifiers may be "active" at a given time.
 * @see [[SpatialModel.classifiers]]
 * @beta
 */
export class SpatialClassifiers {
  private readonly _jsonContainer: any;
  private _active?: SpatialClassificationProps.Properties;
  private _classifiers: SpatialClassificationProps.Properties[] = [];

  /** @internal */
  public constructor(jsonContainer: any) {
    this._jsonContainer = jsonContainer;
    const json = jsonContainer.classifiers as SpatialClassificationProps.Properties[];
    if (undefined !== json) {
      for (const props of json) {
        this._classifiers.push(props);
        if (props.isActive) {
          if (undefined === this._active)
            this._active = props;
          else
            props.isActive = false;
        }
      }
    }
  }

  /** The currently-active classifier, if any is active.
   * @note The classifier passed to the setter must originate from this [[SpatialClassifiers]] object or it will not be applied.
   */
  public get active(): SpatialClassificationProps.Classifier | undefined {
    return this._active;
  }
  public set active(active: SpatialClassificationProps.Classifier | undefined) {
    if (active === this._active)
      return;

    if (undefined === active) {
      if (undefined !== this._active)
        this._active.isActive = false;

      this._active = undefined;
      return;
    }

    // Caller must supply a classifier that belongs to this object...
    for (const classifier of this._classifiers) {
      if (classifier === active) {
        if (undefined !== this._active)
          this._active.isActive = false;

        this._active = classifier as SpatialClassificationProps.Properties;
        this._active.isActive = true;
        return;
      }
    }
  }

  /** Supplies an iterator over the list of available classifiers. */
  public [Symbol.iterator](): Iterator<SpatialClassificationProps.Classifier> {
    return this._classifiers[Symbol.iterator]();
  }

  /** The number of available classifiers. */
  public get length(): number { return this._classifiers.length; }

  /** Add a new classifier to the list. */
  public push(classifier: SpatialClassificationProps.Classifier): void {
    for (const existing of this)
      if (existing === classifier)
        return;

    let list = this._jsonContainer.classifiers;
    if (undefined === list) {
      list = [];
      this._jsonContainer.classifiers = list;
    }

    const props: SpatialClassificationProps.Properties = { ...classifier, isActive: false };
    list.push(props);
  }
}
