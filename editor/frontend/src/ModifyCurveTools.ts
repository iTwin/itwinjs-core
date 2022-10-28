/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DialogItem, DialogProperty, DialogPropertySyncItem, PropertyDescriptionHelper } from "@itwin/appui-abstract";
import { Id64, Id64String } from "@itwin/core-bentley";
import {
  BentleyError, Code, ElementGeometry, ElementGeometryInfo, ElementGeometryOpcode, FeatureAppearance, FlatBufferGeometryStream, GeometricElementProps,
  GeometryParams, JsonGeometryStream,
} from "@itwin/core-common";
import {
  AccuDrawHintBuilder, BeButtonEvent, DynamicsContext, ElementSetTool, FeatureOverrideProvider, FeatureSymbology, HitDetail, IModelApp,
  LengthDescription, LocateResponse, NotifyMessageDetails, OutputMessagePriority, ToolAssistanceInstruction, Viewport,
} from "@itwin/core-frontend";
import {
  AngleSweep, Arc3d, AxisOrder, CurveCollection, CurvePrimitive, FrameBuilder, Geometry, JointOptions, LineSegment3d, LineString3d, Loop, Matrix3d,
  Path, RegionOps, Vector3d,
} from "@itwin/core-geometry";
import { editorBuiltInCmdIds } from "@itwin/editor-common";
import { computeChordToleranceFromPoint, DynamicGraphicsProvider } from "./CreateElementTool";
import { EditTools } from "./EditTool";
import { basicManipulationIpc } from "./EditToolIpc";

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
/** @alpha Base class for applying an offset to path and loops. */
export abstract class ModifyCurveTool extends ElementSetTool implements FeatureOverrideProvider {
  protected _startedCmd?: string;
  protected readonly _checkedIds = new Map<Id64String, boolean>();
  protected curveData?: CurveData;
  protected _graphicsProvider?: DynamicGraphicsProvider;
  protected _firstResult = true;
  protected _agendaAppearanceDefault?: FeatureAppearance;
  protected _agendaAppearanceDynamic?: FeatureAppearance;

  protected allowView(_vp: Viewport) { return true; }
  public override isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && this.allowView(vp)); }

  protected async startCommand(): Promise<string> {
    if (undefined !== this._startedCmd)
      return this._startedCmd;
    return EditTools.startCommand<string>(editorBuiltInCmdIds.cmdBasicManipulation, this.iModel.key);
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
    if (undefined === geometry)
      return;

    const elemProps = this.getElementProps(ev);
    if (undefined === elemProps?.placement)
      return;

    if (undefined === this._graphicsProvider) {
      if (this._firstResult) {
        this.updateAgendaAppearanceProvider();
        this._firstResult = false;
      }
      this._graphicsProvider = new DynamicGraphicsProvider(this.iModel, this.toolId);
    }

    // Set chord tolerance for non-linear curve primitives...
    if (ev.viewport)
      this._graphicsProvider.chordTolerance = computeChordToleranceFromPoint(ev.viewport, ev.point);

    await this._graphicsProvider.createGraphic(elemProps.category, elemProps.placement, geometry);
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

  protected acceptCurve(_curve: CurveCollection | CurvePrimitive): boolean { return true; }
  protected modifyCurve(_ev: BeButtonEvent, _isAccept: boolean): CurveCollection | CurvePrimitive | undefined { return undefined; }

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

  protected onGeometryFilterChanged(): void { this._checkedIds.clear(); }

  protected async acceptElementForOperation(id: Id64String): Promise<boolean> {
    if (Id64.isInvalid(id) || Id64.isTransient(id))
      return false;

    let accept = this._checkedIds.get(id);

    if (undefined === accept) {
      if (this.agenda.isEmpty && this._checkedIds.size > 1000)
        this._checkedIds.clear(); // Limit auto-locate cache size to something reasonable...

      accept = (undefined !== await this.getCurveData(id));
      this._checkedIds.set(id, accept);
    }

    return accept;
  }

  protected override async isElementValidForOperation(hit: HitDetail, out?: LocateResponse): Promise<boolean> {
    if (!await super.isElementValidForOperation(hit, out))
      return false;

    return this.acceptElementForOperation(hit.sourceId);
  }

  protected override async onAgendaModified(): Promise<void> {
    this.curveData = undefined;
    if (this.agenda.isEmpty)
      return;

    const id = this.agenda.elements[this.agenda.length - 1];
    this.curveData = await this.getCurveData(id);
  }

  public override onDynamicFrame(_ev: BeButtonEvent, context: DynamicsContext): void {
    if (undefined !== this._graphicsProvider)
      this._graphicsProvider.addGraphic(context);
  }

  public override async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    return this.createGraphics(ev);
  }

  protected setupAccuDraw(): void {
    const hints = new AccuDrawHintBuilder();

    hints.enableSmartRotation = true;
    hints.sendHints(false);
  }

  protected override setupAndPromptForNextAction(): void {
    this.setupAccuDraw();
    super.setupAndPromptForNextAction();
  }

  protected getGeometryProps(ev: BeButtonEvent, isAccept: boolean): JsonGeometryStream | FlatBufferGeometryStream | undefined {
    if (undefined === this.curveData)
      return;

    const offset = this.modifyCurve(ev, isAccept);
    if (undefined === offset)
      return;

    const builder = new ElementGeometry.Builder();
    builder.setLocalToWorldFromPlacement(this.curveData.props.placement!);

    if (!builder.appendGeometryParamsChange(this.curveData.params))
      return;

    if (!builder.appendGeometryQuery(offset))
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

  public override async processAgenda(ev: BeButtonEvent): Promise<void> {
    if (await this.applyAgendaOperation(ev))
      return this.saveChanges();
  }

  protected get wantModifyOriginal(): boolean { return true; }
  protected get wantContinueWithPreviousResult(): boolean { return false; }

  public override async onProcessComplete(): Promise<void> {
    // Don't restart tool want to continue operation using previous result...
    if (this.wantContinueWithPreviousResult && !this.agenda.isEmpty && undefined !== this.curveData)
      return;
    return super.onProcessComplete();
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

/** @alpha Tool for applying an offset to paths and loops. */
export class OffsetCurveTool extends ModifyCurveTool {
  public static override toolId = "OffsetCurve";
  public static override iconSpec = "icon-scale"; // Need better icon...

  protected override get wantAccuSnap(): boolean { return true; }
  protected override get wantDynamics(): boolean { return true; }

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

    switch (curve.curveCollectionType) {
      case "path":
      case "loop":
        return true;

      default:
        return false;
    }
  }

  protected override modifyCurve(ev: BeButtonEvent, isAccept: boolean): CurveCollection | CurvePrimitive | undefined {
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

  protected override get wantAccuSnap(): boolean { return true; }
  protected override get wantModifyOriginal(): boolean { return this.modifyOriginal; }

  protected override acceptCurve(curve: CurveCollection | CurvePrimitive): boolean {
    if ("curvePrimitive" === curve.geometryCategory)
      return true;

    switch (curve.curveCollectionType) {
      case "path":
      case "loop":
        return true;

      default:
        return false;
    }
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

  protected override modifyCurve(_ev: BeButtonEvent, _isAccept: boolean): CurveCollection | CurvePrimitive | undefined {
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

/** @alpha Tool for extending/shortening curves. */
export class ExtendCurveTool extends ModifyCurveTool {
  public static override toolId = "ExtendCurve";
  public static override iconSpec = "icon-scale"; // Need better icon...

  protected override get wantAccuSnap(): boolean { return true; }
  protected override get wantDynamics(): boolean { return true; }
  protected override get wantAgendaAppearanceOverride(): boolean { return true; }

  protected override acceptCurve(curve: CurveCollection | CurvePrimitive): boolean {
    if ("curvePrimitive" !== curve.geometryCategory)
      return false;

    return curve.isExtensibleFractionSpace;
  }

  protected override modifyCurve(ev: BeButtonEvent, _isAccept: boolean): CurveCollection | CurvePrimitive | undefined {
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

    const pickDetail = geom.closestPoint(this.anchorPoint, false);
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

    return closeDetail.curve.clonePartialCurve(pickDetail.fraction > 0.5 ? 0.0 : 1.0, closeDetail.fraction);
  }

  protected override setupAccuDraw(): void {
    const hints = new AccuDrawHintBuilder();

    if (this.agenda.isEmpty) {
      hints.enableSmartRotation = true;
    } else {
      const geom = this.curveData?.geom;
      if (undefined === geom || "curvePrimitive" !== geom.geometryCategory)
        return;

      if (geom instanceof Arc3d) {
        const matrix = geom.matrixClone();
        matrix.normalizeColumnsInPlace();

        hints.setOrigin(geom.center);
        hints.setMatrix(matrix);
        hints.setModePolar();
      } else if (geom instanceof LineSegment3d) {
        const pickDetail = (undefined !== this.anchorPoint ? geom.closestPoint(this.anchorPoint, false) : undefined);
        if (undefined !== pickDetail?.curve) {
          hints.setOrigin(pickDetail.fraction > 0.5 ? geom.point0Ref : geom.point1Ref);
          hints.setXAxis(Vector3d.createStartEnd(pickDetail.fraction > 0.5 ? geom.point0Ref : geom.point1Ref, pickDetail.fraction > 0.5 ? geom.point1Ref : geom.point0Ref));
        }
        hints.setModeRectangular();
      } else if (geom instanceof LineString3d) {
        const pickDetail = (undefined !== this.anchorPoint ? geom.closestPoint(this.anchorPoint, false) : undefined);
        if (undefined !== pickDetail?.curve && geom.numPoints() > 1) {
          hints.setOrigin(geom.packedPoints.getPoint3dAtUncheckedPointIndex(pickDetail.fraction > 0.5 ? geom.numPoints() - 2 : 1));
          hints.setXAxis(Vector3d.createStartEnd(geom.packedPoints.getPoint3dAtUncheckedPointIndex(pickDetail.fraction > 0.5 ? geom.numPoints() - 2 : 1), geom.packedPoints.getPoint3dAtUncheckedPointIndex(pickDetail.fraction > 0.5 ? geom.numPoints() - 1 : 0)));
        }
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
