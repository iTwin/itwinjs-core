/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { Id64Array, Id64String } from "@itwin/core-bentley";
import { BlendEdgesProps, BooleanMode, BooleanOperationProps, ChamferEdgesProps, ChamferMode, CutDepthMode, CutDirectionMode, CutProps, ElementGeometryCacheFilter, ElementGeometryResultOptions, ElementGeometryResultProps, EmbossDirectionMode, EmbossProps, HollowFacesProps, ImprintProps, LoftProps, OffsetFacesProps, ProfileClosure, SewSheetProps, SubEntityFilter, SubEntityLocationProps, SubEntityProps, SubEntityType, SweepPathProps, ThickenSheetProps } from "@itwin/editor-common";
import { ColorDef, ElementGeometry } from "@itwin/core-common";
import { Geometry, LineString3d, Point3d, Vector3d, XYZProps } from "@itwin/core-geometry";
import { AccuDrawHintBuilder, BeButtonEvent, DecorateContext, DynamicsContext, EventHandled, GraphicType, HitDetail } from "@itwin/core-frontend";
import { computeChordToleranceFromPoint } from "./CreateElementTool";
import { ElementGeometryCacheTool, isSameSubEntity, LocateSubEntityTool, SubEntityData } from "./ElementGeometryTool";

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
      return await ElementGeometryCacheTool.callCommand("booleanOperation", target, params, opts);
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
      return await ElementGeometryCacheTool.callCommand("sewSheets", target, params, opts);
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

  // TODO: Tool settings for front and back distances...
  protected frontDistance = 0.5;
  protected backDistance = 0.0;

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
      return await ElementGeometryCacheTool.callCommand("thickenSheets", target, params, opts);
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

  // TODO: Tool settings for both directions, blind cut depth, and outside...
  protected bothDirections = false;
  protected distance = 0.0;
  protected outside = undefined;

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
      return await ElementGeometryCacheTool.callCommand("isPlanarBody", id, 0);
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
    const depth = (0.0 === this.distance ? CutDepthMode.All : CutDepthMode.Blind);

    try {
      this._startedCmd = await this.startCommand();
      const target = this.agenda.elements[0];
      const profile = this.agenda.elements[1];
      const params: CutProps = { profile, direction, depth, distance: this.distance, outside: this.outside, closeOpen: ProfileClosure.Auto, targetPoint: this.targetPoint, toolPoint: this.toolPoint };
      const opts: ElementGeometryResultOptions = { writeChanges: true };
      return await ElementGeometryCacheTool.callCommand("cutSolid", target, params, opts);
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
      return await ElementGeometryCacheTool.callCommand("embossBody", target, params, opts);
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
      return await ElementGeometryCacheTool.callCommand("sweepAlongPath", target, params, opts);
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
      return await ElementGeometryCacheTool.callCommand("loftProfiles", target, params, opts);
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
    let offset = offsetDir.magnitude();

    if (offset < Geometry.smallMetricDistance)
      return undefined;

    if (offsetDir.dotProduct(faceData.normal) < 0.0)
      offset = -offset;

    try {
      this._startedCmd = await this.startCommand();
      const params: OffsetFacesProps = { faces: this.getAcceptedSubEntities(), distances: offset };
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

  // TODO: Tool settings for shell thickness and face thickness...
  protected shellThickness = 0.1;
  protected faceThickness = 0.0;

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
      return await ElementGeometryCacheTool.callCommand("hollowFaces", this.agenda.elements[0], params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public async onRestartTool(): Promise<void> {
    const tool = new HollowFacesTool();
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

  // TODO: Tool settings for method, propagate for edges, offset distance...
  protected method = ImprintSolidMethod.Points;
  protected points: Point3d[] = [];
  protected extend = true;
  protected distance = 0.1;

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

        params = { imprint : geom, face: this.getAcceptedSubEntityData(0)?.props, extend: this.extend ? true : undefined };
      } else if (ImprintSolidMethod.Edges === this.method) {
        if (!this.haveAcceptedSubEntities)
          return undefined;

        // TODO: Include all accepted edges...
        const edge = this.getAcceptedSubEntityData(0)?.props;
        if (undefined === edge)
          return undefined;

        const edgeFaces = await ElementGeometryCacheTool.callCommand("getConnectedSubEntities", id, edge, SubEntityType.Face );
        if (undefined === edgeFaces || 0 === edgeFaces.length)
          return undefined;

        // TODO: Check planar face...get preferred face from cursor location in dynamics, etc.
        const edgeLoop = await ElementGeometryCacheTool.callCommand("getConnectedSubEntities", id, edge, SubEntityType.Edge, { loopFace: edgeFaces[0] } );
        if (undefined === edgeLoop || 0 === edgeLoop.length)
          return undefined;

        params = { imprint : edgeLoop, face: edgeFaces[0], distance: this.distance, extend: this.extend ? true : undefined };
      } else {
        params = { imprint : this.agenda.elements[1], extend: this.extend ? true : undefined };
      }

      const opts: ElementGeometryResultOptions = { writeChanges: true };
      return await ElementGeometryCacheTool.callCommand("imprintBody", id, params, opts);
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

  public async onRestartTool(): Promise<void> {
    const tool = new ImprintSolidElementsTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Identify edges of solids and surfaces to apply blend to. */
export abstract class BlendEdgesTool extends LocateSubEntityTool {
  // TODO: Tool settings for tangent edge propagation...
  protected propagateSmooth = true;

  protected override wantSubEntityType(type: SubEntityType): boolean { return SubEntityType.Edge === type; }

  protected override getSubEntityFilter(): SubEntityFilter | undefined {
    return { laminarEdges: true, smoothEdges: true };
  }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: false, surfaces: true, solids: true, other: false };
  }

  protected async getTangentEdges(id: Id64String, edge: SubEntityProps): Promise<SubEntityProps[] | undefined> {
    try {
      return await ElementGeometryCacheTool.callCommand("getConnectedSubEntities", id, edge, SubEntityType.Edge, { smoothEdges: true });
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
      this._acceptedSubEntities = this._acceptedSubEntities.filter((entry) => undefined === entry.toolData );
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

  protected override async addSubEntity(id: Id64String, props: SubEntityLocationProps): Promise<void> {
    await super.addSubEntity(id, props);

    if (!this.propagateSmooth)
      return;

    const chordTolerance = (this.targetView ? computeChordToleranceFromPoint(this.targetView, Point3d.fromJSON(props.point)) : undefined);

    return this.addTangentEdges(id, props.subEntity, chordTolerance);
  }

  protected override async removeSubEntity(id: Id64String, props?: SubEntityLocationProps): Promise<void> {
    if (!this.propagateSmooth)
      return super.removeSubEntity(id, props);

    const edge = (undefined !== props) ? props.subEntity : this.getAcceptedSubEntityData()?.props;
    if (undefined === edge)
      return;

    return this.removeTangentEdges(id, edge);
  }

  protected override getAcceptedSubEntities(): SubEntityProps[] {
    const edges: SubEntityProps[] = [];
    this._acceptedSubEntities.forEach((entry) => { if (undefined === entry.toolData) edges.push(entry.props); });
    return edges;
  }
}

/** @alpha Identify edges of solids and surfaces to apply a rolling ball blend to. */
export class RoundEdgesTool extends BlendEdgesTool {
  public static override toolId = "RoundEdges";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  // TODO: Tool settings for blend radius...
  protected radius = 0.5;

  protected override async applyAgendaOperation(ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (undefined === ev.viewport || this.agenda.isEmpty || !this.haveAcceptedSubEntities)
      return undefined;

    try {
      this._startedCmd = await this.startCommand();
      const params: BlendEdgesProps = { edges: this.getAcceptedSubEntities(), radii: this.radius, propagateSmooth: this.propagateSmooth };
      const opts: ElementGeometryResultOptions = {
        wantGraphic: isAccept ? undefined : true,
        chordTolerance: computeChordToleranceFromPoint(ev.viewport, ev.point),
        requestId: `${this.toolId}:${this.agenda.elements[0]}`,
        writeChanges: isAccept ? true : undefined,
      };
      return await ElementGeometryCacheTool.callCommand("blendEdges", this.agenda.elements[0], params, opts);
    } catch (err) {
      return undefined;
    }
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

  // TODO: Tool settings for chamfer length, distances, distance + angle...
  protected mode = ChamferMode.Length;
  protected length = 0.5;

  protected override async applyAgendaOperation(ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (undefined === ev.viewport || this.agenda.isEmpty || !this.haveAcceptedSubEntities)
      return undefined;

    try {
      this._startedCmd = await this.startCommand();
      const params: ChamferEdgesProps = { edges: this.getAcceptedSubEntities(), mode: this.mode, values1: this.length, propagateSmooth: this.propagateSmooth };
      const opts: ElementGeometryResultOptions = {
        wantGraphic: isAccept ? undefined : true,
        chordTolerance: computeChordToleranceFromPoint(ev.viewport, ev.point),
        requestId: `${this.toolId}:${this.agenda.elements[0]}`,
        writeChanges: isAccept ? true : undefined,
      };
      return await ElementGeometryCacheTool.callCommand("chamferEdges", this.agenda.elements[0], params, opts);
    } catch (err) {
      return undefined;
    }
  }

  public async onRestartTool(): Promise<void> {
    const tool = new ChamferEdgesTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

