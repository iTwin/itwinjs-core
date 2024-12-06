/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { createWorkerProxy, GraphicBranch, GraphicType, HitDetail, IModelApp, IModelConnection, readGltfGraphics, readGltfTemplate, RenderGraphic, RenderInstancesParamsBuilder, ScreenViewport, TiledGraphicsProvider, TileTreeReference, Viewport } from "@itwin/core-frontend";
import { Arc3d, Point3d, Sphere, Transform } from "@itwin/core-geometry";
import { CreateCirclesArgs, GraphicCreator, GraphicCreatorResult } from "./workers/ExampleWorker";

class FeatureProvider implements TiledGraphicsProvider {
  private static _instance?: FeatureProvider;
  public trees: TileTreeReference[] = [];

  private constructor(private _vp: Viewport) {
  }

  public static getInstance(vp: Viewport) {
    if (this._instance === undefined) {
      this._instance = new FeatureProvider(vp);
      vp.addTiledGraphicsProvider(this._instance);
    }
    return this._instance;
  }

  public forEachTileTreeRef(_viewport: ScreenViewport, func: (ref: TileTreeReference) => void): void {
    for (const tree of this.trees)
      func(tree);
  }
}

export function getCirclesData(center: Point3d) {
  const scaleFactor = 5;
  const xyzRadius = new Float64Array([
    center.x, center.y, center.z, scaleFactor,
    center.x + 100, center.y, center.z, scaleFactor,
    // center.x + 400, center.y + 400, center.z, scaleFactor]);
    center.x + 100, center.y, center.z+50, scaleFactor]);

  return {
    xyzRadius,
    colors: new Uint32Array([ColorDef.from(255, 0 , 0, 150).tbgr, ColorDef.from(0, 0 , 255, 150).tbgr, ColorDef.from(0, 255, 0, 150).tbgr]),
  };
}



export async function  testGraphicCreatorMain(vp: Viewport) {
  // vp.viewFlags = vp.viewFlags.copy({ renderMode: RenderMode.SmoothShade });
  // vp.viewFlags = vp.viewFlags.withRenderMode(RenderMode.SmoothShade);

  const gltfUrl = "https://publisher.orbitgt.com/objects/bollard.gltf";
  //  const gltfUrl = "https://publisher.orbitgt.com/objects/cone.gltf";
  // const gltfUrl = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/refs/heads/main/2.0/Duck/glTF-Embedded/Duck.gltf";
  // const gltfUrl = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/refs/heads/main/Models/CesiumMan/glTF/CesiumMan.gltf";
  const jsonData  = await (await fetch(gltfUrl)).json();
  const baseUrl = new URL(gltfUrl, window.location.href);

  const getGltf =  async (transform?: Transform) => {
    return readGltfGraphics({
      gltf: jsonData,
      iModel: vp.iModel,
      baseUrl,
      transform,
    });
  }
  const gltf = await readGltfGraphics({
    gltf: jsonData,
    iModel: vp.iModel,
    baseUrl
  });
//

  const useInstancing = true;
  const readGltfForEachInstance = true; // only used when 'useInstancing' is false
  const gltfTemplate =
      useInstancing
    ? await readGltfTemplate({
      gltf: jsonData,
      iModel: vp.iModel,
      baseUrl })
    : undefined;

  const modelId = vp.iModel.transientIds.getNext();
  const instanceBuilder = RenderInstancesParamsBuilder.create({modelId});

  const builder = IModelApp.renderSystem.createGraphic({
    type: GraphicType.Scene,
    computeChordTolerance: () => 0.01,
    pickable: {
      modelId,
      id: modelId,
    },
  });

  const circlesData = getCirclesData(vp.view.getCenter());
  const circles = circlesData.xyzRadius;
  const colors = circlesData.colors;

  const numCircles = circlesData.xyzRadius.length / 4;

  const mainBranch = new GraphicBranch();
  // Add each circle to the builder.
  for (let i = 0; i < numCircles; i++) {
    // Set the next circle's color.
    const color = ColorDef.fromJSON(colors[i]);
    builder.setSymbology(color, color, 1);

    // Assign a unique Id to the circle so it can be interacted with by the user.
    const circleId = vp.iModel.transientIds.getNext();
    builder.activatePickableId(circleId);

    // Add the circle to the builder.
    const offset = i * 4;
    const position = new Point3d(circles[offset], circles[offset + 1], circles[offset + 2]);
    const scaleFactor = circles[offset + 3];
    const radius = circles[offset + 3];
    const sphere = Sphere.createCenterRadius(position, radius);
    builder.addSolidPrimitive(sphere);
    const circle = Arc3d.createXY(position, radius);
    builder.addArc(circle, true, true);
    mainBranch.add(builder.finish());

    if (gltfTemplate) {
      const transform = Transform.createTranslation(position);
      // const transform = Transform.createScaleAboutPoint(center, scaleFactor).multiplyTransformTransform(Transform.createTranslation(center)),
      // const transform = Transform.createIdentity()
      instanceBuilder.add({transform, feature: vp.iModel.transientIds.getNext()});
    } else {
      if (readGltfForEachInstance) {
        // No instancing; read gltf from source each time
        // NO ISSUES
        const transform = Transform.createScaleAboutPoint(position, scaleFactor).multiplyTransformTransform(Transform.createTranslation(position));
        const gltfGraphic = await getGltf(transform)
        if (gltfGraphic !== undefined)
          mainBranch.add(gltfGraphic)
      } else {
      //   // No instancing; re-use gltf graphic
      //   // NOTHING DISPLAYED
      //   const gltfBranch = new GraphicBranch();
      //   gltfBranch.add(gltf)
      //   const transform = Transform.createScaleAboutPoint(center, scaleFactor).multiplyTransformTransform(Transform.createTranslation(center));
      //   const gltfGraphic = IModelApp.renderSystem.createGraphicBranch(mainBranch, transform);
      //   mainBranch.add(gltfGraphic)
      }
    }
  }


  // if (gltf !== undefined) {
  //   branch.add(gltf);
  // }

  let graphic: RenderGraphic|undefined;
  if (gltfTemplate) {
    const instancesParams = instanceBuilder.finish();
    const renderInstances = IModelApp.renderSystem.createRenderInstances(instancesParams);
    const instancesGraphic = IModelApp.renderSystem.createGraphicFromTemplate({ template : gltfTemplate.template, instances: renderInstances });
    mainBranch.add(instancesGraphic);
    // graphic = IModelApp.renderSystem.createGraphicBranch(branch);
    // const center = vp.view.getCenter()
    // const transform = Transform.createTranslation(new Point3d(center.x, center.y, center.z+20));
     const transform = Transform.createIdentity();
    graphic = IModelApp.renderSystem.createGraphicBranch(mainBranch, transform);

  } else {
    // graphic = IModelApp.renderSystem.createGraphicBranch(branch);
    // const transform = Transform.createTranslation(vp.view.getCenter());
    const transform = Transform.createIdentity();
    graphic = IModelApp.renderSystem.createGraphicBranch(mainBranch, transform);
  }




  const inst = FeatureProvider.getInstance(vp);
  inst.trees.push(TileTreeReference.createFromRenderGraphic({
    graphic,
    iModel: vp.iModel,
    modelId,
    getToolTip: async (hit: HitDetail) => {
      return `sourceId: ${hit.sourceId}`;
    },
  }));
  // vp.invalidateRenderPlan();
  // vp.invalidateSymbologyOverrides();
}


export async function testGraphicCreator(vp: Viewport) {
  // Instantiate a reusable WorkerProxy for use by the createCircleGraphic function.
  const worker = createWorkerProxy<GraphicCreator>("./lib/scripts/ExampleWorker.js");

  // Create a render graphic from a description of a large number of circles, using a WorkerProxy.
  async function createCircleGraphic(xyzRadius: Float64Array, color: Uint32Array, chordTolerance: number, iModel: IModelConnection): Promise<GraphicCreatorResult> {
    // Package up the RenderSystem's context to be sent to the Worker.
    const workerContext = IModelApp.renderSystem.createWorkerGraphicDescriptionContextProps(iModel);

    // Transfer the ArrayBuffers to the Worker, instead of making copies.
    const transfer: Transferable[] = [xyzRadius.buffer, color.buffer];

    // Obtain a GraphicDescription from the Worker.
    const args: CreateCirclesArgs = {
      xyzRadius,
      color,
      chordTolerance,
      context: workerContext,
    };

    const result =  worker.createCircles(args, transfer);
    return result;
  }

  const circlesData = getCirclesData(vp.view.getCenter());
  const graphicResult = await createCircleGraphic(circlesData.xyzRadius, circlesData.colors, 0.01, vp.iModel);

  // Unpackage the context from the Worker.
  const context = await IModelApp.renderSystem.resolveGraphicDescriptionContext(graphicResult.context, vp.iModel);

  // Convert the GraphicDescription into a RenderGraphic.
  const graphic =  IModelApp.renderSystem.createGraphicFromDescription({
    description: graphicResult.description,
    context,
  });

  if(graphic === undefined)
    return;

  const inst = FeatureProvider.getInstance(vp);

  inst.trees.push(TileTreeReference.createFromRenderGraphic({
    graphic,
    iModel: vp.iModel,
    modelId: graphicResult.modelId,
    getToolTip: async (hit: HitDetail) => {
      return `sourceId: ${hit.sourceId}`;
    },
  }));
}
