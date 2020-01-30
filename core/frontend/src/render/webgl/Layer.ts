/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import {
  assert,
  compareNumbers,
  compareStrings,
  SortedArray,
} from "@bentley/bentleyjs-core";
import { RenderGraphic } from "../RenderGraphic";
import { RenderMemory } from "../RenderSystem";
import { RenderPass } from "./RenderFlags";
import { Graphic } from "./Graphic";
import { RenderCommands } from "./RenderCommands";
import {
  DrawCommand,
  PopCommand,
  PushCommand,
} from "./DrawCommand";

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

/** @internal */
export class Layer extends GraphicWrapper {
  public readonly layerId: string;

  public get graphic(): Graphic { return this._graphic; }

  public constructor(graphic: Graphic, layerId: string) {
    super(graphic);
    this.layerId = layerId;
  }

  public addCommands(commands: RenderCommands): void {
    commands.addLayerCommands(this);
  }

  public addHiliteCommands(commands: RenderCommands, pass: RenderPass): void {
    commands.addHiliteLayerCommands(this._graphic, pass);
  }
}

class LayerContainer extends GraphicWrapper {
  public constructor(graphic: Graphic) {
    super(graphic);
  }

  public addCommands(commands: RenderCommands): void {
    commands.processLayers(this, this._graphic);
  }

  public addHiliteCommands(commands: RenderCommands, pass: RenderPass): void {
    commands.addHiliteLayerCommands(this._graphic, pass);
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

/** DrawCommands associated with one Layer, drawn during the Layers render pass. */
class LayerCommands {
  public readonly layerId: string;
  public readonly priority: number;
  public readonly commands: DrawCommand[] = [];
  public currentContainer?: object;

  public constructor(layerId: string, priority: number, cmds: DrawCommand[], container: object) {
    this.layerId = layerId;
    this.priority = priority;
    this.currentContainer = container;

    for (const cmd of cmds)
      this.commands.push(cmd);
  }
}

/** Organizes DrawCommands by layer. Once all commands have been added, each LayerCommands list of commands can be concatenated to produce
 * the full, ordered list of commands for the Layers render pass.
 * The array is sorted in ascending order by priority so that lower-priority commands execute first, allowing geometry from subsequent commands to
 * overwrite them in the depth buffer.
 */
export class LayerCommandMap extends SortedArray<LayerCommands> {
  // Commands that need to be pushed onto any new LayerCommands before adding primitive commands.
  private readonly _pushCommands: PushCommand[] = [];
  private readonly _popCommands: PopCommand[] = [];
  private _currentContainer?: object;
  private _currentLayer?: Layer;
  private _fakePriority = 0;

  public constructor() {
    super((lhs: LayerCommands, rhs: LayerCommands) => {
      const cmp = compareNumbers(lhs.priority, rhs.priority);
      return 0 !== cmp ? cmp : compareStrings(lhs.layerId, rhs.layerId);
    });
  }

  public clear(): void {
    super.clear();
    this._fakePriority = 0;
    assert(0 === this._pushCommands.length);
    assert(0 === this._popCommands.length);
    assert(undefined === this._currentContainer);
    assert(undefined === this._currentLayer);
  }

  public processLayers(container: object, func: () => void): void {
    assert(undefined === this._currentContainer);
    assert(undefined === this._currentLayer);

    this._currentContainer = container;

    func();

    for (const entry of this._array) {
      if (entry.currentContainer === this._currentContainer) {
        for (let i = this._popCommands.length - 1; i >= 0; i--)
          entry.commands.push(this._popCommands[i]);
      }
    }

    this._pushCommands.length = this._popCommands.length = 0;

    assert(undefined === this._currentLayer);
    this._currentContainer = undefined;
  }

  public pushAndPop(push: PushCommand, pop: PopCommand, func: () => void): void {
    assert(undefined !== this._currentContainer);
    if (undefined !== this._currentLayer) {
      const cmds = this.getCommands(this._currentLayer);
      cmds.commands.push(push);
      func();
      cmds.commands.push(pop);
    } else {
      this._pushCommands.push(push);
      this._popCommands.push(pop);
      func();
    }
  }

  public set currentLayer(layer: Layer | undefined) {
    assert(undefined === layer || undefined === this._currentLayer);
    this._currentLayer = layer;
  }

  public addCommands(commands: DrawCommand[]): void {
    assert(undefined !== this._currentContainer);
    assert(undefined !== this._currentLayer);

    const cmds = this.getCommands(this._currentLayer);
    for (const command of commands)
      cmds.commands.push(command);
  }

  public outputCommands(cmds: DrawCommand[]): void {
    for (const entry of this._array)
      for (const cmd of entry.commands)
        cmds.push(cmd);
  }

  private getCommands(layer: Layer): LayerCommands {
    for (const entry of this._array) {
      if (entry.layerId === layer.layerId) {
        if (entry.currentContainer !== this._currentContainer) {
          for (const cmd of this._pushCommands)
            entry.commands.push(cmd);

          entry.currentContainer = this._currentContainer;
          return entry;
        }
      }
    }

    const cmds = new LayerCommands(layer.layerId, ++this._fakePriority, this._pushCommands, this._currentContainer!);
    this.insert(cmds);
    return cmds;
  }
}
