/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import { editorBuiltInCmdIds, ElementGeometryCacheFilter, ElementGeometryResultOptions, ElementGeometryResultProps, OffsetFacesProps, SolidModelingCommandIpc, SubEntityGeometryProps, SubEntityLocationProps, SubEntityProps, SubEntityType } from "@itwin/editor-common";
import { FeatureAppearance, FeatureAppearanceProvider, RgbColor } from "@itwin/core-common";
import { Geometry, Point3d, Range3d, Ray3d, Transform, Vector3d } from "@itwin/core-geometry";
import { AccuDrawHintBuilder, BeButtonEvent, DecorateContext, DynamicsContext, ElementSetTool, EventHandled, FeatureOverrideProvider, FeatureSymbology, GraphicBranch, GraphicBranchOptions, GraphicType, HitDetail, IModelApp, IModelConnection, LocateResponse, readElementGraphics, RenderGraphicOwner, Viewport } from "@itwin/core-frontend";
import { computeChordToleranceFromPoint } from "./CreateElementTool";
import { EditTools } from "./EditTool";

/** @alpha */
export class ElementGeometryGraphicsProvider {
  public readonly iModel: IModelConnection;
  public graphic?: RenderGraphicOwner;

  constructor(iModel: IModelConnection) {
    this.iModel = iModel;
  }

  /** Call to request a RenderGraphic for the supplied graphic data.
   * @see [[cleanupGraphic]] Must be called when the tool exits.
   */
  public async createGraphic(graphicData: Uint8Array): Promise<boolean> {
    try {
      const graphic = await readElementGraphics(graphicData, this.iModel, Id64.invalid, true, { noFlash: true, noHilite: true });
      const graphicOwner = graphic ? IModelApp.renderSystem.createGraphicOwner(graphic) : undefined;
      this.cleanupGraphic();
      return (undefined !== (this.graphic = graphicOwner));
    } catch {
      return false;
    }
  }

  /** Call to dispose of [[RenderGraphic]] held by [[RenderGraphicOwner]].
   * @note Must be called when the tool exits to avoid leaks of graphics memory or other webgl resources.
   */
  public cleanupGraphic(): void {
    if (undefined === this.graphic)
      return;
    this.graphic.disposeGraphic();
    this.graphic = undefined;
  }

  public addGraphic(context: DynamicsContext, transform?: Transform, opts?: GraphicBranchOptions): void {
    if (undefined === this.graphic)
      return;

    if (undefined === transform && undefined === opts) {
      context.addGraphic(this.graphic);
      return;
    }

    const branch = new GraphicBranch(false);
    branch.add(this.graphic);

    const branchGraphic = context.createGraphicBranch(branch, transform ? transform : Transform.createIdentity(), opts);
    context.addGraphic(branchGraphic);
  }

  public addDecoration(context: DecorateContext, type: GraphicType, transform?: Transform, opts?: GraphicBranchOptions): void {
    if (undefined === this.graphic)
      return;

    const branch = new GraphicBranch(false);
    branch.add(this.graphic);

    const branchGraphic = context.createGraphicBranch(branch, transform ? transform : Transform.createIdentity(), opts);
    context.addDecoration(type, branchGraphic);
  }
}

/** @alpha */
export class SubEntityData {
  public info?: SubEntityProps;
  public geom?: SubEntityGeometryProps;

  protected _graphicsProvider?: ElementGeometryGraphicsProvider;

  private _acceptedAppearance?: FeatureAppearance;
  private _flashedAppearance?: FeatureAppearance;

  public isSame(other: SubEntityProps): boolean {
    if (undefined === this.info)
      return false;
    if (this.info.index !== other.index)
      return false;
    if (this.info.type !== other.type)
      return false;
    if (this.info.id !== other.id)
      return false;
    return true;
  }

  public getAppearance(vp: Viewport, accepted: boolean): FeatureAppearance {
    let appearance = (accepted ? this._acceptedAppearance : this._flashedAppearance);

    if (undefined === appearance) {
      const color = vp.hilite.color;
      const rgb = RgbColor.fromColorDef(accepted ? color.inverse() : color);
      const transparency = 0.25;
      let weight;
      let emphasized: undefined | true;

      switch (this.info?.type) {
        case SubEntityType.Face:
          emphasized = true;
          break;
        case SubEntityType.Edge:
          const edgeWeight = accepted ? 5 : 3;
          weight = this.geom?.appearance?.weight ? Math.min(this.geom.appearance.weight + edgeWeight, 31) : edgeWeight;
          break;
        case SubEntityType.Vertex:
          const vertexWeight = accepted ? 10 : 8;
          weight = this.geom?.appearance?.weight ? Math.min(this.geom.appearance.weight + vertexWeight, 31) : vertexWeight;
          break;
      }

      appearance = FeatureAppearance.fromJSON({ rgb, transparency, weight, emphasized, nonLocatable: true }); // TODO: nonLocatable shouldn't be necessary...

      if (accepted)
        this._acceptedAppearance = appearance;
      else
        this._flashedAppearance = appearance;
    }

    return appearance;
  }

  public async createGraphic(iModel: IModelConnection): Promise<boolean> {
    if (undefined === this.geom?.graphic)
      return false;

    if (undefined === this._graphicsProvider)
      this._graphicsProvider = new ElementGeometryGraphicsProvider(iModel);

    return this._graphicsProvider.createGraphic(this.geom.graphic);
  }

  public cleanupGraphic(): void {
    if (undefined === this._graphicsProvider)
      return;
    this._graphicsProvider.cleanupGraphic();
    this._graphicsProvider = undefined;
  }

  public get hasGraphic(): boolean {
    return (undefined !== this._graphicsProvider?.graphic);
  }

  public display(context: DecorateContext, accepted: boolean): void {
    if (undefined === this._graphicsProvider?.graphic)
      return;

    const appearanceProvider = FeatureAppearanceProvider.supplement((app: FeatureAppearance) => {
      return app.extendAppearance(this.getAppearance(context.viewport, accepted));
    });

    const opts: GraphicBranchOptions = { appearanceProvider };

    const range = (this.geom?.range ? Range3d.fromJSON(this.geom.range) : undefined);
    const pixelSize = context.viewport.getPixelSizeAtPoint(range ? range.center : undefined);
    const offsetDir = context.viewport.view.getZVector();
    offsetDir.scaleToLength(3 * pixelSize, offsetDir);
    const offsetTrans = Transform.createTranslation(offsetDir);

    this._graphicsProvider.addDecoration(context, GraphicType.Scene, offsetTrans, opts);
  }
}

/** @alpha Base class for tools that want to use the backend geometry cache. */
export abstract class ElementGeometryCacheTool extends ElementSetTool implements FeatureOverrideProvider {
  protected _startedCmd?: string;
  protected readonly _checkedIds = new Map<Id64String, boolean>();
  protected _graphicsProvider?: ElementGeometryGraphicsProvider;
  protected _graphicsPending?: true | undefined;
  protected _firstResult = true;

  protected allowView(vp: Viewport) { return vp.view.is3d(); }
  public override isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && this.allowView(vp)); }

  protected async startCommand(): Promise<string> {
    if (undefined !== this._startedCmd)
      return this._startedCmd;
    return EditTools.startCommand<string>(editorBuiltInCmdIds.cmdSolidModeling, this.iModel.key);
  }

  public static callCommand<T extends keyof SolidModelingCommandIpc>(method: T, ...args: Parameters<SolidModelingCommandIpc[T]>): ReturnType<SolidModelingCommandIpc[T]> {
    return EditTools.callCommand(method, ...args) as ReturnType<SolidModelingCommandIpc[T]>;
  }

  // TODO: This looks nice as long as ViewFlags.transparency is on...
  protected get agendaAppearance(): FeatureAppearance { return FeatureAppearance.fromTransparency(0.90); }
  protected get wantAgendaAppearanceOverride(): boolean { return false; }

  public addFeatureOverrides(overrides: FeatureSymbology.Overrides, _vp: Viewport): void {
    if (this.agenda.isEmpty)
      return;

    const app = this.agendaAppearance;
    this.agenda.elements.forEach((id) => { overrides.overrideElement(id, app); });
  }

  protected updateAgendaAppearanceProvider(drop?: true): void {
    if (!this.wantAgendaAppearanceOverride)
      return;

    for (const vp of IModelApp.viewManager) {
      if (!this.allowView(vp))
        continue;

      if (drop || this.agenda.isEmpty)
        vp.dropFeatureOverrideProvider(this);
      else if (!vp.addFeatureOverrideProvider(this))
        vp.setFeatureOverrideProviderChanged();
    }
  }

  protected get geometryCacheFilter(): ElementGeometryCacheFilter | undefined { return undefined; }

  protected override async isElementValidForOperation(hit: HitDetail, out?: LocateResponse): Promise<boolean> {
    if (!await super.isElementValidForOperation(hit, out))
      return false;

    if (!hit.isElementHit)
      return false;

    let accept = this._checkedIds.get(hit.sourceId);

    if (undefined === accept) {
      try {
        this._startedCmd = await this.startCommand();
        accept = await ElementGeometryCacheTool.callCommand("createElementGeometryCache", hit.sourceId, this.geometryCacheFilter);
      } catch (err) {
        accept = false;
      }

      this._checkedIds.set(hit.sourceId, accept);
    }

    return accept;
  }

  public override onDynamicFrame(_ev: BeButtonEvent, context: DynamicsContext): void {
    if (undefined !== this._graphicsProvider)
      this._graphicsProvider.addGraphic(context);
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    return this.updateGraphic(ev, IModelApp.viewManager.inDynamicsMode);
  }

  protected async getGraphicData(_ev: BeButtonEvent): Promise<Uint8Array | undefined> { return undefined; }

  protected async updateGraphic(ev: BeButtonEvent, isDynamics: boolean): Promise<void> {
    if (!isDynamics || this._graphicsPending)
      return; // Continue displaying previous graphic if new graphic is still pending...

    this._graphicsPending = true;
    const graphicData = await this.getGraphicData(ev);
    this._graphicsPending = undefined;

    if (undefined !== graphicData) {
      if (this._firstResult) {
        this.updateAgendaAppearanceProvider();
        this._firstResult = false;
      }
      return this.createGraphic(graphicData);
    }

    if (undefined !== this._graphicsProvider)
      this._graphicsProvider.cleanupGraphic();
  }

  protected async createGraphic(graphicData: Uint8Array): Promise<void> {
    if (undefined === this._graphicsProvider)
      this._graphicsProvider = new ElementGeometryGraphicsProvider(this.iModel);

    await this._graphicsProvider.createGraphic(graphicData);
  }

  protected clearGraphic(): void {
    if (undefined === this._graphicsProvider)
      return;
    this._graphicsProvider.cleanupGraphic();
    this._graphicsProvider = undefined;
  }

  protected async clearElementGeometryCache(): Promise<void> {
    try {
      this._startedCmd = await this.startCommand();
      await ElementGeometryCacheTool.callCommand("clearElementGeometryCache");
    } catch (err) { }
  }

  public override async onUnsuspend(): Promise<void> {
    if (!this._firstResult)
      this.updateAgendaAppearanceProvider();
    return super.onUnsuspend();
  }

  public override async onSuspend(): Promise<void> {
    if (!this._firstResult)
      this.updateAgendaAppearanceProvider(true);
    return super.onSuspend();
  }

  public override async onPostInstall(): Promise<void> {
    await super.onPostInstall();
    if (this.wantAgendaAppearanceOverride)
      this.agenda.manageHiliteState = false;
  }

  public override async onCleanup(): Promise<void> {
    await super.onCleanup();
    await this.clearElementGeometryCache();
    this.updateAgendaAppearanceProvider(true);
    this.clearGraphic();
  }
}

/** @alpha Identify faces of solids and surfaces to offset. */
export class OffsetFacesTool extends ElementGeometryCacheTool {
  public static override toolId = "OffsetFaces";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  protected _currentSubEntity?: SubEntityData;
  protected _acceptedSubEntity?: SubEntityLocationProps;

  public override requireWriteableTarget(): boolean { return false; } // TODO: Testing...

  protected override get wantDynamics(): boolean { return true; }
  protected override get wantAccuSnap(): boolean { return undefined !== this._acceptedSubEntity; }
  protected override get wantAgendaAppearanceOverride(): boolean { return true; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { minGeom: 1, maxGeom: 1, parts: true, curves: false, surfaces: true, solids: true, other: false };
  }

  public override decorate(context: DecorateContext): void {
    if (!this.allowView(context.viewport))
      return;

    if (undefined !== this._currentSubEntity)
      this._currentSubEntity.display(context, false);
  }

  protected async doPickSubEntities(id: Id64String, boresite: Ray3d): Promise<SubEntityLocationProps | undefined> {
    // TODO: Need proper locate method that returns array of hits...store per-element id...
    try {
      this._startedCmd = await this.startCommand();
      return await ElementGeometryCacheTool.callCommand("getClosestFace", id, boresite.origin);
    } catch (err) {
      return undefined;
    }
  }

  protected async doLocateSubEntity(ev: BeButtonEvent, newSearch: boolean): Promise<boolean> {
    if (this.agenda.isEmpty || undefined === ev.viewport)
      return false;

    if (newSearch) {
      // TODO: Use ev.point when doPickSubEntities stops using getClosestPoint...
      // const boresite = AccuDrawHintBuilder.getBoresite(ev.point, ev.viewport);
      const hit = IModelApp.accuSnap.currHit;
      const boresite = AccuDrawHintBuilder.getBoresite(hit ? hit.hitPoint : ev.point, ev.viewport);
      const info = await this.doPickSubEntities(this.agenda.elements[this.agenda.length - 1], boresite);

      if (undefined === info)
        return false;

      this._acceptedSubEntity = info;
      this.clearSubEntityGraphic();

      return true;
    }

    this._acceptedSubEntity = undefined;
    return true;
  }

  protected override async chooseNextHit(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === this._acceptedSubEntity)
      return super.chooseNextHit(ev);

    await this.doLocateSubEntity(ev, false);
    if (undefined === this._acceptedSubEntity)
      await this.onReinitialize();

    return EventHandled.No;
  }

  protected override async gatherInput(ev: BeButtonEvent): Promise<EventHandled | undefined> {
    if (undefined === this._acceptedSubEntity)
      await this.doLocateSubEntity(ev, true);
    return super.gatherInput(ev);
  }

  protected override get wantAdditionalInput(): boolean {
    if (undefined === this._acceptedSubEntity)
      return true;
    return super.wantAdditionalInput;
  }

  protected async setCurrentSubEntity(id?: Id64String, current?: SubEntityLocationProps, chordTolerance?: number): Promise<boolean> {
    if (undefined === id || undefined === current) {
      if (undefined === this._currentSubEntity || !this._currentSubEntity.hasGraphic)
        return false;
      this._currentSubEntity.cleanupGraphic();
      return true;
    }

    if (undefined !== this._currentSubEntity && this._currentSubEntity.hasGraphic && this._currentSubEntity.isSame(current.subEntity))
      return false;

    if (undefined === this._currentSubEntity)
      this._currentSubEntity = new SubEntityData();
    else
      this._currentSubEntity.cleanupGraphic();

    const opts: ElementGeometryResultOptions = {
      wantGraphic: true,
      wantRange: true,
      wantAppearance: true,
      chordTolerance,
    };

    this._currentSubEntity.info = current.subEntity;
    this._currentSubEntity.geom = await ElementGeometryCacheTool.callCommand("getSubEntityGeometry", id, current.subEntity, opts);

    return this._currentSubEntity.createGraphic(this.iModel);
  }

  protected clearSubEntityGraphic(): void {
    if (undefined === this._currentSubEntity)
      return;
    this._currentSubEntity.cleanupGraphic();
    this._currentSubEntity = undefined;
  }

  protected async updateSubEntityGraphic(ev: BeButtonEvent): Promise<boolean> {
    if (undefined === ev.viewport)
      return false;

    const hit = IModelApp.accuSnap.currHit;
    if (undefined === hit || !hit.isElementHit)
      return this.setCurrentSubEntity();

    // TODO: Use ev.point when doPickSubEntities stops using getClosestPoint...
    // const boresite = AccuDrawHintBuilder.getBoresite(ev.point, ev.viewport);
    const boresite = AccuDrawHintBuilder.getBoresite(hit.hitPoint, ev.viewport);
    const current = await this.doPickSubEntities(hit.sourceId, boresite);
    const chordTolerance = current ? computeChordToleranceFromPoint(ev.viewport, Point3d.fromJSON(current.point)) : 0.0;

    if (!await this.setCurrentSubEntity(hit.sourceId, current, chordTolerance))
      return false;

    IModelApp.viewManager.invalidateDecorationsAllViews();
    return true;
  }

  protected override async updateGraphic(ev: BeButtonEvent, isDynamics: boolean): Promise<void> {
    if (isDynamics)
      return super.updateGraphic(ev, isDynamics);

    await this.updateSubEntityGraphic(ev);
  }

  protected override async getGraphicData(ev: BeButtonEvent): Promise<Uint8Array | undefined> {
    const result = await this.applyAgendaOperation(ev, false);
    return result?.graphic;
  }

  protected async applyAgendaOperation(ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (undefined === ev.viewport || this.agenda.isEmpty || undefined === this._acceptedSubEntity?.point || undefined === this._acceptedSubEntity?.normal)
      return undefined;

    const facePt = Point3d.fromJSON(this._acceptedSubEntity.point);
    const faceNormal = Vector3d.fromJSON(this._acceptedSubEntity.normal);
    const projPt = AccuDrawHintBuilder.projectPointToLineInView(ev.point, facePt, faceNormal, ev.viewport);

    if (undefined === projPt)
      return undefined;

    const offsetDir = Vector3d.createStartEnd(facePt, projPt);
    let offset = offsetDir.magnitude();

    if (offset < Geometry.smallMetricDistance)
      return undefined;

    if (offsetDir.dotProduct(faceNormal) < 0.0)
      offset = -offset;

    try {
      this._startedCmd = await this.startCommand();
      const params: OffsetFacesProps = { faces: this._acceptedSubEntity.subEntity, distances: offset };
      const opts: ElementGeometryResultOptions = {
        wantGraphic: isAccept ? undefined : true,
        chordTolerance: computeChordToleranceFromPoint(ev.viewport, ev.point),
        requestId: `${this.toolId}:${this.agenda.elements[0]}`,
        writeChanges: isAccept ? true : undefined,
      };
      return await ElementGeometryCacheTool.callCommand("offsetFaces", this.agenda.elements[0], params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public override async processAgenda(ev: BeButtonEvent): Promise<void> {
    if (undefined === this._acceptedSubEntity)
      return;

    const result = await this.applyAgendaOperation(ev, true);
    if (result?.elementId)
      await this.saveChanges();
  }

  protected override setupAndPromptForNextAction(): void {
    super.setupAndPromptForNextAction();

    if (undefined === this._acceptedSubEntity?.point || undefined === this._acceptedSubEntity?.normal)
      return;

    const facePt = Point3d.fromJSON(this._acceptedSubEntity.point);
    const faceNormal = Vector3d.fromJSON(this._acceptedSubEntity.normal);

    const hints = new AccuDrawHintBuilder();
    hints.setOriginFixed = true;
    hints.setLockY = true;
    hints.setLockZ = true;
    hints.setModeRectangular();
    hints.setOrigin(facePt);
    hints.setXAxis2(faceNormal);
    hints.sendHints();
  }

  public override async onCleanup(): Promise<void> {
    this.clearSubEntityGraphic();
    return super.onCleanup();
  }

  public async onRestartTool(): Promise<void> {
    const tool = new OffsetFacesTool();
    if (!await tool.run())
      return this.exitTool();
  }
}
