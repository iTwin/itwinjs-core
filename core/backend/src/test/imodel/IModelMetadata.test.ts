/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { BisCodeSpec, Code, CodeScopeSpec, CodeSpec, FontMap, FontType, IModel } from "@itwin/core-common";
import { CustomAttributeClass, EntityClass, PrimitiveArrayProperty, PrimitiveOrEnumPropertyBase, PropertyType, propertyTypeToString, SchemaItemType } from "@itwin/ecschema-metadata";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { BisCoreSchema, Category, ClassRegistry, Element, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";
import { createIModelFromSeed, generateTestSnapshot } from "./IModelTestFixtures";


describe("iModel metadata and schemas", () => {
  let testBimReadonly: SnapshotDb;
  let compatibilityReadonly: SnapshotDb;
  const mutableIModels: SnapshotDb[] = [];

  before(async () => {
    await TestUtils.startBackend();
    IModelTestUtils.registerTestBimSchema();

    const testBimWritable = await generateTestSnapshot("metadata-test.bim", "test.bim");
    const testBimPath = testBimWritable.pathName;
    testBimWritable.close();
    testBimReadonly = SnapshotDb.openFile(testBimPath);

    const compatibilityWritable = createIModelFromSeed("metadata-CompatibilityTestSeed.bim", "CompatibilityTestSeed.bim");
    const compatibilityPath = compatibilityWritable.pathName;
    compatibilityWritable.close();
    compatibilityReadonly = SnapshotDb.openFile(compatibilityPath);
  });

  after(async () => {
    if (testBimReadonly !== undefined && testBimReadonly.isOpen)
      testBimReadonly.close();
    if (compatibilityReadonly !== undefined && compatibilityReadonly.isOpen)
      compatibilityReadonly.close();
  });

  afterEach(() => {
    for (const imodel of mutableIModels.splice(0)) {
      if (imodel.isOpen)
        imodel.close();
    }
  });

  const trackMutableIModel = (imodel: SnapshotDb): SnapshotDb => {
    mutableIModels.push(imodel);
    return imodel;
  };

  function checkElementMetaData(entityClass: EntityClass) {
    assert.isNotNull(entityClass);
    assert.equal(entityClass.fullName, Element.classFullName.replace(":", "."));
    assert.isUndefined(entityClass.baseClass);

    let foundClassHasHandler = false;
    let foundClassHasCurrentTimeStampProperty = false;
    if (entityClass.customAttributes !== undefined) {
      if (entityClass.customAttributes.has("BisCore.ClassHasHandler"))
        foundClassHasHandler = true;
      if (entityClass.customAttributes.has("CoreCustomAttributes.ClassHasCurrentTimeStampProperty"))
        foundClassHasCurrentTimeStampProperty = true;
    }
    assert.isTrue(foundClassHasHandler);
    assert.isTrue(foundClassHasCurrentTimeStampProperty);
    const federationGuid = entityClass.getPropertySync("federationGuid", false);
    if (federationGuid !== undefined) {
      assert.isTrue(federationGuid.isPrimitive());
      assert.equal(federationGuid.propertyType, PropertyType.Binary);
      assert.equal((federationGuid as PrimitiveOrEnumPropertyBase).extendedTypeName, "BeGuid");
    }
  }

  function checkClassHasHandlerMetaData(classToCheck: CustomAttributeClass) {
    assert.isDefined(classToCheck);

    const propertiesArray = Array.from(classToCheck.getPropertiesSync(true));
    assert.equal(propertiesArray.length, 1);

    const restrictionProperty = propertiesArray[0];
    assert.isDefined(restrictionProperty);
    assert.equal(restrictionProperty.name, "Restrictions");
    assert.equal(propertyTypeToString(restrictionProperty.propertyType), "PrimitiveArrayProperty");
    assert.equal((restrictionProperty as PrimitiveArrayProperty).minOccurs, 0);
  }

  it("should use schema to look up classes by name", () => {
    const elementClass = ClassRegistry.findRegisteredClass(Element.classFullName);
    const categoryClass = ClassRegistry.findRegisteredClass(Category.classFullName);
    assert.isDefined(elementClass);
    assert.isDefined(categoryClass);
    assert.equal(elementClass!.schema, BisCoreSchema);
    assert.equal(categoryClass!.schema, BisCoreSchema);
    assert.equal(elementClass!.className, "Element");
    assert.equal(categoryClass!.className, "Category");
  });

  it("Fonts", async () => {
    const imodel1 = trackMutableIModel(await generateTestSnapshot("metadata-fonts.bim", "test.bim"));
    const dbFonts = imodel1.fonts;
    expect(Array.from(dbFonts.queryMappedFamilies({ includeNonEmbedded: true })).length).to.equal(4);
    expect(dbFonts.findDescriptor(1)).to.deep.equal({ name: "Arial", type: FontType.TrueType });
    expect(dbFonts.findId({ name: "Arial" })).to.equal(1);
    expect(dbFonts.findId({ name: "arial" })).to.equal(1);

    expect(dbFonts.findDescriptor(2)).to.deep.equal({ name: "Font0", type: FontType.Rsc });
    expect(dbFonts.findId({ name: "Font0" })).to.equal(2);
    expect(dbFonts.findId({ name: "fOnt0" })).to.equal(2);

    expect(dbFonts.findDescriptor(3)).to.deep.equal({ name: "ShxFont0", type: FontType.Shx });
    expect(dbFonts.findId({ name: "ShxFont0" })).to.equal(3);
    expect(dbFonts.findId({ name: "shxfont0" })).to.equal(3);

    expect(dbFonts.findDescriptor(4)).to.deep.equal({ name: "Calibri", type: FontType.TrueType });
    expect(dbFonts.findId({ name: "Calibri" })).to.equal(4);
    expect(dbFonts.findId({ name: "cAlIbRi" })).to.equal(4);

    expect(dbFonts.findId({ name: "notfound" })).to.be.undefined;

    const fonts1 = imodel1.fontMap; // eslint-disable-line @typescript-eslint/no-deprecated
    assert.equal(fonts1.fonts.size, 4, "font map size should be 4");
    assert.equal(FontType.TrueType, fonts1.getFont(1)!.type, "get font 1 type is TrueType");
    assert.equal("Arial", fonts1.getFont(1)!.name, "get Font 1 name");
    assert.equal(1, fonts1.getFont("Arial")!.id, "get Font 1, by name");
    assert.equal(1, fonts1.getFont("arial")!.id, "get Font 1, by name case insensitive");

    assert.equal(FontType.Rsc, fonts1.getFont(2)!.type, "get font 2 type is Rsc");
    assert.equal("Font0", fonts1.getFont(2)!.name, "get Font 2 name");
    assert.equal(2, fonts1.getFont("Font0")!.id, "get Font 2, by name");
    assert.equal(2, fonts1.getFont("fOnt0")!.id, "get Font 2, by name case insensitive");

    assert.equal(FontType.Shx, fonts1.getFont(3)!.type, "get font 1 type is Shx");
    assert.equal("ShxFont0", fonts1.getFont(3)!.name, "get Font 3 name");
    assert.equal(3, fonts1.getFont("ShxFont0")!.id, "get Font 3, by name");
    assert.equal(3, fonts1.getFont("shxfont0")!.id, "get Font 3, by name case insensitive");

    assert.equal(FontType.TrueType, fonts1.getFont(4)!.type, "get font 4 type is TrueType");
    assert.equal("Calibri", fonts1.getFont(4)!.name, "get Font 4 name");
    assert.equal(4, fonts1.getFont("Calibri")!.id, "get Font 4, by name");
    assert.equal(4, fonts1.getFont("cAlIbRi")!.id, "get Font 4, by name case insensitive");

    assert.isUndefined(fonts1.getFont("notfound"), "attempt lookup of a font that should not be found");

    assert.deepEqual(new FontMap(fonts1.toJSON()), fonts1, "toJSON on FontMap"); // eslint-disable-line @typescript-eslint/no-deprecated
  });

  it("should get metadata for a relationship", async () => {
    const imodelPath = IModelTestUtils.prepareOutputFile("IModel", "metadata-relationshipMetadata.bim");
    const imodel = trackMutableIModel(SnapshotDb.createEmpty(imodelPath, { rootSubject: { name: "relationshipMetadata" } }));

    await withEditTxn(imodel, async (txn) => {
      const partitionId = txn.insertElement({
        classFullName: "BisCore:PhysicalPartition",
        model: IModel.repositoryModelId,
        parent: {
          relClassName: "BisCore:SubjectOwnsPartitionElements",
          id: IModel.rootSubjectId,
        },
        code: new Code({
          spec: imodel.codeSpecs.getByName(BisCodeSpec.informationPartitionElement).id,
          scope: IModel.rootSubjectId,
          value: "physical model",
        }),
      });

      for await (const row of imodel.createQueryReader(`SELECT * FROM bis.Element LIMIT ${1}`)) {
        const relId = txn.insertRelationship({
          classFullName: "BisCore:ElementHasLinks",
          sourceId: partitionId,
          targetId: row.ECInstanceId,
        });
        const relationship = imodel.relationships.getInstance("BisCore:ElementHasLinks", relId);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        const metadata = await relationship.getMetaData();
        assert.isDefined(metadata, "metadata should be defined");
      }
    });
  });

  it("should get metadata for class", () => {
    const imodel1 = testBimReadonly;
    const metaData = imodel1.schemaContext.getSchemaItemSync(Element.classFullName, EntityClass);
    assert.exists(metaData);
    if (metaData !== undefined)
      checkElementMetaData(metaData);
  });

  it("should iterate through metadata for a relationship", async () => {
    const imodelPath = IModelTestUtils.prepareOutputFile("IModel", "metadata-relationshipMetadata-iterate.bim");
    const imodel = trackMutableIModel(SnapshotDb.createEmpty(imodelPath, { rootSubject: { name: "relationshipMetadata" } }));

    await withEditTxn(imodel, async (txn) => {
      const partitionId = txn.insertElement({
        classFullName: "BisCore:PhysicalPartition",
        model: IModel.repositoryModelId,
        parent: {
          relClassName: "BisCore:SubjectOwnsPartitionElements",
          id: IModel.rootSubjectId,
        },
        code: new Code({
          spec: imodel.codeSpecs.getByName(BisCodeSpec.informationPartitionElement).id,
          scope: IModel.rootSubjectId,
          value: "physical model",
        }),
      });

      for await (const row of imodel.createQueryReader(`SELECT * FROM bis.Element LIMIT ${1}`)) {
        const relId = txn.insertRelationship({
          classFullName: "BisCore:ElementHasLinks",
          sourceId: partitionId,
          targetId: row.ECInstanceId,
        });
        const relationship = imodel.relationships.getInstance("BisCore:ElementHasLinks", relId);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        relationship.forEach((propName, propMeta) => {
          assert.isDefined(propName, "Property name should be defined");
          assert.isDefined(propMeta, "Property metadata should be defined");
        });
      }
    });
  });

  it("should get metadata for CA class just as well (and we'll see a array-typed property)", () => {
    const imodel1 = testBimReadonly;
    const metaData = imodel1.schemaContext.getSchemaItemSync("BisCore.ClassHasHandler", CustomAttributeClass);
    assert.exists(metaData);
    if (metaData !== undefined) {
      assert.equal(metaData.schemaItemType, SchemaItemType.CustomAttributeClass);
      checkClassHasHandlerMetaData(metaData);
    }
  });

  it("validate BisCodeSpecs", async () => {
    const imodel2 = compatibilityReadonly;
    assert.equal(imodel2.codeSpecs.getByName(BisCodeSpec.nullCodeSpec).scopeType, CodeScopeSpec.Type.Repository);
    assert.equal(imodel2.codeSpecs.getByName(BisCodeSpec.subCategory).scopeType, CodeScopeSpec.Type.ParentElement);
    assert.equal(imodel2.codeSpecs.getByName(BisCodeSpec.viewDefinition).scopeType, CodeScopeSpec.Type.Model);
    assert.equal(imodel2.codeSpecs.getByName(BisCodeSpec.subject).scopeReq, CodeScopeSpec.ScopeRequirement.ElementId);
  });

  it("should create and insert CodeSpecs", () => {
    const testImodel = trackMutableIModel(createIModelFromSeed("metadata-create-CodeSpecs.bim", "CompatibilityTestSeed.bim"));
    const txn = new EditTxn(testImodel, "create and insert CodeSpecs");
    txn.start();
    const codeSpec = CodeSpec.create(testImodel, "CodeSpec1", CodeScopeSpec.Type.Model);
    const codeSpecId = testImodel.codeSpecs.insert(txn, codeSpec); // throws in case of error
    assert.deepEqual(codeSpecId, codeSpec.id);
    assert.equal(codeSpec.scopeType, CodeScopeSpec.Type.Model);
    assert.equal(codeSpec.scopeReq, CodeScopeSpec.ScopeRequirement.ElementId);

    // Should not be able to insert a duplicate.
    const codeSpecDup = CodeSpec.create(testImodel, "CodeSpec1", CodeScopeSpec.Type.Model);
    assert.throws(() => testImodel.codeSpecs.insert(txn, codeSpecDup), "CodeSpec already exists");

    // We should be able to insert another CodeSpec with a different name.
    const codeSpec2 = CodeSpec.create(testImodel, "CodeSpec2", CodeScopeSpec.Type.Model, CodeScopeSpec.ScopeRequirement.FederationGuid);
    const codeSpec2Id = testImodel.codeSpecs.insert(txn, codeSpec2); // throws in case of error
    assert.deepEqual(codeSpec2Id, codeSpec2.id);
    assert.notDeepEqual(codeSpec2Id, codeSpecId);

    // make sure CodeScopeSpec.Type.Repository works
    const codeSpec3 = CodeSpec.create(testImodel, "CodeSpec3", CodeScopeSpec.Type.Repository, CodeScopeSpec.ScopeRequirement.FederationGuid);
    const codeSpec3Id = testImodel.codeSpecs.insert(txn, codeSpec3); // throws in case of error
    assert.notDeepEqual(codeSpec2Id, codeSpec3Id);

    const codeSpec4 = testImodel.codeSpecs.getById(codeSpec3Id);
    codeSpec4.name = "CodeSpec4";
    const codeSpec4Id = testImodel.codeSpecs.insert(txn, codeSpec4); // throws in case of error
    assert.notDeepEqual(codeSpec3Id, codeSpec4Id);
    assert.equal(codeSpec4.scopeType, CodeScopeSpec.Type.Repository);
    assert.equal(codeSpec4.scopeReq, CodeScopeSpec.ScopeRequirement.FederationGuid);
    const copyOfCodeSpec4 = testImodel.codeSpecs.getById(codeSpec4Id);
    assert.deepEqual(codeSpec4, copyOfCodeSpec4);

    assert.isTrue(testImodel.codeSpecs.hasName("CodeSpec1"));
    assert.isTrue(testImodel.codeSpecs.hasName("CodeSpec2"));
    assert.isTrue(testImodel.codeSpecs.hasName("CodeSpec3"));
    assert.isTrue(testImodel.codeSpecs.hasName("CodeSpec4"));
    assert.isFalse(testImodel.codeSpecs.hasName("CodeSpec5"));

    assert.isTrue(testImodel.codeSpecs.hasId(codeSpec.id));
    assert.isTrue(testImodel.codeSpecs.hasId(codeSpec2.id));
    assert.isTrue(testImodel.codeSpecs.hasId(codeSpec3.id));
    assert.isTrue(testImodel.codeSpecs.hasId(codeSpec4.id));
    assert.isFalse(testImodel.codeSpecs.hasId(Id64.invalid));
    txn.end();
  });

  it("validate CodeSpec properties", async () => {
    const iModelFileName: string = IModelTestUtils.prepareOutputFile("IModel", "metadata-ReadWriteCodeSpec.bim");
    const codeSpecName = "CodeSpec1";

    // Write new CodeSpec to iModel
    if (true) {
      const iModelDb = trackMutableIModel(IModelTestUtils.createSnapshotFromSeed(iModelFileName, IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim")));
      const codeSpec = CodeSpec.create(iModelDb, codeSpecName, CodeScopeSpec.Type.Model, CodeScopeSpec.ScopeRequirement.FederationGuid);
      const codeSpecId = withEditTxn(iModelDb, (txn) => iModelDb.codeSpecs.insert(txn, codeSpec));
      assert.isTrue(Id64.isValidId64(codeSpec.id));
      assert.equal(codeSpec.id, codeSpecId);
      assert.equal(codeSpec.name, codeSpecName);
      assert.equal(codeSpec.scopeType, CodeScopeSpec.Type.Model);
      assert.equal(codeSpec.scopeReq, CodeScopeSpec.ScopeRequirement.FederationGuid);
      iModelDb.close();
    }

    // Reopen iModel (ensure CodeSpec cache is cleared) and reconfirm CodeSpec properties
    if (true) {
      const iModelDb = trackMutableIModel(SnapshotDb.openFile(iModelFileName));
      const codeSpec = iModelDb.codeSpecs.getByName(codeSpecName);
      assert.isTrue(Id64.isValidId64(codeSpec.id));
      assert.equal(codeSpec.name, codeSpecName);
      assert.equal(codeSpec.scopeType, CodeScopeSpec.Type.Model);
      assert.equal(codeSpec.scopeReq, CodeScopeSpec.ScopeRequirement.FederationGuid);
      iModelDb.close();
    }
  });

  it("should import schemas", async () => {
    const imodel1 = trackMutableIModel(await generateTestSnapshot("metadata-import-schemas.bim", "test.bim"));
    const metaData = await imodel1.schemaContext.getSchemaItem("TestBim:TestDocument", EntityClass);
    assert.isDefined(metaData);
    if (metaData !== undefined) {
      const property = await metaData.getProperty("testDocumentProperty");
      assert.isDefined(property);
      if (property !== undefined)
        assert.isDefined(property.propertyType, propertyTypeToString(PropertyType.Integer));
    }
  });
});
