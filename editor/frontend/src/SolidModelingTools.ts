/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { DialogItem, DialogProperty, DialogPropertySyncItem, EnumerationChoice, PropertyDescriptionHelper } from "@itwin/appui-abstract";
import { Id64Array, Id64String } from "@itwin/core-bentley";
import { ColorDef, ElementGeometry } from "@itwin/core-common";
import {
  AccuDraw, AccuDrawHintBuilder, AngleDescription, BeButtonEvent, DecorateContext, DynamicsContext, EventHandled, GraphicType, HitDetail, IModelApp,
  LengthDescription, TentativeOrAccuSnap,
} from "@itwin/core-frontend";
import { Angle, Geometry, LineString3d, Matrix3d, Point3d, Vector3d, XYZProps } from "@itwin/core-geometry";
import {
  BlendEdgesProps, BooleanMode, BooleanOperationProps, BRepEntityType, ChamferEdgesProps, ChamferMode, CutDepthMode, CutDirectionMode, CutProps,
  DeleteSubEntityProps, ElementGeometryCacheFilter, ElementGeometryResultOptions, ElementGeometryResultProps, EmbossDirectionMode, EmbossProps,
  HollowFacesProps, ImprintProps, LoftProps, OffsetFacesProps, ProfileClosure, SewSheetProps, SpinFacesProps, SubEntityFilter, SubEntityLocationProps,
  SubEntityProps, SubEntityType, SweepFacesProps, SweepPathProps, ThickenSheetProps,
} from "@itwin/editor-common";
import { computeChordToleranceFromPoint } from "./CreateElementTool";
import { EditTools } from "./EditTool";
import { ElementGeometryCacheTool, isSameSubEntity, LocateSubEntityTool, SubEntityData } from "./ElementGeometryTool";
import { solidModelingIpc } from "./EditToolIpc";

/** @alpha Base class for tools that perform boolean operations on a set of elements. */
export abstract class BooleanOperationTool extends ElementGeometryCacheTool {
  protected abstract get mode(): BooleanMode;
  protected override get allowSelectionSet(): boolean { return BooleanMode.Subtract !== this.mode; }
  protected override get allowDragSelect(): boolean { return BooleanMode.Subtract !== this.mode; }
  protected override get controlKeyContinuesSelection(): boolean { return true; }
  protected override get requiredElementCount(): number { return 2; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: false, surfaces: BooleanMode.Subtract === this.mode && !this.agenda.isEmpty, solids: true, other: false };
  }

  protected override async onAgendaModified(): Promise<void> {
    // Filter changes to allow surfaces as tools, invalidate cached accept status...
    if (BooleanMode.Subtract === this.mode && (this.agenda.isEmpty || 1 === this.agenda.length))
      this.onGeometryCacheFilterChanged();
  }

  protected async applyAgendaOperation(): Promise<ElementGeometryResultProps | undefined> {
    if (this.agenda.length < this.requiredElementCount)
      return undefined;

    try {
      this._startedCmd = await this.startCommand();
      const target = this.agenda.elements[0];
      const tools: Id64Array = this.agenda.elements.slice(1);
      const params: BooleanOperationProps = { mode: this.mode, tools };
      const opts: ElementGeometryResultOptions = { writeChanges: true };
      return await solidModelingIpc.booleanOperation(target, params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public override async processAgenda(_ev: BeButtonEvent): Promise<void> {
    const result = await this.applyAgendaOperation();
    if (result?.elementId)
      await this.saveChanges();
  }
}

/** @alpha Perform boolean union of solid geometry. */
export class UniteSolidElementsTool extends BooleanOperationTool {
  public static override toolId = "UniteSolids";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  protected override get mode(): BooleanMode { return BooleanMode.Unite; }

  public async onRestartTool(): Promise<void> {
    const tool = new UniteSolidElementsTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Perform boolean subtract of solid geometry. */
export class SubtractSolidElementsTool extends BooleanOperationTool {
  public static override toolId = "SubtractSolids";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  protected override get mode(): BooleanMode { return BooleanMode.Subtract; }

  public async onRestartTool(): Promise<void> {
    const tool = new SubtractSolidElementsTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Perform boolean intersection of solid geometry. */
export class IntersectSolidElementsTool extends BooleanOperationTool {
  public static override toolId = "IntersectSolids";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  protected override get mode(): BooleanMode { return BooleanMode.Intersect; }

  public async onRestartTool(): Promise<void> {
    const tool = new IntersectSolidElementsTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Perform sew operation on surface geometry. */
export class SewSheetElementsTool extends ElementGeometryCacheTool {
  public static override toolId = "SewSheets";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  protected override get allowSelectionSet(): boolean { return true; }
  protected override get allowDragSelect(): boolean { return true; }
  protected override get controlKeyContinuesSelection(): boolean { return true; }
  protected override get requiredElementCount(): number { return 2; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: false, surfaces: true, solids: false, other: false };
  }

  protected async applyAgendaOperation(): Promise<ElementGeometryResultProps | undefined> {
    if (this.agenda.length < this.requiredElementCount)
      return undefined;

    try {
      this._startedCmd = await this.startCommand();
      const target = this.agenda.elements[0];
      const tools: Id64Array = this.agenda.elements.slice(1);
      const params: SewSheetProps = { tools };
      const opts: ElementGeometryResultOptions = { writeChanges: true };
      return await solidModelingIpc.sewSheets(target, params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public override async processAgenda(_ev: BeButtonEvent): Promise<void> {
    const result = await this.applyAgendaOperation();
    if (result?.elementId)
      await this.saveChanges();
  }

  public async onRestartTool(): Promise<void> {
    const tool = new SewSheetElementsTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Perform thicken operation on surface geometry. */
export class ThickenSheetElementsTool extends ElementGeometryCacheTool {
  public static override toolId = "ThickenSheets";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  private _frontDistanceProperty: DialogProperty<number> | undefined;
  public get frontDistanceProperty() {
    if (!this._frontDistanceProperty)
      this._frontDistanceProperty = new DialogProperty<number>(new LengthDescription("thickenFront", EditTools.translate("ThickenSheets.Label.FrontDistance")), 0.1, undefined);
    return this._frontDistanceProperty;
  }

  public get frontDistance(): number { return this.frontDistanceProperty.value; }
  public set frontDistance(value: number) { this.frontDistanceProperty.value = value; }

  private _backDistanceProperty: DialogProperty<number> | undefined;
  public get backDistanceProperty() {
    if (!this._backDistanceProperty)
      this._backDistanceProperty = new DialogProperty<number>(new LengthDescription("thickenBack", EditTools.translate("ThickenSheets.Label.BackDistance")), 0.0, undefined);
    return this._backDistanceProperty;
  }

  public get backDistance(): number { return this.backDistanceProperty.value; }
  public set backDistance(value: number) { this.backDistanceProperty.value = value; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: false, surfaces: true, solids: false, other: false };
  }

  protected async applyAgendaOperation(): Promise<ElementGeometryResultProps | undefined> {
    if (this.agenda.length < this.requiredElementCount)
      return undefined;

    try {
      this._startedCmd = await this.startCommand();
      const target = this.agenda.elements[0];
      const params: ThickenSheetProps = { front: this.frontDistance, back: this.backDistance };
      const opts: ElementGeometryResultOptions = { writeChanges: true };
      return await solidModelingIpc.thickenSheets(target, params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public override async processAgenda(_ev: BeButtonEvent): Promise<void> {
    const result = await this.applyAgendaOperation();
    if (result?.elementId)
      await this.saveChanges();
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.frontDistanceProperty, this.backDistanceProperty]);

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.frontDistanceProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));
    toolSettings.push(this.backDistanceProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));
    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new ThickenSheetElementsTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Perform cut operation on solid using region or path profile. */
export class CutSolidElementsTool extends ElementGeometryCacheTool {
  public static override toolId = "CutSolids";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...
  protected targetPoint?: Point3d;
  protected toolPoint?: Point3d;

  private _bothDirectionsProperty: DialogProperty<boolean> | undefined;
  public get bothDirectionsProperty() {
    if (!this._bothDirectionsProperty)
      this._bothDirectionsProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("cutBothDirections", EditTools.translate("CutSolids.Label.BothDirections")), false);
    return this._bothDirectionsProperty;
  }

  public get bothDirections(): boolean { return this.bothDirectionsProperty.value; }
  public set bothDirections(value: boolean) { this.bothDirectionsProperty.value = value; }

  private _outsideProperty: DialogProperty<boolean> | undefined;
  public get outsideProperty() {
    if (!this._outsideProperty)
      this._outsideProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("cutOutside", EditTools.translate("CutSolids.Label.Outside")), false);
    return this._outsideProperty;
  }

  public get outside(): boolean { return this.outsideProperty.value; }
  public set outside(value: boolean) { this.outsideProperty.value = value; }

  private _useDepthProperty: DialogProperty<boolean> | undefined;
  public get useDepthProperty() {
    if (!this._useDepthProperty)
      this._useDepthProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useCutDepth"), false);
    return this._useDepthProperty;
  }

  public get useDepth(): boolean { return this.useDepthProperty.value; }
  public set useDepth(value: boolean) { this.useDepthProperty.value = value; }

  private _depthProperty: DialogProperty<number> | undefined;
  public get depthProperty() {
    if (!this._depthProperty)
      this._depthProperty = new DialogProperty<number>(new LengthDescription("cutDepth", EditTools.translate("CutSolids.Label.Depth")), 0.1, undefined, !this.useDepth);
    return this._depthProperty;
  }

  public get depth(): number { return this.depthProperty.value; }
  public set depth(value: number) { this.depthProperty.value = value; }

  protected override get requiredElementCount(): number { return 2; }
  protected get isProfilePhase(): boolean { return !this.agenda.isEmpty; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    const profilePhase = this.isProfilePhase;
    return { minGeom: 1, maxGeom: profilePhase ? 1 : undefined, parts: true, curves: profilePhase, surfaces: profilePhase, solids: !profilePhase, other: false };
  }

  protected override async createElementGeometryCache(id: Id64String): Promise<boolean> {
    if (!await super.createElementGeometryCache(id))
      return false;

    if (!this.isProfilePhase)
      return true;

    try {
      this._startedCmd = await this.startCommand();
      return await solidModelingIpc.isPlanarBody(id, 0);
    } catch (err) {
      return false;
    }
  }

  protected override async onAgendaModified(): Promise<void> {
    // Filter changes to allow sheets and wires as profiles, invalidate cached accept status...
    if (this.agenda.isEmpty || 1 === this.agenda.length)
      this.onGeometryCacheFilterChanged();
  }

  protected async applyAgendaOperation(): Promise<ElementGeometryResultProps | undefined> {
    if (this.agenda.length < this.requiredElementCount)
      return undefined;

    const direction = (this.bothDirections ? CutDirectionMode.Both : CutDirectionMode.Auto);
    const depth = (this.useDepth ? CutDepthMode.Blind : CutDepthMode.All);

    try {
      this._startedCmd = await this.startCommand();
      const target = this.agenda.elements[0];
      const profile = this.agenda.elements[1];
      const params: CutProps = { profile, direction, depth, distance: this.depth, outside: this.outside ? true : undefined, closeOpen: ProfileClosure.Auto, targetPoint: this.targetPoint, toolPoint: this.toolPoint };
      const opts: ElementGeometryResultOptions = { writeChanges: true };
      return await solidModelingIpc.cutSolid(target, params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public override async processAgenda(_ev: BeButtonEvent): Promise<void> {
    const result = await this.applyAgendaOperation();
    if (result?.elementId)
      await this.saveChanges();
  }

  protected override async buildLocateAgenda(hit: HitDetail): Promise<boolean> {
    if (this.isProfilePhase)
      this.toolPoint = hit.hitPoint;
    else
      this.targetPoint = hit.hitPoint;

    return super.buildLocateAgenda(hit);
  }

  protected override getToolSettingPropertyLocked(property: DialogProperty<any>): DialogProperty<any> | undefined {
    return (property === this.useDepthProperty ? this.depthProperty : undefined);
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.bothDirectionsProperty, this.outsideProperty, this.useDepthProperty, this.depthProperty]);

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.bothDirectionsProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));
    toolSettings.push(this.outsideProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));

    // ensure controls are enabled/disabled based on current lock property state
    this.depthProperty.isDisabled = !this.useDepth;
    const useDepthLock = this.useDepthProperty.toDialogItem({ rowPriority: 3, columnIndex: 0 });
    toolSettings.push(this.depthProperty.toDialogItem({ rowPriority: 3, columnIndex: 1 }, useDepthLock));

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new CutSolidElementsTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Perform emboss operation on solid or sheet using sheet profile. */
export class EmbossSolidElementsTool extends ElementGeometryCacheTool {
  public static override toolId = "EmbossSolids";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...
  protected targetPoint?: Point3d;

  protected override get requiredElementCount(): number { return 2; }
  protected get isProfilePhase(): boolean { return !this.agenda.isEmpty; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    const profilePhase = this.isProfilePhase;
    return { minGeom: 1, maxGeom: 1, parts: true, curves: false, surfaces: true, solids: !profilePhase, other: false };
  }

  protected override async onAgendaModified(): Promise<void> {
    // Filter changes to disallow solids as profiles, invalidate cached accept status...
    if (this.agenda.isEmpty || 1 === this.agenda.length)
      this.onGeometryCacheFilterChanged();
  }

  protected async applyAgendaOperation(): Promise<ElementGeometryResultProps | undefined> {
    if (this.agenda.length < this.requiredElementCount)
      return undefined;

    try {
      this._startedCmd = await this.startCommand();
      const target = this.agenda.elements[0];
      const profile = this.agenda.elements[1];
      const params: EmbossProps = { profile, direction: EmbossDirectionMode.Auto, targetPoint: this.targetPoint };
      const opts: ElementGeometryResultOptions = { writeChanges: true };
      return await solidModelingIpc.embossBody(target, params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public override async processAgenda(_ev: BeButtonEvent): Promise<void> {
    const result = await this.applyAgendaOperation();
    if (result?.elementId)
      await this.saveChanges();
  }

  protected override async buildLocateAgenda(hit: HitDetail): Promise<boolean> {
    if (!this.isProfilePhase)
      this.targetPoint = hit.hitPoint;

    return super.buildLocateAgenda(hit);
  }

  public async onRestartTool(): Promise<void> {
    const tool = new EmbossSolidElementsTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Create a solid for sheet by sweeping a profile along a path. */
export class SweepAlongPathTool extends ElementGeometryCacheTool {
  public static override toolId = "SweepAlongPath";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  protected override get requiredElementCount(): number { return 2; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { minGeom: 1, maxGeom: 1, parts: true, curves: true, surfaces: true, solids: false, other: false };
  }

  protected async applyAgendaOperation(): Promise<ElementGeometryResultProps | undefined> {
    if (this.agenda.length < this.requiredElementCount)
      return undefined;

    try {
      this._startedCmd = await this.startCommand();
      const target = this.agenda.elements[0];
      const path = this.agenda.elements[1];
      const params: SweepPathProps = { path };
      const opts: ElementGeometryResultOptions = { writeChanges: true };
      return await solidModelingIpc.sweepAlongPath(target, params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public override async processAgenda(_ev: BeButtonEvent): Promise<void> {
    const result = await this.applyAgendaOperation();
    if (result?.elementId)
      await this.saveChanges();
  }

  public async onRestartTool(): Promise<void> {
    const tool = new SweepAlongPathTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Create a new sheet or solid body by lofting through a set of profiles. */
export class LoftProfilesTool extends ElementGeometryCacheTool {
  public static override toolId = "LoftProfiles";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  protected override get requiredElementCount(): number { return 2; }
  protected override get controlKeyContinuesSelection(): boolean { return true; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { minGeom: 1, maxGeom: 1, parts: true, curves: true, surfaces: true, solids: false, other: false };
  }

  protected async applyAgendaOperation(): Promise<ElementGeometryResultProps | undefined> {
    if (this.agenda.length < this.requiredElementCount)
      return undefined;

    try {
      this._startedCmd = await this.startCommand();
      const target = this.agenda.elements[0];
      const tools = this.agenda.elements.slice(1);
      const params: LoftProps = { tools, orderCurves: this.isSelectionSetModify ? true : undefined, orientCurves: true };
      const opts: ElementGeometryResultOptions = { writeChanges: true };
      return await solidModelingIpc.loftProfiles(target, params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public override async processAgenda(_ev: BeButtonEvent): Promise<void> {
    const result = await this.applyAgendaOperation();
    if (result?.elementId)
      await this.saveChanges();
  }

  public async onRestartTool(): Promise<void> {
    const tool = new LoftProfilesTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha */
export class FaceLocationData {
  public point: Point3d;
  public normal: Vector3d;

  constructor(point: Point3d, normal: Vector3d) {
    this.point = point;
    this.normal = normal;
  }

  public static create(pointProps: XYZProps, normalProps: XYZProps) {
    const point = Point3d.fromJSON(pointProps);
    const normal = Vector3d.fromJSON(normalProps);
    return new FaceLocationData(point, normal);
  }
}

/** @alpha Identify faces of solids and surfaces to offset. */
export class OffsetFacesTool extends LocateSubEntityTool {
  public static override toolId = "OffsetFaces";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  private _addSmoothProperty: DialogProperty<boolean> | undefined;
  public get addSmoothProperty() {
    if (!this._addSmoothProperty)
      this._addSmoothProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("offsetSmooth", EditTools.translate("OffsetFaces.Label.AddSmooth")), false);
    return this._addSmoothProperty;
  }

  public get addSmooth(): boolean { return this.addSmoothProperty.value; }
  public set addSmooth(value: boolean) { this.addSmoothProperty.value = value; }

  private _useDistanceProperty: DialogProperty<boolean> | undefined;
  public get useDistanceProperty() {
    if (!this._useDistanceProperty)
      this._useDistanceProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useOffsetDistance"), false);
    return this._useDistanceProperty;
  }

  public get useDistance(): boolean { return this.useDistanceProperty.value; }
  public set useDistance(value: boolean) { this.useDistanceProperty.value = value; }

  private _distanceProperty: DialogProperty<number> | undefined;
  public get distanceProperty() {
    if (!this._distanceProperty)
      this._distanceProperty = new DialogProperty<number>(new LengthDescription("offsetDistance", EditTools.translate("OffsetFaces.Label.Distance")), 0.1, undefined, !this.useDistance);
    return this._distanceProperty;
  }

  public get distance(): number { return this.distanceProperty.value; }
  public set distance(value: number) { this.distanceProperty.value = value; }

  protected override get wantDynamics(): boolean { return true; }
  protected override get wantAccuSnap(): boolean { return this.isDynamicsStarted; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: false, surfaces: true, solids: true, other: false };
  }

  protected override async createSubEntityData(id: Id64String, hit: SubEntityLocationProps): Promise<SubEntityData> {
    const data = await super.createSubEntityData(id, hit);

    if (undefined !== hit.point && undefined !== hit.normal)
      data.toolData = FaceLocationData.create(hit.point, hit.normal);

    return data;
  }

  protected override drawAcceptedSubEntities(context: DecorateContext): void {
    super.drawAcceptedSubEntities(context);

    // Show pick point on last identified face, offset direction/distance will be computed from this location...
    const faceData = this.getAcceptedSubEntityData()?.toolData as FaceLocationData;
    if (undefined === faceData)
      return;

    const builder = context.createGraphic({ type: GraphicType.WorldOverlay });
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 10);
    builder.addPointString([faceData.point]);

    context.addDecorationFromBuilder(builder);
  }

  protected async getSmoothFaces(id: Id64String, face: SubEntityProps): Promise<SubEntityProps[] | undefined> {
    try {
      // NOTE: For offset, include all smoothly connected faces, not just adjacent...
      return await solidModelingIpc.getConnectedSubEntities(id, face, SubEntityType.Face, { smoothFaces: true });
    } catch (err) {
      return undefined;
    }
  }

  protected override async applyAgendaOperation(ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (undefined === ev.viewport || this.agenda.isEmpty || !this.haveAcceptedSubEntities)
      return undefined;

    const faceData = this.getAcceptedSubEntityData()?.toolData as FaceLocationData;
    if (undefined === faceData)
      return undefined;

    const projPt = AccuDrawHintBuilder.projectPointToLineInView(ev.point, faceData.point, faceData.normal, ev.viewport);

    if (undefined === projPt)
      return undefined;

    const offsetDir = Vector3d.createStartEnd(faceData.point, projPt);

    if (this.useDistance && undefined === offsetDir.scaleToLength(this.distance, offsetDir))
      return undefined;

    let offset = offsetDir.magnitude();

    if (offset < Geometry.smallMetricDistance)
      return undefined;

    if (offsetDir.dotProduct(faceData.normal) < 0.0)
      offset = -offset;

    if (!this.useDistance) {
      this.distance = offset;
      this.syncToolSettingPropertyValue(this.distanceProperty);
      if (isAccept)
        this.saveToolSettingPropertyValue(this.distanceProperty, this.distanceProperty.dialogItemValue);
    }

    try {
      this._startedCmd = await this.startCommand();
      const id = this.agenda.elements[0];

      const faces = this.getAcceptedSubEntities();

      if (this.addSmooth) {
        const allSmoothFaces: SubEntityProps[] = [];

        for (const face of faces) {
          const smoothFaces = await this.getSmoothFaces(id, face);
          if (undefined !== smoothFaces)
            allSmoothFaces.push(...smoothFaces);
        }

        for (const smooth of allSmoothFaces) {
          if (undefined === faces.find((selected) => isSameSubEntity(selected, smooth)))
            faces.unshift(smooth); // Preserve last selected entry as reference face...
        }
      }

      const params: OffsetFacesProps = { faces, distances: offset };
      const opts: ElementGeometryResultOptions = {
        wantGraphic: isAccept ? undefined : true,
        chordTolerance: computeChordToleranceFromPoint(ev.viewport, ev.point),
        requestId: `${this.toolId}:${id}`,
        writeChanges: isAccept ? true : undefined,
      };
      return await solidModelingIpc.offsetFaces(id, params, opts);
    } catch (err) {
      return undefined;
    }
  }

  protected override setupAccuDraw(): void {
    if (!this.haveAcceptedSubEntities)
      return;

    const faceData = this.getAcceptedSubEntityData()?.toolData as FaceLocationData;
    if (undefined === faceData)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.setOriginFixed = true;
    hints.setLockY = true;
    hints.setLockZ = true;
    hints.setModeRectangular();
    hints.setOrigin(faceData.point);
    hints.setXAxis2(faceData.normal);
    hints.sendHints(false);
  }

  protected override getToolSettingPropertyLocked(property: DialogProperty<any>): DialogProperty<any> | undefined {
    return (property === this.useDistanceProperty ? this.distanceProperty : undefined);
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.addSmoothProperty, this.useDistanceProperty, this.distanceProperty]);

    const toolSettings = new Array<DialogItem>();

    // ensure controls are enabled/disabled based on current lock property state
    this.distanceProperty.isDisabled = !this.useDistance;
    const useDistanceLock = this.useDistanceProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 });
    toolSettings.push(this.distanceProperty.toDialogItem({ rowPriority: 1, columnIndex: 1 }, useDistanceLock));
    toolSettings.push(this.addSmoothProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new OffsetFacesTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Identify faces to offset to hollow solids. */
export class HollowFacesTool extends LocateSubEntityTool {
  public static override toolId = "HollowFaces";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  private _shellThicknessProperty: DialogProperty<number> | undefined;
  public get shellThicknessProperty() {
    if (!this._shellThicknessProperty)
      this._shellThicknessProperty = new DialogProperty<number>(new LengthDescription("hollowShellThickness", EditTools.translate("HollowFaces.Label.ShellThickness")), 0.1, undefined);
    return this._shellThicknessProperty;
  }

  public get shellThickness(): number { return this.shellThicknessProperty.value; }
  public set shellThickness(value: number) { this.shellThicknessProperty.value = value; }

  private _faceThicknessProperty: DialogProperty<number> | undefined;
  public get faceThicknessProperty() {
    if (!this._faceThicknessProperty)
      this._faceThicknessProperty = new DialogProperty<number>(new LengthDescription("hollowFaceThickness", EditTools.translate("HollowFaces.Label.FaceThickness")), 0.0, undefined);
    return this._faceThicknessProperty;
  }

  public get faceThickness(): number { return this.faceThicknessProperty.value; }
  public set faceThickness(value: number) { this.faceThicknessProperty.value = value; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: false, surfaces: false, solids: true, other: false };
  }

  protected override async applyAgendaOperation(ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (undefined === ev.viewport || this.agenda.isEmpty || !this.haveAcceptedSubEntities)
      return undefined;

    try {
      this._startedCmd = await this.startCommand();
      const params: HollowFacesProps = { faces: this.getAcceptedSubEntities(), distances: this.faceThickness, defaultDistance: this.shellThickness };
      const opts: ElementGeometryResultOptions = {
        wantGraphic: isAccept ? undefined : true,
        chordTolerance: computeChordToleranceFromPoint(ev.viewport, ev.point),
        requestId: `${this.toolId}:${this.agenda.elements[0]}`,
        writeChanges: isAccept ? true : undefined,
      };
      return await solidModelingIpc.hollowFaces(this.agenda.elements[0], params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.shellThicknessProperty, this.faceThicknessProperty]);

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.shellThicknessProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));
    toolSettings.push(this.faceThicknessProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));
    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new HollowFacesTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Identify faces or edges for removal by growing surrounding faces. */
export class DeleteSubEntitiesTool extends LocateSubEntityTool {
  public static override toolId = "DeleteSubEntities";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  protected override wantSubEntityType(type: SubEntityType): boolean {
    switch (type) {
      case SubEntityType.Face:
      case SubEntityType.Edge:
        // Choose all faces or all edges...
        return (0 === this._acceptedSubEntities.length || this._acceptedSubEntities[0].props.type === type);
      default:
        return false;
    }
  }

  protected override getMaximumSubEntityHits(type: SubEntityType): number {
    if (!this.wantSubEntityType(type))
      return 0;

    // Only return single closest edge, avoids having to test for redundant edges on reset...
    return (SubEntityType.Edge === type ? 1 : 25);
  }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: false, surfaces: true, solids: true, other: false };
  }

  protected override async doPickSubEntities(id: Id64String, ev: BeButtonEvent): Promise<SubEntityLocationProps[] | undefined> {
    const hits = await super.doPickSubEntities(id, ev);

    if (undefined === hits)
      return hits;

    // Don't allow reset to select a back edge...
    if (SubEntityType.Face === hits[0].subEntity.type)
      return hits.filter((hit) => { return SubEntityType.Face === hit.subEntity.type; });

    try {
      const accept = await solidModelingIpc.isRedundantEdge(id, hits[0].subEntity);

      if (accept)
        return hits;

      if (hits.length > 1 && SubEntityType.Face === hits[1].subEntity.type)
        return hits.slice(1); // Accept face of rejected edge...

      return undefined;
    } catch (err) {
      return undefined;
    }
  }

  protected override async applyAgendaOperation(ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (undefined === ev.viewport || this.agenda.isEmpty || !this.haveAcceptedSubEntities)
      return undefined;

    try {
      this._startedCmd = await this.startCommand();
      const params: DeleteSubEntityProps = { subEntities: this.getAcceptedSubEntities() };
      const opts: ElementGeometryResultOptions = {
        wantGraphic: isAccept ? undefined : true,
        chordTolerance: computeChordToleranceFromPoint(ev.viewport, ev.point),
        requestId: `${this.toolId}:${this.agenda.elements[0]}`,
        writeChanges: isAccept ? true : undefined,
      };
      return await solidModelingIpc.deleteSubEntities(this.agenda.elements[0], params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public async onRestartTool(): Promise<void> {
    const tool = new DeleteSubEntitiesTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha */
export enum ImprintSolidMethod {
  /** Imprint intersection with another element */
  Element = 0,
  /** Imprint offset edges onto face */
  Edges = 1,
  /** Imprint line string defined by points onto face */
  Points = 2,
}

/** @alpha Identify edges or elements to imprint on solid or surface. */
export class ImprintSolidElementsTool extends LocateSubEntityTool {
  public static override toolId = "ImprintSolids";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  protected points: Point3d[] = [];

  private static methodMessage(str: string) { return EditTools.translate(`ImprintSolids.Method.${str}`); }
  private static getMethodChoices = (): EnumerationChoice[] => {
    return [
      { label: ImprintSolidElementsTool.methodMessage("Element"), value: ImprintSolidMethod.Element },
      { label: ImprintSolidElementsTool.methodMessage("Edges"), value: ImprintSolidMethod.Edges },
      { label: ImprintSolidElementsTool.methodMessage("Points"), value: ImprintSolidMethod.Points },
    ];
  };

  private _methodProperty: DialogProperty<number> | undefined;
  public get methodProperty() {
    if (!this._methodProperty)
      this._methodProperty = new DialogProperty<number>(PropertyDescriptionHelper.buildEnumPicklistEditorDescription(
        "imprintMethod", EditTools.translate("ImprintSolids.Label.Method"), ImprintSolidElementsTool.getMethodChoices()), ImprintSolidMethod.Element as number);
    return this._methodProperty;
  }

  public get method(): ImprintSolidMethod { return this.methodProperty.value as ImprintSolidMethod; }
  public set method(method: ImprintSolidMethod) { this.methodProperty.value = method; }

  private _distanceProperty: DialogProperty<number> | undefined;
  public get distanceProperty() {
    if (!this._distanceProperty)
      this._distanceProperty = new DialogProperty<number>(new LengthDescription("imprintDistance", EditTools.translate("ImprintSolids.Label.Distance")), 0.1, undefined);
    return this._distanceProperty;
  }

  public get distance(): number { return this.distanceProperty.value; }
  public set distance(value: number) { this.distanceProperty.value = value; }

  private _extendProperty: DialogProperty<boolean> | undefined;
  public get extendProperty() {
    if (!this._extendProperty)
      this._extendProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("imprintExtend", EditTools.translate("ImprintSolids.Label.Extend")), false);
    return this._extendProperty;
  }

  public get extend(): boolean { return this.extendProperty.value; }
  public set extend(value: boolean) { this.extendProperty.value = value; }

  protected override get requiredSubEntityCount(): number { return ImprintSolidMethod.Element === this.method ? 0 : 1; }
  protected override get requiredElementCount(): number { return ImprintSolidMethod.Element === this.method ? 2 : 1; }
  protected override get allowSubEntityControlSelect(): boolean { return ImprintSolidMethod.Edges === this.method; }
  protected override get inhibitSubEntityDisplay(): boolean { return ImprintSolidMethod.Points === this.method ? false : super.inhibitSubEntityDisplay; }

  protected override wantSubEntityType(type: SubEntityType): boolean {
    switch (type) {
      case SubEntityType.Face:
        return ImprintSolidMethod.Points === this.method;
      case SubEntityType.Edge:
        return ImprintSolidMethod.Edges === this.method;
      default:
        return false;
    }
  }

  protected override get wantDynamics(): boolean { return ImprintSolidMethod.Points === this.method; }
  protected override get wantAccuSnap(): boolean { return ImprintSolidMethod.Points === this.method && this.isDynamicsStarted; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: !this.agenda.isEmpty, surfaces: true, solids: true, other: false };
  }

  protected override async onAgendaModified(): Promise<void> {
    // Filter changes to allow imprinting an open path, invalidate cached accept status...
    if (ImprintSolidMethod.Element === this.method && (this.agenda.isEmpty || 1 === this.agenda.length))
      this.onGeometryCacheFilterChanged();
  }

  protected override async createSubEntityData(id: Id64String, hit: SubEntityLocationProps): Promise<SubEntityData> {
    const data = await super.createSubEntityData(id, hit);

    if (undefined !== hit.point && undefined !== hit.normal)
      data.toolData = FaceLocationData.create(hit.point, hit.normal);

    return data;
  }

  protected override async applyAgendaOperation(_ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (!isAccept || this.agenda.length < this.requiredElementCount)
      return undefined;

    const id = this.agenda.elements[0];

    try {
      this._startedCmd = await this.startCommand();

      let params: ImprintProps;
      if (ImprintSolidMethod.Points === this.method) {
        if (!this.haveAcceptedSubEntities)
          return undefined;

        const geom = ElementGeometry.fromGeometryQuery(LineString3d.create(this.points));
        if (undefined === geom)
          return undefined;

        params = { imprint: geom, face: this.getAcceptedSubEntityData(0)?.props, extend: this.extend ? true : undefined };
      } else if (ImprintSolidMethod.Edges === this.method) {
        if (!this.haveAcceptedSubEntities)
          return undefined;

        // TODO: Include all accepted edges...
        const edge = this.getAcceptedSubEntityData(0)?.props;
        if (undefined === edge)
          return undefined;

        const edgeFaces = await solidModelingIpc.getConnectedSubEntities(id, edge, SubEntityType.Face);
        if (undefined === edgeFaces || 0 === edgeFaces.length)
          return undefined;

        // TODO: Check planar face...get preferred face from cursor location in dynamics, etc.
        const edgeLoop = await solidModelingIpc.getConnectedSubEntities(id, edge, SubEntityType.Edge, { loopFace: edgeFaces[0] });
        if (undefined === edgeLoop || 0 === edgeLoop.length)
          return undefined;

        params = { imprint: edgeLoop, face: edgeFaces[0], distance: this.distance, extend: this.extend ? true : undefined };
      } else {
        params = { imprint: this.agenda.elements[1], extend: this.extend ? true : undefined };
      }

      const opts: ElementGeometryResultOptions = { writeChanges: true };
      return await solidModelingIpc.imprintBody(id, params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public override onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (ImprintSolidMethod.Points !== this.method || 0 === this.points.length)
      return;

    const pts = this.points.slice();
    pts.push(ev.point.clone());

    const builder = context.createGraphic({ type: GraphicType.WorldOverlay });
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 3);
    builder.addLineString(pts);

    context.addGraphic(builder.finish());
  }

  protected override async gatherInput(ev: BeButtonEvent): Promise<EventHandled | undefined> {
    switch (this.method) {
      case ImprintSolidMethod.Points: {
        if (!this.haveAcceptedSubEntities)
          break;

        this.points.push(ev.point.clone());
        if (!ev.isControlKey)
          break;

        this.setupAndPromptForNextAction();
        return EventHandled.No;
      }

      default:
        break;
    }

    return super.gatherInput(ev);
  }

  protected override get wantAdditionalInput(): boolean {
    switch (this.method) {
      case ImprintSolidMethod.Element:
        return false;

      case ImprintSolidMethod.Edges:
        return super.wantAdditionalInput;

      case ImprintSolidMethod.Points:
        return super.wantAdditionalInput || this.points.length < 2;
    }
  }

  protected override setupAccuDraw(): void {
    if (ImprintSolidMethod.Points !== this.method || 0 !== this.points.length)
      return;

    if (!this.haveAcceptedSubEntities)
      return;

    const faceData = this.getAcceptedSubEntityData()?.toolData as FaceLocationData;
    if (undefined === faceData)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.setModeRectangular();
    hints.setOrigin(faceData.point);
    hints.setNormal(faceData.normal);
    hints.sendHints(false);
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    if (!this.changeToolSettingPropertyValue(updatedValue))
      return false;

    if (updatedValue.propertyName === this.methodProperty.name)
      await this.onReinitialize();

    return true;
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.methodProperty, this.extendProperty, this.distanceProperty]);

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.methodProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));

    switch (this.method) {
      case ImprintSolidMethod.Element:
        toolSettings.push(this.extendProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));
        break;
      case ImprintSolidMethod.Edges:
        toolSettings.push(this.distanceProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));
        break;
      case ImprintSolidMethod.Points:
        toolSettings.push(this.extendProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));
        break;
    }

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new ImprintSolidElementsTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Base class for tools to identify edges of solids and surfaces and apply blends. */
export abstract class BlendEdgesTool extends LocateSubEntityTool {
  private _addSmoothProperty: DialogProperty<boolean> | undefined;
  public get addSmoothProperty() {
    if (!this._addSmoothProperty)
      this._addSmoothProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("blendSmooth", EditTools.translate("RoundEdges.Label.AddSmooth")), false);
    return this._addSmoothProperty;
  }

  public get addSmooth(): boolean { return this.addSmoothProperty.value; }
  public set addSmooth(value: boolean) { this.addSmoothProperty.value = value; }

  protected override wantSubEntityType(type: SubEntityType): boolean { return SubEntityType.Edge === type; }

  protected override getSubEntityFilter(): SubEntityFilter | undefined {
    return { laminarEdges: true, smoothEdges: true };
  }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: false, surfaces: true, solids: true, other: false };
  }

  protected async getTangentEdges(id: Id64String, edge: SubEntityProps): Promise<SubEntityProps[] | undefined> {
    try {
      return await solidModelingIpc.getConnectedSubEntities(id, edge, SubEntityType.Edge, { smoothEdges: true });
    } catch (err) {
      return undefined;
    }
  }

  protected async addTangentEdges(id: Id64String, edge?: SubEntityProps, chordTolerance?: number): Promise<void> {
    if (undefined === edge) {
      this._acceptedSubEntities.forEach(async (accepted) => {
        if (undefined === accepted.toolData)
          await this.addTangentEdges(id, accepted.props, accepted.chordTolerance);
      });
      return;
    }

    const tangentEdges = await this.getTangentEdges(id, edge);
    if (undefined === tangentEdges)
      return;

    tangentEdges.forEach(async (entry) => {
      if (!isSameSubEntity(entry, edge)) {
        const data = new SubEntityData(entry);
        data.toolData = edge; // Mark edge so we know it was added as tangent edge...
        await this.createSubEntityGraphic(id, data, chordTolerance);
        this._acceptedSubEntities.push(data);
      }
    });
  }

  protected async removeTangentEdges(_id: Id64String, edge?: SubEntityProps): Promise<void> {
    if (undefined === edge) {
      this._acceptedSubEntities = this._acceptedSubEntities.filter((entry) => undefined === entry.toolData);
      return;
    }

    const edgeData = this._acceptedSubEntities.find((entry) => isSameSubEntity(entry.props, edge));
    if (undefined === edgeData)
      return undefined;

    const isTangentEdge = (other: SubEntityData): boolean => {
      const primaryOther = (undefined !== other.toolData ? other.toolData : other.props);
      return isSameSubEntity(primaryEdge, primaryOther);
    };

    const primaryEdge = (undefined !== edgeData.toolData ? edgeData.toolData : edgeData.props);
    this._acceptedSubEntities = this._acceptedSubEntities.filter((entry) => !isTangentEdge(entry));
  }

  protected async syncTangentEdges(): Promise<void> {
    const id = this.getCurrentElement();
    if (undefined === id)
      return;

    if (this.addSmooth)
      await this.addTangentEdges(id);
    else
      await this.removeTangentEdges(id);

    IModelApp.viewManager.invalidateDecorationsAllViews();
  }

  protected override async addSubEntity(id: Id64String, props: SubEntityLocationProps): Promise<void> {
    await super.addSubEntity(id, props);

    if (!this.addSmooth)
      return;

    const chordTolerance = (this.targetView ? computeChordToleranceFromPoint(this.targetView, Point3d.fromJSON(props.point)) : undefined);

    return this.addTangentEdges(id, props.subEntity, chordTolerance);
  }

  protected override async removeSubEntity(id: Id64String, props?: SubEntityLocationProps): Promise<void> {
    if (!this.addSmooth)
      return super.removeSubEntity(id, props);

    const edge = (undefined !== props) ? props.subEntity : this.getAcceptedSubEntityData()?.props;
    if (undefined === edge)
      return;

    return this.removeTangentEdges(id, edge);
  }

  protected override getAcceptedSubEntities(): SubEntityProps[] {
    const edges: SubEntityProps[] = [];
    this._acceptedSubEntities.forEach((entry) => {
      if (undefined === entry.toolData)
        edges.push(entry.props);
    });

    return edges;
  }
}

/** @alpha Identify edges of solids and surfaces to apply a rolling ball blend to. */
export class RoundEdgesTool extends BlendEdgesTool {
  public static override toolId = "RoundEdges";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  private _radiusProperty: DialogProperty<number> | undefined;
  public get radiusProperty() {
    if (!this._radiusProperty)
      this._radiusProperty = new DialogProperty<number>(new LengthDescription("roundRadius", EditTools.translate("RoundEdges.Label.Radius")), 0.1, undefined);
    return this._radiusProperty;
  }

  public get radius(): number { return this.radiusProperty.value; }
  public set radius(value: number) { this.radiusProperty.value = value; }

  protected override async applyAgendaOperation(ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (undefined === ev.viewport || this.agenda.isEmpty || !this.haveAcceptedSubEntities)
      return undefined;

    try {
      this._startedCmd = await this.startCommand();
      const params: BlendEdgesProps = { edges: this.getAcceptedSubEntities(), radii: this.radius, propagateSmooth: this.addSmooth };
      const opts: ElementGeometryResultOptions = {
        wantGraphic: isAccept ? undefined : true,
        chordTolerance: computeChordToleranceFromPoint(ev.viewport, ev.point),
        requestId: `${this.toolId}:${this.agenda.elements[0]}`,
        writeChanges: isAccept ? true : undefined,
      };
      return await solidModelingIpc.blendEdges(this.agenda.elements[0], params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    if (!this.changeToolSettingPropertyValue(updatedValue))
      return false;

    if (updatedValue.propertyName === this.addSmoothProperty.name)
      await this.syncTangentEdges();

    return true;
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.radiusProperty, this.addSmoothProperty]);

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.radiusProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));
    toolSettings.push(this.addSmoothProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));
    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new RoundEdgesTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Identify edges of solids and surfaces to apply a rolling ball blend to. */
export class ChamferEdgesTool extends BlendEdgesTool {
  public static override toolId = "ChamferEdges";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  private static methodMessage(str: string) { return EditTools.translate(`ChamferEdges.Method.${str}`); }
  private static getMethodChoices = (): EnumerationChoice[] => {
    return [
      { label: ChamferEdgesTool.methodMessage("Length"), value: ChamferMode.Length },
      { label: ChamferEdgesTool.methodMessage("Distances"), value: ChamferMode.Distances },
      { label: ChamferEdgesTool.methodMessage("DistanceAngle"), value: ChamferMode.DistanceAngle },
      { label: ChamferEdgesTool.methodMessage("AngleDistance"), value: ChamferMode.AngleDistance },
    ];
  };

  private _methodProperty: DialogProperty<number> | undefined;
  public get methodProperty() {
    if (!this._methodProperty)
      this._methodProperty = new DialogProperty<number>(PropertyDescriptionHelper.buildEnumPicklistEditorDescription(
        "chamferMethod", EditTools.translate("ChamferEdges.Label.Method"), ChamferEdgesTool.getMethodChoices()), ChamferMode.Length as number);
    return this._methodProperty;
  }

  public get method(): ChamferMode { return this.methodProperty.value as ChamferMode; }
  public set method(method: ChamferMode) { this.methodProperty.value = method; }

  private _lengthProperty: DialogProperty<number> | undefined;
  public get lengthProperty() {
    if (!this._lengthProperty)
      this._lengthProperty = new DialogProperty<number>(new LengthDescription("chamferLength", EditTools.translate("ChamferEdges.Label.Length")), 0.1, undefined);
    return this._lengthProperty;
  }

  public get length(): number { return this.lengthProperty.value; }
  public set length(value: number) { this.lengthProperty.value = value; }

  private _distanceLeftProperty: DialogProperty<number> | undefined;
  public get distanceLeftProperty() {
    if (!this._distanceLeftProperty)
      this._distanceLeftProperty = new DialogProperty<number>(new LengthDescription("chamferLeftDist", EditTools.translate("ChamferEdges.Label.LeftDistance")), 0.1, undefined);
    return this._distanceLeftProperty;
  }

  public get distanceLeft(): number { return this.distanceLeftProperty.value; }
  public set distanceLeft(value: number) { this.distanceLeftProperty.value = value; }

  private _distanceRightProperty: DialogProperty<number> | undefined;
  public get distanceRightProperty() {
    if (!this._distanceRightProperty)
      this._distanceRightProperty = new DialogProperty<number>(new LengthDescription("chamferRightDist", EditTools.translate("ChamferEdges.Label.RightDistance")), 0.1, undefined);
    return this._distanceRightProperty;
  }

  public get distanceRight(): number { return this.distanceRightProperty.value; }
  public set distanceRight(value: number) { this.distanceRightProperty.value = value; }

  private _angleProperty: DialogProperty<number> | undefined;
  public get angleProperty() {
    if (!this._angleProperty)
      this._angleProperty = new DialogProperty<number>(new AngleDescription("chamferAngle", EditTools.translate("ChamferEdges.Label.Angle")), Angle.piOver4Radians, undefined, false);
    return this._angleProperty;
  }

  public get angle(): number { return this.angleProperty.value; }
  public set angle(value: number) { this.angleProperty.value = value; }

  protected override async applyAgendaOperation(ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (undefined === ev.viewport || this.agenda.isEmpty || !this.haveAcceptedSubEntities)
      return undefined;

    try {
      this._startedCmd = await this.startCommand();

      let values1;
      let values2;

      switch (this.method) {
        case ChamferMode.Length:
          values1 = this.length;
          break;
        case ChamferMode.Distances:
          values1 = this.distanceLeft;
          values2 = this.distanceRight;
          break;
        case ChamferMode.DistanceAngle:
          values1 = this.distanceLeft;
          values2 = this.angle;
          break;
        case ChamferMode.AngleDistance:
          values1 = this.angle;
          values2 = this.distanceRight;
          break;
        default:
          return undefined;
      }

      const params: ChamferEdgesProps = { edges: this.getAcceptedSubEntities(), mode: this.method, values1, values2, propagateSmooth: this.addSmooth };
      const opts: ElementGeometryResultOptions = {
        wantGraphic: isAccept ? undefined : true,
        chordTolerance: computeChordToleranceFromPoint(ev.viewport, ev.point),
        requestId: `${this.toolId}:${this.agenda.elements[0]}`,
        writeChanges: isAccept ? true : undefined,
      };
      return await solidModelingIpc.chamferEdges(this.agenda.elements[0], params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    if (!this.changeToolSettingPropertyValue(updatedValue))
      return false;

    if (updatedValue.propertyName === this.methodProperty.name)
      await this.onReinitialize();

    return true;
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.methodProperty, this.addSmoothProperty, this.lengthProperty, this.distanceLeftProperty, this.distanceRightProperty, this.angleProperty]);

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.methodProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));
    toolSettings.push(this.addSmoothProperty.toDialogItem({ rowPriority: ChamferMode.Length === this.method ? 3 : 4, columnIndex: 0 }));

    switch (this.method) {
      case ChamferMode.Length:
        toolSettings.push(this.lengthProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));
        break;
      case ChamferMode.Distances:
        toolSettings.push(this.distanceLeftProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));
        toolSettings.push(this.distanceRightProperty.toDialogItem({ rowPriority: 3, columnIndex: 0 }));
        break;
      case ChamferMode.DistanceAngle:
        toolSettings.push(this.distanceLeftProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));
        toolSettings.push(this.angleProperty.toDialogItem({ rowPriority: 3, columnIndex: 0 }));
        break;
      case ChamferMode.AngleDistance:
        toolSettings.push(this.distanceRightProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));
        toolSettings.push(this.angleProperty.toDialogItem({ rowPriority: 3, columnIndex: 0 }));
        break;
    }

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new ChamferEdgesTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha */
export class ProfileLocationData {
  public point: Point3d;
  public orientation: Vector3d | Matrix3d;

  constructor(point: Point3d, orientation: Vector3d | Matrix3d) {
    this.point = point;
    this.orientation = orientation;
  }
}

/** @alpha Base class for picking profiles (open paths and regions) or faces of solids. */
export abstract class LocateFaceOrProfileTool extends LocateSubEntityTool {
  protected override get wantGeometrySummary(): boolean { return true; }

  protected override wantSubEntityType(type: SubEntityType): boolean {
    switch (type) {
      case SubEntityType.Face:
      case SubEntityType.Edge:
        // Choose all faces or all edges...
        return (0 === this._acceptedSubEntities.length || this._acceptedSubEntities[0].props.type === type);
      default:
        return false;
    }
  }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: true, surfaces: true, solids: true, other: false };
  }

  protected override async doPickSubEntities(id: Id64String, ev: BeButtonEvent): Promise<SubEntityLocationProps[] | undefined> {
    const hits = await super.doPickSubEntities(id, ev);

    if (undefined === hits)
      return hits;

    // Only want edges from wire bodies...
    const accept = (BRepEntityType.Wire === this.getBRepEntityTypeForSubEntity(id, hits[0].subEntity) ? SubEntityType.Edge : SubEntityType.Face);
    return hits.filter((hit) => accept === hit.subEntity.type);
  }

  protected override async createSubEntityData(id: Id64String, hit: SubEntityLocationProps): Promise<SubEntityData> {
    const data = await super.createSubEntityData(id, hit);

    // Prefer orientation from snap to take entire path curve as well as placement z into account...
    const snap = TentativeOrAccuSnap.getCurrentSnap(false);
    const point = (id === snap?.sourceId && snap.isHot ? snap.snapPoint : Point3d.fromJSON(hit.point));
    const matrix = (id === snap?.sourceId ? AccuDraw.getSnapRotation(snap, undefined) : undefined);
    const invMatrix = matrix?.inverse(); // getSnapRotation returns row matrix...

    if (undefined !== invMatrix)
      data.toolData = new ProfileLocationData(point, invMatrix);
    else
      data.toolData = new ProfileLocationData(point, undefined !== hit.normal ? Vector3d.fromJSON(hit.normal) : Vector3d.unitZ());

    return data;
  }

  protected override drawSubEntity(context: DecorateContext, subEntity: SubEntityData, accepted: boolean): void {
    const id = this.getCurrentElement();
    if (undefined !== id && BRepEntityType.Solid !== this.getBRepEntityTypeForSubEntity(id, subEntity.props))
      return; // Operation will be applied to wire or sheet body, don't display sub-entity...
    super.drawSubEntity(context, subEntity, accepted);
  }

  protected override drawAcceptedSubEntities(context: DecorateContext): void {
    super.drawAcceptedSubEntities(context);

    // Show pick point on last identified face...
    const profileData = this.getAcceptedSubEntityData()?.toolData as ProfileLocationData;
    if (undefined === profileData)
      return;

    const builder = context.createGraphic({ type: GraphicType.WorldOverlay });
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 10);
    builder.addPointString([profileData.point]);

    context.addDecorationFromBuilder(builder);
  }
}

/** @alpha Identify faces of solids and surfaces to translate. */
export class SweepFacesTool extends LocateFaceOrProfileTool {
  public static override toolId = "SweepFaces";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  protected override get wantDynamics(): boolean { return true; }
  protected override get wantAccuSnap(): boolean { return true; }
  protected override get wantSubEntitySnap(): boolean { return true; }

  private _addSmoothProperty: DialogProperty<boolean> | undefined;
  public get addSmoothProperty() {
    if (!this._addSmoothProperty)
      this._addSmoothProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("sweepSmooth", EditTools.translate("SweepFaces.Label.AddSmooth")), false);
    return this._addSmoothProperty;
  }

  public get addSmooth(): boolean { return this.addSmoothProperty.value; }
  public set addSmooth(value: boolean) { this.addSmoothProperty.value = value; }

  private _useDistanceProperty: DialogProperty<boolean> | undefined;
  public get useDistanceProperty() {
    if (!this._useDistanceProperty)
      this._useDistanceProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useOffsetDistance"), false);
    return this._useDistanceProperty;
  }

  public get useDistance(): boolean { return this.useDistanceProperty.value; }
  public set useDistance(value: boolean) { this.useDistanceProperty.value = value; }

  private _distanceProperty: DialogProperty<number> | undefined;
  public get distanceProperty() {
    if (!this._distanceProperty)
      this._distanceProperty = new DialogProperty<number>(new LengthDescription("sweepDistance", EditTools.translate("SweepFaces.Label.Distance")), 0.1, undefined, !this.useDistance);
    return this._distanceProperty;
  }

  public get distance(): number { return this.distanceProperty.value; }
  public set distance(value: number) { this.distanceProperty.value = value; }

  protected async getSmoothFaces(id: Id64String, face: SubEntityProps): Promise<SubEntityProps[] | undefined> {
    try {
      // NOTE: For sweep/translation, it makes sense to limit smooth to immediately adjacent...
      return await solidModelingIpc.getConnectedSubEntities(id, face, SubEntityType.Face, { smoothFaces: true, adjacentFaces: true });
    } catch (err) {
      return undefined;
    }
  }

  protected override async applyAgendaOperation(ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (undefined === ev.viewport || this.agenda.isEmpty || !this.haveAcceptedSubEntities)
      return undefined;

    const profileData = this.getAcceptedSubEntityData()?.toolData as ProfileLocationData;
    if (undefined === profileData)
      return undefined;

    const path = Vector3d.createStartEnd(profileData.point, ev.point);

    if (this.useDistance && undefined === path.scaleToLength(this.distance, path))
      return undefined;

    if (path.magnitude() < Geometry.smallMetricDistance)
      return undefined;

    if (!this.useDistance) {
      this.distance = path.magnitude();
      this.syncToolSettingPropertyValue(this.distanceProperty);
      if (isAccept)
        this.saveToolSettingPropertyValue(this.distanceProperty, this.distanceProperty.dialogItemValue);
    }

    try {
      this._startedCmd = await this.startCommand();
      const id = this.agenda.elements[0];

      const opts: ElementGeometryResultOptions = {
        wantGraphic: isAccept ? undefined : true,
        chordTolerance: computeChordToleranceFromPoint(ev.viewport, ev.point),
        requestId: `${this.toolId}:${id}`,
        writeChanges: isAccept ? true : undefined,
      };

      const subEntities = this.getAcceptedSubEntities();
      const params: SweepFacesProps = { path };

      if (SubEntityType.Edge === subEntities[0].type || BRepEntityType.Solid !== this.getBRepEntityTypeForSubEntity(id, subEntities[0])) {
        return await solidModelingIpc.sweepFaces(id, params, opts);
      }

      if (this.addSmooth) {
        const allSmoothFaces: SubEntityProps[] = [];

        for (const face of subEntities) {
          const smoothFaces = await this.getSmoothFaces(id, face);
          if (undefined !== smoothFaces)
            allSmoothFaces.push(...smoothFaces);
        }

        for (const smooth of allSmoothFaces) {
          if (undefined === subEntities.find((selected) => isSameSubEntity(selected, smooth)))
            subEntities.unshift(smooth); // Preserve last selected entry as reference face...
        }
      }

      params.faces = subEntities;
      return await solidModelingIpc.sweepFaces(id, params, opts);
    } catch (err) {
      return undefined;
    }
  }

  protected override setupAccuDraw(): void {
    if (!this.haveAcceptedSubEntities)
      return;

    const profileData = this.getAcceptedSubEntityData()?.toolData as ProfileLocationData;
    if (undefined === profileData)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.setOriginFixed = true;
    hints.setLockY = true;
    hints.setLockZ = true;
    hints.setModeRectangular();
    hints.setOrigin(profileData.point);
    hints.setXAxis2(profileData.orientation instanceof Matrix3d ? profileData.orientation.getColumn(2) : profileData.orientation);
    hints.sendHints(false);
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.addSmoothProperty, this.useDistanceProperty, this.distanceProperty]);

    const toolSettings = new Array<DialogItem>();

    // ensure controls are enabled/disabled based on current lock property state
    this.distanceProperty.isDisabled = !this.useDistance;
    const useDistanceLock = this.useDistanceProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 });
    toolSettings.push(this.distanceProperty.toDialogItem({ rowPriority: 1, columnIndex: 1 }, useDistanceLock));
    toolSettings.push(this.addSmoothProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new SweepFacesTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Identify faces of solids and surfaces to revolve. */
export class SpinFacesTool extends LocateFaceOrProfileTool {
  public static override toolId = "SpinFaces";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  protected points: Point3d[] = [];

  private _angleProperty: DialogProperty<number> | undefined;
  public get angleProperty() {
    if (!this._angleProperty)
      this._angleProperty = new DialogProperty<number>(new AngleDescription("spinAngle", EditTools.translate("SpinFaces.Label.Angle")), Angle.piOver2Radians, undefined, false);
    return this._angleProperty;
  }

  public get angle(): number { return this.angleProperty.value; }
  public set angle(value: number) { this.angleProperty.value = value; }

  protected override get wantDynamics(): boolean { return true; }
  protected override get wantAccuSnap(): boolean { return true; }
  protected override get wantSubEntitySnap(): boolean { return true; }

  protected override async applyAgendaOperation(ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (undefined === ev.viewport || this.agenda.isEmpty || !this.haveAcceptedSubEntities || this.points.length < (isAccept ? 2 : 1))
      return undefined;

    const direction = Vector3d.createStartEnd(this.points[0], isAccept ? this.points[1] : ev.point);
    if (direction.magnitude() < Geometry.smallMetricDistance)
      return undefined;

    const origin = this.points[0];
    const angle = Angle.createRadians(this.angle);

    try {
      this._startedCmd = await this.startCommand();
      const id = this.agenda.elements[0];

      const opts: ElementGeometryResultOptions = {
        wantGraphic: isAccept ? undefined : true,
        chordTolerance: computeChordToleranceFromPoint(ev.viewport, ev.point),
        requestId: `${this.toolId}:${id}`,
        writeChanges: isAccept ? true : undefined,
      };

      const subEntities = this.getAcceptedSubEntities();
      const params: SpinFacesProps = { origin, direction, angle };

      if (SubEntityType.Edge === subEntities[0].type || BRepEntityType.Solid !== this.getBRepEntityTypeForSubEntity(id, subEntities[0])) {
        return await solidModelingIpc.spinFaces(id, params, opts);
      }

      params.faces = subEntities;
      let result = await solidModelingIpc.spinFaces(id, params, opts);

      // Spun face can be used to create a pocket...retry with negative sweep...
      if (undefined === result) {
        angle.setRadians(-angle.radians);
        result = await solidModelingIpc.spinFaces(id, params, opts);
      }

      return result;
    } catch (err) {
      return undefined;
    }
  }

  public override onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (0 === this.points.length)
      return;

    const pts = this.points.slice();
    pts.push(ev.point.clone());

    const builder = context.createGraphic({ type: GraphicType.WorldOverlay });
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 3);
    builder.addLineString(pts);

    context.addGraphic(builder.finish());

    super.onDynamicFrame(ev, context);
  }

  protected override async gatherInput(ev: BeButtonEvent): Promise<EventHandled | undefined> {
    if (!this.wantAdditionalSubEntities)
      this.points.push(ev.point.clone());

    return super.gatherInput(ev);
  }

  protected override get wantAdditionalInput(): boolean {
    return super.wantAdditionalInput || this.points.length < 2;
  }

  protected override setupAccuDraw(): void {
    if (!this.haveAcceptedSubEntities || 0 !== this.points.length)
      return;

    const profileData = this.getAcceptedSubEntityData()?.toolData as ProfileLocationData;
    if (undefined === profileData)
      return;

    const hints = new AccuDrawHintBuilder();

    hints.setModeRectangular();
    hints.setOrigin(profileData.point);

    if (profileData.orientation instanceof Matrix3d)
      hints.setMatrix(profileData.orientation);
    else
      hints.setNormal(profileData.orientation);

    hints.sendHints(false);
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.angleProperty]);

    const toolSettings = new Array<DialogItem>();
    toolSettings.push(this.angleProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));
    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new SpinFacesTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

