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
  Id64,
  SortedArray,
} from "@bentley/bentleyjs-core";
import { Point3d } from "@bentley/geometry-core";
import { RenderMemory } from "../RenderMemory";
import { RenderPass } from "./RenderFlags";
import { Graphic } from "./Graphic";
import { RenderCommands } from "./RenderCommands";
import {
  DrawCommand,
  DrawCommands,
  PopCommand,
  PushCommand,
} from "./DrawCommand";
import { Target } from "./Target";

abstract class GraphicWrapper extends Graphic {
  public readonly graphic: Graphic;

  protected constructor(graphic: Graphic) {
    super();
    this.graphic = graphic;
  }

  public dispose(): void {
    this.graphic.dispose();
  }

  public get isDisposed(): boolean {
    return this.graphic.isDisposed;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this.graphic.collectStatistics(stats);
  }
}

/** Within a single tile, contains graphics belonging to a single layer.
 * The same layer may appear in multiple tiles, both within the same tile tree and in other tile trees.
 * Within a single tile tree, all Layers are contained within the same LayerContainer.
 * @internal
 */
export class Layer extends GraphicWrapper {
  public readonly layerId: string;
  private readonly _idLo: number;
  private readonly _idHi: number;

  public constructor(graphic: Graphic, layerId: string) {
    super(graphic);
    this.layerId = layerId;

    const pair = Id64.getUint32Pair(layerId);
    this._idLo = pair.lower;
    this._idHi = pair.upper;
  }

  public getPriority(target: Target): number {
    return target.currentFeatureSymbologyOverrides.getSubCategoryPriority(this._idLo, this._idHi);
  }

  public addCommands(commands: RenderCommands): void {
    commands.addLayerCommands(this);
  }

  public addHiliteCommands(commands: RenderCommands, pass: RenderPass): void {
    commands.addHiliteLayerCommands(this.graphic, pass);
  }
}

/** Contains a GraphicBranch that can contain Layers, for a single model / tile-tree.
 * All geometry within the container has the same Z.
 * @internal
 */
export class LayerContainer extends GraphicWrapper {
  public readonly renderPass: RenderPass;

  public constructor(graphic: Graphic, drawAsOverlay: boolean, transparency: number) {
    super(graphic);
    if (drawAsOverlay)
      this.renderPass = RenderPass.OverlayLayers;
    else if (transparency > 0)
      this.renderPass = RenderPass.TranslucentLayers;
    else
      this.renderPass = RenderPass.OpaqueLayers; // ###TODO: What about layers containing naturally-transparent geometry?
  }

  public addCommands(commands: RenderCommands): void {
    commands.processLayers(this);
  }

  public addHiliteCommands(commands: RenderCommands, pass: RenderPass): void {
    commands.addHiliteLayerCommands(this.graphic, pass);
  }
}

/** DrawCommands associated with one Layer, drawn during the Layers render pass. */
class LayerCommands {
  public readonly layerId: string;
  public readonly priority: number;
  public readonly elevation: number;
  public readonly commands: DrawCommand[] = [];
  public currentContainer?: LayerContainer;

  public constructor(layerId: string, priority: number, cmds: DrawCommand[], container: LayerContainer, elevation: number) {
    this.layerId = layerId;
    this.priority = priority;
    this.elevation = elevation;
    this.currentContainer = container;

    for (const cmd of cmds)
      this.commands.push(cmd);
  }
}

const scratchModelPt = new Point3d();
const scratchViewPt = new Point3d();

/** Organizes DrawCommands by layer. Once all commands have been added, each LayerCommands list of commands can be concatenated to produce
 * the full, ordered list of commands for the Layers render pass.
 * The array is sorted in ascending order by priority so that lower-priority commands execute first, allowing geometry from subsequent commands to
 * overwrite them in the depth buffer.
 * @internal
 */
class LayerCommandMap extends SortedArray<LayerCommands> {
  // Commands that need to be pushed onto any new LayerCommands before adding primitive commands.
  private readonly _pushCommands: PushCommand[] = [];
  private readonly _popCommands: PopCommand[] = [];
  private readonly _target: Target;
  private _currentContainer?: LayerContainer;
  private _currentContainerElevation?: number;
  private _currentLayer?: Layer;

  public constructor(target: Target) {
    // Layers with different view Z draw in ascending order by Z.
    // Layers with same elevation draw in ascending order by priority.
    // Layers with same elevation and priority draw in indeterminate order.
    super((lhs: LayerCommands, rhs: LayerCommands) => {
      let cmp = compareNumbers(lhs.elevation, rhs.elevation);
      if (0 === cmp) {
        cmp = compareNumbers(lhs.priority, rhs.priority);
        if (0 === cmp)
          cmp = compareStrings(lhs.layerId, rhs.layerId);
      }

      return cmp;
    });

    this._target = target;
  }

  public clear(): void {
    super.clear();
    assert(0 === this._pushCommands.length);
    assert(0 === this._popCommands.length);
    assert(undefined === this._currentContainer);
    assert(undefined === this._currentLayer);
  }

  public processLayers(container: LayerContainer, func: () => void): void {
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
    this._currentContainerElevation = undefined;
  }

  public pushAndPop(push: PushCommand, pop: PopCommand, func: () => void): void {
    assert(undefined !== this._currentContainer);
    if (undefined !== this._currentLayer) {
      const cmds = this.getCommands();
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

    // Each layer container has a fixed Z. Different containers at different Zs can contain the same layer(s).
    // The first time we encounter any layer for a given container, compute the Z for that container.
    if (undefined === this._currentContainerElevation) {
      scratchModelPt.set(0, 0, this._target.currentTransform.origin.z);
      const viewPt = this._target.modelToView(scratchModelPt, scratchViewPt);
      this._currentContainerElevation = viewPt.z;
    }
  }

  public addCommands(commands: DrawCommand[]): void {
    assert(undefined !== this._currentContainer);
    assert(undefined !== this._currentContainerElevation);
    assert(undefined !== this._currentLayer);

    const cmds = this.getCommands();
    for (const command of commands)
      cmds.commands.push(command);
  }

  public outputCommands(cmds: DrawCommand[]): void {
    for (const entry of this._array)
      for (const cmd of entry.commands)
        cmds.push(cmd);
  }

  private getCommands(): LayerCommands {
    assert(undefined !== this._currentLayer && undefined !== this._currentContainerElevation);
    const layer = this._currentLayer;
    const elevation = this._currentContainerElevation;
    for (const entry of this._array) {
      if (entry.layerId === layer.layerId && entry.elevation === elevation) {
        if (entry.currentContainer !== this._currentContainer) {
          for (const cmd of this._pushCommands)
            entry.commands.push(cmd);

          entry.currentContainer = this._currentContainer;
          return entry;
        }
      }
    }

    const cmds = new LayerCommands(layer.layerId, layer.getPriority(this._target), this._pushCommands, this._currentContainer!, elevation);
    this.insert(cmds);
    return cmds;
  }
}

/** @internal */
export class LayerCommandLists {
  private readonly _maps: LayerCommandMap[] = [];
  private readonly _renderCommands: RenderCommands;
  private _activeMap?: LayerCommandMap;

  public constructor(cmds: RenderCommands) {
    this._renderCommands = cmds;
  }

  public clear(): void {
    this._maps.length = 0;
  }

  public processLayers(container: LayerContainer, func: () => void): void {
    assert(undefined === this._activeMap);
    const pass = container.renderPass;
    this._activeMap = this._maps[pass];
    if (undefined === this._activeMap) {
      this._activeMap = new LayerCommandMap(this._renderCommands.target);
      this._maps[pass] = this._activeMap;
    }

    this._activeMap.processLayers(container, func);
    this._activeMap = undefined;
  }

  public set currentLayer(layer: Layer | undefined) {
    assert(undefined !== this._activeMap);
    this._activeMap.currentLayer = layer;
  }

  public addCommands(cmds: DrawCommands): void {
    assert(undefined !== this._activeMap);
    this._activeMap.addCommands(cmds);
  }

  public pushAndPop(push: PushCommand, pop: PopCommand, func: () => void): void {
    assert(undefined !== this._activeMap);
    this._activeMap.pushAndPop(push, pop, func);
  }

  public outputCommands(): void {
    this.outputCommandsForPass(RenderPass.OpaqueLayers);
    this.outputCommandsForPass(RenderPass.TranslucentLayers);
    this.outputCommandsForPass(RenderPass.OverlayLayers);
  }

  private outputCommandsForPass(pass: RenderPass): void {
    const map = this._maps[pass];
    if (undefined !== map)
      map.outputCommands(this._renderCommands.getCommands(pass));
  }
}
