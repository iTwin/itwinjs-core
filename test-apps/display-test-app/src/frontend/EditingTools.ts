/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, Id64String } from "@bentley/bentleyjs-core";
import {
  IModelJson, LineString3d, Point3d, Sphere, Vector3d, YawPitchRollAngles,
} from "@bentley/geometry-core";
import {
  Code, ColorDef, ElementGeometry, GeometryPartProps, GeometryStreamBuilder, GeometryStreamProps, IModel, PhysicalElementProps,
} from "@bentley/imodeljs-common";
import { EditTools } from "@bentley/imodeljs-editor-frontend";
import {
  AccuDrawHintBuilder, BeButtonEvent, DecorateContext, DynamicsContext,
  EventHandled, GraphicType, HitDetail, IModelApp, NotifyMessageDetails, OutputMessagePriority, PrimitiveTool, Tool,
} from "@bentley/imodeljs-frontend";
import { BasicManipulationCommandIpc, editorBuiltInCmdIds } from "@bentley/imodeljs-editor-common";
import { setTitle } from "./Title";

// Simple tools for testing interactive editing. They require the iModel to have been opened in read-write mode.

/** If an editing scope is currently in progress, end it; otherwise, begin a new one. */
export class EditingScopeTool extends Tool {
  public static toolId = "EditingSession";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 0; }

  public run(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this._run();
    return true;
  }

  private async _run(): Promise<void> {
    const imodel = IModelApp.viewManager.selectedView?.iModel;
    if (!imodel || !imodel.isBriefcaseConnection())
      return;

    const scope = imodel.editingScope;
    if (scope)
      await scope.exit();
    else
      await imodel.enterEditingScope();

    setTitle(imodel);
  }
}

/** Places a line string. The first model in the view's model selector and the first category in its category selector are used. */
export class PlaceLineStringTool extends PrimitiveTool {
  public static toolId = "PlaceLineString";
  private readonly _points: Point3d[] = [];
  private _snapGeomId?: Id64String;
  private _testGeomJson = false;
  private _testGeomParts = false;
  protected _startedCmd?: string;

  public requireWriteableTarget(): boolean { return true; }

  public onPostInstall(): void {
    super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);

    const nPts = this._points.length;
    const prompts = ["Enter start point", "Enter second point", "Enter next point or Reset to finish"];
    const prompt = prompts[Math.min(nPts, 2)];
    IModelApp.notifications.outputPrompt(prompt);

    if (0 === nPts)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.enableSmartRotation = true;

    if (nPts > 1 && !this._points[nPts - 1].isAlmostEqual(this._points[nPts - 2]))
      hints.setXAxis(Vector3d.createStartEnd(this._points[nPts - 2], this._points[nPts - 1])); // Rotate AccuDraw to last segment.

    hints.setOrigin(this._points[nPts - 1]);
    hints.sendHints();
  }

  public testDecorationHit(id: Id64String): boolean {
    return id === this._snapGeomId;
  }

  public getDecorationGeometry(_hit: HitDetail): GeometryStreamProps | undefined {
    if (this._points.length < 2)
      return undefined;

    const geom = IModelJson.Writer.toIModelJson(LineString3d.create(this._points));
    return geom ? [geom] : undefined;
  }

  public decorate(context: DecorateContext): void {
    if (this._points.length < 2)
      return;

    if (undefined === this._snapGeomId)
      this._snapGeomId = this.iModel.transientIds.next;

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined, this._snapGeomId);
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString([...this._points]);
    context.addDecorationFromBuilder(builder);
  }

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this._points.length < 1)
      return;

    // Only draw current segment in dynamics - accepted segments are drawn as pickable decorations.
    const builder = context.createSceneGraphicBuilder();
    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString([this._points[this._points.length - 1].clone(), ev.point.clone()]);
    context.addGraphic(builder.finish());
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this._points.push(ev.point.clone());
    this.setupAndPromptForNextAction();

    if (!this.isDynamicsStarted)
      this.beginDynamics();

    return EventHandled.No;
  }

  protected async startCommand(): Promise<string> {
    if (undefined !== this._startedCmd)
      return this._startedCmd;
    return EditTools.startCommand<string>(editorBuiltInCmdIds.cmdBasicManipulation, this.iModel.key);
  }

  public static callCommand<T extends keyof BasicManipulationCommandIpc>(method: T, ...args: Parameters<BasicManipulationCommandIpc[T]>): ReturnType<BasicManipulationCommandIpc[T]> {
    return EditTools.callCommand(method, ...args) as ReturnType<BasicManipulationCommandIpc[T]>;
  }

  private async createElement(): Promise<void> {
    const vp = this.targetView;
    assert(undefined !== vp);
    assert(2 <= this._points.length);

    let category;
    for (const catId of vp.view.categorySelector.categories) {
      category = catId;
      break;
    }

    if (undefined === category)
      return;

    let model;
    if (vp.view.is2d()) {
      model = vp.view.baseModelId;
    } else if (vp.view.isSpatialView()) {
      for (const modId of vp.view.modelSelector.models) {
        model = modId;
        break;
      }
    }

    if (undefined === model)
      return;

    const origin = this._points[0];
    const angles = new YawPitchRollAngles();

    const matrix = AccuDrawHintBuilder.getCurrentRotation(vp, true, true);
    ElementGeometry.Builder.placementAnglesFromPoints(this._points, matrix?.getColumn(2), angles);

    try {
      this._startedCmd = await this.startCommand();

      if (this._testGeomJson) {
        const builder = new GeometryStreamBuilder();
        const primitive = LineString3d.create(this._points);

        builder.setLocalToWorld3d(origin, angles); // Establish world to local transform...
        if (!builder.appendGeometry(primitive))
          return;

        if (this._testGeomParts) {
          const partBuilder = new GeometryStreamBuilder();
          const sphere = Sphere.createCenterRadius(Point3d.createZero(), this._points[0].distance(this._points[1]) * 0.05);

          if (!partBuilder.appendGeometry(sphere))
            return;

          const partProps: GeometryPartProps = { classFullName: "BisCore:GeometryPart", model: IModel.dictionaryId, code: Code.createEmpty(), geom: partBuilder.geometryStream };
          const partId = await PlaceLineStringTool.callCommand("insertGeometryPart", partProps);

          for (const pt of this._points) {
            if (!builder.appendGeometryPart3d(partId, pt))
              return;
          }
        }

        const elemProps: PhysicalElementProps = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty(), placement: { origin, angles }, geom: builder.geometryStream };
        await PlaceLineStringTool.callCommand("insertGeometricElement", elemProps);
        await this.saveChanges();
      } else {
        const builder = new ElementGeometry.Builder();
        const primitive = LineString3d.create(this._points);

        builder.setLocalToWorld3d(origin, angles); // Establish world to local transform...
        if (!builder.appendGeometryQuery(primitive))
          return;

        if (this._testGeomParts) {
          const partBuilder = new ElementGeometry.Builder();
          const sphere = Sphere.createCenterRadius(Point3d.createZero(), this._points[0].distance(this._points[1]) * 0.05);

          if (!partBuilder.appendGeometryQuery(sphere))
            return;

          const partProps: GeometryPartProps = { classFullName: "BisCore:GeometryPart", model: IModel.dictionaryId, code: Code.createEmpty() };
          const partId = await PlaceLineStringTool.callCommand("insertGeometryPart", partProps, { entryArray: partBuilder.entries });

          for (const pt of this._points) {
            if (!builder.appendGeometryPart3d(partId, pt))
              return;
          }
        }

        const elemProps: PhysicalElementProps = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty(), placement: { origin, angles } };
        await PlaceLineStringTool.callCommand("insertGeometricElement", elemProps, { entryArray: builder.entries });
        await this.saveChanges();
      }
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, err.toString()));
    }
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    if (this._points.length >= 2) {
      IModelApp.notifications.outputPrompt("");
      await this.createElement();
    }

    this.onReinitialize();
    return EventHandled.No;
  }

  public async onUndoPreviousStep(): Promise<boolean> {
    if (0 === this._points.length)
      return false;

    this._points.pop();
    if (0 === this._points.length)
      this.onReinitialize();
    else
      this.setupAndPromptForNextAction();

    return true;
  }

  public onRestartTool(): void {
    const tool = new PlaceLineStringTool();
    if (!tool.run())
      this.exitTool();
  }
}
