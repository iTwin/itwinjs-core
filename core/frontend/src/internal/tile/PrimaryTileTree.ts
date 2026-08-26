/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import {
  assert, comparePossiblyUndefined, compareStrings, Id64String,
  OrderedId64Iterable,
} from "@itwin/core-bentley";
import {
  BaseLayerSettings,
  BatchType, compareIModelTileTreeIds, FeatureAppearance, FeatureAppearanceProvider, HiddenLine, iModelTileTreeIdToString, MapLayerSettings, ModelMapLayerDrapeTarget, ModelMapLayerSettings,
  PrimaryTileTreeId, RenderMode, RenderSchedule, SpatialClassifier, ViewFlagOverrides, ViewFlagsProperties,
} from "@itwin/core-common";
import { Range3d, StringifiedClipVector, Transform } from "@itwin/core-geometry";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { GeometricModel3dState, GeometricModelState } from "../../ModelState";
import { formatAnimationBranchId } from "../../internal/render/AnimationBranchState";
import { AnimationNodeId } from "../../common/internal/render/AnimationNodeId";
import { RenderClipVolume } from "../../render/RenderClipVolume";
import { SceneContext } from "../../ViewContext";
import { AttachToViewportArgs } from "../../ViewState";
import {
  DisclosedTileTreeSet,
  IModelTileTree, IModelTileTreeParams, iModelTileTreeParamsFromJSON, LayerTileTreeReferenceHandler, MapLayerTileTreeReference, RealityModelTileTree, TileDrawArgs, TileGraphicType, TileTree, TileTreeOwner, TileTreeReference,
  TileTreeSupplier,
} from "../../tile/internal";
import { _backingView, _getModelClip, _scheduleScriptReference } from "../../common/internal/Symbols";
import { IModelDisplayReference, SpatialIModelDisplayReference } from "../../IModelDisplayReference";

interface PrimaryTreeId {
  treeId: PrimaryTileTreeId;
  modelId: Id64String;
  is3d: boolean;
  isPlanProjection: boolean;
  timeline?: RenderSchedule.ModelTimeline;
}

class PlanProjectionTileTree extends IModelTileTree {
  public readonly baseElevation: number;

  public constructor(params: IModelTileTreeParams, treeId: PrimaryTileTreeId, baseElevation: number) {
    super(params, treeId);
    this.baseElevation = baseElevation;
  }
}

class PrimaryTreeSupplier implements TileTreeSupplier {
  public constructor() {
  }

  public compareTileTreeIds(lhs: PrimaryTreeId, rhs: PrimaryTreeId): number {
    // NB: we don't compare isPlanProjection or is3d - they should always have the same value for a given modelId.
    return compareStrings(lhs.modelId, rhs.modelId) || compareIModelTileTreeIds(lhs.treeId, rhs.treeId)
      || comparePossiblyUndefined((x, y) => x.compareTo(y), lhs.timeline, rhs.timeline);
  }

  public async createTileTree(id: PrimaryTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    const treeId = id.treeId;
    const idStr = iModelTileTreeIdToString(id.modelId, treeId, IModelApp.tileAdmin);
    const props = await IModelApp.tileAdmin.requestTileTreeProps(iModel, idStr);

    // ###TODO remove restriction that animated tile trees can't contained instanced geometry.
    const isAnimated = undefined !== treeId.animationId || undefined !== id.timeline;
    const allowInstancing = !isAnimated && !treeId.enforceDisplayPriority && !treeId.sectionCut;
    const options = {
      edges: treeId.edges,
      allowInstancing,
      is3d: id.is3d,
      batchType: BatchType.Primary,
      timeline: id.timeline,
    };

    const params = iModelTileTreeParamsFromJSON(props, iModel, id.modelId, options);
    if (!id.isPlanProjection)
      return new IModelTileTree(params, id.treeId);

    let elevation = 0;
    try {
      const ranges = await iModel.models.queryExtents(id.modelId);
      if (1 === ranges.length) {
        const range = Range3d.fromJSON(ranges[0].extents);
        const lo = range.low.z;
        const hi = range.high.z;
        if (lo <= hi)
          elevation = (lo + hi) / 2;
      }
    } catch {
      //
    }

    return new PlanProjectionTileTree(params, id.treeId, elevation);
  }

  public getOwner(id: PrimaryTreeId, iModel: IModelConnection): TileTreeOwner {
    return iModel.tiles.getTileTreeOwner(id, this);
  }

  public addModelsAnimatedByScript(modelIds: Set<Id64String>, scriptSourceId: Id64String, trees: Iterable<{ id: PrimaryTreeId, owner: TileTreeOwner }>): void {
    // Note: This is invoked when an element hosting a schedule script is updated - it doesn't care about frontend schedule scripts.
    for (const tree of trees)
      if (scriptSourceId === tree.id.treeId.animationId)
        modelIds.add(tree.id.modelId);
  }

  public addSpatialModels(modelIds: Set<Id64String>, trees: Iterable<{ id: PrimaryTreeId, owner: TileTreeOwner }>): void {
    for (const tree of trees)
      if (tree.id.is3d)
        modelIds.add(tree.id.modelId);
  }
}

const primaryTreeSupplier = new PrimaryTreeSupplier();

/** Find all extant tile trees associated with the specified model Ids and dispose of them.
 * This is used by BriefcaseConnection when a GraphicalEditingScope is exited or after a change to the models' geometry guids
 * is committed, undone, redone, or merged.
 */
export function disposeTileTreesForGeometricModels(modelIds: Set<Id64String>, iModel: IModelConnection): void {
  const trees = iModel.tiles.getTreeOwnersForSupplier(primaryTreeSupplier);
  for (const kvp of trees) {
    const id = kvp.id as PrimaryTreeId;
    assert(undefined !== id.modelId);
    if (modelIds.has(id.modelId))
      kvp.owner[Symbol.dispose]();
  }
}

class PrimaryTreeReference extends TileTreeReference {
  public readonly iModelRef: IModelDisplayReference;
  public readonly model: GeometricModelState;
  /** Chiefly for debugging - disables iteration of this reference in SpatialModelRefs to e.g. omit the reference from the scene. */
  public deactivated = false;
  protected _viewFlagOverrides: ViewFlagOverrides;
  protected _id: PrimaryTreeId;
  private _owner: TileTreeOwner;
  private readonly _sectionClip?: StringifiedClipVector;
  private readonly _sectionCutAppearanceProvider?: FeatureAppearanceProvider;
  protected readonly _animationTransformNodeId?: number;
  private _layerRefHandler: LayerTileTreeReferenceHandler;
  public readonly iModel: IModelConnection;

  public shouldDrapeLayer(layerTreeRef?: MapLayerTileTreeReference): boolean {
    const mapLayerSettings = layerTreeRef?.layerSettings;
    if (mapLayerSettings && mapLayerSettings instanceof ModelMapLayerSettings)
      return ModelMapLayerDrapeTarget.IModel === mapLayerSettings.drapeTarget;
    return false;
  }

  public constructor(
    iModelRef: IModelDisplayReference,
    model: GeometricModelState,
    planProjection: boolean,
    transformNodeId: number | undefined,
    sectionClip?: StringifiedClipVector,
    backgroundBase?: BaseLayerSettings,
    backgroundLayers?: MapLayerSettings[]
  ) {
    super();

    this.iModel = model.iModel;

    this._layerRefHandler = new LayerTileTreeReferenceHandler(this, false, backgroundBase, backgroundLayers, false);
    this.iModelRef = iModelRef;
    this.model = model;
    this._animationTransformNodeId = transformNodeId;

    this._sectionClip = sectionClip;
    this._viewFlagOverrides = { ...model.jsonProperties.viewFlagOverrides };
    if (sectionClip) {
      // Clipping will be applied on backend; don't clip out cut geometry.
      this._viewFlagOverrides.clipVolume = false;
      this._sectionCutAppearanceProvider = FeatureAppearanceProvider.supplement((app: FeatureAppearance) => {
        const cutApp = this.iModelRef.activeClipStyle.cutStyle.appearance;
        return cutApp ? app.extendAppearance(cutApp) : app;
      });
    }

    const scriptInfo = IModelApp.tileAdmin.getScriptInfoForTreeId(model.id, iModelRef[_scheduleScriptReference]);

    this._id = {
      modelId: model.id,
      is3d: model.is3d,
      treeId: this.createTreeId(iModelRef, model.id),
      isPlanProjection: planProjection,
      timeline: scriptInfo?.timeline,
    };

    this._owner = primaryTreeSupplier.getOwner(this._id, model.iModel);
  }

  protected override getAnimationTransformNodeId() {
    return this._animationTransformNodeId ?? AnimationNodeId.Untransformed;
  }

  protected override getViewFlagOverrides(_tree: TileTree) {
    return this._viewFlagOverrides;
  }

  protected override getAppearanceProvider(_tree: TileTree): FeatureAppearanceProvider | undefined {
    if (this._sectionCutAppearanceProvider && this.iModelRef.activeClipStyle.cutStyle.appearance)
      return this._sectionCutAppearanceProvider;

    return undefined;
  }

  protected override getHiddenLineSettings(_tree: TileTree): HiddenLine.Settings | undefined {
    return this._sectionClip ? this.iModelRef.activeClipStyle.cutStyle.hiddenLine : undefined;
  }

  public override get castsShadows() {
    return true;
  }

  protected get isPlanProjection(): boolean {
    return false;
  }

  public detachLayerListeners(): void {
    this._layerRefHandler.detachFromDisplayStyle();
  }

  public override discloseTileTrees(trees: DisclosedTileTreeSet): void {
    super.discloseTileTrees(trees);
    this._layerRefHandler.discloseTileTrees(trees);
  }

  protected override getClipVolume(_tree: TileTree): RenderClipVolume | undefined {
    // ###TODO: reduce frequency with which getModelClip() is called
    return this.iModelRef.isSpatial() && !this._sectionClip ? this.iModelRef[_getModelClip](this.model.id) : undefined;
  }

  public override canSupplyToolTip() {
    return false;
  }

  public override createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    const args = super.createDrawArgs(context);
    if (args)
      args.intersectionClip = this._sectionClip;

    return args;
  }

  public get treeOwner(): TileTreeOwner {
    const newId = this.createTreeId(this.iModelRef, this._id.modelId);
    const timeline = IModelApp.tileAdmin.getScriptInfoForTreeId(this._id.modelId, this.iModelRef[_scheduleScriptReference])?.timeline;
    if (0 !== compareIModelTileTreeIds(newId, this._id.treeId) || timeline?.isEditingCommitted) {
      this._id = {
        modelId: this._id.modelId,
        is3d: this._id.is3d,
        treeId: newId,
        isPlanProjection: this._id.isPlanProjection,
        timeline,
      };

      this._owner = primaryTreeSupplier.getOwner(this._id, this.model.iModel);
    }

    return this._owner;
  }

  protected createTreeId(iModelRef: IModelDisplayReference, modelId: Id64String): PrimaryTileTreeId {
    if (this._sectionClip) {
      // We do this each time in case the ClipStyle's overrides are modified.
      // ###TODO: can we avoid that? Event listeners maybe?
      this._viewFlagOverrides = {
        ...this.iModelRef.activeClipStyle.cutStyle.viewflags,
        // Do not clip out the cut geometry intersecting the clip planes.
        clipVolume: false,
        // The cut geometry is planar - it should win a z-fight.
        // Also we need to preserve this flag if this is a plan projection tile tree reference.
        forceSurfaceDiscard: true,
      };
    }

    const animationId = IModelApp.tileAdmin.getScriptInfoForTreeId(modelId, iModelRef[_scheduleScriptReference])?.animationId;
    const renderMode = this._viewFlagOverrides.renderMode ?? iModelRef.activeViewFlags.renderMode;
    const visibleEdges = this._viewFlagOverrides.visibleEdges ?? iModelRef.activeViewFlags.visibleEdges;
    const edgesRequired = visibleEdges || RenderMode.SmoothShade !== renderMode || IModelApp.tileAdmin.alwaysRequestEdges;
    const edges = edgesRequired ? IModelApp.tileAdmin.edgeOptions : false;
    const sectionCut = this._sectionClip?.clipString;
    const disablePolyfaceDecimation = IModelApp.tileAdmin.disablePolyfaceDecimation;
    return { type: BatchType.Primary, edges, animationId, sectionCut, disablePolyfaceDecimation };
  }

  protected computeBaseTransform(tree: TileTree): Transform {
    return super.computeTransform(tree);
  }

  protected override computeTransform(tree: TileTree): Transform {
    const baseTf = this.computeBaseTransform(tree);
    const displayTf = this.iModelRef.modelDisplayTransformProvider?.getModelDisplayTransform(this.model.id);
    if (!displayTf)
      return baseTf;

    return displayTf.premultiply ? displayTf.transform.multiplyTransformTransform(baseTf) : baseTf.multiplyTransformTransform(displayTf.transform);
  }

  public override addToScene(context: SceneContext): void {
    const tree = this.treeOwner.load() as IModelTileTree;
    if (undefined === tree || !this._layerRefHandler.initializeLayers(context))
      return;     // Not loaded yet.

    super.addToScene(context);
  }
}

export class AnimatedTreeReference extends PrimaryTreeReference {
  private readonly _branchId: string;

  public constructor(iModelRef: IModelDisplayReference, model: GeometricModelState, transformNodeId: number) {
    super(iModelRef, model, false, transformNodeId);
    this._branchId = formatAnimationBranchId(model.id, transformNodeId);
  }

  protected override computeBaseTransform(tree: TileTree): Transform {
    const tf = super.computeBaseTransform(tree);
    const script = this.iModelRef[_scheduleScriptReference]?.script;
    if (undefined === script || undefined === this._animationTransformNodeId)
      return tf;

    const timePoint = this.iModelRef.parent[_backingView].displayStyle.settings.timePoint ?? script.duration.low;
    const animTf = script.getTransform(this._id.modelId, this._animationTransformNodeId, timePoint);
    if (animTf)
      animTf.multiplyTransformTransform(tf, tf);

    return tf;
  }

  public override createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    const animBranch = context.viewport.target.animationBranches?.branchStates.get(this._branchId);
    if (animBranch && animBranch.omit)
      return undefined;

    const args = super.createDrawArgs(context);
    if (args?.tree && undefined !== this._animationTransformNodeId) {
      assert(args.tree instanceof IModelTileTree);
      args.boundingRange = args.tree.getTransformNodeRange(this._animationTransformNodeId);
    }

    return args;
  }
}

class PlanProjectionTreeReference extends PrimaryTreeReference {
  private get _spatialIModelRef() { return this.iModelRef as SpatialIModelDisplayReference; }
  private readonly _baseTransform = Transform.createIdentity();

  public constructor(
    iModelRef: SpatialIModelDisplayReference,
    model: GeometricModelState,
    sectionCut?: StringifiedClipVector,
    backgroundBase?: BaseLayerSettings,
    backgroundLayers?: MapLayerSettings[]
  ) {
    super(iModelRef, model, true, undefined, sectionCut, backgroundBase, backgroundLayers);
    this._viewFlagOverrides.forceSurfaceDiscard = true;
  }

  public override get castsShadows() {
    return false;
  }

  protected override get isPlanProjection(): boolean {
    return true;
  }

  public override createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    const args = super.createDrawArgs(context);
    if (undefined !== args && this._id.treeId.enforceDisplayPriority) {
      args.drawGraphics = () => {
        const graphics = args.produceGraphics();
        if (undefined !== graphics) {
          const settings = this.getSettings();
          const asOverlay = undefined !== settings && settings.overlay;
          const transparency = settings?.transparency || 0;

          let elevation = settings?.elevation;
          if (undefined === elevation) {
            const tree = this.treeOwner.tileTree;
            if (tree) {
              assert(tree instanceof PlanProjectionTileTree);
              elevation = tree.baseElevation;
            } else {
              elevation = 0;
            }
          }

          context.outputGraphic(context.target.renderSystem.createGraphicLayerContainer(graphics, asOverlay, transparency, elevation));
        }
      };
    }

    return args;
  }

  protected override computeBaseTransform(tree: TileTree): Transform {
    assert(tree instanceof PlanProjectionTileTree);
    const transform = tree.iModelTransform.clone(this._baseTransform);

    const elevation = this.getSettings()?.elevation;
    if (undefined !== elevation)
      transform.origin.z = elevation;

    return transform;
  }

  public override draw(args: TileDrawArgs): void {
    const settings = this.getSettings();
    if (undefined === settings || settings.enforceDisplayPriority || !settings.overlay)
      super.draw(args);
    else
      args.context.withGraphicType(TileGraphicType.Overlay, () => args.tree.draw(args));
  }

  private getSettings() {
    return this._spatialIModelRef.planProjectionSettings.get(this.model.id);
  }

  protected override createTreeId(iModelRef: IModelDisplayReference, modelId: Id64String): PrimaryTileTreeId {
    const id = super.createTreeId(iModelRef, modelId);
    const settings = this.getSettings();
    if (undefined !== settings && settings.enforceDisplayPriority)
      id.enforceDisplayPriority = true;

    return id;
  }
}

function isPlanProjection(iModelRef: IModelDisplayReference, model: GeometricModelState): boolean {
  const model3d = iModelRef.isSpatial() ? model.asGeometricModel3d : undefined;
  return undefined !== model3d && model3d.isPlanProjection;
}

function createTreeRef(
  iModelRef: IModelDisplayReference,
  model: GeometricModelState,
  sectionCut: StringifiedClipVector | undefined,
  backgroundBase?: BaseLayerSettings,
  backgroundLayers?: MapLayerSettings[]
): PrimaryTreeReference {
  if (false !== IModelApp.renderSystem.options.planProjections && isPlanProjection(iModelRef, model))
    return new PlanProjectionTreeReference(iModelRef as SpatialIModelDisplayReference, model, sectionCut, backgroundBase, backgroundLayers);

  return new PrimaryTreeReference(iModelRef, model, false, undefined, sectionCut, backgroundBase, backgroundLayers);
}

export function createPrimaryTileTreeReference(
  iModelRef: IModelDisplayReference,
  model: GeometricModelState,
  getBackgroundBase?: () => BaseLayerSettings,
  getBackgroundLayers?: () => MapLayerSettings[]
): PrimaryTreeReference {
  const backgroundBase = getBackgroundBase?.();
  const backgroundLayers = getBackgroundLayers?.();

  return createTreeRef(iModelRef, model, undefined, backgroundBase, backgroundLayers);
}

class MaskTreeReference extends TileTreeReference {
  protected _id: PrimaryTreeId;
  private _owner: TileTreeOwner;
  public readonly model: GeometricModelState;
  public override get castsShadows() { return false; }
  public constructor(iModelRef: IModelDisplayReference, model: GeometricModelState) {
    super();
    this.model = model;
    this._id = {
      modelId: model.id,
      is3d: model.is3d,
      treeId: this.createTreeId(),
      isPlanProjection: isPlanProjection(iModelRef, model),
    };

    this._owner = primaryTreeSupplier.getOwner(this._id, model.iModel);
  }

  public get treeOwner(): TileTreeOwner {
    const newId = this.createTreeId();
    if (0 !== compareIModelTileTreeIds(newId, this._id.treeId)) {
      this._id = { modelId: this._id.modelId, is3d: this._id.is3d, treeId: newId, isPlanProjection: false };
      this._owner = primaryTreeSupplier.getOwner(this._id, this.model.iModel);
    }

    return this._owner;
  }
  protected createTreeId(): PrimaryTileTreeId {
    return { type: BatchType.Primary, edges: false, disablePolyfaceDecimation: IModelApp.tileAdmin.disablePolyfaceDecimation };
  }
}

export function createMaskTreeReference(iModelRef: IModelDisplayReference, model: GeometricModelState): TileTreeReference {
  return new MaskTreeReference(iModelRef, model);
}

export class ModelMapLayerTileTreeReference extends MapLayerTileTreeReference {
  private _id: PrimaryTreeId;
  private _owner: TileTreeOwner;
  public get isPlanar() { return true; }
  public get activeClassifier() { return this._classifier; }
  public constructor(layerSettings: MapLayerSettings, private _classifier: SpatialClassifier, layerIndex: number, iModel: IModelConnection) {
    super(layerSettings, layerIndex, iModel);
    this._id = {
      modelId: _classifier.modelId,
      is3d: true, // model.is3d,
      treeId: this.createTreeId(),
      isPlanProjection: false, // isPlanProjection(view, model),
    };

    this._owner = primaryTreeSupplier.getOwner(this._id, this.iModel);
  }

  protected createTreeId(): PrimaryTileTreeId {
    return { type: BatchType.Primary, edges: false, disablePolyfaceDecimation: IModelApp.tileAdmin.disablePolyfaceDecimation };
  }

  public get treeOwner(): TileTreeOwner {
    const newId = this.createTreeId();
    if (0 !== compareIModelTileTreeIds(newId, this._id.treeId)) {
      this._id = { modelId: this._id.modelId, is3d: this._id.is3d, treeId: newId, isPlanProjection: false };
      this._owner = primaryTreeSupplier.getOwner(this._id, this.iModel);
    }

    return this._owner;
  }
  public get viewFlags(): Partial<ViewFlagsProperties> {
    return {
      renderMode: RenderMode.SmoothShade,
      transparency: true,      // Igored for point clouds as they don't support transparency.
      textures: true,
      lighting: false,
      shadows: false,
      monochrome: false,
      materials: false,
      ambientOcclusion: false,
      visibleEdges: true,
      hiddenEdges: false,
      fill: true,
    };
  }
}
export function createModelMapLayerTileTreeReference(layerSettings: ModelMapLayerSettings, layerIndex: number, iModel: IModelConnection): ModelMapLayerTileTreeReference | undefined {
  const classifier = SpatialClassifier.fromModelMapLayer(layerSettings);
  return classifier ? new ModelMapLayerTileTreeReference(layerSettings, classifier, layerIndex, iModel) : undefined;
}

/** Provides [[TileTreeReference]]s for the loaded models present in a [[SpatialViewState]]'s [[ModelSelectorState]].
 * @internal
 */
export interface SpatialTileTreeReferences extends Iterable<TileTreeReference> {
  /** Supplies an iterator over all of the [[TileTreeReference]]s. */
  [Symbol.iterator](): Iterator<TileTreeReference>;
  /** Requests that the set of [[TileTreeReference]]s be updated to match the current state of the view, e.g., after the model selector's contents have changed. */
  update(): void;
  /** See SpatialViewState.setTileTreeReferencesDeactivated. */
  setDeactivated(modelIds: Id64String | Id64String[] | undefined, deactivated: boolean | undefined, refs: "all" | "animated" | "primary" | "section" | number[]): void;
  /** See SpatialViewState.attachToViewport. */
  attachToViewport(args: AttachToViewportArgs): void;
  /** See SpatialViewState.detachFromViewport. */
  detachFromViewport(): void;
  /** See SpatialViewState.collectMaskRefs */
  collectMaskRefs(modelIds: OrderedId64Iterable, maskTreeRefs: TileTreeReference[], maskRange: Range3d): void;
  /** See SpatialViewState.getModelsNotInMask */
  getModelsNotInMask(maskModels: OrderedId64Iterable | undefined, useVisible: boolean): Id64String[] | undefined;
}

/** @internal */
export function collectMaskRefs(iModelRef: SpatialIModelDisplayReference, modelIds: OrderedId64Iterable, excludedModelIds: Set<Id64String> | undefined, maskTreeRefs: TileTreeReference[], maskRange: Range3d): void {
  for (const modelId of modelIds) {
    if (!excludedModelIds?.has(modelId)) {
      const model = iModelRef.iModel.models.getLoaded(modelId);
      assert(model !== undefined);   // Models should be loaded by RealityModelTileTree
      if (model?.asGeometricModel) {
        const treeRef = createMaskTreeReference(iModelRef, model.asGeometricModel);
        maskTreeRefs.push(treeRef);
        const range = treeRef.computeWorldContentRange();
        maskRange.extendRange(range);
      }
    }
  }
}

/** Provides [[TileTreeReference]]s for the loaded models present in a [[SpatialViewState]]'s [[ModelSelectorState]] and
 * not present in the optionally-supplied exclusion list.
 * @internal
 */
export function createSpatialTileTreeReferences(iModelRef: SpatialIModelDisplayReference, excludedModels?: Set<Id64String>): SpatialTileTreeReferences {
  return new SpatialRefs(iModelRef, excludedModels);
}

/** Provides [[TileTreeReference]]s for the loaded models present in a [[SpatialViewState]]'s [[ModelSelectorState]].
 * @internal
 */
export namespace SpatialTileTreeReferences {
  /** Create a SpatialTileTreeReferences object reflecting the contents of the specified view. */
  export function create(iModelRef: SpatialIModelDisplayReference): SpatialTileTreeReferences {
    return createSpatialTileTreeReferences(iModelRef);
  }
}

/** Represents the [[TileTreeReference]]s associated with one model in a [[SpatialTileTreeReferences]]. */
class SpatialModelRefs implements Iterable<TileTreeReference> {
  /** The TileTreeReference representing the model's primary content. */
  private readonly _modelRef: TileTreeReference;
  /** TileTreeReferences representing nodes transformed by the view's schedule script. */
  private readonly _animatedRefs: PrimaryTreeReference[] = [];
  /** TileTreeReference providing cut geometry intersecting the view's clip volume. */
  private _sectionCutRef?: PrimaryTreeReference;
  /** Whether `this._modelRef` is a [[PrimaryTreeReference]] (as opposed to, e.g., a reality model tree reference). */
  private readonly _isPrimaryRef: boolean;
  /** Used to mark refs as excluded so that only their _sectionCutRef is returned by the iterator. */
  private readonly _isExcluded: boolean;

  public constructor(model: GeometricModel3dState, iModelRef: SpatialIModelDisplayReference, excluded: boolean) {
    this._modelRef = model.createTileTreeReference(iModelRef);
    this._isPrimaryRef = this._modelRef instanceof PrimaryTreeReference;
    this._isExcluded = excluded;
  }

  public *[Symbol.iterator](): Iterator<TileTreeReference> {
    if ((!this._primaryRef || !this._primaryRef.deactivated) && !this._isExcluded)
      yield this._modelRef;

    for (const animated of this._animatedRefs)
      if (!animated.deactivated)
        yield animated;

    if (this._sectionCutRef && !this._sectionCutRef.deactivated)
      yield this._sectionCutRef;
  }

  public updateAnimated(script: RenderSchedule.ScriptReference  | undefined): void {
    const ref = this._primaryRef;
    if (!ref || this._isExcluded)
      return;

    this._animatedRefs.length = 0;
    const nodeIds = script?.script.getTransformBatchIds(ref.model.id);
    if (nodeIds)
      for (const nodeId of nodeIds)
        this._animatedRefs.push(new AnimatedTreeReference(ref.iModelRef, ref.model, nodeId));
  }

  public updateSectionCut(clip: StringifiedClipVector | undefined): void {
    const ref = this._primaryRef;
    if (!ref) {
      assert(undefined === this._sectionCutRef);
      return;
    }

    // If the clip isn't supposed to apply to this model, don't produce cut geometry.
    const vfJson = clip ? ref.model.jsonProperties.viewFlagOverrides : undefined;
    const vfOvrs = vfJson ? { ...vfJson } : undefined;
    if (vfOvrs && !vfOvrs.clipVolume)
      clip = undefined;

    this._sectionCutRef = clip ? createTreeRef(ref.iModelRef, ref.model, clip) : undefined;
  }

  public setDeactivated(deactivated: boolean | undefined, which: "all" | "animated" | "primary" | "section" | number[]): void {
    if (typeof which !== "string") {
      for (const index of which)
        if (this._animatedRefs[index])
          this._animatedRefs[index].deactivated = deactivated ?? !this._animatedRefs[index].deactivated;

      return;
    }

    if (("all" === which || "primary" === which) && this._primaryRef)
      this._primaryRef.deactivated = deactivated ?? !this._primaryRef.deactivated;

    if (("all" === which || "section" === which) && this._sectionCutRef)
      this._sectionCutRef.deactivated = deactivated ?? !this._sectionCutRef.deactivated;

    if (("all" === which || "animated" === which))
      for (const ref of this._animatedRefs)
        ref.deactivated = deactivated ?? !ref.deactivated;
  }

  public detachLayerListeners(): void {
    if (this._primaryRef)
      this._primaryRef.detachLayerListeners();
    else if (this._modelRef instanceof RealityModelTileTree.Reference)
      this._modelRef.detachLayerListeners();
    for (const ref of this._animatedRefs)
      ref.detachLayerListeners();
    if (this._sectionCutRef)
      this._sectionCutRef.detachLayerListeners();
  }

  private get _primaryRef(): PrimaryTreeReference | undefined {
    if (!this._isPrimaryRef)
      return undefined;

    assert(this._modelRef instanceof PrimaryTreeReference);
    return this._modelRef;
  }
}

/** Provides [[TileTreeReference]]s for the loaded models present in a [[SpatialViewState]]'s [[ModelSelectorState]]. */
class SpatialRefs implements SpatialTileTreeReferences {
  private _allLoaded = false;
  private readonly _iModelRef: SpatialIModelDisplayReference;
  private readonly _excludedModels?: Set<Id64String>;
  private _refs = new Map<Id64String, SpatialModelRefs>();
  private _swapRefs = new Map<Id64String, SpatialModelRefs>();
  private _sectionCutOnlyRefs = new Map<Id64String, SpatialModelRefs>();
  private _swapSectionCutOnlyRefs = new Map<Id64String, SpatialModelRefs>();
  private _scheduleScript?: RenderSchedule.ScriptReference;
  private _sectionCut?: StringifiedClipVector;

  public constructor(iModelRef: SpatialIModelDisplayReference, excludedModels: Set<Id64String> | undefined) {
    this._iModelRef = iModelRef;
    this._scheduleScript = iModelRef[_scheduleScriptReference];
    this._sectionCut = this.getSectionCutFromView();
    if (excludedModels)
      this._excludedModels = new Set(excludedModels);
  }

  public update(): void {
    this._allLoaded = false;
  }

  public attachToViewport() { }
  public detachFromViewport() {
    for (const refs of this._refs.values())
      refs.detachLayerListeners();
    for (const refs of this._swapRefs.values())
      refs.detachLayerListeners();
    for (const refs of this._sectionCutOnlyRefs.values())
      refs.detachLayerListeners();
    for (const refs of this._swapSectionCutOnlyRefs.values())
      refs.detachLayerListeners();
  }

  public *[Symbol.iterator](): Iterator<TileTreeReference> {
    this.load();
    for (const modelRef of this._refs.values())
      for (const ref of modelRef)
        yield ref;
    if (this._sectionCut) {
      for (const modelRef of this._sectionCutOnlyRefs.values())
        for (const ref of modelRef)
          yield ref;
    }
  }

  public setDeactivated(modelIds: Id64String | Id64String[] | undefined, deactivated: boolean, refs: "all" | "animated" | "primary" | "section" | number[]): void {
    if (undefined === modelIds) {
      for (const model of this._refs.values())
        model.setDeactivated(deactivated, refs);

      return;
    }

    if (typeof modelIds === "string")
      modelIds = [modelIds];

    for (const modelId of modelIds)
      this._refs.get(modelId)?.setDeactivated(deactivated, refs);
  }

  /** For getting the [TileTreeReference]s that are in the modelIds, for planar classification.
   * @param modelIds modelIds for which to get the TileTreeReferences
   * @param maskTreeRefs where to store the TileTreeReferences
   * @param maskRange range to extend for the maskRefs
   */
  public collectMaskRefs(modelIds: OrderedId64Iterable, maskTreeRefs: TileTreeReference[], maskRange: Range3d): void {
    collectMaskRefs(this._iModelRef, modelIds, this._excludedModels, maskTreeRefs, maskRange);
  }

  /** For getting a list of modelIds which do not participate in masking, for planar classification.
   * For non-batched tile trees this is not needed, so just return undefined.
   */
  public getModelsNotInMask(_maskModels: OrderedId64Iterable | undefined, _useVisible: boolean): Id64String[] | undefined { return undefined; }

  private load(): void {
    if (!this._allLoaded) {
      this._allLoaded = true;
      this.updateModels();
    }

    const curScript = this._iModelRef[_scheduleScriptReference];
    const prevScript = this._scheduleScript;
    if (curScript !== prevScript) {
      this._scheduleScript = curScript;
      if (!curScript || !prevScript || !curScript.script.equals(prevScript.script))
        for (const ref of this._refs.values())
          ref.updateAnimated(curScript);
    }

    const sectionCut = this.getSectionCutFromView();
    if (sectionCut?.clipString !== this._sectionCut?.clipString) {
      this._sectionCut = sectionCut;
      for (const ref of this._refs.values())
        ref.updateSectionCut(sectionCut);
      for (const ref of this._sectionCutOnlyRefs.values())
        ref.updateSectionCut(sectionCut);
    }
  }

  private getSectionCutFromView(): StringifiedClipVector | undefined {
    const wantCut = this._iModelRef.activeViewFlags.clipVolume && this._iModelRef.activeClipStyle.produceCutGeometry;
    const clip = wantCut ? this._iModelRef.parent[_backingView].getViewClip() : undefined;
    return StringifiedClipVector.fromClipVector(clip);
  }

  /** Ensure this._refs contains a SpatialModelRefs for all loaded models in the model selector. */
  private updateModels(): void {
    let prev = this._refs;
    let cur = this._swapRefs;
    this._refs = cur;
    this._swapRefs = prev;
    cur.clear();
    prev = this._sectionCutOnlyRefs;
    cur = this._swapSectionCutOnlyRefs;
    this._sectionCutOnlyRefs = cur;
    this._swapSectionCutOnlyRefs = prev;
    cur.clear();

    for (const modelId of this._iModelRef.viewedModels) {
      let excluded = false;
      if (undefined !== this._excludedModels && this._excludedModels.has(modelId)) {
        excluded = true;
        cur = this._sectionCutOnlyRefs;
        prev = this._swapSectionCutOnlyRefs;
      } else {
        cur = this._refs;
        prev = this._swapRefs;
      }

      let modelRefs = prev.get(modelId);
      if (modelRefs) {
        prev.delete(modelId);
      } else {
        const model = this._iModelRef.iModel.models.getLoaded(modelId)?.asGeometricModel3d;
        if (model) {
          modelRefs = new SpatialModelRefs(model, this._iModelRef, excluded);
          modelRefs.updateAnimated(this._scheduleScript);
          modelRefs.updateSectionCut(this._sectionCut);
        }
      }

      if (modelRefs)
        cur.set(modelId, modelRefs);
    }

    // Detach event listeners from model refs that are no longer in the selector.
    for (const dropped of this._swapRefs.values())
      dropped.detachLayerListeners();
    for (const dropped of this._swapSectionCutOnlyRefs.values())
      dropped.detachLayerListeners();
  }
}
