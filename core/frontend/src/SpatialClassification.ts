/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SpatialClassification */
import { compareStrings, compareStringsOrUndefined, Id64String, Id64 } from "@bentley/bentleyjs-core";
import { IModelConnection } from "./IModelConnection";
import { SceneContext } from "./ViewContext";
import { BatchType, SpatialClassificationProps } from "@bentley/imodeljs-common";
import { IModelApp } from "./IModelApp";
import { IModelTile } from "./tile/IModelTile";
import { TileTree, TileTreeSet } from "./tile/TileTree";
import { ViewState } from "./ViewState";
import { DisplayStyleState } from "./DisplayStyleState";
import { GeometricModelState } from "./ModelState";

interface ClassifierTreeId extends IModelTile.ClassifierTreeId {
  modelId: Id64String;
}

// ###TODO A 3d model can supply EITHER a planar classifier tile tree OR a volumetric one - yet the planarity is encoded into the ID of the request for the tile tree.
// We should instead request the ONE-AND-ONLY classifier tile tree and determine planarity from result.
// For now assume all classifiers are planar.
class ClassifierTreeSupplier implements TileTree.Supplier {
  private readonly _nonexistentTreeOwner: TileTree.Owner = {
    tileTree: undefined,
    loadStatus: TileTree.LoadStatus.NotFound,
    load: () => undefined,
    dispose: () => undefined,
  };

  public compareTileTreeIds(lhs: ClassifierTreeId, rhs: ClassifierTreeId): number {
    let cmp = compareStrings(lhs.modelId, rhs.modelId);
    if (0 === cmp)
      cmp = compareStringsOrUndefined(lhs.animationId, rhs.animationId);

    return 0 === cmp ? IModelTile.compareTreeIds(lhs, rhs) : cmp;
  }

  public async createTileTree(id: ClassifierTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    await iModel.models.load(id.modelId);
    const model = iModel.models.getLoaded(id.modelId);
    if (undefined === model || !(model instanceof GeometricModelState))
      return undefined;

    const idStr = IModelTile.treeIdToString(id.modelId, id);
    const props = await iModel.tiles.getTileTreeProps(idStr);

    const loader = new IModelTile.Loader(iModel, props.formatVersion, BatchType.PlanarClassifier, false, false, model.geometryGuid);
    props.rootTile.contentId = loader.rootContentId;
    const params = TileTree.paramsFromJSON(props, iModel, true, loader, id.modelId);
    return new TileTree(params);
  }

  public getOwner(id: ClassifierTreeId, iModel: IModelConnection): TileTree.Owner {
    return Id64.isValid(id.modelId) ? iModel.tiles.getTileTreeOwner(id, this) : this._nonexistentTreeOwner;
  }
}

const classifierTreeSupplier = new ClassifierTreeSupplier();

/** @internal */
export abstract class SpatialClassifierTileTreeReference extends TileTree.Reference {
  public abstract get classifiers(): SpatialClassifiers;
}

/** @internal */
class ClassifierTreeReference extends SpatialClassifierTileTreeReference {
  private _id: ClassifierTreeId;
  private readonly _classifiers: SpatialClassifiers;
  private readonly _source: ViewState | DisplayStyleState;
  private readonly _iModel: IModelConnection;
  private readonly _classifiedTree: TileTree.Reference;
  private _owner: TileTree.Owner;

  public constructor(classifiers: SpatialClassifiers, classifiedTree: TileTree.Reference, iModel: IModelConnection, source: ViewState | DisplayStyleState) {
    super();
    this._id = this.createId(classifiers, source);
    this._source = source;
    this._iModel = iModel;
    this._classifiers = classifiers;
    this._classifiedTree = classifiedTree;
    this._owner = classifierTreeSupplier.getOwner(this._id, iModel);
  }

  public get classifiers(): SpatialClassifiers { return this._classifiers; }

  public get treeOwner(): TileTree.Owner {
    const newId = this.createId(this._classifiers, this._source);
    if (newId.modelId !== this._id.modelId || newId.expansion !== this._id.expansion || 0 !== compareStringsOrUndefined(newId.animationId, this._id.animationId)) {
      this._id = newId;
      this._owner = classifierTreeSupplier.getOwner(this._id, this._iModel);
    }

    return this._owner;
  }

  public discloseTileTrees(trees: TileTreeSet): void {
    // NB: We do NOT call super because we don't use our tree if no classifier is active.
    trees.disclose(this._classifiedTree);

    const classifier = this._classifiers.active;
    const classifierTree = undefined !== classifier ? this.treeOwner.tileTree : undefined;
    if (undefined !== classifierTree)
      trees.add(classifierTree);
  }

  public addToScene(context: SceneContext): void {
    const classifiedTree = this._classifiedTree.treeOwner.load();
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

  private createId(classifiers: SpatialClassifiers, source: ViewState | DisplayStyleState): ClassifierTreeId {
    const active = classifiers.active;
    const script = source.scheduleScript;
    const animationId = (undefined !== script && undefined !== active) ? script.getModelAnimationId(active.modelId) : undefined;
    return {
      modelId: undefined !== active ? active.modelId : Id64.invalid,
      type: BatchType.PlanarClassifier,
      expansion: undefined !== active ? active.expand : 0,
      animationId,
    };
  }
}

/** @internal */
export function createClassifierTileTreeReference(classifiers: SpatialClassifiers, classifiedTree: TileTree.Reference, iModel: IModelConnection, source: ViewState | DisplayStyleState): SpatialClassifierTileTreeReference {
  return new ClassifierTreeReference(classifiers, classifiedTree, iModel, source);
}

/** @internal */
export interface SpatialClassifiersContainer {
  classifiers?: SpatialClassificationProps.Properties[];
}

/** Exposes a list of classifiers that allow one [[ModelState]] to classify another [[SpatialModel]] or reality model.
 * A spatial model can have a list of any number of available classifiers; at most one of those classifiers may be "active" at a given time.
 * @see [[SpatialModel.classifiers]]
 * @beta
 */
export class SpatialClassifiers {
  private readonly _jsonContainer: SpatialClassifiersContainer;
  private _active?: SpatialClassificationProps.Properties;

  /** @internal */
  public constructor(jsonContainer: SpatialClassifiersContainer) {
    this._jsonContainer = jsonContainer;
    const json = jsonContainer.classifiers;
    if (undefined !== json) {
      for (const props of json) {
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
   * @note If the `Classifier` object supplied to the setter did not originate from this `SpatialClassifier`'s list but an equivalent entry exists in the list, that entry
   * will be set as active - **not** the object supplied to the setter.
   */
  public get active(): SpatialClassificationProps.Classifier | undefined {
    return this._active;
  }
  public set active(active: SpatialClassificationProps.Classifier | undefined) {
    if (undefined === active && undefined === this._active)
      return;
    else if (undefined !== active && undefined !== this._active && SpatialClassificationProps.equalClassifiers(active, this._active))
      return;

    if (undefined === active) {
      if (undefined !== this._active)
        this._active.isActive = false;

      this._active = undefined;
      return;
    }

    const classifiers = this._jsonContainer.classifiers;
    if (undefined === classifiers)
      return;

    for (const classifier of classifiers) {
      if (SpatialClassificationProps.equalClassifiers(classifier, active)) {
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
    let classifiers = this._jsonContainer.classifiers;
    if (undefined === classifiers)
      classifiers = [];

    return classifiers[Symbol.iterator]();
  }

  /** The number of available classifiers. */
  public get length(): number {
    const classifiers = this._jsonContainer.classifiers;
    return undefined !== classifiers ? classifiers.length : 0;
  }

  /** Adds a new classifier to the list, if an equivalent classifier is not already present.
   * @param classifier JSON representation of the new classifier
   * @returns The copy of `classifier` that was added to the list, or undefined if an equivalent classifier already exists in the list.
   */
  public push(classifier: SpatialClassificationProps.Classifier): SpatialClassificationProps.Classifier | undefined {
    for (const existing of this)
      if (SpatialClassificationProps.equalClassifiers(existing, classifier))
        return undefined;

    let list = this._jsonContainer.classifiers;
    if (undefined === list) {
      list = [];
      this._jsonContainer.classifiers = list;
    }

    const props: SpatialClassificationProps.Properties = { ...classifier, isActive: false };
    list.push(props);
    return props;
  }
}
