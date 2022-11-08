/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DialogItem, DialogProperty, DialogPropertySyncItem, PropertyDescriptionHelper } from "@itwin/appui-abstract";
import { BentleyError } from "@itwin/core-bentley";
import {
  Code, ElementGeometry, ElementGeometryBuilderParams, FlatBufferGeometryStream, GeometricElementProps, JsonGeometryStream, PlacementProps,
} from "@itwin/core-common";
import {
  AccuDrawHintBuilder, AngleDescription, BeButtonEvent, IModelApp, LengthDescription, NotifyMessageDetails, OutputMessagePriority,
  ToolAssistanceInstruction, Viewport,
} from "@itwin/core-frontend";
import {
  Angle, Arc3d, Box, Cone, FrameBuilder, GeometryQuery, LineSegment3d, LineString3d, Loop, Matrix3d, Point3d, SolidPrimitive, Sphere, TorusPipe,
  Vector3d, YawPitchRollAngles,
} from "@itwin/core-geometry";
import { editorBuiltInCmdIds } from "@itwin/editor-common";
import { CreateElementWithDynamicsTool } from "./CreateElementTool";
import { EditTools } from "./EditTool";
import { basicManipulationIpc } from "./EditToolIpc";

/** @alpha Base class for creating a capped or uncapped SolidPrimitive. */
export abstract class SolidPrimitiveTool extends CreateElementWithDynamicsTool {
  protected readonly accepted: Point3d[] = [];
  protected baseRotation?: Matrix3d;
  protected current?: GeometryQuery;
  protected _startedCmd?: string;

  protected allowView(vp: Viewport) { return vp.view.is3d(); }
  public override isCompatibleViewport(vp: Viewport | undefined, isSelectedViewChange: boolean): boolean { return (super.isCompatibleViewport(vp, isSelectedViewChange) && undefined !== vp && this.allowView(vp)); }

  protected async startCommand(): Promise<string> {
    if (undefined !== this._startedCmd)
      return this._startedCmd;
    return EditTools.startCommand<string>(editorBuiltInCmdIds.cmdBasicManipulation, this.iModel.key);
  }

  protected getPlacementProps(): PlacementProps | undefined {
    if (undefined === this.current)
      return undefined;

    const localToWorld = ("solid" === this.current.geometryCategory ? (this.current as SolidPrimitive).getConstructiveFrame() : FrameBuilder.createRightHandedFrame(this.baseRotation?.getColumn(2), this.current));
    if (undefined === localToWorld)
      return undefined;

    const origin = localToWorld.getOrigin();
    const angles = new YawPitchRollAngles();

    YawPitchRollAngles.createFromMatrix3d(localToWorld.matrix, angles);

    return { origin, angles };
  }

  protected getGeometryProps(placement: PlacementProps): JsonGeometryStream | FlatBufferGeometryStream | undefined {
    if (undefined === this.current)
      return undefined;

    const builder = new ElementGeometry.Builder();
    builder.setLocalToWorldFromPlacement(placement);

    if (!builder.appendGeometryQuery(this.current))
      return;

    return { format: "flatbuffer", data: builder.entries };
  }

  protected getElementProps(placement: PlacementProps): GeometricElementProps | undefined {
    const model = this.targetModelId;
    const category = this.targetCategory;

    return { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty(), placement };
  }

  protected override async doCreateElement(props: GeometricElementProps, data?: ElementGeometryBuilderParams): Promise<void> {
    try {
      this._startedCmd = await this.startCommand();
      await basicManipulationIpc.insertGeometricElement(props, data);
      await this.saveChanges();
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, BentleyError.getErrorMessage(err) || "An unknown error occurred."));
    }
  }
}

/** @alpha Creates a sphere. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class CreateSphereTool extends SolidPrimitiveTool {
  public static override toolId = "CreateSphere";
  public static override iconSpec = "icon-circle"; // TODO: Need better icon...

  protected override provideToolAssistance(mainInstrText?: string, additionalInstr?: ToolAssistanceInstruction[]): void {
    mainInstrText = EditTools.translate(0 === this.accepted.length ? "CreateSphere.Prompts.CenterPoint" : "CreateSphere.Prompts.RadiusPoint");
    super.provideToolAssistance(mainInstrText, additionalInstr);
  }

  protected override setupAccuDraw(): void {
    const nPts = this.accepted.length;
    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();

    hints.setModePolar();
    hints.setOrigin(this.accepted[0]);
    hints.setOriginFixed = true;

    hints.sendHints();
  }

  private _useRadiusProperty: DialogProperty<boolean> | undefined;
  public get useRadiusProperty() {
    if (!this._useRadiusProperty)
      this._useRadiusProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useSphereRadius"), false);
    return this._useRadiusProperty;
  }

  public get useRadius(): boolean { return this.useRadiusProperty.value; }
  public set useRadius(value: boolean) { this.useRadiusProperty.value = value; }

  private _radiusProperty: DialogProperty<number> | undefined;
  public get radiusProperty() {
    if (!this._radiusProperty)
      this._radiusProperty = new DialogProperty<number>(new LengthDescription("sphereRadius", EditTools.translate("CreateSphere.Label.Radius")), 0.1, undefined, !this.useRadius);
    return this._radiusProperty;
  }

  public get radius(): number { return this.radiusProperty.value; }
  public set radius(value: number) { this.radiusProperty.value = value; }

  private _cappedProperty: DialogProperty<boolean> | undefined;
  public get cappedProperty() {
    if (!this._cappedProperty)
      this._cappedProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("sphereCapped", EditTools.translate("CreateSphere.Label.Capped")), true);
    return this._cappedProperty;
  }

  public get capped(): boolean { return this.cappedProperty.value; }
  public set capped(value: boolean) { this.cappedProperty.value = value; }

  protected override isComplete(_ev: BeButtonEvent): boolean {
    return (2 === this.accepted.length);
  }

  protected override async updateElementData(ev: BeButtonEvent, isDynamics: boolean): Promise<void> {
    const vp = this.targetView;
    if (undefined === vp)
      return;

    if (0 === this.accepted.length) {
      if (!isDynamics)
        this.accepted.push(ev.point.clone());
      return;
    }

    const vector0 = Vector3d.createStartEnd(this.accepted[0], ev.point);
    const radius = (this.useRadius ? this.radius : vector0.magnitude());

    if (!this.useRadius) {
      this.radius = radius;
      this.syncToolSettingPropertyValue(this.radiusProperty);
    }

    if (undefined === vector0.scaleToLength(radius, vector0)) {
      this.current = undefined;
      this.clearGraphics();
      return;
    }

    this.baseRotation = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);

    const normal = this.baseRotation ? this.baseRotation.getColumn(2) : Vector3d.unitZ();
    const vector90 = normal.crossProduct(vector0);
    const matrix = Matrix3d.createColumns(vector0, vector90, normal);

    this.baseRotation = Matrix3d.createRigidFromMatrix3d(matrix);
    this.current = Sphere.createFromAxesAndScales(this.accepted[0], this.baseRotation, radius, radius, radius, undefined, this.capped);

    if (isDynamics || undefined === this.current)
      return;

    this.accepted.push(ev.point.clone());
  }

  protected override getToolSettingPropertyLocked(property: DialogProperty<any>): DialogProperty<any> | undefined {
    return (property === this.useRadiusProperty ? this.radiusProperty : undefined);
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.radiusProperty, this.useRadiusProperty, this.cappedProperty]);

    const toolSettings = new Array<DialogItem>();

    this.radiusProperty.isDisabled = !this.useRadius;
    const useRadiusLock = this.useRadiusProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 });
    toolSettings.push(this.radiusProperty.toDialogItem({ rowPriority: 1, columnIndex: 1 }, useRadiusLock));
    toolSettings.push(this.cappedProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 }));

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new CreateSphereTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Values for [[CreateCylinderTool.createPhase]. */
export enum CreateCylinderPhase {
  /** Current tool phase to define center of base */
  AcceptBase,
  /** Current tool phase to define radius or base axes */
  AcceptRadius,
  /** Current tool phase to define length or axis */
  AcceptLength,
  /** Current tool phase to accept result */
  AcceptResult,
}

/** @alpha Creates a cylinder. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class CreateCylinderTool extends SolidPrimitiveTool {
  public static override toolId = "CreateCylinder";
  public static override iconSpec = "icon-circle"; // TODO: Need better icon...

  protected createPhase = CreateCylinderPhase.AcceptBase;

  protected override provideToolAssistance(mainInstrText?: string, additionalInstr?: ToolAssistanceInstruction[]): void {
    switch (this.createPhase) {
      case CreateCylinderPhase.AcceptBase:
        mainInstrText = EditTools.translate("CreateCylinder.Prompts.BasePoint");
        break;
      case CreateCylinderPhase.AcceptRadius:
        mainInstrText = EditTools.translate("CreateCylinder.Prompts.RadiusPoint");
        break;
      default:
        mainInstrText = EditTools.translate("CreateCylinder.Prompts.LengthPoint");
        break;
    }

    super.provideToolAssistance(mainInstrText, additionalInstr);
  }

  protected override setupAccuDraw(): void {
    const nPts = this.accepted.length;
    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();

    hints.setModePolar();
    hints.setOrigin(this.accepted[0]);
    hints.setOriginFixed = true;

    if (CreateCylinderPhase.AcceptLength === this.createPhase && undefined !== this.baseRotation) {
      hints.setXAxis2(this.baseRotation.getColumn(2));

      if (this.orthogonal) {
        hints.setModeRectangular();
        hints.setLockY = true;
        hints.setLockZ = true;
      }
    }

    hints.sendHints();
  }

  private _useRadiusProperty: DialogProperty<boolean> | undefined;
  public get useRadiusProperty() {
    if (!this._useRadiusProperty)
      this._useRadiusProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useCylinderRadius"), false);
    return this._useRadiusProperty;
  }

  public get useRadius(): boolean { return this.useRadiusProperty.value; }
  public set useRadius(value: boolean) { this.useRadiusProperty.value = value; }

  private _radiusProperty: DialogProperty<number> | undefined;
  public get radiusProperty() {
    if (!this._radiusProperty)
      this._radiusProperty = new DialogProperty<number>(new LengthDescription("cylinderRadius", EditTools.translate("CreateCylinder.Label.Radius")), 0.1, undefined, !this.useRadius);
    return this._radiusProperty;
  }

  public get radius(): number { return this.radiusProperty.value; }
  public set radius(value: number) { this.radiusProperty.value = value; }

  private _useLengthProperty: DialogProperty<boolean> | undefined;
  public get useLengthProperty() {
    if (!this._useLengthProperty)
      this._useLengthProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useCylinderLength"), false);
    return this._useLengthProperty;
  }

  public get useLength(): boolean { return this.useLengthProperty.value; }
  public set useLength(value: boolean) { this.useLengthProperty.value = value; }

  private _lengthProperty: DialogProperty<number> | undefined;
  public get lengthProperty() {
    if (!this._lengthProperty)
      this._lengthProperty = new DialogProperty<number>(new LengthDescription("cylinderLength", EditTools.translate("CreateCylinder.Label.Length")), 0.1, undefined, !this.useLength);
    return this._lengthProperty;
  }

  public get length(): number { return this.lengthProperty.value; }
  public set length(value: number) { this.lengthProperty.value = value; }

  private _cappedProperty: DialogProperty<boolean> | undefined;
  public get cappedProperty() {
    if (!this._cappedProperty)
      this._cappedProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("cylinderCapped", EditTools.translate("CreateCylinder.Label.Capped")), true);
    return this._cappedProperty;
  }

  public get capped(): boolean { return this.cappedProperty.value; }
  public set capped(value: boolean) { this.cappedProperty.value = value; }

  private _orthogonalProperty: DialogProperty<boolean> | undefined;
  public get orthogonalProperty() {
    if (!this._orthogonalProperty)
      this._orthogonalProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("cylinderOrthogonal", EditTools.translate("CreateCylinder.Label.Orthogonal")), true);
    return this._orthogonalProperty;
  }

  public get orthogonal(): boolean { return this.orthogonalProperty.value; }
  public set orthogonal(value: boolean) { this.orthogonalProperty.value = value; }

  protected override isComplete(_ev: BeButtonEvent): boolean {
    return (CreateCylinderPhase.AcceptResult === this.createPhase);
  }

  protected override async updateElementData(ev: BeButtonEvent, isDynamics: boolean): Promise<void> {
    const vp = this.targetView;
    if (undefined === vp)
      return;

    const pt1 = (0 === this.accepted.length ? ev.point : this.accepted[0]);
    const pt2 = ev.point;

    switch (this.createPhase) {
      case CreateCylinderPhase.AcceptBase: {
        if (isDynamics)
          break;

        // Allow creating cylinder by 2 points when orthogonal and radius are locked...
        this.accepted.push(pt2.clone());
        this.createPhase = (this.orthogonal && this.useRadius ? CreateCylinderPhase.AcceptLength : CreateCylinderPhase.AcceptRadius);
        break;
      }

      case CreateCylinderPhase.AcceptRadius: {
        this.baseRotation = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);

        const normal = this.baseRotation ? this.baseRotation.getColumn(2) : Vector3d.unitZ();
        const vector0 = Vector3d.createStartEnd(pt1, pt2);
        const vector90 = normal.crossProduct(vector0);
        const radius = (this.useRadius ? this.radius : vector0.magnitude());

        if (!this.useRadius) {
          this.radius = radius;
          this.syncToolSettingPropertyValue(this.radiusProperty);
        }

        if (undefined === vector0.scaleToLength(radius, vector0) || undefined === vector90.scaleToLength(radius, vector90)) {
          this.current = undefined;
          this.clearGraphics();
          return;
        }

        const arc = Arc3d.create(pt1, vector0, vector90);
        this.baseRotation = Matrix3d.createRigidFromMatrix3d(arc.matrixRef); // Update base rotation from result arc...
        this.current = (this.capped ? Loop.create(arc) : arc);

        if (isDynamics)
          break;

        this.createPhase = CreateCylinderPhase.AcceptLength;
        break;
      }

      case CreateCylinderPhase.AcceptLength: {
        const zAxis = Vector3d.createStartEnd(pt1, pt2);
        const length = (this.useLength ? this.length : zAxis.magnitude());

        if (!this.useLength) {
          this.length = length;
          this.syncToolSettingPropertyValue(this.lengthProperty);
        }

        // Establish base rotation when creating cylinder by 2 points...
        if (undefined === this.baseRotation)
          this.baseRotation = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);

        const xAxis = this.baseRotation ? this.baseRotation.getColumn(0) : Vector3d.unitX();
        const yAxis = this.baseRotation ? this.baseRotation.getColumn(1) : Vector3d.unitY();

        if (undefined === zAxis.scaleToLength(length, zAxis)) {
          xAxis.scaleToLength(this.radius, xAxis);
          yAxis.scaleToLength(this.radius, yAxis);

          const baseArc = Arc3d.create(pt1, xAxis, yAxis);
          this.current = (this.capped ? Loop.create(baseArc) : baseArc);
          return;
        }

        if (this.orthogonal)
          this.current = Cone.createAxisPoints(pt1, pt1.plus(zAxis), this.radius, this.radius, this.capped);
        else
          this.current = Cone.createBaseAndTarget(pt1, pt1.plus(zAxis), xAxis, yAxis, this.radius, this.radius, this.capped);

        if (isDynamics || undefined === this.current)
          break;

        this.createPhase = CreateCylinderPhase.AcceptResult;
        break;
      }
    }
  }

  protected override getToolSettingPropertyLocked(property: DialogProperty<any>): DialogProperty<any> | undefined {
    if (property === this.useRadiusProperty)
      return this.radiusProperty;
    else if (property === this.useLengthProperty)
      return this.lengthProperty;
    return undefined;
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.radiusProperty, this.useRadiusProperty, this.lengthProperty, this.useLengthProperty, this.orthogonalProperty, this.cappedProperty]);

    const toolSettings = new Array<DialogItem>();

    this.radiusProperty.isDisabled = !this.useRadius;
    const useRadiusLock = this.useRadiusProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 });
    toolSettings.push(this.radiusProperty.toDialogItem({ rowPriority: 1, columnIndex: 1 }, useRadiusLock));

    this.lengthProperty.isDisabled = !this.useLength;
    const useLengthLock = this.useLengthProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 });
    toolSettings.push(this.lengthProperty.toDialogItem({ rowPriority: 2, columnIndex: 1 }, useLengthLock));

    toolSettings.push(this.orthogonalProperty.toDialogItem({ rowPriority: 3, columnIndex: 0 }));
    toolSettings.push(this.cappedProperty.toDialogItem({ rowPriority: 4, columnIndex: 0 }));

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new CreateCylinderTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Values for [[CreateConeTool.createPhase]. */
export enum CreateConePhase {
  /** Current tool phase to define center of base */
  AcceptBase,
  /** Current tool phase to define base radius or base axes */
  AcceptBaseRadius,
  /** Current tool phase to define length or axis */
  AcceptLength,
  /** Current tool phase to define top radius */
  AcceptTopRadius,
  /** Current tool phase to accept result */
  AcceptResult,
}

/** @alpha Creates a cone. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class CreateConeTool extends SolidPrimitiveTool {
  public static override toolId = "CreateCone";
  public static override iconSpec = "icon-circle"; // TODO: Need better icon...

  protected createPhase = CreateConePhase.AcceptBase;

  protected override provideToolAssistance(mainInstrText?: string, additionalInstr?: ToolAssistanceInstruction[]): void {
    switch (this.createPhase) {
      case CreateConePhase.AcceptBase:
        mainInstrText = EditTools.translate("CreateCone.Prompts.BasePoint");
        break;
      case CreateConePhase.AcceptBaseRadius:
        mainInstrText = EditTools.translate("CreateCone.Prompts.BaseRadiusPoint");
        break;
      case CreateConePhase.AcceptTopRadius:
        mainInstrText = EditTools.translate("CreateCone.Prompts.TopRadiusPoint");
        break;
      default:
        mainInstrText = EditTools.translate("CreateCone.Prompts.LengthPoint");
        break;
    }

    super.provideToolAssistance(mainInstrText, additionalInstr);
  }

  protected override setupAccuDraw(): void {
    const nPts = this.accepted.length;
    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();

    hints.setModePolar();
    hints.setOrigin(this.accepted[0]);
    hints.setOriginFixed = true;

    if (CreateConePhase.AcceptTopRadius === this.createPhase && 2 === nPts) {
      hints.setOrigin(this.accepted[1]);
      if (undefined !== this.baseRotation)
        hints.setMatrix(this.baseRotation);
    } else if (CreateConePhase.AcceptLength === this.createPhase && undefined !== this.baseRotation) {
      hints.setXAxis2(this.baseRotation.getColumn(2));

      if (this.orthogonal) {
        hints.setModeRectangular();
        hints.setLockY = true;
        hints.setLockZ = true;
      }
    }

    hints.sendHints();
  }

  private _useBaseRadiusProperty: DialogProperty<boolean> | undefined;
  public get useBaseRadiusProperty() {
    if (!this._useBaseRadiusProperty)
      this._useBaseRadiusProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useConeBaseRadius"), false);
    return this._useBaseRadiusProperty;
  }

  public get useBaseRadius(): boolean { return this.useBaseRadiusProperty.value; }
  public set useBaseRadius(value: boolean) { this.useBaseRadiusProperty.value = value; }

  private _baseRadiusProperty: DialogProperty<number> | undefined;
  public get baseRadiusProperty() {
    if (!this._baseRadiusProperty)
      this._baseRadiusProperty = new DialogProperty<number>(new LengthDescription("coneBaseRadius", EditTools.translate("CreateCone.Label.BaseRadius")), 0.1, undefined, !this.useBaseRadius);
    return this._baseRadiusProperty;
  }

  public get baseRadius(): number { return this.baseRadiusProperty.value; }
  public set baseRadius(value: number) { this.baseRadiusProperty.value = value; }

  private _useTopRadiusProperty: DialogProperty<boolean> | undefined;
  public get useTopRadiusProperty() {
    if (!this._useTopRadiusProperty)
      this._useTopRadiusProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useConeTopRadius"), false);
    return this._useTopRadiusProperty;
  }

  public get useTopRadius(): boolean { return this.useTopRadiusProperty.value; }
  public set useTopRadius(value: boolean) { this.useTopRadiusProperty.value = value; }

  private _topRadiusProperty: DialogProperty<number> | undefined;
  public get topRadiusProperty() {
    if (!this._topRadiusProperty)
      this._topRadiusProperty = new DialogProperty<number>(new LengthDescription("coneTopRadius", EditTools.translate("CreateCone.Label.TopRadius")), 0.1, undefined, !this.useTopRadius);
    return this._topRadiusProperty;
  }

  public get topRadius(): number { return this.topRadiusProperty.value; }
  public set topRadius(value: number) { this.topRadiusProperty.value = value; }

  private _useLengthProperty: DialogProperty<boolean> | undefined;
  public get useLengthProperty() {
    if (!this._useLengthProperty)
      this._useLengthProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useConeLength"), false);
    return this._useLengthProperty;
  }

  public get useLength(): boolean { return this.useLengthProperty.value; }
  public set useLength(value: boolean) { this.useLengthProperty.value = value; }

  private _lengthProperty: DialogProperty<number> | undefined;
  public get lengthProperty() {
    if (!this._lengthProperty)
      this._lengthProperty = new DialogProperty<number>(new LengthDescription("coneLength", EditTools.translate("CreateCone.Label.Length")), 0.1, undefined, !this.useLength);
    return this._lengthProperty;
  }

  public get length(): number { return this.lengthProperty.value; }
  public set length(value: number) { this.lengthProperty.value = value; }

  private _cappedProperty: DialogProperty<boolean> | undefined;
  public get cappedProperty() {
    if (!this._cappedProperty)
      this._cappedProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("coneCapped", EditTools.translate("CreateCone.Label.Capped")), true);
    return this._cappedProperty;
  }

  public get capped(): boolean { return this.cappedProperty.value; }
  public set capped(value: boolean) { this.cappedProperty.value = value; }

  private _orthogonalProperty: DialogProperty<boolean> | undefined;
  public get orthogonalProperty() {
    if (!this._orthogonalProperty)
      this._orthogonalProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("coneOrthogonal", EditTools.translate("CreateCone.Label.Orthogonal")), true);
    return this._orthogonalProperty;
  }

  public get orthogonal(): boolean { return this.orthogonalProperty.value; }
  public set orthogonal(value: boolean) { this.orthogonalProperty.value = value; }

  protected override isComplete(_ev: BeButtonEvent): boolean {
    return (CreateConePhase.AcceptResult === this.createPhase);
  }

  protected override async updateElementData(ev: BeButtonEvent, isDynamics: boolean): Promise<void> {
    const vp = this.targetView;
    if (undefined === vp)
      return;

    const pt1 = (0 === this.accepted.length ? ev.point : this.accepted[0]);
    const pt2 = ev.point;

    switch (this.createPhase) {
      case CreateConePhase.AcceptBase: {
        if (isDynamics)
          break;

        // Allow creating cone by 2 points when orthogonal and base/top radii are locked...
        this.accepted.push(pt2.clone());
        this.createPhase = (this.orthogonal && this.useBaseRadius ? CreateConePhase.AcceptLength : CreateConePhase.AcceptBaseRadius);
        break;
      }

      case CreateConePhase.AcceptBaseRadius: {
        this.baseRotation = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);

        const normal = this.baseRotation ? this.baseRotation.getColumn(2) : Vector3d.unitZ();
        const vector0 = Vector3d.createStartEnd(pt1, pt2);
        const vector90 = normal.crossProduct(vector0);
        const radius = (this.useBaseRadius ? this.baseRadius : vector0.magnitude());

        if (!this.useBaseRadius) {
          this.baseRadius = radius;
          this.syncToolSettingPropertyValue(this.baseRadiusProperty);
        }

        if (undefined === vector0.scaleToLength(radius, vector0) || undefined === vector90.scaleToLength(radius, vector90)) {
          this.current = undefined;
          this.clearGraphics();
          return;
        }

        const arc = Arc3d.create(pt1, vector0, vector90);
        this.baseRotation = Matrix3d.createRigidFromMatrix3d(arc.matrixRef); // Update base rotation from result arc...
        this.current = (this.capped ? Loop.create(arc) : arc);

        if (isDynamics)
          break;

        this.createPhase = CreateConePhase.AcceptLength;
        break;
      }

      case CreateConePhase.AcceptLength: {
        const zAxis = Vector3d.createStartEnd(pt1, pt2);
        const length = (this.useLength ? this.length : zAxis.magnitude());

        if (!this.useLength) {
          this.length = length;
          this.syncToolSettingPropertyValue(this.lengthProperty);
        }

        // Establish base rotation when creating cone by 2 points...
        if (undefined === this.baseRotation)
          this.baseRotation = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);

        const xAxis = this.baseRotation ? this.baseRotation.getColumn(0) : Vector3d.unitX();
        const yAxis = this.baseRotation ? this.baseRotation.getColumn(1) : Vector3d.unitY();

        if (undefined === zAxis.scaleToLength(length, zAxis)) {
          xAxis.scaleToLength(this.baseRadius, xAxis);
          yAxis.scaleToLength(this.baseRadius, yAxis);

          const baseArc = Arc3d.create(pt1, xAxis, yAxis);
          this.current = (this.capped ? Loop.create(baseArc) : baseArc);
          return;
        }

        if (this.orthogonal)
          this.current = Cone.createAxisPoints(pt1, pt1.plus(zAxis), this.baseRadius, this.useTopRadius ? this.topRadius : 0.0, this.capped);
        else
          this.current = Cone.createBaseAndTarget(pt1, pt1.plus(zAxis), xAxis, yAxis, this.baseRadius, this.useTopRadius ? this.topRadius : 0.0, this.capped);

        if (isDynamics || undefined === this.current)
          break;

        const localToWorld = (this.current as Cone).getConstructiveFrame();
        if (undefined !== localToWorld)
          this.baseRotation = localToWorld.matrix; // Update base rotation from result for AccuDraw hints...

        this.accepted.push((this.current as Cone).getCenterB()); // Add top center to accepted points for AccuDraw hints...
        this.createPhase = this.useTopRadius ? CreateConePhase.AcceptResult : CreateConePhase.AcceptTopRadius;
        break;
      }

      case CreateConePhase.AcceptTopRadius: {
        const cone = ("solid" === this.current?.geometryCategory ? (this.current as Cone) : undefined);
        if (undefined === cone)
          break;

        const vector0 = Vector3d.createStartEnd(cone.getCenterB(), pt2);
        const radius = (this.useTopRadius ? this.topRadius : vector0.magnitude());

        if (!this.useTopRadius) {
          this.topRadius = radius;
          this.syncToolSettingPropertyValue(this.topRadiusProperty);
        }

        this.current = Cone.createBaseAndTarget(cone.getCenterA(), cone.getCenterB(), cone.getVectorX(), cone.getVectorY(), cone.getRadiusA(), radius, this.capped);

        if (isDynamics)
          break;

        this.createPhase = CreateConePhase.AcceptResult;
        break;
      }
    }
  }

  protected override getToolSettingPropertyLocked(property: DialogProperty<any>): DialogProperty<any> | undefined {
    if (property === this.useBaseRadiusProperty)
      return this.baseRadiusProperty;
    else if (property === this.useTopRadiusProperty)
      return this.topRadiusProperty;
    else if (property === this.useLengthProperty)
      return this.lengthProperty;
    return undefined;
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.baseRadiusProperty, this.useBaseRadiusProperty, this.topRadiusProperty, this.useTopRadiusProperty, this.lengthProperty, this.useLengthProperty, this.orthogonalProperty, this.cappedProperty]);

    const toolSettings = new Array<DialogItem>();

    this.baseRadiusProperty.isDisabled = !this.useBaseRadius;
    const useBaseRadiusLock = this.useBaseRadiusProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 });
    toolSettings.push(this.baseRadiusProperty.toDialogItem({ rowPriority: 1, columnIndex: 1 }, useBaseRadiusLock));

    this.topRadiusProperty.isDisabled = !this.useTopRadius;
    const useTopRadiusLock = this.useTopRadiusProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 });
    toolSettings.push(this.topRadiusProperty.toDialogItem({ rowPriority: 2, columnIndex: 1 }, useTopRadiusLock));

    this.lengthProperty.isDisabled = !this.useLength;
    const useLengthLock = this.useLengthProperty.toDialogItem({ rowPriority: 3, columnIndex: 0 });
    toolSettings.push(this.lengthProperty.toDialogItem({ rowPriority: 3, columnIndex: 1 }, useLengthLock));

    toolSettings.push(this.orthogonalProperty.toDialogItem({ rowPriority: 4, columnIndex: 0 }));
    toolSettings.push(this.cappedProperty.toDialogItem({ rowPriority: 5, columnIndex: 0 }));

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new CreateConeTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Creates a bix. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class CreateBoxTool extends SolidPrimitiveTool {
  public static override toolId = "CreateBox";
  public static override iconSpec = "icon-circle"; // TODO: Need better icon...

  protected override provideToolAssistance(mainInstrText?: string, additionalInstr?: ToolAssistanceInstruction[]): void {
    switch (this.accepted.length) {
      case 0:
        mainInstrText = EditTools.translate("CreateBox.Prompts.BasePoint");
        break;
      case 1:
        mainInstrText = EditTools.translate("CreateBox.Prompts.LengthPoint");
        break;
      case 2:
        mainInstrText = EditTools.translate("CreateBox.Prompts.WidthPoint");
        break;
      default:
        mainInstrText = EditTools.translate("CreateBox.Prompts.HeightPoint");
        break;
    }

    super.provideToolAssistance(mainInstrText, additionalInstr);
  }

  protected override setupAccuDraw(): void {
    const nPts = this.accepted.length;
    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();

    hints.setModeRectangular();
    hints.setOrigin(this.accepted[0]);
    hints.setOriginFixed = true;

    if (undefined !== this.baseRotation) {
      if (2 === nPts) {
        hints.setMatrix(this.baseRotation);
        hints.setLockX = true;
        hints.setLockZ = true;
      } else if (3 === nPts) {
        hints.setXAxis2(this.baseRotation.getColumn(2));
        if (this.orthogonal) {
          hints.setLockY = true;
          hints.setLockZ = true;
        }
      }
    }

    hints.sendHints();
  }

  private _useLengthProperty: DialogProperty<boolean> | undefined;
  public get useLengthProperty() {
    if (!this._useLengthProperty)
      this._useLengthProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useBoxLength"), false);
    return this._useLengthProperty;
  }

  public get useLength(): boolean { return this.useLengthProperty.value; }
  public set useLength(value: boolean) { this.useLengthProperty.value = value; }

  private _lengthProperty: DialogProperty<number> | undefined;
  public get lengthProperty() {
    if (!this._lengthProperty)
      this._lengthProperty = new DialogProperty<number>(new LengthDescription("boxLength", EditTools.translate("CreateBox.Label.Length")), 0.1, undefined, !this.useLength);
    return this._lengthProperty;
  }

  public get length(): number { return this.lengthProperty.value; }
  public set length(value: number) { this.lengthProperty.value = value; }

  private _useWidthProperty: DialogProperty<boolean> | undefined;
  public get useWidthProperty() {
    if (!this._useWidthProperty)
      this._useWidthProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useBoxWidth"), false);
    return this._useWidthProperty;
  }

  public get useWidth(): boolean { return this.useWidthProperty.value; }
  public set useWidth(value: boolean) { this.useWidthProperty.value = value; }

  private _widthProperty: DialogProperty<number> | undefined;
  public get widthProperty() {
    if (!this._widthProperty)
      this._widthProperty = new DialogProperty<number>(new LengthDescription("boxWidth", EditTools.translate("CreateBox.Label.Width")), 0.1, undefined, !this.useWidth);
    return this._widthProperty;
  }

  public get width(): number { return this.widthProperty.value; }
  public set width(value: number) { this.widthProperty.value = value; }

  private _useHeightProperty: DialogProperty<boolean> | undefined;
  public get useHeightProperty() {
    if (!this._useHeightProperty)
      this._useHeightProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useBoxHeight"), false);
    return this._useHeightProperty;
  }

  public get useHeight(): boolean { return this.useHeightProperty.value; }
  public set useHeight(value: boolean) { this.useHeightProperty.value = value; }

  private _heightProperty: DialogProperty<number> | undefined;
  public get heightProperty() {
    if (!this._heightProperty)
      this._heightProperty = new DialogProperty<number>(new LengthDescription("boxHeight", EditTools.translate("CreateBox.Label.Height")), 0.1, undefined, !this.useHeight);
    return this._heightProperty;
  }

  public get height(): number { return this.heightProperty.value; }
  public set height(value: number) { this.heightProperty.value = value; }

  private _cappedProperty: DialogProperty<boolean> | undefined;
  public get cappedProperty() {
    if (!this._cappedProperty)
      this._cappedProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("boxCapped", EditTools.translate("CreateBox.Label.Capped")), true);
    return this._cappedProperty;
  }

  public get capped(): boolean { return this.cappedProperty.value; }
  public set capped(value: boolean) { this.cappedProperty.value = value; }

  private _orthogonalProperty: DialogProperty<boolean> | undefined;
  public get orthogonalProperty() {
    if (!this._orthogonalProperty)
      this._orthogonalProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("boxOrthogonal", EditTools.translate("CreateBox.Label.Orthogonal")), true);
    return this._orthogonalProperty;
  }

  public get orthogonal(): boolean { return this.orthogonalProperty.value; }
  public set orthogonal(value: boolean) { this.orthogonalProperty.value = value; }

  protected override isComplete(_ev: BeButtonEvent): boolean {
    return (4 === this.accepted.length);
  }

  protected override async updateElementData(ev: BeButtonEvent, isDynamics: boolean): Promise<void> {
    const vp = this.targetView;
    if (undefined === vp)
      return;

    switch (this.accepted.length) {
      case 0: {
        if (!isDynamics)
          this.accepted.push(ev.point.clone());
        break;
      }

      case 1: {
        const vector0 = Vector3d.createStartEnd(this.accepted[0], ev.point);
        const length = (this.useLength ? this.length : vector0.magnitude());

        if (!this.useLength) {
          this.length = length;
          this.syncToolSettingPropertyValue(this.lengthProperty);
        }

        if (undefined === vector0.scaleToLength(length, vector0)) {
          this.current = undefined;
          this.clearGraphics();
          return;
        }

        this.baseRotation = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);

        const normal = this.baseRotation ? this.baseRotation.getColumn(2) : Vector3d.unitZ();
        const vector90 = normal.crossProduct(vector0);
        const matrix = Matrix3d.createColumns(vector0, vector90, normal);

        this.baseRotation = Matrix3d.createRigidFromMatrix3d(matrix);
        this.current = LineSegment3d.create(this.accepted[0], this.accepted[0].plus(vector0));

        if (isDynamics)
          return;

        this.accepted.push(ev.point.clone());
        break;
      }

      case 2: {
        const vector90 = Vector3d.createStartEnd(this.accepted[0], ev.point);
        const width = (this.useWidth ? this.width : vector90.magnitude());

        if (!this.useWidth) {
          this.width = width;
          this.syncToolSettingPropertyValue(this.widthProperty);
        }

        const vector0 = this.baseRotation ? this.baseRotation.getColumn(0) : Vector3d.unitX();
        const normal = vector90.crossProduct(vector0);
        const matrix = Matrix3d.createColumns(vector0, vector90, normal);

        if (undefined === vector90.scaleToLength(width, vector90) || undefined === Matrix3d.createRigidFromMatrix3d(matrix, undefined, matrix)) {
          this.current = LineSegment3d.create(this.accepted[0], this.accepted[0].plusScaled(vector0, this.length));
          return;
        }

        this.baseRotation = matrix; // Update base rotation from cross product...

        const shapePts: Point3d[] = [];
        shapePts[0] = this.accepted[0].clone();
        shapePts[1] = shapePts[0].plusScaled(this.baseRotation.getColumn(0), this.length);
        shapePts[2] = shapePts[1].plusScaled(this.baseRotation.getColumn(1), width);
        shapePts[3] = shapePts[0].plusScaled(this.baseRotation.getColumn(1), width);
        shapePts[4] = shapePts[0].clone();

        const base = LineString3d.create(shapePts);
        this.current = (this.capped ? Loop.create(base) : base);

        if (isDynamics)
          return;

        this.accepted.push(ev.point.clone());
        break;
      }

      default: {
        if (undefined === this.baseRotation)
          return; // Should always have base rotation after width is defined...

        const zAxis = Vector3d.createStartEnd(this.accepted[0], ev.point);
        const height = (this.useHeight ? this.height : zAxis.magnitude());

        if (!this.useHeight) {
          this.height = height;
          this.syncToolSettingPropertyValue(this.heightProperty);
        }

        if (undefined === zAxis.scaleToLength(height, zAxis)) {
          const shapePts: Point3d[] = [];
          shapePts[0] = this.accepted[0].clone();
          shapePts[1] = shapePts[0].plusScaled(this.baseRotation.getColumn(0), this.length);
          shapePts[2] = shapePts[1].plusScaled(this.baseRotation.getColumn(1), this.width);
          shapePts[3] = shapePts[0].plusScaled(this.baseRotation.getColumn(1), this.width);
          shapePts[4] = shapePts[0].clone();

          const base = LineString3d.create(shapePts);
          this.current = (this.capped ? Loop.create(base) : base);
          return;
        }

        if (this.orthogonal) {
          const normal = this.baseRotation.getColumn(2);
          normal.scaleToLength(normal.dotProduct(zAxis) >= 0.0 ? height : -height, zAxis);
        }

        this.current = Box.createDgnBoxWithAxes(this.accepted[0], this.baseRotation, this.accepted[0].plus(zAxis), this.length, this.width, this.length, this.width, this.capped);

        if (isDynamics || undefined === this.current)
          return;

        this.accepted.push(ev.point.clone());
        break;
      }
    }
  }

  protected override getToolSettingPropertyLocked(property: DialogProperty<any>): DialogProperty<any> | undefined {
    if (property === this.useLengthProperty)
      return this.lengthProperty;
    else if (property === this.useWidthProperty)
      return this.widthProperty;
    else if (property === this.useHeightProperty)
      return this.heightProperty;
    return undefined;
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.lengthProperty, this.useLengthProperty, this.widthProperty, this.useWidthProperty, this.heightProperty, this.useHeightProperty, this.orthogonalProperty, this.cappedProperty]);

    const toolSettings = new Array<DialogItem>();

    this.lengthProperty.isDisabled = !this.useLength;
    const useLengthLock = this.useLengthProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 });
    toolSettings.push(this.lengthProperty.toDialogItem({ rowPriority: 1, columnIndex: 1 }, useLengthLock));

    this.widthProperty.isDisabled = !this.useWidth;
    const useWidthLock = this.useWidthProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 });
    toolSettings.push(this.widthProperty.toDialogItem({ rowPriority: 2, columnIndex: 1 }, useWidthLock));

    this.heightProperty.isDisabled = !this.useHeight;
    const useHeightLock = this.useHeightProperty.toDialogItem({ rowPriority: 3, columnIndex: 0 });
    toolSettings.push(this.heightProperty.toDialogItem({ rowPriority: 3, columnIndex: 1 }, useHeightLock));

    toolSettings.push(this.orthogonalProperty.toDialogItem({ rowPriority: 4, columnIndex: 0 }));
    toolSettings.push(this.cappedProperty.toDialogItem({ rowPriority: 5, columnIndex: 0 }));

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new CreateBoxTool();
    if (!await tool.run())
      return this.exitTool();
  }
}

/** @alpha Values for [[CreateTorusTool.createPhase]. */
export enum CreateTorusPhase {
  /** Current tool phase to define start point */
  AcceptStart,
  /** Current tool phase to define center point */
  AcceptCenter,
  /** Current tool phase to define  secondary radius */
  AcceptSecondaryRadius,
  /** Current tool phase to define sweep angle */
  AcceptAngle,
  /** Current tool phase to accept result */
  AcceptResult,
}

/** @alpha Creates a torus pipe. Uses model and category from [[BriefcaseConnection.editorToolSettings]]. */
export class CreateTorusTool extends SolidPrimitiveTool {
  public static override toolId = "CreateTorus";
  public static override iconSpec = "icon-circle"; // TODO: Need better icon...

  protected createPhase = CreateTorusPhase.AcceptStart;

  protected override provideToolAssistance(mainInstrText?: string, additionalInstr?: ToolAssistanceInstruction[]): void {
    switch (this.createPhase) {
      case CreateTorusPhase.AcceptStart:
        mainInstrText = EditTools.translate("CreateTorus.Prompts.StartPoint");
        break;
      case CreateTorusPhase.AcceptCenter:
        mainInstrText = EditTools.translate("CreateTorus.Prompts.CenterPoint");
        break;
      case CreateTorusPhase.AcceptSecondaryRadius:
        mainInstrText = EditTools.translate("CreateTorus.Prompts.SecondaryRadiusPoint");
        break;
      default:
        mainInstrText = EditTools.translate("CreateTorus.Prompts.AnglePoint");
        break;
    }

    super.provideToolAssistance(mainInstrText, additionalInstr);
  }

  protected override setupAccuDraw(): void {
    const nPts = this.accepted.length;
    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();

    if (CreateTorusPhase.AcceptCenter === this.createPhase) {
      hints.setOrigin(this.accepted[0]);
    } else if (CreateTorusPhase.AcceptSecondaryRadius === this.createPhase) {
      hints.setModePolar();
      hints.setOrigin(this.accepted[0]);
      hints.setOriginFixed = true;
      if (undefined !== this.baseRotation)
        hints.setMatrix(Matrix3d.createColumns(this.baseRotation.getColumn(0), this.baseRotation.getColumn(2), this.baseRotation.getColumn(1)));
    } else if (CreateTorusPhase.AcceptAngle === this.createPhase && 2 === nPts) {
      hints.setModePolar();
      hints.setOrigin(this.accepted[1]);
      hints.setOriginFixed = true;
      if (undefined !== this.baseRotation)
        hints.setMatrix(this.baseRotation);
    }

    hints.sendHints();
  }

  private _usePrimaryRadiusProperty: DialogProperty<boolean> | undefined;
  public get usePrimaryRadiusProperty() {
    if (!this._usePrimaryRadiusProperty)
      this._usePrimaryRadiusProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useTorusPrimaryRadius"), false);
    return this._usePrimaryRadiusProperty;
  }

  public get usePrimaryRadius(): boolean { return this.usePrimaryRadiusProperty.value; }
  public set usePrimaryRadius(value: boolean) { this.usePrimaryRadiusProperty.value = value; }

  private _primaryRadiusProperty: DialogProperty<number> | undefined;
  public get primaryRadiusProperty() {
    if (!this._primaryRadiusProperty)
      this._primaryRadiusProperty = new DialogProperty<number>(new LengthDescription("torusPrimaryRadius", EditTools.translate("CreateTorus.Label.PrimaryRadius")), 0.1, undefined, !this.usePrimaryRadius);
    return this._primaryRadiusProperty;
  }

  public get primaryRadius(): number { return this.primaryRadiusProperty.value; }
  public set primaryRadius(value: number) { this.primaryRadiusProperty.value = value; }

  private _useSecondaryRadiusProperty: DialogProperty<boolean> | undefined;
  public get useSecondaryRadiusProperty() {
    if (!this._useSecondaryRadiusProperty)
      this._useSecondaryRadiusProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useTorusSecondaryRadius"), false);
    return this._useSecondaryRadiusProperty;
  }

  public get useSecondaryRadius(): boolean { return this.useSecondaryRadiusProperty.value; }
  public set useSecondaryRadius(value: boolean) { this.useSecondaryRadiusProperty.value = value; }

  private _secondaryRadiusProperty: DialogProperty<number> | undefined;
  public get secondaryRadiusProperty() {
    if (!this._secondaryRadiusProperty)
      this._secondaryRadiusProperty = new DialogProperty<number>(new LengthDescription("torusSecondaryRadius", EditTools.translate("CreateTorus.Label.SecondaryRadius")), 0.05, undefined, !this.useSecondaryRadius);
    return this._secondaryRadiusProperty;
  }

  public get secondaryRadius(): number { return this.secondaryRadiusProperty.value; }
  public set secondaryRadius(value: number) { this.secondaryRadiusProperty.value = value; }

  private _useAngleProperty: DialogProperty<boolean> | undefined;
  public get useAngleProperty() {
    if (!this._useAngleProperty)
      this._useAngleProperty = new DialogProperty<boolean>(PropertyDescriptionHelper.buildLockPropertyDescription("useTorusAngle"), false);
    return this._useAngleProperty;
  }

  public get useAngle(): boolean { return this.useAngleProperty.value; }
  public set useAngle(value: boolean) { this.useAngleProperty.value = value; }

  private _angleProperty: DialogProperty<number> | undefined;
  public get angleProperty() {
    if (!this._angleProperty)
      this._angleProperty = new DialogProperty<number>(new AngleDescription("torusAngle", EditTools.translate("CreateTorus.Label.Angle")), Math.PI / 2.0, undefined, !this.useAngle);
    return this._angleProperty;
  }

  public get angle(): number { return this.angleProperty.value; }
  public set angle(value: number) { this.angleProperty.value = value; }

  private _cappedProperty: DialogProperty<boolean> | undefined;
  public get cappedProperty() {
    if (!this._cappedProperty)
      this._cappedProperty = new DialogProperty<boolean>(
        PropertyDescriptionHelper.buildToggleDescription("torusCapped", EditTools.translate("CreateTorus.Label.Capped")), true);
    return this._cappedProperty;
  }

  public get capped(): boolean { return this.cappedProperty.value; }
  public set capped(value: boolean) { this.cappedProperty.value = value; }

  protected override isComplete(_ev: BeButtonEvent): boolean {
    return (CreateTorusPhase.AcceptResult === this.createPhase);
  }

  protected override async updateElementData(ev: BeButtonEvent, isDynamics: boolean): Promise<void> {
    const vp = this.targetView;
    if (undefined === vp)
      return;

    switch (this.createPhase) {
      case CreateTorusPhase.AcceptStart: {
        if (isDynamics)
          break;

        this.accepted.push(ev.point.clone());
        this.createPhase = CreateTorusPhase.AcceptCenter;
        break;
      }

      case CreateTorusPhase.AcceptCenter: {
        this.baseRotation = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);

        const normal = this.baseRotation ? this.baseRotation.getColumn(2) : Vector3d.unitZ();
        const vector0 = Vector3d.createStartEnd(ev.point, this.accepted[0]);
        const vector90 = normal.crossProduct(vector0);
        const primaryRadius = (this.usePrimaryRadius ? this.primaryRadius : vector0.magnitude());

        if (!this.usePrimaryRadius) {
          this.primaryRadius = primaryRadius;
          this.syncToolSettingPropertyValue(this.primaryRadiusProperty);
        }

        if (undefined === vector0.scaleToLength(primaryRadius, vector0) || undefined === vector90.scaleToLength(primaryRadius, vector90)) {
          this.current = undefined;
          this.clearGraphics();
          return;
        }

        const center = this.accepted[0].plus(vector0.negate());
        const allowComplete = (this.useSecondaryRadius && this.useAngle && (2 * Math.PI) === this.angle);

        if (allowComplete) {
          vector0.normalizeInPlace();
          vector90.normalizeInPlace();

          this.current = TorusPipe.createDgnTorusPipe(center, vector0, vector90, primaryRadius, this.secondaryRadius, Angle.createRadians(this.angle), this.capped);

          if (undefined === this.current) {
            this.clearGraphics();
            break;
          }

          if (!isDynamics)
            this.createPhase = CreateTorusPhase.AcceptResult;
          break;
        }

        const arc = Arc3d.create(center, vector0, vector90);
        this.baseRotation = Matrix3d.createRigidFromMatrix3d(arc.matrixRef); // Update base rotation from result arc...
        this.current = arc;

        if (isDynamics)
          break;

        this.accepted.push(arc.center); // Add center to accepted points for AccuDraw hints...
        this.createPhase = (this.useSecondaryRadius ? CreateTorusPhase.AcceptAngle : CreateTorusPhase.AcceptSecondaryRadius);
        break;
      }

      case CreateTorusPhase.AcceptSecondaryRadius: {
        const vector0 = Vector3d.createStartEnd(this.accepted[0], ev.point);
        const secondaryRadius = (this.useSecondaryRadius ? this.secondaryRadius : Math.min(this.primaryRadius, vector0.magnitude()));

        if (!this.useSecondaryRadius) {
          this.secondaryRadius = secondaryRadius;
          this.syncToolSettingPropertyValue(this.secondaryRadiusProperty);
        }

        const xAxis = this.baseRotation ? this.baseRotation.getColumn(0) : Vector3d.unitX();
        const yAxis = this.baseRotation ? this.baseRotation.getColumn(1) : Vector3d.unitY();

        if (undefined === vector0.scaleToLength(secondaryRadius, vector0)) {
          xAxis.scaleToLength(this.primaryRadius, xAxis);
          yAxis.scaleToLength(this.primaryRadius, yAxis);

          this.current = Arc3d.create(this.accepted[1], xAxis, yAxis);
          return;
        }

        const sweep = Angle.createRadians(this.useAngle ? this.angle : 2 * Math.PI);
        this.current = TorusPipe.createDgnTorusPipe(this.accepted[1], xAxis, yAxis, this.primaryRadius, secondaryRadius, sweep, this.capped);

        if (undefined === this.current) {
          this.clearGraphics();
          break;
        }

        if (!isDynamics)
          this.createPhase = ((this.useAngle && (2 * Math.PI) === this.angle) ? CreateTorusPhase.AcceptResult : CreateTorusPhase.AcceptAngle);
        break;
      }

      case CreateTorusPhase.AcceptAngle: {
        const vector90 = Vector3d.createStartEnd(this.accepted[1], ev.point);

        const xAxis = this.baseRotation ? this.baseRotation.getColumn(0) : Vector3d.unitX();
        const yAxis = this.baseRotation ? this.baseRotation.getColumn(1) : Vector3d.unitY();
        const zAxis = this.baseRotation ? this.baseRotation.getColumn(2) : Vector3d.unitZ();

        const prevSweep = Angle.createRadians(this.angle);
        const sweep = xAxis.planarAngleTo(vector90, zAxis);

        if (Math.abs(sweep.radians) < Angle.createDegrees(30.0).radians && prevSweep.isFullCircle && ((sweep.radians < 0.0 && prevSweep.radians > 0.0) || (sweep.radians > 0.0 && prevSweep.radians < 0.0)))
          prevSweep.setRadians(-prevSweep.radians); // Reverse direction...

        if (sweep.isAlmostZero)
          sweep.setDegrees(prevSweep.radians < 0.0 ? -360.0 : 360.0); // Create full sweep...

        if (this.useAngle) {
          if ((sweep.radians < 0.0 && this.angle > 0.0) || (sweep.radians > 0.0 && this.angle < 0.0))
            sweep.setRadians(-this.angle);
          else
            sweep.setRadians(this.angle);
        } else {
          if (sweep.radians < 0.0 && prevSweep.radians > 0.0)
            sweep.setRadians(Angle.pi2Radians + sweep.radians);
          else if (sweep.radians > 0.0 && prevSweep.radians < 0.0)
            sweep.setRadians(-(Angle.pi2Radians - sweep.radians));

          this.angle = sweep.radians;
          this.syncToolSettingPropertyValue(this.angleProperty);
        }

        this.current = TorusPipe.createDgnTorusPipe(this.accepted[1], xAxis, yAxis, this.primaryRadius, this.secondaryRadius, sweep, this.capped);

        if (undefined === this.current) {
          this.clearGraphics();
          break;
        }

        if (!isDynamics)
          this.createPhase = CreateTorusPhase.AcceptResult;
        break;
      }
    }
  }

  protected override getToolSettingPropertyLocked(property: DialogProperty<any>): DialogProperty<any> | undefined {
    if (property === this.usePrimaryRadiusProperty)
      return this.primaryRadiusProperty;
    else if (property === this.useSecondaryRadiusProperty)
      return this.secondaryRadiusProperty;
    else if (property === this.useAngleProperty)
      return this.angleProperty;
    return undefined;
  }

  public override async applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): Promise<boolean> {
    return this.changeToolSettingPropertyValue(updatedValue);
  }

  public override supplyToolSettingsProperties(): DialogItem[] | undefined {
    this.initializeToolSettingPropertyValues([this.primaryRadiusProperty, this.usePrimaryRadiusProperty, this.secondaryRadiusProperty, this.useSecondaryRadiusProperty, this.angleProperty, this.useAngleProperty, this.cappedProperty]);

    const toolSettings = new Array<DialogItem>();

    this.primaryRadiusProperty.isDisabled = !this.usePrimaryRadius;
    const usePrimaryRadiusLock = this.usePrimaryRadiusProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 });
    toolSettings.push(this.primaryRadiusProperty.toDialogItem({ rowPriority: 1, columnIndex: 1 }, usePrimaryRadiusLock));

    this.secondaryRadiusProperty.isDisabled = !this.useSecondaryRadius;
    const useSecondaryRadiusLock = this.useSecondaryRadiusProperty.toDialogItem({ rowPriority: 2, columnIndex: 0 });
    toolSettings.push(this.secondaryRadiusProperty.toDialogItem({ rowPriority: 2, columnIndex: 1 }, useSecondaryRadiusLock));

    this.angleProperty.isDisabled = !this.useAngle;
    const useAngleLock = this.useAngleProperty.toDialogItem({ rowPriority: 3, columnIndex: 0 });
    toolSettings.push(this.angleProperty.toDialogItem({ rowPriority: 3, columnIndex: 1 }, useAngleLock));

    toolSettings.push(this.cappedProperty.toDialogItem({ rowPriority: 4, columnIndex: 0 }));

    return toolSettings;
  }

  public async onRestartTool(): Promise<void> {
    const tool = new CreateTorusTool();
    if (!await tool.run())
      return this.exitTool();
  }
}
