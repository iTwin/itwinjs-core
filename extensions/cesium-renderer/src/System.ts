/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ElementAlignedBox3d, RenderFeatureTable } from "@itwin/core-common";
import { Transform } from "@itwin/core-geometry";
import { BatchOptions, CreateGraphicFromTemplateArgs, CustomGraphicBuilderOptions, GraphicBranch, GraphicBranchOptions, GraphicBuilder, IModelApp, IModelConnection, InstancedGraphicParams, RenderAreaPattern, RenderGeometry, RenderGraphic, RenderSystem, RenderTarget, ViewportGraphicBuilderOptions, ViewRect } from "@itwin/core-frontend";
import { CesiumOffScreenTarget, CesiumOnScreenTarget } from "./Target.js";
import { CesiumGraphic } from "./Graphic.js";
import { PrimitiveConverterFactory } from "./decorations/PrimitiveConverterFactory.js";

/** @internal */
export function createCesiumRenderSystem(optionsIn?: RenderSystem.Options): RenderSystem {
  return CesiumSystem.create(optionsIn);
}

/** @internal */
export class CesiumSystem extends RenderSystem {
  private _removeEventListener?: () => void;

  public get isValid(): boolean { return true; }
  /** Override maxTextureSize to prevent VertexTable assertion errors */
  public override get maxTextureSize(): number { return 4096; }

  public static create(optionsIn?: RenderSystem.Options): CesiumSystem {
    const options: RenderSystem.Options = undefined !== optionsIn ? optionsIn : {};

    // ###TODO use new CesiumJS shared context API: https://github.com/CesiumGS/cesium/pull/12635

    return new this(options);
  }

  protected constructor(options: RenderSystem.Options) {
    super(options);

    // Make this System a subscriber to the the IModelConnection onClose event
    this._removeEventListener = IModelConnection.onClose.addListener((_model) => { /* this.removeIModelMap(imodel)); */ });
  }

  public dispose() {
    // ###TODO Implement disposal logic for Cesium System if necessary
    if (undefined !== this._removeEventListener) {
      this._removeEventListener();
      this._removeEventListener = undefined;
    }
  }

  public static get instance() { return IModelApp.renderSystem as CesiumSystem; }

  public createTarget(canvas: HTMLCanvasElement): RenderTarget {
    return new CesiumOnScreenTarget(canvas);
  }

  public createOffscreenTarget(rect: ViewRect): RenderTarget {
    return new CesiumOffScreenTarget(rect);
  }

  public doIdleWork(): boolean {
    // ###TODO - should we just remove the requirement for `doIdleWork` in a System? We are not using this anywhere anymore, right?
    return false;
  }

  public createGraphic(options: CustomGraphicBuilderOptions | ViewportGraphicBuilderOptions): GraphicBuilder {
    const coordinateBuilderClass = PrimitiveConverterFactory.getCoordinateBuilder();
    return new coordinateBuilderClass(this, options);
  }

  // ###TODO for all of the following create methods, we may need to implement separate classes for each type of graphic. Right now everything is using `CesiumGraphic` as a placeholder. In theory that might be able to handle everything, but we will see. Let's get one path working first!

  public override createGraphicFromTemplate(args: CreateGraphicFromTemplateArgs): RenderGraphic {
    const template = args.template;

    const templateId = (template as any)._coordinateTemplateId as symbol;
    const coordinateStorage = PrimitiveConverterFactory.getCoordinateStorage();
    const coordinateData = templateId ? coordinateStorage.getCoordinates(templateId) : undefined;

    const symbols = Object.getOwnPropertySymbols(template);
    const nodesSymbol = symbols.find(s => s.toString().includes('_nodes'));
    const templateNodes = nodesSymbol ? (template as any)[nodesSymbol] : [];

    const allGeometries: RenderGeometry[] = [];
    let geometryType = 'point-string';

    for (const node of templateNodes) {
      if (node.geometry && Array.isArray(node.geometry)) {
        allGeometries.push(...node.geometry);
        if (node.geometry.length > 0 && node.geometry[0].renderGeometryType) {
          geometryType = node.geometry[0].renderGeometryType;
        }
      }
    }

    const cesiumGraphic = new CesiumGraphic(allGeometries, geometryType);

    if (coordinateData) {
      (cesiumGraphic as any)._coordinateData = coordinateData;
      coordinateStorage.clearCoordinates(templateId);
    }

    return cesiumGraphic;
  }

  public override createRenderGraphic(geometry: RenderGeometry, _instances?: InstancedGraphicParams | RenderAreaPattern): RenderGraphic | undefined {
    // Pass the single geometry to CesiumGraphic
    return new CesiumGraphic([geometry], geometry.renderGeometryType);
  }

  public createGraphicList(_primitives: RenderGraphic[]): RenderGraphic {
    // ##TODO implement logic to create a graphic list from the array of primitives.
    return new CesiumGraphic();
  }

  public createGraphicBranch(_branch: GraphicBranch, _transform: Transform, _options?: GraphicBranchOptions): RenderGraphic {
    // ###TODO implement logic to create a graphic branch from the branch and transform
    return new CesiumGraphic();
  }

  public createBatch(_graphic: RenderGraphic, _features: RenderFeatureTable, _range: ElementAlignedBox3d, _options?: BatchOptions): RenderGraphic {
    // ###TODO implement logic to create a batch from the graphic, features, range, and options
    return new CesiumGraphic();
  }
}
