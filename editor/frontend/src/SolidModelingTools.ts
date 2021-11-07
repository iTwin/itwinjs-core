/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { Id64Array, Id64String } from "@itwin/core-bentley";
import { BooleanMode, BooleanOperationProps, CutDepthMode, CutDirectionMode, CutProps, ElementGeometryCacheFilter, ElementGeometryResultOptions, ElementGeometryResultProps, EmbossDirectionMode, EmbossProps, HollowFacesProps, ImprintProps, LoftProps, OffsetFacesProps, ProfileClosure, SewSheetProps, SubEntityType, SweepPathProps } from "@itwin/editor-common";
import { ColorDef, ElementGeometry } from "@itwin/core-common";
import { Geometry, LineString3d, Point3d, Vector3d } from "@itwin/core-geometry";
import { AccuDrawHintBuilder, BeButtonEvent, DynamicsContext, EventHandled, GraphicType, HitDetail } from "@itwin/core-frontend";
import { computeChordToleranceFromPoint } from "./CreateElementTool";
import { ElementGeometryCacheTool, LocateSubEntityTool } from "./ElementGeometryTool";

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

/** @alpha Perform cut operation on solid using region or path profile. */
export class CutSolidElementsTool extends ElementGeometryCacheTool {
  public static override toolId = "CutSolids";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...
  protected targetPoint?: Point3d;
  protected toolPoint?: Point3d;

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

    // TODO: Tool settings for both directions, blind cut depth, and outside...
    const bothDirections = false;
    const distance = 0.0;
    const outside = undefined;

    const direction = (bothDirections ? CutDirectionMode.Both : CutDirectionMode.Auto);
    const depth = (0.0 === distance ? CutDepthMode.All : CutDepthMode.Blind);

    try {
      this._startedCmd = await this.startCommand();
      const target = this.agenda.elements[0];
      const profile = this.agenda.elements[1];
      const params: CutProps = { profile, direction, depth, distance, outside, closeOpen: ProfileClosure.Auto, targetPoint: this.targetPoint, toolPoint: this.toolPoint };
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

/** @alpha Identify faces of solids and surfaces to offset. */
export class OffsetFacesTool extends LocateSubEntityTool {
  public static override toolId = "OffsetFaces";
  public static override iconSpec = "icon-move"; // TODO: Need better icon...

  protected override get wantDynamics(): boolean { return true; }
  protected override get wantAccuSnap(): boolean { return undefined !== this._acceptedSubEntity; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: false, surfaces: true, solids: true, other: false };
  }

  protected override async applyAgendaOperation(ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
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

  protected override setupAccuDraw(): void {
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

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: false, surfaces: false, solids: true, other: false };
  }

  protected override async applyAgendaOperation(ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (undefined === ev.viewport || this.agenda.isEmpty || undefined === this._acceptedSubEntity)
      return undefined;

    // TODO: Tool settings for shell thickness and face thickness...
    const shellThickness = 0.1;
    const faceThickness = 0.0;

    try {
      this._startedCmd = await this.startCommand();
      const params: HollowFacesProps = { faces: this._acceptedSubEntity.subEntity, distances: faceThickness, defaultDistance: shellThickness };
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

  protected method = ImprintSolidMethod.Points;
  protected points: Point3d[] = [];

  protected override get requiredElementCount(): number { return ImprintSolidMethod.Element === this.method ? 2 : 1; }

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

  protected override get wantAccuSnap(): boolean { return ImprintSolidMethod.Points === this.method && undefined !== this._acceptedSubEntity; }
  protected override get wantDynamics(): boolean { return ImprintSolidMethod.Points === this.method && undefined !== this._acceptedSubEntity; }

  protected override get geometryCacheFilter(): ElementGeometryCacheFilter | undefined {
    return { parts: true, curves: !this.agenda.isEmpty, surfaces: true, solids: true, other: false };
  }

  protected override async onAgendaModified(): Promise<void> {
    // Filter changes to allow imprinting an open path, invalidate cached accept status...
    if (ImprintSolidMethod.Element === this.method && (this.agenda.isEmpty || 1 === this.agenda.length))
      this.onGeometryCacheFilterChanged();
  }

  protected override async applyAgendaOperation(_ev: BeButtonEvent, isAccept: boolean): Promise<ElementGeometryResultProps | undefined> {
    if (!isAccept || this.agenda.length < this.requiredElementCount)
      return undefined;

    // TODO: Tool settings for method, propagate smooth for edges, offset distance...
    const id = this.agenda.elements[0];
    const extend = true;
    const distance = 0.1;

    try {
      this._startedCmd = await this.startCommand();

      let params: ImprintProps;
      if (ImprintSolidMethod.Points === this.method) {
        if (undefined === this._acceptedSubEntity)
          return undefined;

        const geom = ElementGeometry.fromGeometryQuery(LineString3d.create(this.points));
        if (undefined === geom)
          return undefined;

        params = { imprint : geom, face: this._acceptedSubEntity.subEntity, extend };
      } else if (ImprintSolidMethod.Edges === this.method) {
        if (undefined === this._acceptedSubEntity)
          return undefined;

        const edgeFaces = await ElementGeometryCacheTool.callCommand("getConnectedSubEntities", id, this._acceptedSubEntity.subEntity, SubEntityType.Face );
        if (undefined === edgeFaces || 0 === edgeFaces.length)
          return undefined;

        // TODO: Check planar face...get preferred face from cursor location in dynamics, etc.
        const edgeLoop = await ElementGeometryCacheTool.callCommand("getConnectedSubEntities", id, this._acceptedSubEntity.subEntity, SubEntityType.Edge, { loopFace: edgeFaces[0] } );
        if (undefined === edgeLoop || 0 === edgeLoop.length)
          return undefined;

        params = { imprint : edgeLoop, face: edgeFaces[0], distance, extend };
      } else {
        params = { imprint : this.agenda.elements[1], extend };
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
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 2);
    builder.addLineString(pts);

    context.addGraphic(builder.finish());
  }

  protected override async gatherInput(ev: BeButtonEvent): Promise<EventHandled | undefined> {
    switch (this.method) {
      case ImprintSolidMethod.Points: {
        if (undefined === this._acceptedSubEntity)
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

    if (undefined === this._acceptedSubEntity?.point || undefined === this._acceptedSubEntity?.normal)
      return;

    const facePt = Point3d.fromJSON(this._acceptedSubEntity.point);
    const faceNormal = Vector3d.fromJSON(this._acceptedSubEntity.normal);

    const hints = new AccuDrawHintBuilder();
    hints.setModeRectangular();
    hints.setOrigin(facePt);
    hints.setNormal(faceNormal);
    hints.sendHints();
  }

  public async onRestartTool(): Promise<void> {
    const tool = new ImprintSolidElementsTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

