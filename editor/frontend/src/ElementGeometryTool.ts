/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { Id64, Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import { editorBuiltInCmdIds, ElementGeometryCacheFilter, ElementGeometryResultOptions, ElementGeometryResultProps, LocateSubEntityProps, SolidModelingCommandIpc, SubEntityFilter, SubEntityGeometryProps, SubEntityLocationProps, SubEntityProps, SubEntityType } from "@itwin/editor-common";
import { FeatureAppearance, FeatureAppearanceProvider, RgbColor } from "@itwin/core-common";
import { Point3d, Range3d, Ray3d, Transform } from "@itwin/core-geometry";
import { AccuDrawHintBuilder, BeButtonEvent, BeModifierKeys, CoordinateLockOverrides, DecorateContext, DynamicsContext, ElementSetTool, EventHandled, FeatureOverrideProvider, FeatureSymbology, GraphicBranch, GraphicBranchOptions, GraphicType, HitDetail, IModelApp, IModelConnection, InputSource, LocateResponse, readElementGraphics, RenderGraphicOwner, SelectionMethod, SelectionSet, Viewport } from "@itwin/core-frontend";
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
export function isSameSubEntity(a: SubEntityProps, b: SubEntityProps): boolean {
  if (a.type !== b.type)
    return false;
  if (a.id !== b.id)
    return false;
  if ((undefined !== a.index ? a.index : 0) !== (undefined !== b.index ? b.index : 0))
    return false;
  return true;
}

/** @alpha */
export class SubEntityData {
  public toolData?: any;
  public chordTolerance?: number;

  private _props: SubEntityProps;
  private _geometry?: SubEntityGeometryProps;
  private _graphicsProvider?: ElementGeometryGraphicsProvider;

  constructor(props: SubEntityProps) { this._props = props; }

  public get props(): SubEntityProps { return this._props; }
  public set props(value: SubEntityProps) { this.cleanupGraphic(); this._props = value; }

  public get geometry(): SubEntityGeometryProps | undefined { return this._geometry; }
  public set geometry(value: SubEntityGeometryProps | undefined) { this._geometry = value; }

  public isSame(other: SubEntityProps): boolean { return isSameSubEntity(this._props, other); }

  public getAppearance(vp: Viewport, accepted: boolean): FeatureAppearance {
    const color = vp.hilite.color;
    const rgb = RgbColor.fromColorDef(accepted ? color.inverse() : color);
    const transparency = 0.25;
    const emphasized = true; // Necessary for obscured sub-entities w/SceneGraphic...
    let weight;

    switch (this.props.type) {
      case SubEntityType.Face:
        break;
      case SubEntityType.Edge:
        const edgeWeight = accepted ? 1 : 3;
        weight = this._geometry?.appearance?.weight ? Math.min(this._geometry.appearance.weight + edgeWeight, 31) : edgeWeight;
        break;
      case SubEntityType.Vertex:
        const vertexWeight = accepted ? 8 : 10;
        weight = this._geometry?.appearance?.weight ? Math.min(this._geometry.appearance.weight + vertexWeight, 31) : vertexWeight;
        break;
    }

    return FeatureAppearance.fromJSON({ rgb, transparency, weight, emphasized, nonLocatable: true });
  }

  public async createGraphic(iModel: IModelConnection): Promise<boolean> {
    if (undefined === this._geometry?.graphic)
      return false;

    if (undefined === this._graphicsProvider)
      this._graphicsProvider = new ElementGeometryGraphicsProvider(iModel);

    return this._graphicsProvider.createGraphic(this._geometry.graphic);
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

    const range = (this._geometry?.range ? Range3d.fromJSON(this._geometry.range) : undefined);
    const pixelSize = context.viewport.getPixelSizeAtPoint(range ? range.center : undefined);
    const offsetDir = context.viewport.view.getZVector();
    offsetDir.scaleToLength(3 * pixelSize, offsetDir);
    const offsetTrans = Transform.createTranslation(offsetDir);

    const appearanceProvider = FeatureAppearanceProvider.supplement((app: FeatureAppearance) => {
      return app.extendAppearance(this.getAppearance(context.viewport, accepted));
    });

    this._graphicsProvider.addDecoration(context, GraphicType.Scene, offsetTrans, { appearanceProvider });
  }
}

/** @alpha Base class for tools that want to use the backend geometry cache. */
export abstract class ElementGeometryCacheTool extends ElementSetTool implements FeatureOverrideProvider {
  protected _startedCmd?: string;
  protected readonly _checkedIds = new Map<Id64String, boolean>();
  protected _graphicsProvider?: ElementGeometryGraphicsProvider;
  protected _graphicsPending?: true;
  protected _firstResult = true;
  protected _agendaAppearanceDefault?: FeatureAppearance;
  protected _agendaAppearanceDynamic?: FeatureAppearance;

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

  protected agendaAppearance(isDynamics: boolean): FeatureAppearance {
    if (isDynamics) {
      if (undefined === this._agendaAppearanceDynamic)
        this._agendaAppearanceDynamic = FeatureAppearance.fromTransparency(0.0);

      return this._agendaAppearanceDynamic;
    }

    if (undefined === this._agendaAppearanceDefault)
      this._agendaAppearanceDefault = FeatureAppearance.fromTransparency(0.9);

    return this._agendaAppearanceDefault;
  }

  protected get wantAgendaAppearanceOverride(): boolean { return false; }

  public addFeatureOverrides(overrides: FeatureSymbology.Overrides, _vp: Viewport): void {
    if (this.agenda.isEmpty)
      return;

    const appearance = this.agendaAppearance(false);
    this.agenda.elements.forEach((elementId) => { overrides.override({ elementId, appearance }); });
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
  protected onGeometryCacheFilterChanged(): void { this._checkedIds.clear(); }

  protected async createElementGeometryCache(id: Id64String): Promise<boolean> {
    // NOTE: Creates cache if it doesn't already exist then test new or existing cache against filter...
    try {
      this._startedCmd = await this.startCommand();
      return await ElementGeometryCacheTool.callCommand("createElementGeometryCache", id, this.geometryCacheFilter);
    } catch (err) {
      return false;
    }
  }

  protected async acceptElementForOperation(id: Id64String): Promise<boolean> {
    if (Id64.isInvalid(id) || Id64.isTransient(id))
      return false;

    let accept = this._checkedIds.get(id);

    if (undefined === accept) {
      accept = await this.createElementGeometryCache(id);
      this._checkedIds.set(id, accept);
    }

    return accept;
  }

  protected override async isElementValidForOperation(hit: HitDetail, out?: LocateResponse): Promise<boolean> {
    if (!await super.isElementValidForOperation(hit, out))
      return false;

    return this.acceptElementForOperation(hit.sourceId);
  }

  protected async postFilterIds(arg: Id64Arg): Promise<Id64Arg> {
    const ids: Id64Array = [];

    for (const id of Id64.iterable(arg)) {
      if (await this.acceptElementForOperation(id))
        ids.push(id);
    }

    return ids;
  }

  protected override async getGroupIds(id: Id64String): Promise<Id64Arg> {
    return this.postFilterIds(await super.getGroupIds(id));
  }

  protected override async getSelectionSetCandidates(ss: SelectionSet): Promise<Id64Arg> {
    return this.postFilterIds(await super.getSelectionSetCandidates(ss));
  }

  protected override async getDragSelectCandidates(vp: Viewport, origin: Point3d, corner: Point3d, method: SelectionMethod, overlap: boolean): Promise<Id64Arg> {
    return this.postFilterIds(await super.getDragSelectCandidates(vp, origin, corner, method, overlap));
  }

  public override onDynamicFrame(_ev: BeButtonEvent, context: DynamicsContext): void {
    if (undefined === this._graphicsProvider)
      return;

    if (!this.wantAgendaAppearanceOverride)
      return this._graphicsProvider.addGraphic(context);

    const appearanceProvider = FeatureAppearanceProvider.supplement((app: FeatureAppearance) => {
      return app.extendAppearance(this.agendaAppearance(true));
    });

    this._graphicsProvider.addGraphic(context, undefined, { appearanceProvider });
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

/** @alpha Base class for tools that need to locate faces, edges, and vertices. */
export abstract class LocateSubEntityTool extends ElementGeometryCacheTool {
  protected _currentSubEntity?: SubEntityData;
  protected _acceptedSubEntities: SubEntityData[] = [];
  protected _locatedSubEntities?: SubEntityLocationProps[];

  protected override get wantAgendaAppearanceOverride(): boolean { return true; }

  protected wantSubEntityType(type: SubEntityType): boolean { return SubEntityType.Face === type; }
  protected getMaximumSubEntityHits(type: SubEntityType): number { return this.wantSubEntityType(type) ? 25 : 0; }

  protected get requiredSubEntityCount(): number { return 1; }
  protected get haveAcceptedSubEntities(): boolean { return (0 !== this._acceptedSubEntities.length); }
  protected get inhibitSubEntityDisplay(): boolean { return this.isDynamicsStarted; }

  protected get allowSubEntityControlSelect(): boolean { return true; }
  protected get allowSubEntityControlDeselect(): boolean { return this.allowSubEntityControlSelect; }
  protected get allowSubEntitySelectNext(): boolean { return !this.isDynamicsStarted; }

  protected getAcceptedSubEntityData(index: number = -1): SubEntityData | undefined {
    if (-1 === index)
      index = this._acceptedSubEntities.length - 1;

    if (index < 0 || index > this._acceptedSubEntities.length - 1)
      return undefined;

    return this._acceptedSubEntities[index];
  }

  protected getAcceptedSubEntities(): SubEntityProps[] {
    const accepted: SubEntityProps[] = [];
    this._acceptedSubEntities.forEach((entry) => { accepted.push(entry.props); });
    return accepted;
  }

  protected drawSubEntity(context: DecorateContext, subEntity: SubEntityData, accepted: boolean): void {
    subEntity.display(context, accepted);
  }

  protected drawAcceptedSubEntities(context: DecorateContext): void {
    this._acceptedSubEntities.forEach((entry) => { this.drawSubEntity(context, entry, true); });
  }

  public override decorate(context: DecorateContext): void {
    if (this.inhibitSubEntityDisplay || !this.allowView(context.viewport))
      return;

    if (this.haveAcceptedSubEntities)
      this.drawAcceptedSubEntities(context);

    if (undefined !== this._currentSubEntity)
      this.drawSubEntity(context, this._currentSubEntity, false);
  }

  public override decorateSuspended(context: DecorateContext): void {
    if (this.inhibitSubEntityDisplay || !this.allowView(context.viewport))
      return;

    if (this.haveAcceptedSubEntities)
      this.drawAcceptedSubEntities(context);
  }

  protected getLocateAperture(ev: BeButtonEvent): number {
    if (undefined === ev.viewport)
      return 0.0;

    return ev.viewport.pixelsFromInches(InputSource.Touch === ev.inputSource ? IModelApp.locateManager.touchApertureInches : IModelApp.locateManager.apertureInches);
  }

  protected getMaxRayDistance(ev: BeButtonEvent, aperture: number): number {
    if (undefined === ev.viewport)
      return 0.0;

    // NOTE: Compute a world coordinate radius for ray test, try getting aperature size at point on element...
    const hit = IModelApp.accuSnap.currHit;
    const vec: Point3d[] = [];

    vec[0] = ev.viewport.worldToView(hit ? hit.hitPoint : ev.point);
    vec[1] = vec[0].clone(); vec[1].x += 1;
    ev.viewport.viewToWorldArray(vec);

    // The edge and vertex hits get post-filtered on xy distance, so this is fine for perspective views...
    return (aperture * vec[0].distance(vec[1]));
  }

  protected getRayOrigin(ev: BeButtonEvent): Point3d {
    const spacePoint = ev.point.clone();
    const vp = ev.viewport;

    if (undefined === vp)
      return spacePoint;

    vp.worldToNpc(spacePoint, spacePoint);
    spacePoint.z = 1.0;
    vp.npcToWorld(spacePoint, spacePoint);

    return spacePoint;
  }

  protected getSubEntityFilter(): SubEntityFilter | undefined { return undefined; }

  protected async pickSubEntities(id: Id64String, boresite: Ray3d, maxFace: number, maxEdge: number, maxVertex: number, maxDistance: number, hiddenEdgesVisible: boolean, filter?: SubEntityFilter): Promise<SubEntityLocationProps[] | undefined> {
    try {
      this._startedCmd = await this.startCommand();
      const opts: LocateSubEntityProps = {
        maxFace,
        maxEdge,
        maxVertex,
        maxDistance,
        hiddenEdgesVisible,
        filter,
      };
      return await ElementGeometryCacheTool.callCommand("locateSubEntities", id, boresite.origin, boresite.direction, opts);
    } catch (err) {
      return undefined;
    }
  }

  protected async doPickSubEntities(id: Id64String, ev: BeButtonEvent): Promise<SubEntityLocationProps[] | undefined> {
    const vp = ev.viewport;
    if (undefined === vp)
      return undefined;

    const maxFace = this.getMaximumSubEntityHits(SubEntityType.Face);
    const maxEdge = this.getMaximumSubEntityHits(SubEntityType.Edge);
    const maxVertex = this.getMaximumSubEntityHits(SubEntityType.Vertex);

    if (0 === maxFace && 0 === maxEdge && 0 === maxVertex)
      return undefined;

    const aperture = this.getLocateAperture(ev);
    const maxDistance = this.getMaxRayDistance(ev, aperture);
    const spacePoint = this.getRayOrigin(ev);
    const boresite = AccuDrawHintBuilder.getBoresite(spacePoint, vp);
    const hiddenEdgesVisible = vp.viewFlags.hiddenEdgesVisible();
    const filter = this.getSubEntityFilter();

    let hits = await this.pickSubEntities(id, boresite, maxFace, maxEdge, maxVertex, maxDistance, hiddenEdgesVisible, filter);

    // NOTE: Remove erroneous edge/vertex hits in perspective views by checking real xy distance to hit point...
    if (undefined === hits || !vp.isCameraOn)
      return hits;

    if (maxEdge > 0 && hits.length > 1) {
      const edgeApertureSquared = (aperture * aperture);
      const vertexApertureSquared = ((aperture * 2.0) * (aperture * 2.0));

      const e2 = Math.pow(aperture, 2);
      const v2 = Math.pow(aperture * 2.0, 2);

      if (e2 !== edgeApertureSquared || v2 !== vertexApertureSquared)
        return hits;

      const rayOrigin = vp.worldToView(boresite.origin);

      hits = hits.filter((hit) => {
        if (SubEntityType.Face === hit.subEntity.type)
          return true;

        const hitPoint = vp.worldToView(Point3d.fromJSON(hit.point));
        const distance = hitPoint.distanceSquaredXY(rayOrigin);

        return (distance <= (SubEntityType.Edge === hit.subEntity.type ? edgeApertureSquared : vertexApertureSquared));
      });
    }

    return hits;
  }

  protected async createSubEntityData(id: Id64String, hit: SubEntityLocationProps): Promise<SubEntityData> {
    const data = new SubEntityData(hit.subEntity);
    const chordTolerance = (this.targetView ? computeChordToleranceFromPoint(this.targetView, Point3d.fromJSON(hit.point)) : undefined);

    await this.createSubEntityGraphic(id, data, chordTolerance);

    return data;
  }

  /** Append specified sub-entity to accepted array. */
  protected async addSubEntity(id: Id64String, props: SubEntityLocationProps): Promise<void> {
    this._acceptedSubEntities.push(await this.createSubEntityData(id, props));
  }

  /** Remove specified sub-entity from accepted array, or pop last sub-entity if undefined. */
  protected async removeSubEntity(_id: Id64String, props?: SubEntityLocationProps): Promise<void> {
    if (undefined !== props)
      this._acceptedSubEntities = this._acceptedSubEntities.filter((entry) => !isSameSubEntity(entry.props, props.subEntity));
    else
      this._acceptedSubEntities.pop();
  }

  /** Locate sub-entities for the most recently added (last) agenda entry. Tool sub-classes that wish to identity
   * sub-entities from multiple elements are responsible for maintaining the sub-entities per-element.
   */
  protected async doLocateSubEntity(ev: BeButtonEvent, newSearch: boolean): Promise<boolean> {
    if (this.agenda.isEmpty || undefined === ev.viewport)
      return false;

    const id = this.agenda.elements[this.agenda.length - 1];

    if (newSearch) {
      this._locatedSubEntities = await this.doPickSubEntities(id, ev);
      if (undefined === this._locatedSubEntities || 0 === this._locatedSubEntities.length)
        return false;
    } else {
      await this.removeSubEntity(id);
    }

    const hit = this._locatedSubEntities?.shift();
    if (undefined !== hit) {
      if (undefined === this._acceptedSubEntities.find((entry) => isSameSubEntity(entry.props, hit.subEntity)))
        await this.addSubEntity(id, hit);
      else if (this.allowSubEntityControlDeselect)
        await this.removeSubEntity(id, hit);
    }

    IModelApp.viewManager.invalidateDecorationsAllViews();
    return true;
  }

  protected override async chooseNextHit(ev: BeButtonEvent): Promise<EventHandled> {
    if (!this.haveAcceptedSubEntities)
      return super.chooseNextHit(ev);

    if (!this.allowSubEntitySelectNext) {
      await this.onReinitialize(); // Don't cycle through hits after starting dynamics...
    } else {
      await this.doLocateSubEntity(ev, false);
      if (!this.haveAcceptedSubEntities)
        await this.onReinitialize();
    }

    return EventHandled.No;
  }

  protected get wantAdditionalSubEntities(): boolean {
    return (this._acceptedSubEntities.length < this.requiredSubEntityCount || (this.allowSubEntityControlSelect && this.isControlDown));
  }

  protected override async gatherInput(ev: BeButtonEvent): Promise<EventHandled | undefined> {
    if (this.wantAdditionalSubEntities) {
      await this.doLocateSubEntity(ev, true);

      if (this.wantAdditionalSubEntities)
        return EventHandled.No;

      this.clearCurrentSubEntity();
    }

    return super.gatherInput(ev);
  }

  protected getCurrentElement(): Id64String | undefined {
    if (!this.agenda.isEmpty)
      return this.agenda.elements[this.agenda.length - 1];

    const hit = IModelApp.accuSnap.currHit;
    return (undefined !== hit && hit.isElementHit ? hit.sourceId : undefined);
  }

  protected clearCurrentSubEntity(): void {
    if (undefined === this._currentSubEntity)
      return;
    this._currentSubEntity.cleanupGraphic();
    this._currentSubEntity = undefined;
  }

  protected async setCurrentSubEntity(id: Id64String, hit: SubEntityLocationProps, chordTolerance?: number): Promise<boolean> {
    if (undefined === this._currentSubEntity)
      this._currentSubEntity = new SubEntityData(hit.subEntity);
    else
      this._currentSubEntity.props = hit.subEntity;

    return this.createSubEntityGraphic(id, this._currentSubEntity, chordTolerance);
  }

  protected async changeCurrentSubEntity(id?: Id64String, current?: SubEntityLocationProps, chordTolerance?: number): Promise<boolean> {
    if (undefined === id || undefined === current) {
      if (undefined === this._currentSubEntity || !this._currentSubEntity.hasGraphic)
        return false;
      this._currentSubEntity.cleanupGraphic();
      return true;
    }

    if (undefined !== this._currentSubEntity && this._currentSubEntity.hasGraphic && this._currentSubEntity.isSame(current.subEntity))
      return false;

    return this.setCurrentSubEntity(id, current, chordTolerance);
  }

  protected async updateCurrentSubEntity(ev: BeButtonEvent): Promise<boolean> {
    if (undefined === ev.viewport)
      return false;

    const id = this.wantAdditionalSubEntities ? this.getCurrentElement() : undefined;
    if (undefined === id)
      return this.changeCurrentSubEntity();

    const current = await this.doPickSubEntities(id, ev);
    const chordTolerance = current ? computeChordToleranceFromPoint(ev.viewport, Point3d.fromJSON(current[0].point)) : 0.0;

    if (!await this.changeCurrentSubEntity(id, current ? current[0] : undefined, chordTolerance))
      return false;

    IModelApp.viewManager.invalidateDecorationsAllViews();
    return true;
  }

  protected async createSubEntityGraphic(id: Id64String, data: SubEntityData, chordTolerance?: number): Promise<boolean> {
    try {
      const opts: ElementGeometryResultOptions = {
        wantGraphic: true,
        wantRange: true,
        wantAppearance: true,
        chordTolerance,
      };

      data.chordTolerance = chordTolerance;
      data.geometry = await ElementGeometryCacheTool.callCommand("getSubEntityGeometry", id, data.props, opts);

      return await data.createGraphic(this.iModel);
    } catch (err) {
      return false;
    }
  }

  protected override async updateGraphic(ev: BeButtonEvent, isDynamics: boolean): Promise<void> {
    if (isDynamics)
      return super.updateGraphic(ev, isDynamics);

    await this.updateCurrentSubEntity(ev);
  }

  protected override async getGraphicData(ev: BeButtonEvent): Promise<Uint8Array | undefined> {
    const result = await this.applyAgendaOperation(ev, false);
    return result?.graphic;
  }

  protected async applyAgendaOperation(_ev: BeButtonEvent, _isAccept: boolean): Promise<ElementGeometryResultProps | undefined> { return undefined; }

  public override async processAgenda(ev: BeButtonEvent): Promise<void> {
    const result = await this.applyAgendaOperation(ev, true);
    if (result?.elementId)
      await this.saveChanges();
  }

  public override async onModifierKeyTransition(wentDown: boolean, modifier: BeModifierKeys, event: KeyboardEvent): Promise<EventHandled> {
    if (EventHandled.Yes === await super.onModifierKeyTransition(wentDown, modifier, event))
      return EventHandled.Yes;

    if (BeModifierKeys.Control !== modifier)
      return EventHandled.No;

    if (IModelApp.toolAdmin.isLocateCircleOn === this.wantAdditionalSubEntities)
      return EventHandled.No;

    this.setupAndPromptForNextAction();
    return EventHandled.Yes;
  }

  public override changeLocateState(enableLocate: boolean, enableSnap?: boolean, cursor?: string, coordLockOvr?: CoordinateLockOverrides): void {
    super.changeLocateState(enableLocate, enableSnap, cursor, coordLockOvr);

    // Keep showing locate circle when identifing sub-entities even if done locating elements...
    if (!IModelApp.toolAdmin.isLocateCircleOn && this.wantAdditionalSubEntities)
      IModelApp.toolAdmin.setLocateCircleOn(true);
  }

  protected override get shouldEnableSnap(): boolean {
    if (this.isSelectByPoints || !this.wantAccuSnap)
      return false;

    if (!this.isControlDown)
      return true;

    if (!(this.controlKeyContinuesSelection || this.allowSubEntityControlSelect))
      return true;

    return (!(this.wantAdditionalElements || this.wantAdditionalSubEntities));
  }

  protected setupAccuDraw(): void { }

  protected override setupAndPromptForNextAction(): void {
    this.setupAccuDraw();
    super.setupAndPromptForNextAction();
  }

  protected clearSubEntityGraphics(): void {
    if (undefined !== this._currentSubEntity)
      this._currentSubEntity.cleanupGraphic();
    this._acceptedSubEntities.forEach((entry) => { entry.cleanupGraphic(); });
  }

  public override async onCleanup(): Promise<void> {
    this.clearSubEntityGraphics();
    return super.onCleanup();
  }
}
