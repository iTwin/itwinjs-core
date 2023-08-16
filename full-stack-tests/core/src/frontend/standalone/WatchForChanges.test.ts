/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { Guid, Id64, OpenMode, ProcessDetector } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";
import { Point3d, Transform } from "@itwin/core-geometry";
import { BriefcaseConnection, GeometricModelState } from "@itwin/core-frontend";
import { coreFullStackTestIpc, initializeEditTools, insertLineStringElement, makeModelCode, transformElements } from "../Editing";
import { TestUtility } from "../TestUtility";

describe.only("watchForChanges", () => {
  if (ProcessDetector.isMobileAppFrontend)
    return;

  let rwConn: BriefcaseConnection;
  let roConn: BriefcaseConnection;
  let modelId: string;
  let categoryId: string;
  let elemId: string;

  before(async () => {
    await TestUtility.startFrontend(undefined, undefined, true);
    await initializeEditTools();
  });

  after(async () => TestUtility.shutdownFrontend());

  beforeEach(async () => {
    const filePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/planprojection.bim");

    // Populate the iModel with some initial geometry.
    rwConn = await BriefcaseConnection.openStandalone(filePath, OpenMode.ReadWrite);
    modelId = await coreFullStackTestIpc.createAndInsertPhysicalModel(rwConn.key, (await makeModelCode(rwConn, rwConn.models.repositoryModelId, Guid.createValue())));
    const dictId = await rwConn.models.getDictionaryModel();
    categoryId = await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictId, Guid.createValue(), { color: 0 });
    elemId = await insertLineStringElement(rwConn, { model: modelId, category: categoryId, color: ColorDef.green, points: [new Point3d()] });
    expect(Id64.isValid(elemId)).to.be.true;
    await rwConn.saveChanges();

    // Open a second, read-only connection that will monitor for changes made via the read-write connection.
    roConn = await BriefcaseConnection.openFile({
      fileName: filePath,
      key: Guid.createValue(),
      readonly: true,
      watchForChanges: true,
    });
  });

  afterEach(async () => {
    await roConn.close();
    await rwConn.close();
  });

  async function waitForModelChanges(func: () => Promise<void>): Promise<Set<string>> {
    const promise = new Promise<Set<string>>((resolve) => {
      roConn.onBufferedModelChanges.addOnce((modelIds) => {
        resolve(modelIds);
      });
    });

    await func();
    return promise;
  }

  it("updates ModelState.geometryGuid", async () => {
    await roConn.models.load(modelId);
    const model = roConn.models.getLoaded(modelId) as GeometricModelState;
    expect(model).instanceof(GeometricModelState);

    const prevGuid = model.geometryGuid;
    expect(prevGuid).not.to.be.undefined;

    const modelIds = await waitForModelChanges(async () => {
      const transform = Transform.createTranslationXYZ(0, 0, 1);
      await transformElements(rwConn, [elemId], transform);
      await rwConn.saveChanges();
    });
    expect(modelIds.size).to.equal(1);
    expect(modelIds.has(modelId)).to.be.true;

    expect(roConn.models.getLoaded(model.id)).to.equal(model);
    expect(model.geometryGuid).not.to.be.undefined;
    expect(model.geometryGuid).not.to.equal(prevGuid);

    await rwConn.models.load(modelId);
    const rwModel = rwConn.models.getLoaded(modelId) as GeometricModelState;
    expect(rwModel.geometryGuid).to.equal(model.geometryGuid);
  });
});
