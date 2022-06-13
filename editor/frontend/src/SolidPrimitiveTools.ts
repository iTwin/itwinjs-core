/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError } from "@itwin/core-bentley";
import { Arc3d, Cone, FrameBuilder, GeometryQuery, Loop, Matrix3d, Point3d, SolidPrimitive, Sphere, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { Code, ElementGeometry, ElementGeometryBuilderParams, FlatBufferGeometryStream, GeometricElementProps, JsonGeometryStream, PlacementProps } from "@itwin/core-common";
import { AccuDrawHintBuilder, BeButtonEvent, IModelApp, LengthDescription, NotifyMessageDetails, OutputMessagePriority, ToolAssistanceInstruction, Viewport } from "@itwin/core-frontend";
import { BasicManipulationCommandIpc, editorBuiltInCmdIds } from "@itwin/editor-common";
import { CreateElementWithDynamicsTool } from "./CreateElementTool";
import { EditTools } from "./EditTool";
import { DialogItem, DialogProperty, DialogPropertySyncItem, PropertyDescriptionHelper } from "@itwin/appui-abstract";

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

  public static callCommand<T extends keyof BasicManipulationCommandIpc>(method: T, ...args: Parameters<BasicManipulationCommandIpc[T]>): ReturnType<BasicManipulationCommandIpc[T]> {
    return EditTools.callCommand(method, ...args) as ReturnType<BasicManipulationCommandIpc[T]>;
  }

  protected getPlacementProps(): PlacementProps | undefined {
    if (undefined === this.current)
      return undefined;

    const localToWorld = ("solid" === this.current.geometryCategory ? (this.current as SolidPrimitive).getConstructiveFrame() : FrameBuilder.createRightHandedFrame(undefined, this.current));
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
      await SolidPrimitiveTool.callCommand("insertGeometricElement", props, data);
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

    const pt1 = this.accepted[0];
    const pt2 = ev.point;

    const vector0 = Vector3d.createStartEnd(pt1, pt2);
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

    this.current = Sphere.createFromAxesAndScales(pt1, this.baseRotation, radius, radius, radius, undefined, this.capped);

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
        this.accepted.push(ev.point.clone());
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

        if (isDynamics || undefined === this.current)
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
        this.accepted.push(ev.point.clone());
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

        if (isDynamics || undefined === this.current)
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

        const vector0 = Vector3d.createStartEnd(cone.getCenterB(), ev.point);
        const radius = (this.useTopRadius ? this.topRadius : vector0.magnitude());

        if (!this.useTopRadius) {
          this.topRadius = radius;
          this.syncToolSettingPropertyValue(this.topRadiusProperty);
        }

        this.current = Cone.createBaseAndTarget(cone.getCenterA(), cone.getCenterB(), cone.getVectorX(), cone.getVectorY(), cone.getRadiusA(), radius, this.capped);

        if (isDynamics || undefined === this.current)
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
    const useTopRadiusLock = this.useTopRadiusProperty.toDialogItem({ rowPriority: 1, columnIndex: 0 });
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

