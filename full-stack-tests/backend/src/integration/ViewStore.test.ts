/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Suite } from "mocha";
import { CategorySelector, CloudSqlite, DisplayStyle3d, IModelDb, IModelHost, ModelSelector, SpatialViewDefinition, StandaloneDb, ViewStore } from "@itwin/core-backend";
import { CompressedId64Set, Guid, GuidString, Id64, Id64String } from "@itwin/core-bentley";
import { Camera, Code, ColorByName, ColorDef, DisplayStyle3dSettingsProps, IModel, LocalFileName, SpatialViewDefinitionProps, ViewDefinitionProps } from "@itwin/core-common";
import { AzuriteTest } from "./AzuriteTest";
import { join } from "path";
import { existsSync, mkdirSync, unlinkSync } from "fs-extra";
import { Matrix3d, Range3d, StandardViewIndex, Transform, YawPitchRollAngles } from "@itwin/core-geometry";
import * as sinon from "sinon";

const viewContainer = "views-itwin1";

async function initializeContainer(containerId: string) {
  await AzuriteTest.Sqlite.createAzContainer({ containerId });
  const props: CloudSqlite.ContainerTokenProps = { baseUri: AzuriteTest.baseUri, storageType: "azure", containerId, writeable: true };
  const accessToken = await CloudSqlite.requestToken(props);
  await ViewStore.CloudAccess.initializeDb({ ...props, accessToken });
}

async function makeViewStore(moniker: string) {
  const props: CloudSqlite.ContainerTokenProps = { baseUri: AzuriteTest.baseUri, storageType: "azure", containerId: viewContainer, writeable: true };
  const accessToken = await CloudSqlite.requestToken(props);
  const propStore = new ViewStore.CloudAccess({ ...props, accessToken });
  propStore.setCache(CloudSqlite.CloudCaches.getCache({ cacheName: moniker }));
  propStore.lockParams.moniker = moniker;
  return propStore;
}

function prepareOutputFile(subDirName: string, fileName: string): LocalFileName {
  const outputDir = join(__dirname, "output", subDirName);
  if (!existsSync(outputDir))
    mkdirSync(outputDir, { recursive: true });

  const outputFile = join(outputDir, fileName);
  if (existsSync(outputFile))
    unlinkSync(outputFile);

  return outputFile;
}

describe.only("ViewStore", function (this: Suite) {
  this.timeout(0);
  let iModel: StandaloneDb;

  let vs1: ViewStore.CloudAccess;

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;

    await initializeContainer(viewContainer);
    vs1 = await makeViewStore("viewStore1");
    iModel = StandaloneDb.createEmpty(prepareOutputFile("ViewStore", "test.bim"), {
      rootSubject: { name: "ViewStore tests", description: "ViewStore tests" },
      client: "integration tests",
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
      guid: Guid.createValue(),
    });

  });
  after(async () => {
    vs1.close();
    iModel.close();
    IModelHost.authorizationClient = undefined;
  });

  it("access ViewStore", async () => {
    const vs1locker = vs1.writeLocker;
    const vs1reader = vs1.reader;

    const guids: GuidString[] = [];
    const ids1: Id64String[] = [];
    const elements: IModelDb.GuidMapper = {
      getFederationGuidFromId(id: Id64String): GuidString | undefined {
        const index = ids1.indexOf(id);
        if (index >= 0)
          return guids[index];
        return undefined;
      },
      getIdFromFederationGuid(guid?: GuidString): Id64String | undefined {
        const index = guids.indexOf(guid!);
        if (index >= 0)
          return ids1[index];
        return undefined;
      },
    };
    for (let i = 0; i < 500; i++) {
      guids.push(Guid.createValue());
      ids1.push(Id64.fromLocalAndBriefcaseIds(i, 0));
    }

    const displayStyleProps: DisplayStyle3dSettingsProps = {
      backgroundColor: ColorDef.fromString("rgb(255,20,10)").toJSON(),
      subCategoryOvr:
        [{
          subCategory: "0x40",
          color: ColorByName.fuchsia,
          invisible: true,
          style: "0xaaa",
          weight: 10,
          transp: 0.5,
        },
        ],

      excludedElements: CompressedId64Set.compressArray(["0x8", "0x12", "0x22"]),
      scheduleScript: [{
        modelId: "0x21",
        realityModelUrl: "reality.com",
        elementTimelines: [{
          batchId: 64,
          elementIds: CompressedId64Set.compressArray(["0x1a", "0x1d"]),
        }, {
          batchId: 65,
          elementIds: CompressedId64Set.compressArray(["0x2a", "0x2b", "0x2d", "0x2e"]),
        }],
      }],
    };

    const dsEl = DisplayStyle3d.create(iModel, IModel.dictionaryId, "test style 1", displayStyleProps);
    const dsId = iModel.elements.insertElement(dsEl.toJSON());
    const ds1Row = await vs1locker.addDisplayStyle({ elements, className: dsEl.classFullName, settings: displayStyleProps });
    expect(ds1Row).equals("@1");
    expect(Id64.isValid(dsId)).true;

    const categories = ["0x101", "0x22"];
    const cs1Row = await vs1locker.addCategorySelector({ elements, categories, name: "default" });
    const cs1Id = CategorySelector.insert(iModel, IModel.dictionaryId, "default", categories);
    expect(Id64.isValid(cs1Id)).true;
    expect(cs1Row).equals("@1");

    const models = ["0x11", "0x32"];
    const ms1Id = ModelSelector.insert(iModel, IModel.dictionaryId, "default", models);
    const ms1Row = await vs1locker.addModelSelector({ elements, models, name: "default" });
    expect(Id64.isValid(ms1Id)).true;
    expect(ms1Row).equals("@1");

    const viewDef: ViewDefinitionProps = {
      code: Code.createEmpty(),
      model: IModel.dictionaryId,
      classFullName: "spatial",
      categorySelectorId: "@1",
      displayStyleId: "@1",
    };
    viewDef.code.value = "view1";

    expect(vs1reader.getViewByName({ name: "view1" })).to.be.undefined;
    const v1Id = await vs1locker.addViewDefinition({ elements, viewDefinition: viewDef, owner: "owner1" });
    expect(v1Id).equals("@1");

    const v1 = vs1reader.getViewByName({ name: "view1" })!;
    expect(v1.owner).equals("owner1");
    expect(v1.className).equals("spatial");
    expect(v1.groupId).equals(ViewStore.defaultViewGroupId);
    expect(v1.shared).to.be.false;
    expect(v1.name).equals("view1");

    const g1 = await vs1locker.addViewGroup({ name: "group1", parentId: ViewStore.defaultViewGroupId });

    const standardView = StandardViewIndex.Iso;
    const rotation = Matrix3d.createStandardWorldToView(standardView);
    const angles = YawPitchRollAngles.createFromMatrix3d(rotation);
    const rotationTransform = Transform.createOriginAndMatrix(undefined, rotation);
    const range = new Range3d(1, 1, 1, 8, 8, 8);
    const rotatedRange = rotationTransform.multiplyRange(range);
    const basicProps = {
      code: Code.createEmpty(),
      model: IModel.dictionaryId,
      classFullName: "BisCore:SpatialViewDefinition",
      cameraOn: false,
      origin: rotation.multiplyTransposeXYZ(rotatedRange.low.x, rotatedRange.low.y, rotatedRange.low.z),
      extents: rotatedRange.diagonal(),
      angles,
      camera: new Camera(),
    };

    const props: SpatialViewDefinitionProps = { ...basicProps, modelSelectorId: ms1Id, categorySelectorId: cs1Id, displayStyleId: dsId };
    props.code.value = "view2";
    const viewDefinition = iModel.elements.createElement<SpatialViewDefinition>(props);
    const viewDefinitionId = iModel.elements.insertElement(viewDefinition.toJSON());
    expect(Id64.isValid(viewDefinitionId)).true;

    props.categorySelectorId = cs1Row;
    props.displayStyleId = ds1Row;
    props.modelSelectorId = ms1Row;
    const v2Id = await vs1locker.addViewDefinition({ elements, viewDefinition: props, owner: "owner2", groupId: g1 });
    expect(v2Id).equals("@2");

    sinon.stub(iModel.elements, "getFederationGuidFromId").callsFake((id) => elements.getFederationGuidFromId(id));
    sinon.stub(iModel.elements, "getIdFromFederationGuid").callsFake((id) => elements.getIdFromFederationGuid(id));

    iModel.views.viewStore = vs1;
    const vsElOut = iModel.views.getViewStateData(viewDefinitionId);
    const vsStoreOut = iModel.views.getViewStateData(v2Id);
    expect(vsElOut).to.deep.equal(vsStoreOut);
    sinon.restore();

    expect(vs1reader.findViewsByClass(["spatial"]).length).equals(1);
    expect(vs1reader.findViewsByClass(["BisCore:SpatialViewDefinition"]).length).equals(1);
    expect(vs1reader.findViewsByClass(["spatial", "BisCore:SpatialViewDefinition", "blah"]).length).equals(2);
    expect(vs1reader.findViewsByClass([]).length).equals(0);
    expect(vs1reader.findViewsByClass(["blah"]).length).equals(0);
    expect(vs1reader.findViewsByOwner("owner1").length).equals(1);

    expect(vs1reader.getViewByName({ name: "view2", groupId: g1 })?.groupId).equals(g1);
    await vs1locker.deleteViewGroup(g1);
    expect(vs1reader.getViewByName({ name: "view2", groupId: g1 })).to.be.undefined;
  });
});

