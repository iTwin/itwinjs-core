/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Editing
 */

import { Id64, Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import { FeatureAppearance, FlatBufferGeometryStream, GeometricElementProps, JsonGeometryStream } from "@itwin/core-common";
import { BeButtonEvent, DynamicsContext, ElementSetTool, FeatureOverrideProvider, FeatureSymbology, HitDetail, IModelApp, LocateResponse, SelectionMethod, SelectionSet, Viewport } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { computeChordToleranceFromPoint, DynamicGraphicsProvider } from "./CreateElementTool";

/** Edit tool base class for updating existing elements.
 * @beta
 */
export abstract class ModifyElementTool extends ElementSetTool {
  protected readonly _checkedIds = new Map<Id64String, boolean>();

  protected allowView(_vp: Viewport) { return true; }
  public override isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && this.allowView(vp)); }

  protected onGeometryFilterChanged(): void { this._checkedIds.clear(); }

  protected async doAcceptElementForOperation(_id: Id64String): Promise<boolean> { return false; }

  protected async acceptElementForOperation(id: Id64String): Promise<boolean> {
    if (Id64.isInvalid(id) || Id64.isTransient(id))
      return false;

    let accept = this._checkedIds.get(id);

    if (undefined === accept) {
      if (this.agenda.isEmpty && this._checkedIds.size > 1000)
        this._checkedIds.clear(); // Limit auto-locate cache size to something reasonable...

      accept = await this.doAcceptElementForOperation(id);
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

  protected setupAccuDraw(): void { }

  protected override setupAndPromptForNextAction(): void {
    this.setupAccuDraw();
    super.setupAndPromptForNextAction();
  }

  protected abstract getGeometryProps(ev: BeButtonEvent, isAccept: boolean): JsonGeometryStream | FlatBufferGeometryStream | undefined;
  protected abstract getElementProps(ev: BeButtonEvent): GeometricElementProps | undefined;

  protected async doUpdateElement(_props: GeometricElementProps): Promise<boolean> { return false; }

  protected async applyAgendaOperation(ev: BeButtonEvent): Promise<boolean> {
    const geometry = this.getGeometryProps(ev, true);
    if (undefined === geometry)
      return false;

    const elemProps = this.getElementProps(ev);
    if (undefined === elemProps)
      return false;

    if ("flatbuffer" === geometry.format)
      elemProps.elementGeometryBuilderParams = { entryArray: geometry.data };
    else
      elemProps.geom = geometry.data;

    return this.doUpdateElement(elemProps);
  }

  public override async processAgenda(ev: BeButtonEvent): Promise<void> {
    if (await this.applyAgendaOperation(ev))
      return this.saveChanges();
  }
}

/** Edit tool base class for updating existing elements that use dynamics to show intermediate results.
 * @beta
 */
export abstract class ModifyElementWithDynamicsTool extends ModifyElementTool implements FeatureOverrideProvider {
  protected _graphicsProvider?: DynamicGraphicsProvider;
  protected _firstResult = true;
  protected _agendaAppearanceDefault?: FeatureAppearance;
  protected _agendaAppearanceDynamic?: FeatureAppearance;

  protected override get wantAccuSnap(): boolean { return true; }
  protected override get wantDynamics(): boolean { return true; }

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
    this.agenda.elements.forEach((elementId) => overrides.override({ elementId, appearance }));
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

  protected clearGraphics(): void {
    if (undefined === this._graphicsProvider)
      return;
    this._graphicsProvider.cleanupGraphic();
    this._graphicsProvider = undefined;
  }

  protected async createGraphics(ev: BeButtonEvent): Promise<void> {
    if (!IModelApp.viewManager.inDynamicsMode)
      return; // Don't need to create graphic if dynamics aren't yet active...

    const geometry = this.getGeometryProps(ev, false);
    if (undefined === geometry) {
      this.clearGraphics();
      return;
    }

    const elemProps = this.getElementProps(ev);
    if (undefined === elemProps?.placement) {
      this.clearGraphics();
      return;
    }

    if (undefined === this._graphicsProvider) {
      if (this._firstResult) {
        this.updateAgendaAppearanceProvider();
        this._firstResult = false;
      }
      this._graphicsProvider = new DynamicGraphicsProvider(this.iModel, this.toolId);
    }

    // Set chord tolerance for non-linear/non-planar geometry...
    if (ev.viewport)
      this._graphicsProvider.chordTolerance = computeChordToleranceFromPoint(ev.viewport, ev.point);

    await this._graphicsProvider.createGraphic(elemProps.category, elemProps.placement, geometry);
  }

  public override onDynamicFrame(_ev: BeButtonEvent, context: DynamicsContext): void {
    if (undefined !== this._graphicsProvider)
      this._graphicsProvider.addGraphic(context);
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    return this.createGraphics(ev);
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
    this.clearGraphics();
    this.updateAgendaAppearanceProvider(true);
    return super.onCleanup();
  }
}
