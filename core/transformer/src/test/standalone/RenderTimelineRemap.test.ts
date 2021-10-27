/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CompressedId64Set, Guid, Id64, Id64String } from "@itwin/core-bentley";
import { Box, Point3d, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import {
  Code, GeometryStreamBuilder, IModel, PhysicalElementProps, RenderSchedule, RenderTimelineProps,
} from "@itwin/core-common";
import {
  GenericSchema, PhysicalModel, PhysicalObject, PhysicalPartition, RenderTimeline, SpatialCategory, StandaloneDb, SubjectOwnsPartitionElements,
} from "@itwin/core-backend";
import { IModelTestUtils } from "@itwin/core-backend/lib/cjs/test";
import { IModelTransformer } from "../../core-transformer";

describe("RenderTimeline Remap", () => {
  before(() => {
    GenericSchema.registerSchema();
  });

  function makeScriptProps(): RenderSchedule.ScriptProps {
    return [{
      modelId: "0x123",
      elementTimelines: [{
        batchId: 1,
        elementIds: ["0xabc", "0xdef"],
        visibilityTimeline: [{ time: 42, value: 50 }],
      }],
    }];
  }

  function insertTimeline(imodel: StandaloneDb, scriptProps?: RenderSchedule.ScriptProps): Id64String {
    const script = JSON.stringify(scriptProps ?? makeScriptProps());
    const props: RenderTimelineProps = {
      model: IModel.dictionaryId,
      classFullName: RenderTimeline.classFullName,
      code: Code.createEmpty(),
      script,
    };
    return imodel.elements.insertElement(props);
  }

  function insertPhysicalModel(db: StandaloneDb): Id64String {
    const partitionProps = {
      classFullName: PhysicalPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(IModel.rootSubjectId),
      code: PhysicalPartition.createCode(db, IModel.rootSubjectId, `PhysicalPartition_${Guid.createValue()}`),
    };

    const partitionId = db.elements.insertElement(partitionProps);
    expect(Id64.isValidId64(partitionId)).to.be.true;

    const model = db.models.createModel({
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: partitionId },
    });

    expect(model instanceof PhysicalModel).to.be.true;

    const modelId = db.models.insertModel(model);
    expect(Id64.isValidId64(modelId)).to.be.true;
    return modelId;
  }

  function insertPhysicalElement(db: StandaloneDb, model: Id64String, category: Id64String): Id64String {
    const geomBuilder = new GeometryStreamBuilder();
    geomBuilder.appendGeometry(Box.createDgnBox(Point3d.createZero(), Vector3d.unitX(), Vector3d.unitY(), new Point3d(0, 0, 2), 2, 2, 2, 2, true)!);
    const props: PhysicalElementProps = {
      classFullName: PhysicalObject.classFullName,
      model,
      category,
      code: Code.createEmpty(),
      geom: geomBuilder.geometryStream,
      placement: {
        origin: Point3d.create(1, 1, 1),
        angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      },
    };

    const elemId = db.elements.insertElement(props);
    expect(Id64.isValid(elemId)).to.be.true;
    return elemId;
  }

  function createIModel(name: string): StandaloneDb {
    const props = {
      rootSubject: {
        name,
      },
      allowEdit: `{ "txns": true }`,
    };
    const filename = IModelTestUtils.prepareOutputFile("RenderTimeline", `${name}.bim`);
    return StandaloneDb.createEmpty(filename, props);
  }

  it("remaps schedule script Ids on clone", async () => {
    const sourceDb = createIModel("remap-source");
    const model = insertPhysicalModel(sourceDb);
    const category = SpatialCategory.insert(sourceDb, IModel.dictionaryId, "cat", {});
    const elementIds: Id64String[] = [];
    for (let i = 0; i < 3; i++)
      elementIds.push(insertPhysicalElement(sourceDb, model, category));

    const scriptProps: RenderSchedule.ScriptProps = [{
      modelId: model,
      elementTimelines: [{
        batchId: 1,
        elementIds,
        visibilityTimeline: [{ time: 42, value: 50 }],
      }],
    }];

    const sourceTimelineId = insertTimeline(sourceDb, scriptProps);
    sourceDb.saveChanges();

    // Make sure targetDb has more elements in it to start with than sourceDb does, so element Ids will be different.
    const targetDb = createIModel("remap-target");
    for (let i = 0; i < 3; i++)
      insertPhysicalModel(targetDb);

    targetDb.saveChanges();

    const transformer = new IModelTransformer(sourceDb, targetDb);
    await transformer.processAll();

    const targetTimelineIds = targetDb.queryEntityIds({ from: RenderTimeline.classFullName });
    expect(targetTimelineIds.size).to.equal(1);
    let targetTimelineId: Id64String | undefined;
    for (const id of targetTimelineIds)
      targetTimelineId = id;

    const sourceTimeline = sourceDb.elements.getElement<RenderTimeline>(sourceTimelineId);
    expect(sourceTimeline.scriptProps).to.deep.equal(scriptProps);

    const targetTimeline = targetDb.elements.getElement<RenderTimeline>(targetTimelineId!);
    expect(targetTimeline.scriptProps).not.to.deep.equal(scriptProps);
    expect(targetTimeline.scriptProps.length).to.equal(1);

    expect(targetTimeline.scriptProps[0].modelId).not.to.equal(scriptProps[0].modelId);
    expect(targetDb.models.getModel<PhysicalModel>(targetTimeline.scriptProps[0].modelId)).instanceof(PhysicalModel);

    expect(targetTimeline.scriptProps[0].elementTimelines.length).to.equal(1);
    const timeline = targetTimeline.scriptProps[0].elementTimelines[0];

    let numElements = 0;
    expect(typeof timeline.elementIds).to.equal("string"); // remapping also compresses Ids if they weren't already.
    for (const elementId of CompressedId64Set.iterable(timeline.elementIds as string)) {
      ++numElements;
      expect(targetDb.elements.getElement<PhysicalObject>(elementId)).instanceof(PhysicalObject);
    }
    expect(numElements).to.equal(3);
  });
});
