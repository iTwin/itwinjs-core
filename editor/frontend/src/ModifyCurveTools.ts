/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DialogItem, DialogProperty, DialogPropertySyncItem, EnumerationChoice, PropertyDescriptionHelper } from "@itwin/appui-abstract";
import { CompressedId64Set, Id64String } from "@itwin/core-bentley";
import {
  BentleyError, Code, ElementGeometry, ElementGeometryInfo, ElementGeometryOpcode, FlatBufferGeometryStream, GeometricElementProps,
  GeometryParams, JsonGeometryStream,
} from "@itwin/core-common";
import {
  AccuDrawHintBuilder, BeButtonEvent, IModelApp,
  LengthDescription, NotifyMessageDetails, OutputMessagePriority, ToolAssistanceInstruction,
} from "@itwin/core-frontend";
import {
  AngleSweep, AnyRegion, Arc3d, AxisOrder, CurveChainWithDistanceIndex, CurveCollection, CurveLocationDetail, CurvePrimitive, FrameBuilder, Geometry, GeometryQuery, JointOptions, LineSegment3d, LineString3d, Loop, Matrix3d,
  Path, Plane3dByOriginAndUnitNormal, Point3d, RegionBinaryOpType, RegionOps, SignedLoops, UnionRegion, Vector3d,
} from "@itwin/core-geometry";
import { editorBuiltInCmdIds } from "@itwin/editor-common";
import { EditTools } from "./EditTool";
import { basicManipulationIpc } from "./EditToolIpc";
import { ModifyElementWithDynamicsTool } from "./ModifyElementTool";

/** @alpha */
export class CurveData {
  public props: GeometricElementProps;
  public params: GeometryParams;
  public geom: CurveCollection | CurvePrimitive;

  constructor(props: GeometricElementProps, params: GeometryParams, geom: CurveCollection | CurvePrimitive) {
    this.props = props;
    this.params = params;
    this.geom = geom;
  }
}

/** @alpha Base class for modifying all types of curve geometry. */
export abstract class ModifyCurveTool extends ModifyElementWithDynamicsTool {
  protected _startedCmd?: string;
  protected curveData?: CurveData;

  protected async startCommand(): Promise<string> {
    if (undefined !== this._startedCmd)
      return this._startedCmd;
    return EditTools.startCommand<string>({ commandId: editorBuiltInCmdIds.cmdBasicManipulation, iModelKey: this.iModel.key });
  }

  public static isSingleCurve(info: ElementGeometryInfo): { curve: CurveCollection | CurvePrimitive, params: GeometryParams } | undefined {
    const it = new ElementGeometry.Iterator(info);
    it.requestWorldCoordinates();

    for (const entry of it) {
      const geom = entry.toGeometryQuery();
      if (undefined === geom)
        return;

      if ("curvePrimitive" === geom.geometryCategory) {
        return { curve: geom as CurvePrimitive, params: entry.geomParams };
      } else if ("curveCollection" === geom.geometryCategory) {
        return { curve: geom as CurveCollection, params: entry.geomParams };
      }

      break;
    }

    return;
  }

  public static isInPlane(curve: CurveCollection | CurvePrimitive, plane: Plane3dByOriginAndUnitNormal): boolean {
    if ("curvePrimitive" === curve.geometryCategory)
      return curve.isInPlane(plane);

    if (!curve.children)
      return false;

    for (const child of curve.children) {
      if (child instanceof CurvePrimitive) {
        if (!child.isInPlane(plane))
          return false;
      } else if (child instanceof CurveCollection) {
        if (!this.isInPlane(child, plane))
          return false;
      }
    }

    return true;
  }

  protected acceptCurve(_curve: CurveCollection | CurvePrimitive): boolean { return true; }
  protected modifyCurve(_ev: BeButtonEvent, _isAccept: boolean): GeometryQuery | undefined { return undefined; }

  protected async getCurveData(id: Id64String): Promise<CurveData | undefined> {
    try {
      this._startedCmd = await this.startCommand();
      const reject: ElementGeometryOpcode[] = [ElementGeometryOpcode.Polyface, ElementGeometryOpcode.SolidPrimitive, ElementGeometryOpcode.BsplineSurface, ElementGeometryOpcode.BRep];
      const info = await basicManipulationIpc.requestElementGeometry(id, { maxDisplayable: 1, reject, geometry: { curves: true, surfaces: true, solids: false } });
      if (undefined === info)
        return undefined;

      const data = ModifyCurveTool.isSingleCurve(info);
      if (undefined === data)
        return undefined;

      if (!this.acceptCurve(data.curve))
        return undefined;

      const props = await this.iModel.elements.loadProps(id) as GeometricElementProps;
      if (undefined === props)
        return undefined;

      return new CurveData(props, data.params, data.curve);
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, BentleyError.getErrorMessage(err)));
      return undefined;
    }
  }

  protected override async doAcceptElementForOperation(id: Id64String): Promise<boolean> {
    return (undefined !== await this.getCurveData(id));
  }

  protected override async onAgendaModified(): Promise<void> {
    this.curveData = undefined;
    if (this.agenda.isEmpty)
      return;

    const id = this.agenda.elements[this.agenda.length - 1];
    this.curveData = await this.getCurveData(id);
  }

  protected override setupAccuDraw(): void {
    const hints = new AccuDrawHintBuilder();

    hints.enableSmartRotation = true;
    hints.sendHints(false);
  }

  protected getGeometryProps(ev: BeButtonEvent, isAccept: boolean): JsonGeometryStream | FlatBufferGeometryStream | undefined {
    if (undefined === this.curveData)
      return;

    const geom = this.modifyCurve(ev, isAccept);
    if (undefined === geom)
      return;

    const builder = new ElementGeometry.Builder();
    builder.setLocalToWorldFromPlacement(this.curveData.props.placement!);

    if (!builder.appendGeometryParamsChange(this.curveData.params))
      return;

    if (!builder.appendGeometryQuery(geom))
      return;

    return { format: "flatbuffer", data: builder.entries };
  }

  protected getElementProps(ev: BeButtonEvent): GeometricElementProps | undefined {
    if (undefined === this.curveData)
      return;

    if (!this.wantModifyOriginal) {
      // Create result as new element with same model and category as original...
      const classFullName = (ev.viewport?.view.is3d() ? "Generic:PhysicalObject" : "BisCore:DrawingGraphic");
      return { classFullName, model: this.curveData.props.model, category: this.curveData.props.category, code: Code.createEmpty(), placement: this.curveData.props.placement };
    }

    return this.curveData.props;
  }

  protected override async doUpdateElement(elemProps: GeometricElementProps): Promise<boolean> {
    try {
      this._startedCmd = await this.startCommand();
      if (undefined === elemProps.id) {
        const repeatOperation = this.wantContinueWithPreviousResult;
        if (repeatOperation)
          this.agenda.clear();

        const newId = await basicManipulationIpc.insertGeometricElement(elemProps);

        if (repeatOperation && this.agenda.add(newId))
          await this.onAgendaModified();
      } else {
        await basicManipulationIpc.updateGeometricElement(elemProps);
      }
      return true;
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, BentleyError.getErrorMessage(err) || "An unknown error occurred."));
      return false;
    }
  }

  protected get wantModifyOriginal(): boolean { return true; }
  protected get wantContinueWithPreviousResult(): boolean { return false; }

  public override async onProcessComplete(): Promise<void> {
    // Don't restart tool want to continue operation using previous result...
    if (this.wantContinueWithPreviousResult && !this.agenda.isEmpty && undefined !== this.curveData)
      return;
    return super.onProcessComplete();
  }
}

/** @alpha Tool for applying an offset to paths and loops. */
export class OffsetCurveTool extends ModifyCurveTool {
  public static override toolId = "OffsetCurve";
  public static override iconSpec = "icon-scale"; // Need better icon...

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
      this._distanceProperty = new DialogProperty<number>(new LengthDescription("offsetDistance", EditTools.translate("OffsetCurve.Label.Distance")), 0.1, undefined, !this.useDistance);
    return this._distanceProperty;
  }

  public get distance(): number { return this.distanceProperty.value; }
  public set distance(value: number) { this.distanceProperty.value = value; }

  private _makeCopyProperty: DialogProperty<boolean> | undefined;
  public get makeCopyProperty() {
    if (!this._makeCopyProperty)
      this._makeCopyProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("offsetCopy", EditTools.translate("OffsetCurve.Label.MakeCopy")), false);
    return this._makeCopyProperty;
  }

  public get makeCopy(): boolean { return this.makeCopyProperty.value; }
  public set makeCopy(value: boolean) { this.makeCopyProperty.value = value; }

  protected override getToolSettingPropertyLocked(property: DialogProperty<any>): DialogProperty<any> | undefined {
    return (property === this.useDistanceProperty ? this.distanceProperty : undefined);
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.makeCopyProperty, this.useDistanceProperty, this.distanceProperty]);

    const toolSettings = new Array<DialogItem>();

    // ensure controls are enabled/disabled based on current lock property state
    this.distanceProperty.isDisabled = !this.useDistance;
    const useDistanceLock = this.useDistanceProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 });
    toolSettings.push(this.distanceProperty.toDialogItem({ rowPriority: 1, columnIndex: 1 }, useDistanceLock));
    toolSettings.push(this.makeCopyProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));

    return toolSettings;
  }

  protected override acceptCurve(curve: CurveCollection | CurvePrimitive): boolean {
    if ("curvePrimitive" === curve.geometryCategory)
      return true;

    return (curve.isOpenPath || curve.isClosedPath);
  }

  protected override modifyCurve(ev: BeButtonEvent, isAccept: boolean): GeometryQuery | undefined {
    if (undefined === ev.viewport)
      return undefined;

    const geom = this.curveData?.geom;
    if (undefined === geom)
      return undefined;

    const matrix = AccuDrawHintBuilder.getCurrentRotation(ev.viewport, true, true);
    const localToWorld = FrameBuilder.createRightHandedFrame(matrix?.getColumn(2), geom);
    if (undefined === localToWorld)
      return undefined;

    const worldToLocal = localToWorld.inverse();
    if (undefined === worldToLocal)
      return undefined;

    const geomXY = ((geom instanceof CurvePrimitive) ? Path.create(geom) : geom).cloneTransformed(worldToLocal);
    if (undefined === geomXY)
      return undefined;

    const spacePoint = AccuDrawHintBuilder.projectPointToPlaneInView(ev.point, localToWorld.getOrigin(), localToWorld.matrix.getColumn(2), ev.viewport);
    if (undefined === spacePoint)
      return undefined;

    worldToLocal.multiplyPoint3d(spacePoint, spacePoint);
    spacePoint.z = 0.0;

    const closeDetail = geomXY.closestPoint(spacePoint);
    if (undefined === closeDetail?.curve)
      return undefined;

    const unitZ = Vector3d.unitZ();
    const unitX = closeDetail.curve.fractionToPointAndUnitTangent(closeDetail.fraction).direction;
    const unitY = unitZ.unitCrossProduct(unitX);

    if (undefined === unitY)
      return undefined;

    let distance = closeDetail.point.distance(spacePoint);
    const refDir = Vector3d.createStartEnd(closeDetail.point, spacePoint);

    if (refDir.dotProduct(unitY) < 0.0)
      distance = -distance;

    let offset = 0.0;

    if (this.useDistance) {
      offset = this.distance;
      if ((offset < 0.0 && distance > 0.0) || (offset > 0.0 && distance < 0.0))
        offset = -offset;
    } else {
      offset = distance;
    }

    if (Math.abs(offset) < Geometry.smallMetricDistance)
      return undefined;

    if (offset !== this.distance) {
      this.distance = offset;
      this.syncToolSettingPropertyValue(this.distanceProperty);
      if (isAccept)
        this.saveToolSettingPropertyValue(this.distanceProperty, this.distanceProperty.dialogItemValue);
    }

    const jointOptions = new JointOptions(offset);
    jointOptions.preserveEllipticalArcs = true;

    const offsetGeom = RegionOps.constructCurveXYOffset(geomXY as Path | Loop, jointOptions);
    if (undefined === offsetGeom)
      return undefined;

    if (!offsetGeom.tryTransformInPlace(localToWorld))
      return undefined;

    if (geom instanceof CurvePrimitive && offsetGeom instanceof Path && 1 === offsetGeom.children.length)
      return offsetGeom.getChild(0); // Don't create path for offset of single open curve...

    return offsetGeom;
  }

  protected override get wantModifyOriginal(): boolean {
    return !this.makeCopy;
  }

  protected override get wantContinueWithPreviousResult(): boolean {
    return !this.wantModifyOriginal;
  }

  protected override setupAccuDraw(): void {
    const hints = new AccuDrawHintBuilder();

    if (this.agenda.isEmpty) {
      hints.enableSmartRotation = true;
    } else if (undefined !== this.anchorPoint && undefined !== this.targetView) {
      const geom = this.curveData?.geom;
      const closeDetail = (geom instanceof CurvePrimitive) ? geom.closestPoint(this.anchorPoint, false) : geom?.closestPoint(this.anchorPoint);

      if (undefined !== closeDetail?.curve) {
        const unitX = closeDetail.curve.fractionToPointAndUnitTangent(closeDetail.fraction).direction;

        if (undefined !== unitX) {
          const matrix = AccuDrawHintBuilder.getCurrentRotation(this.targetView, true, true);
          const localToWorld = FrameBuilder.createRightHandedFrame(matrix?.getColumn(2), geom);

          if (undefined !== localToWorld) {
            const unitZ = localToWorld.matrix.getColumn(2);
            const frame = Matrix3d.createRigidFromColumns(unitX, unitZ, AxisOrder.XZY);

            if (undefined !== frame) {
              hints.setOrigin(closeDetail.point);
              hints.setMatrix(frame);
            }
          }
        }
      }
    }

    hints.sendHints(false);
  }

  protected override provideToolAssistance(_mainInstrText?: string, _additionalInstr?: ToolAssistanceInstruction[]): void {
    let mainMsg;
    if (!this.agenda.isEmpty)
      mainMsg = EditTools.translate("OffsetCurve.Prompts.DefineOffset");
    super.provideToolAssistance(mainMsg);
  }

  public async onRestartTool(): Promise<void> {
    const tool = new OffsetCurveTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Tool for opening loops and splitting paths. */
export class BreakCurveTool extends ModifyCurveTool {
  public static override toolId = "BreakCurve";
  public static override iconSpec = "icon-scale"; // Need better icon...

  protected resultA?: CurveCollection | CurvePrimitive;
  protected resultB?: CurveCollection | CurvePrimitive;
  protected modifyOriginal = true;

  protected override get wantDynamics(): boolean { return false; }
  protected override get wantModifyOriginal(): boolean { return this.modifyOriginal; }

  protected override acceptCurve(curve: CurveCollection | CurvePrimitive): boolean {
    if ("curvePrimitive" === curve.geometryCategory)
      return true;

    return (curve.isOpenPath || curve.isClosedPath);
  }

  protected doBreakCurve(ev: BeButtonEvent): void {
    this.resultA = this.resultB = undefined;

    if (undefined === ev.viewport)
      return;

    const geom = this.curveData?.geom;
    if (undefined === geom)
      return;

    const closeDetail = (geom instanceof CurvePrimitive) ? geom.closestPoint(ev.point, false) : geom.closestPoint(ev.point);
    if (undefined === closeDetail?.curve)
      return;

    const selectedStart = (closeDetail.fraction <= Geometry.smallFraction);
    const selectedEnd = (closeDetail.fraction >= (1.0 - Geometry.smallFraction));

    if (geom instanceof CurvePrimitive) {
      if (selectedStart || selectedEnd)
        return; // split is no-op...

      this.resultA = geom.clonePartialCurve(0.0, closeDetail.fraction);
      this.resultB = geom.clonePartialCurve(closeDetail.fraction, 1.0);
      return;
    } else if (geom instanceof Path) {
      const firstCurve = geom.children[0];
      const lastCurve = geom.children[geom.children.length - 1];

      if ((closeDetail.curve === firstCurve && selectedStart) || (closeDetail.curve === lastCurve && selectedEnd))
        return; // split is no-op...

      let beforeCurve = true;
      const resultA = Path.create();
      const resultB = Path.create();

      for (const curve of geom.children) {
        if (curve === closeDetail.curve) {
          if (selectedStart) {
            resultB.children.push(curve.clone());
          } else if (selectedEnd) {
            resultA.children.push(curve.clone());
          } else {
            const curveA = curve.clonePartialCurve(0.0, closeDetail.fraction);
            if (undefined !== curveA)
              resultA.children.push(curveA);

            const curveB = curve.clonePartialCurve(closeDetail.fraction, 1.0);
            if (undefined !== curveB)
              resultB.children.push(curveB);
          }
          beforeCurve = false;
        } else {
          if (beforeCurve)
            resultA.children.push(curve.clone());
          else
            resultB.children.push(curve.clone());
        }
      }

      this.resultA = resultA;
      this.resultB = resultB;
    } else if (geom instanceof Loop) {
      const closeIndex = geom.children.findIndex((child) => child === closeDetail.curve);
      if (-1 === closeIndex)
        return;

      const endIndex = closeIndex + geom.children.length;
      const resultA = Path.create(); // Result is always a single path...

      if (selectedStart) {
        resultA.children.push(closeDetail.curve.clone());
      } else if (!selectedEnd) {
        const curveB = closeDetail.curve.clonePartialCurve(closeDetail.fraction, 1.0);
        if (undefined !== curveB)
          resultA.children.push(curveB);
      }

      for (let index = closeIndex; index < endIndex; ++index) {
        const curve = geom.cyclicCurvePrimitive(index);
        if (undefined === curve || curve === closeDetail.curve)
          continue;

        resultA.children.push(curve.clone());
      }

      if (selectedEnd) {
        resultA.children.push(closeDetail.curve.clone());
      } else if (!selectedStart) {
        const curveA = closeDetail.curve.clonePartialCurve(0.0, closeDetail.fraction);
        if (undefined !== curveA)
          resultA.children.push(curveA);
      }

      this.resultA = resultA;
    }
  }

  protected override modifyCurve(_ev: BeButtonEvent, _isAccept: boolean): GeometryQuery | undefined {
    return (this.wantModifyOriginal ? this.resultA : this.resultB);
  }

  public override async processAgenda(ev: BeButtonEvent): Promise<void> {
    this.doBreakCurve(ev);
    if (undefined === this.resultA || !await this.applyAgendaOperation(ev))
      return;

    if (undefined !== this.resultB) {
      this.modifyOriginal = false;
      await this.applyAgendaOperation(ev);
    }

    return this.saveChanges();
  }

  protected override provideToolAssistance(_mainInstrText?: string, _additionalInstr?: ToolAssistanceInstruction[]): void {
    let mainMsg;
    if (this.agenda.isEmpty)
      mainMsg = EditTools.translate("BreakCurve.Prompts.IdentifyBreak");
    super.provideToolAssistance(mainMsg);
  }

  public async onRestartTool(): Promise<void> {
    const tool = new BreakCurveTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Tool to extend or trim a path or open curve */
export class ExtendCurveTool extends ModifyCurveTool {
  public static override toolId = "ExtendCurve";
  public static override iconSpec = "icon-scale"; // Need better icon...

  protected modifyingEnd?: CurvePrimitive;

  protected override get wantAgendaAppearanceOverride(): boolean { return true; }

  protected override acceptCurve(curve: CurveCollection | CurvePrimitive): boolean {
    if ("curvePrimitive" === curve.geometryCategory)
      return curve.isExtensibleFractionSpace;

    return curve.isOpenPath;
  }

  protected extendCurve(geom: CurvePrimitive, pickPoint: Point3d, spacePoint: Point3d): CurvePrimitive | undefined {
    const pickDetail = geom.closestPoint(pickPoint, false);
    if (undefined === pickDetail?.curve)
      return undefined;

    const closeDetail = geom.closestPoint(spacePoint, true);
    if (undefined === closeDetail?.curve)
      return undefined;

    if (closeDetail.curve instanceof Arc3d) {
      if (pickDetail.fraction > 0.5 && closeDetail.fraction < 0.0) {
        const smallArc = closeDetail.curve.clonePartialCurve(closeDetail.fraction, 0.0);
        smallArc.sweep.cloneComplement(false, smallArc.sweep);
        return smallArc;
      } else if (pickDetail.fraction <= 0.5 && closeDetail.fraction > 1.0) {
        const smallArc = closeDetail.curve.clonePartialCurve(1.0, closeDetail.fraction);
        smallArc.sweep.cloneComplement(false, smallArc.sweep);
        return smallArc;
      } else if (Math.abs(pickDetail.fraction > 0.5 ? closeDetail.fraction : 1.0 - closeDetail.fraction) < Geometry.smallFraction) {
        const fullArc = closeDetail.curve.clone();
        fullArc.sweep = AngleSweep.create360();
        return fullArc;
      }
    }

    return geom.clonePartialCurve(pickDetail.fraction > 0.5 ? 0.0 : 1.0, closeDetail.fraction);
  }

  protected extendPathEnd(geom: Path, closeDetail: CurveLocationDetail, isStart: boolean): Path | undefined {
    if (undefined === closeDetail.curve)
      return undefined;

    const curve = closeDetail.curve.clonePartialCurve(isStart ? closeDetail.fraction : 0.0, isStart ? 1.0 : closeDetail.fraction);
    if (undefined === curve)
      return undefined;

    if (curve instanceof Arc3d && closeDetail.curve instanceof Arc3d && (curve.sweep.isCCW !== closeDetail.curve.sweep.isCCW))
      curve.sweep.cloneComplement(true, curve.sweep); // Preserve current sweep direction...

    const result = geom.clone() as Path;
    result.children[isStart ? 0 : geom.children.length - 1] = curve;

    return result;
  }

  protected extendPath(geom: Path, pickPoint: Point3d, spacePoint: Point3d): Path | CurvePrimitive | undefined {
    if (geom.children.length < 2)
      return this.extendCurve(geom.children[0], pickPoint, spacePoint);

    const pathAsPrimitive = CurveChainWithDistanceIndex.createCapture(geom);
    const closeDetail = pathAsPrimitive.closestPoint(spacePoint, true);
    if (undefined === closeDetail?.curve || undefined === closeDetail.childDetail?.curve)
      return undefined;

    if (undefined !== this.modifyingEnd) {
      if (closeDetail.childDetail.curve === this.modifyingEnd) {
        this.modifyingEnd = undefined; // Ok to unlock extending first/last curve in path...
      } else {
        const pathEndDetail = this.modifyingEnd.closestPoint(spacePoint, true);
        if (undefined === pathEndDetail?.curve)
          return undefined;
        return this.extendPathEnd(geom, pathEndDetail, (pathEndDetail.curve === geom.children[0]));
      }
    }

    // NOTE: Special case extend instead of using CurveChainWithDistanceIndex.clonePartialCurve...
    if (closeDetail.fraction < 0.0) {
      this.modifyingEnd = closeDetail.childDetail.curve;
      return this.extendPathEnd(geom, closeDetail.childDetail, true);
    } else if (closeDetail.fraction > 1.0) {
      this.modifyingEnd = closeDetail.childDetail.curve;
      return this.extendPathEnd(geom, closeDetail.childDetail, false);
    }

    const pickDetail = pathAsPrimitive.closestPoint(pickPoint, false);
    if (undefined === pickDetail?.curve)
      return undefined;

    const result = pathAsPrimitive.clonePartialCurve(pickDetail.fraction > 0.5 ? 0.0 : 1.0, closeDetail.fraction);
    if (undefined === result)
      return undefined;

    return Path.create(...result.path.children);
  }

  protected override modifyCurve(ev: BeButtonEvent, _isAccept: boolean): GeometryQuery | undefined {
    if (undefined === ev.viewport || undefined === this.anchorPoint)
      return undefined;

    const geom = this.curveData?.geom;
    if (undefined === geom)
      return undefined;

    const matrix = AccuDrawHintBuilder.getCurrentRotation(ev.viewport, true, true);
    const localToWorld = FrameBuilder.createRightHandedFrame(matrix?.getColumn(2), geom);
    if (undefined === localToWorld)
      return undefined;

    const worldToLocal = localToWorld.inverse();
    if (undefined === worldToLocal)
      return undefined;

    const spacePoint = AccuDrawHintBuilder.projectPointToPlaneInView(ev.point, localToWorld.getOrigin(), localToWorld.matrix.getColumn(2), ev.viewport);
    if (undefined === spacePoint)
      return undefined;

    if (geom instanceof CurvePrimitive)
      return this.extendCurve(geom, this.anchorPoint, spacePoint);
    else if (geom instanceof Path)
      return this.extendPath(geom, this.anchorPoint, spacePoint);

    return undefined;
  }

  protected override async onAgendaModified(): Promise<void> {
    IModelApp.accuSnap.neverFlash(this.agenda.elements); // Don't flash snapped segment for better preview when trimming curve/path...
    return super.onAgendaModified();
  }

  protected override setupAccuDraw(): void {
    const hints = new AccuDrawHintBuilder();

    if (this.agenda.isEmpty) {
      hints.enableSmartRotation = true;
    } else {
      const geom = this.curveData?.geom;
      if (undefined === geom || undefined === this.anchorPoint)
        return;

      let pickDetail;
      if (geom instanceof CurvePrimitive)
        pickDetail = geom.closestPoint(this.anchorPoint, false);
      else if (geom instanceof Path)
        pickDetail = CurveChainWithDistanceIndex.createCapture(geom).closestPoint(this.anchorPoint, false);
      if (undefined === pickDetail?.curve)
        return;

      const curve = (undefined !== pickDetail.childDetail?.curve ? pickDetail.childDetail?.curve : pickDetail.curve);

      if (curve instanceof Arc3d) {
        const matrix = curve.matrixClone();
        matrix.normalizeColumnsInPlace();
        hints.setOrigin(curve.center);
        hints.setMatrix(matrix);
        hints.setModePolar();
      } else if (curve instanceof LineSegment3d) {
        hints.setOrigin(pickDetail.fraction > 0.5 ? curve.point0Ref : curve.point1Ref);
        hints.setXAxis(Vector3d.createStartEnd(pickDetail.fraction > 0.5 ? curve.point0Ref : curve.point1Ref, pickDetail.fraction > 0.5 ? curve.point1Ref : curve.point0Ref));
        hints.setModeRectangular();
      } else if (curve instanceof LineString3d) {
        if (curve.numPoints() > 1) {
          hints.setOrigin(curve.packedPoints.getPoint3dAtUncheckedPointIndex(pickDetail.fraction > 0.5 ? curve.numPoints() - 2 : 1));
          hints.setXAxis(Vector3d.createStartEnd(curve.packedPoints.getPoint3dAtUncheckedPointIndex(pickDetail.fraction > 0.5 ? curve.numPoints() - 2 : 1), curve.packedPoints.getPoint3dAtUncheckedPointIndex(pickDetail.fraction > 0.5 ? curve.numPoints() - 1 : 0)));
        }
        hints.setModeRectangular();
      } else {
        const ray = curve.fractionToPointAndUnitTangent(pickDetail.fraction > 0.5 ? 0.0 : 1.0);
        hints.setOrigin(ray.origin);
        hints.setXAxis(ray.direction);
        hints.setModeRectangular();
      }
    }
    hints.sendHints(false);
  }

  protected override provideToolAssistance(_mainInstrText?: string, _additionalInstr?: ToolAssistanceInstruction[]): void {
    let mainMsg;
    if (this.agenda.isEmpty)
      mainMsg = EditTools.translate("ExtendCurve.Prompts.IdentifyEnd");
    super.provideToolAssistance(mainMsg);
  }

  public async onRestartTool(): Promise<void> {
    const tool = new ExtendCurveTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha */
export enum RegionBooleanMode {
  /** Create region from union of all input regions */
  Unite = 0,
  /** Create region from subtraction from the first input region */
  Subtract = 1,
  /** Create region from intersection of all input regions */
  Intersect = 2,
}

/** @alpha Tool to unite, subtract, or intersect planar regions. */
export class RegionBooleanTool extends ModifyCurveTool {
  public static override toolId = "RegionBoolean";
  public static override iconSpec = "icon-scale"; // Need better icon...

  private _makeCopyProperty: DialogProperty<boolean> | undefined;
  public get makeCopyProperty() {
    if (!this._makeCopyProperty)
      this._makeCopyProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("regionBooleanKeep", EditTools.translate("RegionBoolean.Label.KeepOriginal")), false);
    return this._makeCopyProperty;
  }

  public get makeCopy(): boolean { return this.makeCopyProperty.value; }
  public set makeCopy(value: boolean) { this.makeCopyProperty.value = value; }

  private static modeMessage(str: string) { return EditTools.translate(`RegionBoolean.Mode.${str}`); }
  private static getModeChoices = (): EnumerationChoice[] => {
    return [
      { label: RegionBooleanTool.modeMessage("Unite"), value: RegionBooleanMode.Unite },
      { label: RegionBooleanTool.modeMessage("Subtract"), value: RegionBooleanMode.Subtract },
      { label: RegionBooleanTool.modeMessage("Intersect"), value: RegionBooleanMode.Intersect },
    ];
  };

  private _modeProperty: DialogProperty<number> | undefined;
  public get modeProperty() {
    if (!this._modeProperty)
      this._modeProperty = new DialogProperty<number>(PropertyDescriptionHelper.buildEnumPicklistEditorDescription(
        "regionBooleanMode", EditTools.translate("RegionBoolean.Label.Mode"), RegionBooleanTool.getModeChoices()), RegionBooleanMode.Unite as number);
    return this._modeProperty;
  }

  public get mode(): RegionBooleanMode { return this.modeProperty.value as RegionBooleanMode; }
  public set mode(mode: RegionBooleanMode) { this.modeProperty.value = mode; }

  protected override get clearSelectionSet(): boolean { return false; } // Don't clear for subtract so that mode can be changed...
  protected override get allowSelectionSet(): boolean { return RegionBooleanMode.Subtract !== this.mode; }
  protected override get allowDragSelect(): boolean { return RegionBooleanMode.Subtract !== this.mode; }
  protected override get controlKeyContinuesSelection(): boolean { return true; }
  protected override get requiredElementCount(): number { return 2; }

  protected override get wantAccuSnap(): boolean { return false; }
  protected override get wantDynamics(): boolean { return false; }
  protected override get wantModifyOriginal(): boolean { return !this.makeCopy; }

  protected override async onAgendaModified(): Promise<void> { } // No intermediate result preview, defer to processAgenda...

  protected override acceptCurve(curve: CurveCollection | CurvePrimitive): boolean {
    if ("curvePrimitive" === curve.geometryCategory)
      return false;

    return curve.isAnyRegionType;
  }

  private regionBinaryOp(): RegionBinaryOpType {
    switch (this.mode) {
      case RegionBooleanMode.Subtract:
        return RegionBinaryOpType.AMinusB;
      case RegionBooleanMode.Intersect:
        return RegionBinaryOpType.Intersection;
      default:
        return RegionBinaryOpType.Union;
    }
  }

  private regionFromSignedLoops(loops: SignedLoops): AnyRegion | undefined {
    switch (loops.negativeAreaLoops.length) {
      case 0:
        return undefined;
      case 1:
        return loops.negativeAreaLoops[0];
      default:
        return RegionOps.sortOuterAndHoleLoopsXY(loops.negativeAreaLoops);
    }
  }

  private regionBooleanXY(tools: AnyRegion[], op: RegionBinaryOpType): AnyRegion | undefined {
    if (tools.length < 2)
      return undefined;

    const loopsA = (RegionBinaryOpType.Union !== op ? tools[0] : tools);
    const loopsB = (RegionBinaryOpType.Union !== op ? tools.slice(1) : undefined);

    // TODO: Need to be able to specify group operation for loopsB to correctly support intersect w/o doing 2 at time...
    const areas = RegionOps.regionBooleanXY(loopsA, loopsB, op);
    if (undefined === areas)
      return undefined;

    // TODO: Holes are expected to be returned as negative area loops but currently are not...
    const loops = RegionOps.constructAllXYRegionLoops(areas);

    if (1 === loops.length)
      return this.regionFromSignedLoops(loops[0]);

    if (loops.length > 1) {
      const unionRegion = UnionRegion.create();

      for (const loop of loops) {
        const child = this.regionFromSignedLoops(loop);
        if (undefined === child)
          continue;

        unionRegion.tryAddChild(child);
      }

      if (unionRegion.children.length > 1)
        return unionRegion;
    }

    return undefined;
  }

  protected async doRegionBoolean(_ev: BeButtonEvent): Promise<void> {
    this.curveData = undefined;

    if (this.agenda.length < this.requiredElementCount)
      return;

    const targetData = await this.getCurveData(this.agenda.elements[0]);
    if (undefined === targetData?.geom)
      return;

    const targetLocalToWorld = FrameBuilder.createRightHandedFrame(undefined, targetData.geom);
    if (undefined === targetLocalToWorld)
      return;

    const targetWorldToLocal = targetLocalToWorld.inverse();
    if (undefined === targetWorldToLocal)
      return;

    const targetPlane = Plane3dByOriginAndUnitNormal.create(targetLocalToWorld.getOrigin(), targetLocalToWorld.matrix.getColumn(2));
    if (undefined === targetPlane)
      return;

    if (!targetData.geom.tryTransformInPlace(targetWorldToLocal))
      return;

    const tools: AnyRegion[] = [targetData.geom as AnyRegion];

    for (const id of this.agenda.elements) {
      if (id === targetData.props.id)
        continue;

      const curveData = await this.getCurveData(id);
      if (undefined === curveData?.geom)
        return;

      if (!ModifyCurveTool.isInPlane(curveData.geom, targetPlane)) {
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, EditTools.translate("RegionBoolean.Error.NonCoplanar")));
        return;
      }

      if (!curveData.geom.tryTransformInPlace(targetWorldToLocal))
        return;

      tools.push(curveData.geom as AnyRegion);
    }

    const result = this.regionBooleanXY(tools, this.regionBinaryOp());
    if (undefined === result || !result.tryTransformInPlace(targetLocalToWorld))
      return;

    this.curveData = targetData;
    this.curveData.geom = result;
  }

  protected override modifyCurve(_ev: BeButtonEvent, _isAccept: boolean): GeometryQuery | undefined {
    return this.curveData?.geom;
  }

  protected override async applyAgendaOperation(ev: BeButtonEvent): Promise<boolean> {
    if (!await super.applyAgendaOperation(ev))
      return false;

    if (this.wantModifyOriginal && this.agenda.length > 1)
      await basicManipulationIpc.deleteElements(CompressedId64Set.sortAndCompress(this.agenda.elements.slice(1)));

    return true;
  }

  public override async processAgenda(ev: BeButtonEvent): Promise<void> {
    await this.doRegionBoolean(ev);
    return super.processAgenda(ev);
  }

  public async onRestartTool(): Promise<void> {
    const tool = new RegionBooleanTool();
    if (!await tool.run())
      return this.exitTool();
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    if (!this.changeToolSettingPropertyValue(updatedValue))
      return false;

    if (this.modeProperty.name === updatedValue.propertyName)
      await this.onReinitialize();

    return true;
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.makeCopyProperty, this.modeProperty]);

    const toolSettings = new Array<DialogItem>();

    toolSettings.push(this.modeProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 }));
    toolSettings.push(this.makeCopyProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));

    return toolSettings;
  }
}
