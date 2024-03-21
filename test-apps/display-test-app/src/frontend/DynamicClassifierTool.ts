/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64 } from "@itwin/core-bentley";
import { ColorDef, Feature, SpatialClassifierFlags } from "@itwin/core-common";
import { BeButtonEvent, DecorateContext, EventHandled, GraphicType, HitDetail, IModelApp, IModelConnection, LocateFilterStatus, LocateResponse, PrimitiveTool, RenderGraphic, SpatialClassifiersState, SpatialModelState, TileTreeReference, Viewport } from "@itwin/core-frontend";
import { Point3d, Sphere as SpherePrimitive } from "@itwin/core-geometry";

function getColor(index: number): ColorDef {
  const colors = [ColorDef.red, ColorDef.blue, ColorDef.green, ColorDef.white, ColorDef.black];
  return colors[index % colors.length];
}

interface Sphere {
  id: string;
  center: Point3d;
}

class Spheres {
  private readonly _radius = 10;
  private readonly _chordTolerance = 0.01;
  public readonly spheres: Sphere[] = [];
  public readonly modelId: string;

  constructor(private readonly _iModel: IModelConnection) {
    this.modelId = this._iModel.transientIds.getNext();
  }

  public add(point: Point3d) {
    this.spheres.push({
      id: this._iModel.transientIds.getNext(),
      center: point,
    });
  }

  public toGraphic(): RenderGraphic {
    const builder = IModelApp.renderSystem.createGraphic({
      type: GraphicType.Scene,
      computeChordTolerance: () => this._chordTolerance,
      pickable: {
        modelId: this.modelId,
        id: this.modelId,
      },
    });

    for (let i = 0; i < this.spheres.length; i++) {
      const entry = this.spheres[i];
      const color = getColor(i);
      builder.setSymbology(color, color, 1);
      builder.activateFeature(new Feature(entry.id));

      const sphere = SpherePrimitive.createCenterRadius(entry.center, this._radius);
      builder.addSolidPrimitive(sphere);
    }

    return builder.finish();
  }
}

export class DynamicClassifierTool extends PrimitiveTool {
  private _graphic?: RenderGraphic;
  private _spheres?: Spheres;
  private _classifiers?: SpatialClassifiersState;

  public static override toolId = "DtaClassify";

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public override async onPostInstall() {
    await super.onPostInstall();
    this.setupAndPromptForNextAction();
  }

  public override async onUnsuspend(): Promise<void> {
    this.showPrompt();
  }

  private setupAndPromptForNextAction(): void {
    this.initLocateElements(undefined === this._classifiers, undefined !== this._classifiers);
    IModelApp.locateManager.options.allowDecorations = true;
    this.showPrompt();
  }

  private showPrompt() {
    IModelApp.notifications.outputPrompt(undefined === this._classifiers ? "Select reality model" : "Enter sphere center");
  }

  private findClassifiers(hit: HitDetail): SpatialClassifiersState | undefined {
    if (!hit.viewport || undefined === hit.modelId) {
      return undefined;
    }

    if (Id64.isTransient(hit.modelId)) {
      const model = hit.viewport.displayStyle.contextRealityModelStates.find((x) => x.modelId === hit.modelId);
      return model?.classifiers;
    } else {
      const model = hit.iModel.models.getLoaded(hit.modelId);
      if (model && model instanceof SpatialModelState) {
        return model?.classifiers;
      }
    }

    return undefined;
  }
    
  public override async filterHit(hit: HitDetail): Promise<LocateFilterStatus> {
    if (this._classifiers) {
      return LocateFilterStatus.Accept;
    }

    return this.findClassifiers(hit) ? LocateFilterStatus.Accept : LocateFilterStatus.Reject;
  }

  public override async onDataButtonDown(ev: BeButtonEvent) {
    if (!ev.viewport) {
      return EventHandled.No;
    }

    // First data button identifies the reality model to classify.
    if (!this._classifiers) {
      const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
      if (hit) {
        this._classifiers = this.findClassifiers(hit);
      }
    } else {
      // Subsequent data buttons place spheres with which to classify the reality model.
      if (!this._spheres) {
        this._spheres = new Spheres(ev.viewport.iModel);
      }

      this._spheres.add(ev.point);
      this._graphic?.dispose();
      this._graphic = this._spheres.toGraphic();
      ev.viewport?.invalidateDecorations();
    }

    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public override async onResetButtonUp(ev: BeButtonEvent) {
    // Reset button applies the classifiers and terminates the tool.
    if (ev.viewport) {
      this.applyClassifier(ev.viewport);
    }

    await this.exitTool();
    return EventHandled.No;
  }

  private applyClassifier(viewport: Viewport) {
    const spheres = this._spheres;
    if (!this._classifiers || !this._graphic || !spheres) {
      return;
    }

    const sphereIds = spheres.spheres.map((x) => x.id);
    const tileTreeReference = TileTreeReference.createFromRenderGraphic({
      iModel: viewport.iModel,
      graphic: this._graphic,
      modelId: spheres.modelId,
      getToolTip: async (hit: HitDetail) => {
        const index = sphereIds.indexOf(hit.sourceId);
        if (-1 !== index) {
          return Promise.resolve(`Sphere #${index + 1}`);
        } else {
          return undefined;
        }
      },
    });
    
    this._classifiers.activeClassifier = {
      tileTreeReference,
      name: "Spheres",
      flags: new SpatialClassifierFlags(undefined, undefined, true),
    };
  }

  public override decorate(context: DecorateContext) {
    if (this._graphic) {
      context.addDecoration(GraphicType.Scene, IModelApp.renderSystem.createGraphicOwner(this._graphic));
    }
  }

  public override decorateSuspended(context: DecorateContext) {
    this.decorate(context);
  }

  public override async onRestartTool() {
    return this.exitTool();
  }
}
