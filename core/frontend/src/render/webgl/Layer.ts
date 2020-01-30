/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { assert } from "@bentley/bentleyjs-core";
import { RenderGraphic } from "../RenderGraphic";
import { RenderMemory } from "../RenderSystem";
import { RenderPass } from "./RenderFlags";
import { Graphic } from "./Graphic";
import { RenderCommands } from "./RenderCommands";

abstract class GraphicWrapper extends Graphic {
  protected readonly _graphic: Graphic;

  protected constructor(graphic: Graphic) {
    super();
    this._graphic = graphic;
  }

  public dispose(): void {
    this._graphic.dispose();
  }

  public get isDisposed(): boolean {
    return this._graphic.isDisposed;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this._graphic.collectStatistics(stats);
  }
}

class Layer extends GraphicWrapper {
  private readonly _layerId: string;

  public constructor(graphic: Graphic, layerId: string) {
    super(graphic);
    this._layerId = layerId;
  }

  public addCommands(commands: RenderCommands): void {
    assert(commands.isDrawingLayers);
    if (commands.isDrawingLayers)
      this._graphic.addCommands(commands);
  }

  public addHiliteCommands(commands: RenderCommands, pass: RenderPass): void {
    assert(commands.isDrawingLayers);
    if (commands.isDrawingLayers)
      this._graphic.addHiliteCommands(commands, pass);
  }
}

class LayerContainer extends GraphicWrapper {
  public constructor(graphic: Graphic) {
    super(graphic);
  }

  public addCommands(commands: RenderCommands): void {
    commands.addLayerCommands(() => this._graphic.addCommands(commands));
  }

  public addHiliteCommands(commands: RenderCommands, pass: RenderPass): void {
    commands.addLayerCommands(() => this._graphic.addHiliteCommands(commands, pass));
  }
}

/** @internal */
export function createGraphicLayer(graphic: RenderGraphic, layerId: string): RenderGraphic {
  return new Layer(graphic as Graphic, layerId);
}

/** @internal */
export function createGraphicLayerContainer(graphic: RenderGraphic): RenderGraphic {
  return new LayerContainer(graphic as Graphic);
}
