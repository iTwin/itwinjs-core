/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "@bentley/bentleyjs-core";
import { IModelJson, Polyface } from "@bentley/geometry-core";
import { AnalysisStyle } from "@bentley/imodeljs-common";
import {
  DecorateContext, GraphicType, IModelApp, RenderGraphicOwner, Viewport,
} from "@bentley/imodeljs-frontend";
import { Viewer } from "./Viewer";

type AnalysisMeshType = "Cantilever" | "Flat";

interface AnalysisMesh {
  readonly type: AnalysisMeshType;
  readonly polyface: Polyface;
  readonly styles: Map<string, AnalysisStyle | undefined>;
}

async function createCantilever(): Promise<AnalysisMesh> {
  const response = await fetch("Cantilever.json");
  const polyface = IModelJson.Reader.parse(await response.json()) as Polyface;
  assert(polyface instanceof Polyface);
  return {
    type: "Cantilever",
    polyface,
    styles: new Map<string, AnalysisStyle | undefined>(), // ###TODO styles
  };
}

class AnalysisDecorator {
  public readonly mesh: AnalysisMesh;
  private readonly _viewport: Viewport;
  private _graphic?: RenderGraphicOwner;
  private _dispose?: () => void;

  public constructor(viewport: Viewport, mesh: AnalysisMesh) {
    this._viewport = viewport;
    this.mesh = mesh;
    this._dispose = viewport.onDisposed.addOnce(() => this.dispose());
    IModelApp.viewManager.addDecorator(this);
  }

  public dispose(): void {
    if (!this._dispose) {
      assert(undefined === this._graphic);
      return;
    }

    this._graphic?.disposeGraphic();
    this._graphic = undefined;
    this._dispose();
    this._dispose = undefined;
    IModelApp.viewManager.dropDecorator(this);
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport !== this._viewport)
      return;

    if (!this._graphic) {
      const builder = context.createGraphicBuilder(GraphicType.WorldDecoration);
      builder.addPolyface(this.mesh.polyface, false);
      this._graphic = IModelApp.renderSystem.createGraphicOwner(builder.finish());
    }

    context.addDecoration(GraphicType.WorldDecoration, this._graphic);
  }
}

export async function openAnalysisStyleExample(viewer: Viewer): Promise<void> {
  const cantilever = await createCantilever();
  // const flat = await createAnalysisMesh("Flat")

  /* let decorator = */ new AnalysisDecorator(viewer.viewport, cantilever);
}
