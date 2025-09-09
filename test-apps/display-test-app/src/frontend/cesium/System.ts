/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { ElementAlignedBox3d, RenderFeatureTable } from "@itwin/core-common";
import { Transform } from "@itwin/core-geometry";
import { OffScreenTarget, OnScreenTarget } from "./Target";
import { CesiumGraphic } from "./Graphic";
import { PrimitiveConverterFactory } from "./PrimitiveConverterFactory";
import { BatchOptions, CreateGraphicFromTemplateArgs, CustomGraphicBuilderOptions, GraphicBranch, GraphicBranchOptions, GraphicBuilder, IModelApp, IModelConnection, InstancedGraphicParams, PrimitiveBuilder, RenderAreaPattern, RenderGeometry, RenderGraphic, RenderSystem, RenderTarget, ViewportGraphicBuilderOptions, ViewRect } from "@itwin/core-frontend";


/** @internal */
export class System extends RenderSystem {
  private _removeEventListener?: () => void;

  // ###TODO
  public get isValid(): boolean { return true; }
  
  /** Override maxTextureSize to prevent VertexTable assertion errors */
  public override get maxTextureSize(): number { return 4096; }

  public static create(optionsIn?: RenderSystem.Options): System {
    console.log("creating Cesium System...");

    const options: RenderSystem.Options = undefined !== optionsIn ? optionsIn : {};

    // ###TODO use new CesiumJS shared context API: https://github.com/CesiumGS/cesium/pull/12635

    // const canvas = document.createElement("canvas");
    // if (null === canvas)
    //   throw new IModelError(BentleyStatus.ERROR, "Failed to obtain HTMLCanvasElement");

    // const context = this.createContext(canvas, true, optionsIn?.contextAttributes);
    // if (undefined === context)
    //   throw new IModelError(BentleyStatus.ERROR, "Failed to obtain WebGL context");

    // if (!(context instanceof WebGL2RenderingContext))
    //   throw new IModelError(BentleyStatus.ERROR, "WebGL 2 support is required");

    // const capabilities = Capabilities.create(context, options.disabledExtensions);
    // if (undefined === capabilities)
    //   throw new IModelError(BentleyStatus.ERROR, "Failed to initialize rendering capabilities");

    // // set actual gl state to match desired state defaults
    // context.depthFunc(GL.DepthFunc.Default);  // LessOrEqual

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

  public static get instance() { return IModelApp.renderSystem as System; }

  public createTarget(canvas: HTMLCanvasElement): RenderTarget {
    return new OnScreenTarget(canvas);
    // return new OnScreenTarget(canvas);
    // ###TODO Implement target creation logic for Cesium
  }

  public createOffscreenTarget(rect: ViewRect): RenderTarget {
    return new OffScreenTarget(rect);
  }

  public doIdleWork(): boolean {
    // ###TODO - should we just remove the requirement for `doIdleWork` in a System? We are not using this anywhere anymore, right?
    return false;
  }

  public createGraphic(options: CustomGraphicBuilderOptions | ViewportGraphicBuilderOptions): GraphicBuilder {
    const CoordinateBuilderClass = PrimitiveConverterFactory.getCoordinateBuilder();
    return new CoordinateBuilderClass(this, options);
  }


  // ##TODO for all of the following create methods, we may need to implement separate classes for each type of graphic. Right now everything is using `CesiumGraphic` as a placeholder. In theory that might be able to handle everything, but we will see. Let's get one path working first!

  public override createGraphicFromTemplate(args: CreateGraphicFromTemplateArgs): RenderGraphic {
    const template = args.template;
    
    const templateId = (template as any)._coordinateTemplateId as symbol;
    const CoordinateStorage = PrimitiveConverterFactory.getCoordinateStorage();
    const coordinateData = templateId ? CoordinateStorage.getCoordinates(templateId) : undefined;
    
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
      CoordinateStorage.clearCoordinates(templateId);
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

  public createGraphicBranch(_lBranch: GraphicBranch, _transform: Transform, _options?: GraphicBranchOptions): RenderGraphic {
    // ###TODO implement logic to create a graphic branch from the branch and transform
    return new CesiumGraphic();
  }

  public createBatch(_graphic: RenderGraphic, _features: RenderFeatureTable, _range: ElementAlignedBox3d, _options?: BatchOptions): RenderGraphic {
    // ###TODO implement logic to create a batch from the graphic, features, range, and options
    return new CesiumGraphic();
  }
}
