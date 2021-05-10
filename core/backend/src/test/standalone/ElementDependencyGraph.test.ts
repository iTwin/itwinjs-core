/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

import { assert } from "chai";
import { DbResult, Guid, Id64Array, Id64String, Logger, LogLevel, OpenMode } from "@bentley/bentleyjs-core";
import { LineSegment3d, Point3d, YawPitchRollAngles } from "@bentley/geometry-core";
import {
  CodeScopeSpec, CodeSpec, ColorByName, DomainOptions, GeometryStreamBuilder, IModel, RelatedElementProps, RelationshipProps, SubCategoryAppearance, UpgradeOptions,
} from "@bentley/imodeljs-common";
import {
  BackendRequestContext, ElementDrivesElementProps, IModelHost, IModelJsFs, PhysicalModel, SpatialCategory, StandaloneDb,
} from "../../imodeljs-backend";
import { IModelTestUtils, TestElementDrivesElement, TestPhysicalObject, TestPhysicalObjectProps } from "../IModelTestUtils";
import * as path from "path";
import * as fs from "fs";

export function copyFile(newName: string, pathToCopy: string): string {
  const newPath = path.join(path.dirname(pathToCopy), newName);
  try {
    fs.unlinkSync(newPath);
  } catch (_err) {
  }
  fs.copyFileSync(pathToCopy, newPath);
  return newPath;
}

function assertRels(list: RelationshipProps[], rels: ElementDrivesElementProps[]) {
  assert.equal(list.length, rels.length);
  for (let i = 0; i < rels.length; ++i) {
    assert.equal(list[i].id, rels[i].id);
  }
}

class DependencyCallbackResults {
  public beforeOutputs: Id64Array = [];
  public allInputsHandled: Id64Array = [];
  public rootChanged: RelationshipProps[] = [];
  public deletedDependency: RelationshipProps[] = [];
}

interface DbInfo {
  seedFileName: string;
  codeSpecId: Id64String;
  physicalModelId: Id64String;
  spatialCategoryId: Id64String;
}

class TestHelper {
  public db: StandaloneDb;
  public dres = new DependencyCallbackResults();
  private removals: VoidFunction[] = [];
  private codeSpecId: Id64String = "";
  private physicalModelId: Id64String = "";
  private spatialCategoryid: Id64String = "";

  constructor(testName: string, dbInfo: DbInfo) {
    this.codeSpecId = dbInfo.codeSpecId;
    this.physicalModelId = dbInfo.physicalModelId;
    this.spatialCategoryid = dbInfo.spatialCategoryId;

    const writeDbFileName = copyFile(`${testName}.bim`, dbInfo.seedFileName);
    this.db = StandaloneDb.openFile(writeDbFileName, OpenMode.ReadWrite);
    assert.isTrue(this.db !== undefined);

    // Logger.setLevelDefault(LogLevel.Info);
    // Logger.setLevel("EDGTest", LogLevel.Trace);
    // Logger.setLevel("ElementDependencyGraph", LogLevel.Trace);
    // Logger.setLevel("ECObjectsNative", LogLevel.Error);

    this.db.nativeDb.enableTxnTesting();
    assert.equal(this.db.nativeDb.addChildPropagatesChangesToParentRelationship("TestBim", "ChildPropagatesChangesToParent"), 0);
    this.setElementDependencyGraphCallbacks();
  }

  public terminate() {
    this.db.close();
    assert.isFalse(this.db.isOpen);
    this.removeElementDependencyGraphCallbacks();
  }

  public makeElement(codeValue: string, parent?: RelatedElementProps): TestPhysicalObjectProps {
    const builder = new GeometryStreamBuilder();
    builder.appendGeometry(LineSegment3d.create(Point3d.createZero(), Point3d.create(5, 0, 0)));

    return {
      classFullName: "TestBim:TestPhysicalObject",
      model: this.physicalModelId,
      category: this.spatialCategoryid,
      code: { spec: this.codeSpecId, scope: this.physicalModelId, value: codeValue },
      intProperty: 100,
      placement: {
        origin: new Point3d(0, 0, 0),
        angles: new YawPitchRollAngles(),
      },
      geom: builder.geometryStream,
      parent,
    };
  }

  public insertElement(codeValue: string, parent?: RelatedElementProps): Id64String {
    return this.db.elements.insertElement(this.makeElement(codeValue, parent));
  }

  public updateElement(elid: Id64String, newLabel: string) {
    const ed2 = this.db.elements.getElement({ id: elid });
    ed2.userLabel = newLabel;
    this.db.elements.updateElement(ed2);
  }

  public fmtElem(elId: Id64String) { return this.db.elements.getElement(elId).code.value; }
  public fmtRel(props: RelationshipProps) { return `${props.classFullName} ${this.fmtElem(props.sourceId)}  -->  ${this.fmtElem(props.targetId)}`; }

  public resetDependencyResults() {
    this.dres = new DependencyCallbackResults();
  }

  public setElementDependencyGraphCallbacks() {
    this.removals.push(TestElementDrivesElement.deletedDependency.addListener((evProps) => {
      Logger.logTrace("EDGTest", `_onDeletedDependency ${this.fmtRel(evProps)}`);
      this.dres.deletedDependency.push(evProps);
    }));
    this.removals.push(TestElementDrivesElement.rootChanged.addListener((evProps, _im) => {
      Logger.logTrace("EDGTest", `_onRootChanged ${this.fmtRel(evProps)}`);
      this.dres.rootChanged.push(evProps);
    }));
    this.removals.push(TestPhysicalObject.beforeOutputsHandled.addListener((elId) => {
      Logger.logTrace("EDGTest", `_onBeforeOutputsHandled ${this.fmtElem(elId)}`);
      this.dres.beforeOutputs.push(elId);
    }));
    this.removals.push(TestPhysicalObject.allInputsHandled.addListener((elId) => {
      Logger.logTrace("EDGTest", `_onAllInputsHandled ${this.fmtElem(elId)}`);
      this.dres.allInputsHandled.push(elId);
    }));
  }

  public removeElementDependencyGraphCallbacks() {
    this.removals.forEach((drop) => drop());
  }
}

describe("ElementDependencyGraph", () => {
  let testFileName: string;
  const requestContext = new BackendRequestContext();
  let dbInfo: DbInfo;

  const performUpgrade = (pathname: string): DbResult => {
    const nativeDb = new IModelHost.platform.DgnDb();
    const upgradeOptions: UpgradeOptions = {
      domain: DomainOptions.Upgrade,
    };
    const res = nativeDb.openIModel(pathname, OpenMode.ReadWrite, upgradeOptions);
    if (DbResult.BE_SQLITE_OK === res) {
      nativeDb.deleteAllTxns();
      nativeDb.closeIModel();
    }
    return res;
  };

  before(async () => {
    IModelTestUtils.registerTestBimSchema();
    // make a unique name for the output file so this test can be run in parallel
    testFileName = IModelTestUtils.prepareOutputFile("ElementDependencyGraph", `${Guid.createValue()}.bim`);
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const schemaFileName = IModelTestUtils.resolveAssetFile("TestBim.ecschema.xml");
    IModelJsFs.copySync(seedFileName, testFileName);
    assert.equal(performUpgrade(testFileName), 0);
    const imodel = StandaloneDb.openFile(testFileName, OpenMode.ReadWrite);
    await imodel.importSchemas(requestContext, [schemaFileName]); // will throw an exception if import fails
    const physicalModelId = PhysicalModel.insert(imodel, IModel.rootSubjectId, "EDGTestModel");
    const codeSpecId = imodel.codeSpecs.insert(CodeSpec.create(imodel, "EDGTestCodeSpec", CodeScopeSpec.Type.Model));
    const spatialCategoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, "EDGTestSpatialCategory", new SubCategoryAppearance({ color: ColorByName.darkRed }));
    dbInfo = { physicalModelId, codeSpecId, spatialCategoryId, seedFileName: testFileName };
    imodel.saveChanges("");
    imodel.nativeDb.deleteAllTxns();
    imodel.close();
  });

  after(() => {
    IModelJsFs.removeSync(testFileName);
  });

  it("should invokeCallbacks EDE only", () => {
    const helper = new TestHelper("EDE", dbInfo);

    const e1id = helper.insertElement("e1");
    const e2id = helper.insertElement("e2");
    const e3id = helper.insertElement("e3");
    helper.db.saveChanges(); // get the elements into the iModel

    const ede_1_2 = TestElementDrivesElement.create<TestElementDrivesElement>(helper.db, e1id, e2id);
    const ede_2_3 = TestElementDrivesElement.create<TestElementDrivesElement>(helper.db, e2id, e3id);
    for (const ede of [ede_1_2, ede_2_3]) {
      ede.insert();
    }

    // The full graph:
    //  e1 --> e2 --> e3

    helper.resetDependencyResults();
    helper.db.saveChanges(); // this will react to EDE inserts only.
    assert.deepEqual(helper.dres.beforeOutputs, []); // only roots get this callback, and only if they have been directly changed.
    assert.deepEqual(helper.dres.allInputsHandled, []); // No input elements have changed
    assertRels(helper.dres.rootChanged, [ede_1_2, ede_2_3]); // we send out this callback even if only the relationship itself is new or changed.

    helper.updateElement(e1id, "change e1");

    helper.resetDependencyResults();
    helper.db.saveChanges();

    assert.deepEqual(helper.dres.beforeOutputs, [e1id]); // only called on directly changed root elements.
    assert.deepEqual(helper.dres.allInputsHandled, [e2id, e3id]);
    assertRels(helper.dres.rootChanged, [ede_1_2, ede_2_3]);

    helper.terminate();
  });

  it("should invokeCallbacks through parents only", () => {
    const helper = new TestHelper("Parents", dbInfo);

    const p2id = helper.insertElement("p2");
    const e1id = helper.insertElement("e1", { id: p2id, relClassName: "TestBim.ChildPropagatesChangesToParent" });
    helper.db.saveChanges(); // get the elements into the iModel

    // The full graph:
    //     .-parent-> p2
    //    /
    //  e1
    //
    helper.resetDependencyResults();
    helper.db.saveChanges();
    assert.deepEqual(helper.dres.beforeOutputs, []); // only roots get this callback, and only if they have been directly changed.
    assert.deepEqual(helper.dres.allInputsHandled, []); // No input elements have changed
    assertRels(helper.dres.rootChanged, []); // we send out this callback even if only the relationship itself is new or changed.

    helper.updateElement(e1id, "change e1");

    helper.resetDependencyResults();
    helper.db.saveChanges();

    assert.deepEqual(helper.dres.beforeOutputs, [e1id]); // only called on directly changed root elements.
    assert.deepEqual(helper.dres.allInputsHandled, [p2id]);
    assertRels(helper.dres.rootChanged, []);

    helper.updateElement(p2id, "change p2");

    helper.resetDependencyResults();
    helper.db.saveChanges();

    assert.deepEqual(helper.dres.beforeOutputs, []); // only called on directly changed root elements
    assert.deepEqual(helper.dres.allInputsHandled, []);
    assertRels(helper.dres.rootChanged, []);

    helper.terminate();
  });

  it("should invokeCallbacks through EDEs and parents", () => {
    const helper = new TestHelper("EDEsAndParents", dbInfo);

    const p2id = helper.insertElement("p2");
    const p3id = helper.insertElement("p3");
    const e1id = helper.insertElement("e1", { id: p2id, relClassName: "TestBim.ChildPropagatesChangesToParent" });
    const e2id = helper.insertElement("e2");
    const e3id = helper.insertElement("e3");
    helper.db.saveChanges(); // get the elements into the iModel

    const ede_1_2 = TestElementDrivesElement.create<TestElementDrivesElement>(helper.db, e1id, e2id);
    const ede_2_3 = TestElementDrivesElement.create<TestElementDrivesElement>(helper.db, e2id, e3id);
    const ede_p2_p3 = TestElementDrivesElement.create<TestElementDrivesElement>(helper.db, p2id, p3id);
    for (const ede of [ede_1_2, ede_2_3, ede_p2_p3]) {
      ede.insert();
    }

    // db.nativeDb.writeFullElementDependencyGraphToFile(`${writeDbFileName}.dot`);

    // The full graph:
    //     .-parent-> p2 -EDE-> p3
    //    /
    //  e1 -EDE-> e2 -EDE-> e3
    //
    helper.resetDependencyResults();
    helper.db.saveChanges(); // this will react to EDE inserts only.
    assert.deepEqual(helper.dres.beforeOutputs, []); // only roots get this callback, and only if they have been directly changed.
    assert.deepEqual(helper.dres.allInputsHandled, []); // No input elements have changed
    assertRels(helper.dres.rootChanged, [ede_1_2, ede_2_3, ede_p2_p3]); // we send out this callback even if only the relationship itself is new or changed.

    helper.updateElement(e1id, "change e1");

    helper.resetDependencyResults();
    helper.db.saveChanges();

    assert.deepEqual(helper.dres.beforeOutputs, [e1id]); // only called on directly changed root elements.
    assert.deepEqual(helper.dres.allInputsHandled, [e2id, p2id, e3id, p3id]);
    assertRels(helper.dres.rootChanged, [ede_1_2, ede_2_3, ede_p2_p3]);

    helper.updateElement(p2id, "change p2");

    helper.resetDependencyResults();
    helper.db.saveChanges();

    assert.deepEqual(helper.dres.beforeOutputs, [p2id]); // only called on directly changed root elements.
    assert.deepEqual(helper.dres.allInputsHandled, [p3id]);
    assertRels(helper.dres.rootChanged, [ede_p2_p3]);

    helper.updateElement(e2id, "change e2");

    helper.resetDependencyResults();
    helper.db.saveChanges();

    assert.deepEqual(helper.dres.beforeOutputs, [e2id]); // only called on directly changed root elements.
    assert.deepEqual(helper.dres.allInputsHandled, [e3id]);
    assertRels(helper.dres.rootChanged, [ede_2_3]);

    helper.terminate();
  });

  it("should invokeCallbacks through parents - geomodeler schema", () => {
    const helper = new TestHelper("GeoModeler", dbInfo);

    // The full graph:
    //                                        BoreholeSource -EDE-> GroundGeneration
    //                                        / parent
    //                                  Borehole
    //                                  / parent
    // Material -EDE-> MaterialDepthRange

    const boreholeSource = helper.insertElement("BoreholeSource");
    const borehole = helper.insertElement("Borehole", { id: boreholeSource, relClassName: "TestBim.ChildPropagatesChangesToParent" });
    const materialDepthRange = helper.insertElement("MaterialDepthRange", { id: borehole, relClassName: "TestBim.ChildPropagatesChangesToParent" });
    const material = helper.insertElement("Material");
    const groundGeneration = helper.insertElement("GroundGeneration");
    helper.db.saveChanges(); // get the elements into the iModel

    const ede_material_materialDepthRange = TestElementDrivesElement.create<TestElementDrivesElement>(helper.db, material, materialDepthRange);
    const ede_boreholeSource_groundGeneration = TestElementDrivesElement.create<TestElementDrivesElement>(helper.db, boreholeSource, groundGeneration);
    for (const ede of [ede_material_materialDepthRange, ede_boreholeSource_groundGeneration]) {
      ede.insert();
    }

    helper.resetDependencyResults();
    helper.db.saveChanges();

    helper.updateElement(material, "change material");

    helper.resetDependencyResults();
    helper.db.saveChanges();

    assert.deepEqual(helper.dres.beforeOutputs, [material]); // only called on directly changed root elements.
    assert.deepEqual(helper.dres.allInputsHandled, [materialDepthRange, borehole, boreholeSource, groundGeneration]);
    assertRels(helper.dres.rootChanged, [ede_material_materialDepthRange, ede_boreholeSource_groundGeneration]);

    helper.terminate();
  });

  it("should invokeCallbacks many:1", () => {
    const helper = new TestHelper("ManyToOne", dbInfo);

    const e1id = helper.insertElement("e1");
    const e11id = helper.insertElement("e11");
    const e2id = helper.insertElement("e2");
    const e21id = helper.insertElement("e21");
    const e3id = helper.insertElement("e3");
    const e4id = helper.insertElement("e4");

    const ede_1_2 = TestElementDrivesElement.create<TestElementDrivesElement>(helper.db, e1id, e2id);
    const ede_11_2 = TestElementDrivesElement.create<TestElementDrivesElement>(helper.db, e11id, e2id);
    const ede_2_3 = TestElementDrivesElement.create<TestElementDrivesElement>(helper.db, e2id, e3id);
    const ede_21_3 = TestElementDrivesElement.create<TestElementDrivesElement>(helper.db, e21id, e3id);
    const ede_3_4 = TestElementDrivesElement.create<TestElementDrivesElement>(helper.db, e3id, e4id);
    for (const ede of [ede_1_2, ede_11_2, ede_2_3, ede_21_3, ede_3_4]) {
      ede.insert();
    }

    // The full graph:
    //        e21
    //            \
    //  e1 --> e2 --> e3 --> e4
    //      /
    //  e11

    // On the very first validation, everything is new and is considered directly changed
    // resulting graph:
    //        e21
    //            \
    //  e1 --> e2 --> e3 --> e4
    //      /
    //  e11
    helper.resetDependencyResults();
    helper.db.saveChanges();
    assert.deepEqual(helper.dres.beforeOutputs, [e1id, e11id, e21id]); // only called on directly changed root elements.
    assert.deepEqual(helper.dres.allInputsHandled, [e2id, e3id, e4id]);
    assertRels(helper.dres.rootChanged, [ede_1_2, ede_11_2, ede_2_3, ede_21_3, ede_3_4]);

    // modify e4 directly. That is a leaf. None of its inputs are changed.
    // resulting subgraph:
    //                      *
    //                      e4
    //
    //
    helper.updateElement(e4id, "change e4");

    helper.resetDependencyResults();
    helper.db.saveChanges();

    assert.deepEqual(helper.dres.beforeOutputs, []); // only called on directly changed root elements.
    assert.deepEqual(helper.dres.allInputsHandled, []);
    assertRels(helper.dres.rootChanged, []);

    // modify e3 directly.
    // resulting subgraph:
    //
    //
    //               *
    //               e3 --> e4
    //
    //
    helper.updateElement(e3id, "change e3");

    helper.resetDependencyResults();
    helper.db.saveChanges();

    assert.deepEqual(helper.dres.beforeOutputs, [e3id]); // only called on directly changed root elements.
    assert.deepEqual(helper.dres.allInputsHandled, [e4id]);
    assertRels(helper.dres.rootChanged, [ede_3_4]);

    // modify e2 directly. That is a node in middle of the graph. None of its inputs is modified.
    // resulting subgraph:
    //
    //         *
    //         e2 --> e3 --> e4
    //
    //
    //
    helper.updateElement(e2id, "change e2");

    helper.resetDependencyResults();
    helper.db.saveChanges();

    assert.deepEqual(helper.dres.beforeOutputs, [e2id]); // only called on directly changed root elements
    assert.deepEqual(helper.dres.allInputsHandled, [e3id, e4id],);
    assertRels(helper.dres.rootChanged, [ede_2_3, ede_3_4]);

    // Modify e1 directly. That should propagate to the rest of the nodes. Each should get an _onAllInputsHandled callback
    // resulting graph:
    //
    //    *
    //    e1 --> e2 --> e3 --> e4
    //
    helper.updateElement(e1id, "change e1");

    helper.resetDependencyResults();
    helper.db.saveChanges();

    assert.deepEqual(helper.dres.beforeOutputs, [e1id]); // only called on directly changed root elements
    assert.deepEqual(helper.dres.allInputsHandled, [e2id, e3id, e4id]);
    assertRels(helper.dres.rootChanged, [ede_1_2, ede_2_3, ede_3_4]);

    // Modify e11 directly. That should propagate to the rest of the nodes. Each should get an _onAllInputsHandled callback
    // resulting graph:
    //
    //       > e2 --> e3 --> e4
    //      /
    //  e11
    //  *
    //
    // Note that the e1 -> e2 and e21 -> e3 edges are NOT in the sub-graph. These edges should be validated, nevertheless -- TBD
    helper.updateElement(e11id, "change e11");

    helper.resetDependencyResults();
    helper.db.saveChanges();

    // assert.deepEqual(helper.dres.directChange, []); // only called on directly changed non-root elements that have no directly changed inputs
    assert.deepEqual(helper.dres.beforeOutputs, [e11id]); // only called on directly changed root elements
    assert.deepEqual(helper.dres.allInputsHandled, [e2id, e3id, e4id]);
    assertRels(helper.dres.rootChanged, [ede_11_2, ede_2_3, ede_3_4]);
    // assertRels(helper.dres.validateOutput, [ede_1_2, ede_21_3]); // this callback is made only on rels that not in the graph but share an output with another rel or have an output that was directly changed

    helper.terminate();
  });

});
