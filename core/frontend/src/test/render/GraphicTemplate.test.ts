/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../IModelApp";
import { EmptyLocalization } from "@itwin/core-common";
import { GraphicType } from "../../common/render/GraphicType";
import { Point2d, Point3d, Transform } from "@itwin/core-geometry";
import { RenderInstances } from "../../render/RenderSystem";
import { _batch, _branch, _nodes } from "../../common/internal/Symbols";
import { GraphicTemplate } from "../../render/GraphicTemplate";
import { RenderInstancesParamsBuilder } from "../../common/render/RenderInstancesParams";
import { TransientIdSequence } from "@itwin/core-bentley";
import { GraphicDescriptionImpl } from "../../common/internal/render/GraphicDescriptionBuilderImpl";
import { GraphicDescriptionBuilder } from "../../common/render/GraphicDescriptionBuilder";
import { WorkerGraphicDescriptionContext } from "../../common/render/GraphicDescriptionContext";
import { IModelConnection } from "../../IModelConnection";

describe("GraphicTemplate", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  it("produces reusable non-disposable geometry", () => {
    function expectDisposed(tmplt: GraphicTemplate, expected: boolean): void {
      for (const node of tmplt[_nodes]) {
        for (const geom of node.geometry) {
          expect(geom.isDisposed).toEqual(expected);
        }
      }
    }

    const builder = IModelApp.renderSystem.createGraphic({ type: GraphicType.Scene, computeChordTolerance: () => 0 });
    builder.addLineString2d([new Point2d(0, 1), new Point2d(2, 3)], 0);
    builder.addShape2d([new Point2d(0, 0), new Point2d(0, 5), new Point2d(5, 0), new Point2d(0, 0)], 0);
    const template = builder.finishTemplate();
    expectDisposed(template, false);
    const graphic = IModelApp.renderSystem.createGraphicFromTemplate({ template });

    graphic.dispose();
    expectDisposed(template, false);
  });

  it("is not instanceable if GraphicBuilder or GraphicDescription specifies a view-independent origin", () => {
    function makeTemplate(viewIndependent: boolean): GraphicTemplate {
      const builder = IModelApp.renderSystem.createGraphic({
        type: GraphicType.Scene,
        computeChordTolerance: () => 0,
        viewIndependentOrigin: viewIndependent ? new Point3d(1, 2, 3) : undefined,
      });

      builder.addPointString2d([new Point2d(1, 2)], 0);
      return builder.finishTemplate();
    }

    function makeInstances(): RenderInstances {
      const builder = RenderInstancesParamsBuilder.create({});
      builder.add({ transform: Transform.createIdentity() });
      const instances = IModelApp.renderSystem.createRenderInstances(builder.finish())!;
      expect(instances).toBeDefined();
      return instances;
    }

    const viewDep = makeTemplate(false);
    expect(viewDep.isInstanceable).toBe(true);
    expect(IModelApp.renderSystem.createGraphicFromTemplate({ template: viewDep, instances: makeInstances() })).toBeDefined();

    const viewIndep = makeTemplate(true);
    expect(viewIndep.isInstanceable).toBe(false);
    expect(() => IModelApp.renderSystem.createGraphicFromTemplate({
      template: viewIndep,
      instances: makeInstances(),
    })).to.throw("instanceable");
  });

  it("produces a batch if features are specified", () => {
    function makeTemplate(withFeatures: boolean): GraphicTemplate {
      const builder = IModelApp.renderSystem.createGraphic({
        type: GraphicType.Scene,
        computeChordTolerance: () => 0,
        pickable: withFeatures ? { id: "0x1", modelId: "0x2", noFlash: true, isVolumeClassifier: true } : undefined,
      });

      builder.addPointString2d([new Point2d(1, 2)], 0);
      return builder.finishTemplate();
    }

    const noFeat = makeTemplate(false);
    expect(noFeat[_batch]).toBeUndefined();

    const feat = makeTemplate(true);
    const batch = feat[_batch]!;
    expect(batch).toBeDefined();
    expect(batch.featureTable.numFeatures).toEqual(1);
    expect(batch.featureTable.batchModelId).toEqual("0x2");
  });

  it("produces a Branch if GraphicDescription specifies a translation", async () => {
    const iModel = { transientIds: new TransientIdSequence() } as unknown as IModelConnection;
    const contextProps = IModelApp.renderSystem.createWorkerGraphicDescriptionContextProps(iModel);
    const workerContext = WorkerGraphicDescriptionContext.fromProps(contextProps);
    const mainContext = await IModelApp.renderSystem.resolveGraphicDescriptionContext(workerContext.toProps(new Set()), iModel);

    const builder = GraphicDescriptionBuilder.create({ type: GraphicType.Scene, computeChordTolerance: () => 0, context: workerContext });
    builder.addPointString2d([new Point2d(10, 0)], 2);
    const descr = builder.finish() as GraphicDescriptionImpl;
    expect(descr.translation).toBeDefined();

    const template = IModelApp.renderSystem.createTemplateFromDescription({ context: mainContext, description: descr });
    const branch = template[_branch]!;
    expect(branch).toBeDefined();
    expect(branch.transform).toBeDefined();
    expect(branch.transform!.origin.x).toEqual(10);
    expect(branch.transform!.origin.y).toEqual(0);
    expect(branch.transform!.origin.z).toEqual(2);
  });
});
