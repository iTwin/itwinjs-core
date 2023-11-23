/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as sinon from "sinon";
import * as path from "path";
import {
  BisCodeSpec, Code, ConcreteEntityTypes, DefinitionElementProps, ElementAspectProps, ElementProps, EntityMetaData, EntityReferenceSet, ModelProps,
  RelatedElement, RelatedElementProps, RelationshipProps, SchemaState,
} from "@itwin/core-common";
import {
  DefinitionElement, DefinitionModel, ElementRefersToElements, EntityReferences, IModelDb, IModelJsFs, Model, RepositoryLink,
  Schema, SnapshotDb, SpatialViewDefinition, StandaloneDb, UrlLink, ViewDefinition3d,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { Element } from "../../Element";
import { Schemas } from "../../Schema";
import { ClassRegistry } from "../../ClassRegistry";
import { OpenMode } from "@itwin/core-bentley";

describe("Class Registry", () => {
  let imodel: SnapshotDb;

  before(() => {
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ClassRegistry", "ClassRegistryTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    assert.exists(imodel);
  });

  after(() => {
    imodel?.close();
  });

  it("should verify the Entity metadata of known element subclasses", () => {
    const code1 = new Code({ spec: "0x10", scope: "0x11", value: "RF1.dgn" });
    const el = imodel.elements.getElement(code1);
    assert.exists(el);
    if (el) {
      const metaData: EntityMetaData | undefined = el.getClassMetaData();
      assert.exists(metaData);
      if (undefined === metaData)
        return;
      assert.equal(metaData.ecclass, el.classFullName);
      // I happen to know that this is a BisCore:RepositoryLink
      assert.equal(metaData.ecclass, RepositoryLink.classFullName);
      //  Check the metadata on the class itself
      assert.isTrue(metaData.baseClasses.length > 0);
      assert.equal(metaData.baseClasses[0], UrlLink.classFullName);
      assert.equal(metaData.customAttributes![0].ecclass, "BisCore:ClassHasHandler");
      //  Check the metadata on the one property that RepositoryLink defines, RepositoryGuid
      assert.exists(metaData.properties);
      assert.isDefined(metaData.properties.repositoryGuid);
      const p = metaData.properties.repositoryGuid;
      assert.equal(p.extendedType, "BeGuid");
      assert.equal(p.customAttributes![1].ecclass, "CoreCustomAttributes:HiddenProperty");
    }
    const el2 = imodel.elements.getElement("0x34");
    assert.exists(el2);
    if (el2) {
      const metaData = el2.getClassMetaData();
      assert.exists(metaData);
      if (undefined === metaData)
        return;
      assert.equal(metaData.ecclass, el2.classFullName);
      // I happen to know that this is a BisCore.SpatialViewDefinition
      assert.equal(metaData.ecclass, SpatialViewDefinition.classFullName);
      assert.isTrue(metaData.baseClasses.length > 0);
      assert.equal(metaData.baseClasses[0], ViewDefinition3d.classFullName);
      assert.exists(metaData.properties);
      assert.isDefined(metaData.properties.modelSelector);
      const n = metaData.properties.modelSelector;
      assert.equal(n.relationshipClass, "BisCore:SpatialViewDefinitionUsesModelSelector");
    }
  });

  it("should verify Entity metadata with both base class and mixin properties", async () => {
    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestDomain.ecschema.xml");
    await imodel.importSchemas([schemaPathname]); // will throw an exception if import fails

    const testDomainClass = imodel.getMetaData("TestDomain:TestDomainClass"); // will throw on failure

    assert.equal(testDomainClass.baseClasses.length, 2);
    assert.equal(testDomainClass.baseClasses[0], DefinitionElement.classFullName);
    assert.equal(testDomainClass.baseClasses[1], "TestDomain:IMixin");

    // Ensures the IMixin has been loaded as part of getMetadata call above.
    assert.isDefined(imodel.classMetaDataRegistry.find("TestDomain:IMixin"));

    // Verify that the forEach method which is called when constructing an entity
    // is picking up all expected properties.
    const testData: string[] = [];
    IModelDb.forEachMetaData(imodel, "TestDomain:TestDomainClass", true, (propName) => {
      testData.push(propName);
    }, false);

    const expectedString = testData.find((testString: string) => {
      return testString === "testMixinProperty";
    });

    assert.isDefined(expectedString);
  });
});

describe("Class Registry - getRootMetaData", () => {
  let imodel: StandaloneDb;

  before(async () => {
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ClassRegistry", "GetRootMetaData.bim");
    IModelJsFs.copySync(seedFileName, testFileName);

    const schemaState: SchemaState = StandaloneDb.validateSchemas(testFileName, true);
    assert.strictEqual(schemaState, SchemaState.UpgradeRecommended);
    StandaloneDb.upgradeStandaloneSchemas(testFileName);

    imodel = StandaloneDb.openFile(testFileName, OpenMode.ReadWrite);
    assert.exists(imodel);
    await imodel.importSchemaStrings([
      `<?xml version="1.0" encoding="UTF-8"?>
        <ECSchema schemaName="TestSchema1" alias="ts1" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
          <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>

          <ECEntityClass typeName="TestBase">
            <BaseClass>bis:PhysicalElement</BaseClass>
          </ECEntityClass>

          <ECEntityClass typeName="TestDerived">
            <BaseClass>TestBase</BaseClass>
          </ECEntityClass>

          <ECEntityClass typeName="ITestMixinForAspectsBase">
            <ECCustomAttributes>
              <IsMixin xmlns="CoreCustomAttributes.01.00.03">
                <AppliesToEntityClass>bis:ElementUniqueAspect</AppliesToEntityClass>
              </IsMixin>
            </ECCustomAttributes>
          </ECEntityClass>

          <ECEntityClass typeName="ITestMixinForAspectsDerived">
            <BaseClass>ITestMixinForAspectsBase</BaseClass>
            <ECCustomAttributes>
              <IsMixin xmlns="CoreCustomAttributes.01.00.03">
                <AppliesToEntityClass>bis:ElementUniqueAspect</AppliesToEntityClass>
              </IsMixin>
            </ECCustomAttributes>
          </ECEntityClass>

          <ECEntityClass typeName="ITestMixinForElements" modifier="Abstract">
            <ECCustomAttributes>
              <IsMixin xmlns="CoreCustomAttributes.01.00.03">
                <AppliesToEntityClass>bis:Element</AppliesToEntityClass>
              </IsMixin>
            </ECCustomAttributes>
          </ECEntityClass>

          <ECEntityClass typeName="TestMixedInAndDerived">
            <BaseClass>TestBase</BaseClass>
            <BaseClass>ITestMixinForElements</BaseClass>
          </ECEntityClass>

        </ECSchema>
      `,
    ]); // will throw an exception if import fails
  });

  after(() => {
    imodel?.close();
  });

  it("should get the root metadata", async () => {
    for (const [testClass, expectedRoot] of [
      ["TestSchema1.TestBase", "BisCore:Element"],
      ["TestSchema1.TestDerived", "BisCore:Element"],
      ["TestSchema1.ITestMixinForAspectsBase", "BisCore:ElementAspect"],
      ["TestSchema1.ITestMixinForAspectsDerived", "BisCore:ElementAspect"],
      ["TestSchema1.ITestMixinForElements", "BisCore:Element"],
      ["TestSchema1.TestMixedInAndDerived", "BisCore:Element"],
    ] as const) {
      const rootMetaData = ClassRegistry.getRootEntity(imodel, testClass);
      expect(rootMetaData.replace(".", ":")).to.equal(expectedRoot);
    }
  });
});

describe("Class Registry - generated classes", () => {
  let imodel: SnapshotDb;
  const testSchemaPath = path.join(KnownTestLocations.assetsDir, "TestGeneratedClasses.ecschema.xml");

  before(async () => {
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ClassRegistry", "GeneratedClasses.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    assert.exists(imodel);
    await imodel.importSchemas([testSchemaPath]); // will throw an exception if import fails
  });

  after(() => {
    imodel?.close();
  });

  interface TestModelWithNavPropProps extends ModelProps {
    elemNavProp: RelatedElementProps;
    aspectNavProp: RelatedElementProps;
    relNavProp: RelatedElementProps;
  }

  interface TestEntityProps extends DefinitionElementProps {
    prop: string;
  }

  interface LinkTableRelWithNavPropProps extends RelationshipProps {
    elemNavProp: RelatedElementProps;
    modelNavProp: RelatedElementProps;
    aspectNavProp: RelatedElementProps;
  }

  interface TestElementWithNavPropProps extends DefinitionElementProps {
    navProp: RelatedElementProps;
  }

  interface DerivedWithNavPropProps extends TestElementWithNavPropProps {
    derivedNavProp: RelatedElementProps;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TestAspectWithNavProp extends ElementAspectProps {
    navProp: RelatedElement;
  }

  class TestGeneratedClasses extends Schema {
    public static override get schemaName(): string { return "TestGeneratedClasses"; }
    public static get classes() {
      return [TestModelWithNavProp, TestElementWithNavProp, LinkTableRelWithNavProp, DerivedWithNavProp, Derived2, Derived3, Derived4, Derived5, Derived6];
    }
    public static registerSchema() {
      if (this !== Schemas.getRegisteredSchema(this.schemaName)) {
        Schemas.unregisterSchema(this.schemaName);
        Schemas.registerSchema(this);
        // eslint-disable-next-line @typescript-eslint/naming-convention
        for (const class_ of this.classes) {
          ClassRegistry.register(class_, this);
        }
      }
    }

    public static unregisterSchema() {
      Schemas.unregisterSchema(this.schemaName);
    }
  }

  class TestElementWithNavProp extends DefinitionElement {
    public static override get className() { return "TestElementWithNavProp"; }
    public static override schema = TestGeneratedClasses;
    public navProp: RelatedElement;
    public constructor(props: TestElementWithNavPropProps, inIModel: IModelDb) {
      super(props, inIModel);
      this.navProp = new RelatedElement(props.navProp);
    }
  }

  class TestModelWithNavProp extends DefinitionModel {
    public static override get className() { return "TestModelWithNavProp"; }
    public static override schema = TestGeneratedClasses;
    public elemNavProp: RelatedElement;
    public aspectNavProp: RelatedElement;
    public relNavProp: RelatedElement;
    public constructor(props: TestModelWithNavPropProps, inIModel: IModelDb) {
      super(props, inIModel);
      this.elemNavProp = new RelatedElement(props.elemNavProp);
      this.aspectNavProp = new RelatedElement(props.aspectNavProp);
      this.relNavProp = new RelatedElement(props.relNavProp);
    }
  }

  class LinkTableRelWithNavProp extends ElementRefersToElements {
    public static override get className() { return "LinkTableRelWithNavProp"; }
    public static override schema = TestGeneratedClasses;
    public elemNavProp: RelatedElement;
    public aspectNavProp: RelatedElement;
    public modelNavProp: RelatedElement;
    public constructor(props: LinkTableRelWithNavPropProps, inIModel: IModelDb) {
      super(props, inIModel);
      this.elemNavProp = new RelatedElement(props.elemNavProp);
      this.aspectNavProp = new RelatedElement(props.aspectNavProp);
      this.modelNavProp = new RelatedElement(props.modelNavProp);
    }
  }

  class DerivedWithNavProp extends TestElementWithNavProp {
    public static override get className() { return "DerivedWithNavProp"; }
    public static override schema = TestGeneratedClasses;
    public derivedNavProp: RelatedElement;
    public constructor(props: DerivedWithNavPropProps, inIModel: IModelDb) {
      super(props, inIModel);
      this.derivedNavProp = new RelatedElement(props.derivedNavProp);
    }
  }

  class Derived2 extends DerivedWithNavProp {
    public static override get className() { return "Derived2"; }
  }
  class Derived3 extends Derived2 {
    public static override get className() { return "Derived3"; }
  }
  class Derived4 extends Derived3 {
    public static override get className() { return "Derived4"; }
  }
  class Derived5 extends Derived4 {
    public static override get className() { return "Derived5"; }
  }
  class Derived6 extends Derived5 {
    public static override get className() { return "Derived6"; }
  }

  // if a single inherited class is not generated, the entire hierarchy is considered not-generated
  it("should only generate automatic collectReferenceIds implementations for generated classes", async () => {
    await imodel.importSchemas([testSchemaPath]); // will throw an exception if import fails

    // eslint-disable-next-line @typescript-eslint/naming-convention
    class GeneratedTestElementWithNavProp extends imodel.getJsClass<typeof Element>("TestGeneratedClasses:TestElementWithNavProp") {
      constructor(props: TestElementWithNavPropProps) {
        super(props, imodel);
      }
    }

    const testEntityId = imodel.elements.insertElement({
      classFullName: "TestGeneratedClasses:TestEntity",
      prop: "sample-value",
      model: IModelDb.dictionaryId,
      code: Code.createEmpty(),
    } as TestEntityProps);

    const elemWithNavProp = new GeneratedTestElementWithNavProp({
      classFullName: "TestGeneratedClasses:TestElementWithNavProp",
      navProp: {
        id: testEntityId,
        relClassName: "TestGeneratedClasses:ElemRel",
      },
    } as TestElementWithNavPropProps);

    // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/dot-notation
    assert.isDefined(GeneratedTestElementWithNavProp.prototype["collectReferenceIds"]);
    expect(
      [...elemWithNavProp.getReferenceIds()],
    ).to.have.members([
      EntityReferences.fromEntityType(elemWithNavProp.model, ConcreteEntityTypes.Model),
      EntityReferences.fromEntityType(elemWithNavProp.code.scope, ConcreteEntityTypes.Element),
      EntityReferences.fromEntityType(testEntityId, ConcreteEntityTypes.Element),
    ]);

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const GeneratedTestAspectWithNavProp = imodel.getJsClass("TestGeneratedClasses:TestAspectWithNavProp");
    assert.isTrue(GeneratedTestAspectWithNavProp.prototype.hasOwnProperty("collectReferenceIds"));
  });

  it("should not override collectReferenceIds for BisCore schema classes", async () => {
    // AnnotationFrameStyle is an example of an unregistered bis class without an implementation of collectReferenceIds
    // eslint-disable-next-line @typescript-eslint/dot-notation
    assert.isTrue(imodel.getJsClass("BisCore:AnnotationFrameStyle").prototype.hasOwnProperty("collectReferenceIds"));
  });

  it("should get references from its bis superclass", async () => {
    await imodel.importSchemas([testSchemaPath]); // will throw an exception if import fails

    // eslint-disable-next-line @typescript-eslint/naming-convention
    class GeneratedTestElementWithNavProp extends imodel.getJsClass<typeof Element>("TestGeneratedClasses:TestElementWithNavProp") {
      constructor(props: ElementProps) {
        super(props, imodel);
      }
    }

    const testEntityId = imodel.elements.insertElement({
      classFullName: "TestGeneratedClasses:TestEntity",
      prop: "sample-value",
      model: IModelDb.dictionaryId,
      code: Code.createEmpty(),
    } as TestEntityProps);

    const elemWithNavProp = new GeneratedTestElementWithNavProp({
      classFullName: "TestGeneratedClasses:TestElementWithNavProp",
      navProp: new RelatedElement({
        id: testEntityId,
        relClassName: "TestGeneratedClasses:ElemRel",
      }),
      model: IModelDb.dictionaryId,
      code: new Code({
        scope: IModelDb.rootSubjectId,
        spec: imodel.codeSpecs.getByName(BisCodeSpec.spatialCategory).id,
        value: "",
      }),
      parent: new RelatedElement({
        // since we don't actually insert this element in this test, using an arbitrary id string
        id: "0x0000ffff",
        relClassName: "BisCore:ElementOwnsChildElements",
      }),
    } as TestElementWithNavPropProps);

    // super class here is Element so we should get the code.scope, model and parent as references
    expect(
      [...elemWithNavProp.getReferenceIds()],
    ).to.have.members([
      EntityReferences.fromEntityType(elemWithNavProp.model, ConcreteEntityTypes.Model),
      EntityReferences.fromEntityType(elemWithNavProp.code.scope, ConcreteEntityTypes.Element),
      elemWithNavProp.parent && EntityReferences.fromEntityType(elemWithNavProp.parent?.id, ConcreteEntityTypes.Element),
      EntityReferences.fromEntityType(testEntityId, ConcreteEntityTypes.Element),
    ].filter((x) => x !== undefined));

    const modelTestEntityIds = new Array(2).fill(undefined).map((_, index) => imodel.elements.insertElement({
      classFullName: "TestGeneratedClasses:TestEntity",
      prop: `model-value-${index}`,
      model: IModelDb.dictionaryId,
      code: Code.createEmpty(),
    } as TestEntityProps));

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const GeneratedTestAspectWithNavProp = imodel.getJsClass("TestGeneratedClasses:TestAspectWithNavProp");

    const aspectWithNavPropId = imodel.elements.insertAspect({
      classFullName: GeneratedTestAspectWithNavProp.classFullName,
      navProp: { id: modelTestEntityIds[0], relClassName: "TestGeneratedClasses:NonElemRel" },
      element: { id: modelTestEntityIds[1] },
    } as TestAspectWithNavProp);

    // eslint-disable-next-line @typescript-eslint/naming-convention
    class GeneratedTestModelWithNavProp extends imodel.getJsClass<typeof Model>("TestGeneratedClasses:TestModelWithNavProp") {
      constructor(props: TestModelWithNavPropProps) {
        super(props, imodel);
      }
    }

    const modelWithNavProp = new GeneratedTestModelWithNavProp({
      classFullName: GeneratedTestModelWithNavProp.classFullName,
      modeledElement: { id: modelTestEntityIds[0] },
      parentModel: IModelDb.dictionaryId,
      elemNavProp: { id: modelTestEntityIds[1], relClassName: "TestGeneratedClasses:ModelToElemNavRel" },
      aspectNavProp: { id: aspectWithNavPropId, relClassName: "TestGeneratedClasses:ModelToAspectNavRel" },
      // removed due to a bug
      // relNavProp: { id: relWithNavPropId, relClassName: "TestGeneratedClasses:ModelToRelNavRel" },
    } as TestModelWithNavPropProps);

    const modelWithNavPropId = modelWithNavProp.insert();

    expect(
      [...modelWithNavProp.getReferenceIds()],
    ).to.have.members([
      EntityReferences.fromEntityType(modelTestEntityIds[1], ConcreteEntityTypes.Element),
      EntityReferences.fromEntityType(IModelDb.dictionaryId, ConcreteEntityTypes.Model),
      EntityReferences.fromEntityType(modelTestEntityIds[0], ConcreteEntityTypes.Element),
      EntityReferences.fromEntityType(aspectWithNavPropId, ConcreteEntityTypes.ElementAspect),
      // ignoring this one, because there seems to be a bug when specifying a relationship instance as a nav prop
      // EntityReferences.fromEntityType(relWithNavPropId, ConcreteEntityTypes.Relationship),
    ].filter((x) => x !== undefined));

    const relTestEntityIds = new Array(3).fill(undefined).map((_, index) => imodel.elements.insertElement({
      classFullName: "TestGeneratedClasses:TestEntity",
      prop: `rel-value-${index}`,
      model: IModelDb.dictionaryId,
      code: Code.createEmpty(),
    } as TestEntityProps));

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const GeneratedLinkTableRelWithNavProp = imodel.getJsClass<typeof LinkTableRelWithNavProp>("TestGeneratedClasses:LinkTableRelWithNavProp");

    const relWithNavProp = new GeneratedLinkTableRelWithNavProp({
      classFullName: GeneratedLinkTableRelWithNavProp.classFullName,
      sourceId: relTestEntityIds[0],
      targetId: relTestEntityIds[1],
      elemNavProp: {
        id: relTestEntityIds[2],
        relClassName: "TestGeneratedClasses:LinkTableRelToElemNavRel",
      },
      modelNavProp: {
        id: modelWithNavPropId,
        relClassName: "TestGeneratedClasses:LinkTableRelToModelNavRel",
      },
      aspectNavProp: {
        id: aspectWithNavPropId,
        relClassName: "TestGeneratedClasses:LinkTableRelToAspectNavRel",
      },
    }, imodel);

    const _relWithNavPropId = relWithNavProp.insert();

    expect(
      [...relWithNavProp.getReferenceIds()],
    ).to.have.members([
      ...relTestEntityIds.map((id) => EntityReferences.fromEntityType(id, ConcreteEntityTypes.Element)),
      EntityReferences.fromEntityType(modelWithNavPropId, ConcreteEntityTypes.Model),
      EntityReferences.fromEntityType(aspectWithNavPropId, ConcreteEntityTypes.ElementAspect),
    ]);
  });

  it("should not override custom registered schema class implementations of collectReferenceIds", async () => {
    const testImplReferenceId = "TEST-INVALID-ID";
    class MyTestElementWithNavProp extends TestElementWithNavProp {
      public override collectReferenceIds(referenceIds: EntityReferenceSet) {
        super.collectReferenceIds(referenceIds);
        referenceIds.addElement(testImplReferenceId);
      }
    }
    class MyTestGeneratedClasses extends TestGeneratedClasses {
      public static override get classes() {
        return [MyTestElementWithNavProp, Derived2, Derived3, Derived4, Derived5, Derived6];
      }
    }
    MyTestGeneratedClasses.registerSchema();

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const ActualTestElementWithNavProp = imodel.getJsClass<typeof MyTestElementWithNavProp>(TestElementWithNavProp.classFullName);

    const testElementWithNavPropCollectReferencesSpy = sinon.spy(ActualTestElementWithNavProp.prototype, "collectReferenceIds");

    // eslint-disable-next-line @typescript-eslint/naming-convention
    class ActualDerivedWithNavProp extends imodel.getJsClass<typeof Element>(DerivedWithNavProp.classFullName) {
      constructor(props: DerivedWithNavPropProps) {
        super(props, imodel);
      }
    }

    const testEntity1Id = imodel.elements.insertElement({
      classFullName: "TestGeneratedClasses:TestEntity",
      prop: "sample-value-1",
      model: IModelDb.dictionaryId,
      code: Code.createEmpty(),
    } as TestEntityProps);

    const testEntity2Id = imodel.elements.insertElement({
      classFullName: "TestGeneratedClasses:TestEntity",
      prop: "sample-value-2",
      model: IModelDb.dictionaryId,
      code: Code.createEmpty(),
    } as TestEntityProps);

    const elemWithNavProp = new ActualTestElementWithNavProp({
      classFullName: TestElementWithNavProp.classFullName,
      navProp: {
        id: testEntity1Id,
        relClassName: "TestGeneratedClasses:ElemRel",
      },
    } as TestElementWithNavPropProps, imodel);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    assert.isDefined(ActualTestElementWithNavProp.prototype.collectReferenceIds);
    expect(
      [...elemWithNavProp.getReferenceIds()],
    ).to.have.members([
      EntityReferences.fromEntityType(elemWithNavProp.model, ConcreteEntityTypes.Model),
      EntityReferences.fromEntityType(elemWithNavProp.code.scope, ConcreteEntityTypes.Element),
      elemWithNavProp.parent && EntityReferences.fromEntityType(elemWithNavProp.parent?.id, ConcreteEntityTypes.Element),
      EntityReferences.fromEntityType(testImplReferenceId, ConcreteEntityTypes.Element),
    ].filter((x) => x !== undefined));

    expect(testElementWithNavPropCollectReferencesSpy.called).to.be.true;
    testElementWithNavPropCollectReferencesSpy.resetHistory();

    const derivedElemWithNavProp = new ActualDerivedWithNavProp({
      classFullName: DerivedWithNavProp.classFullName,
      navProp: {
        id: testEntity1Id,
        relClassName: "TestGeneratedClasses:ElemRel",
      },
      derivedNavProp: {
        id: testEntity2Id,
        relClassName: "TestGeneratedClasses:DerivedElemRel",
      },
    } as DerivedWithNavPropProps);

    // eslint-disable-next-line @typescript-eslint/unbound-method, @typescript-eslint/dot-notation
    assert.isDefined(ActualDerivedWithNavProp.prototype["collectReferenceIds"]);
    // This demonstrates that if a non-generated class has a registered non-biscore base, it will not get a generated impl,
    expect(
      [...derivedElemWithNavProp.getReferenceIds()],
    ).to.have.members([
      EntityReferences.fromEntityType(elemWithNavProp.model, ConcreteEntityTypes.Model),
      EntityReferences.fromEntityType(elemWithNavProp.code.scope, ConcreteEntityTypes.Element),
      elemWithNavProp.parent && EntityReferences.fromEntityType(elemWithNavProp.parent?.id, ConcreteEntityTypes.Element),
      EntityReferences.fromEntityType(testImplReferenceId, ConcreteEntityTypes.Element),
    ].filter((x) => x !== undefined));
    // explicitly check we called the super function
    // (we already know its implementation was called, because testImplReferenceId is in the derived call's result)
    expect(testElementWithNavPropCollectReferencesSpy.called).to.be.true;

    sinon.restore();
    MyTestGeneratedClasses.unregisterSchema();
  });

  it("should work along a complex chain of overrides", async () => {
    class MyDerived2 extends Derived2 {
      public override collectReferenceIds(referenceIds: EntityReferenceSet) {
        super.collectReferenceIds(referenceIds);
        referenceIds.addElement("derived-2");
      }
    }
    class MyDerived4 extends Derived4 {
      public override collectReferenceIds(referenceIds: EntityReferenceSet) {
        super.collectReferenceIds(referenceIds);
        referenceIds.addElement("derived-4");
      }
    }
    class MyTestGeneratedClasses extends TestGeneratedClasses {
      public static override get classes() {
        // leaving Derived3,5,6 generated
        return [MyDerived2, MyDerived4];
      }
    }
    MyTestGeneratedClasses.registerSchema();

    /* eslint-disable @typescript-eslint/naming-convention */
    const ActualTestElementWithNavProp = imodel.getJsClass<typeof Element>("TestGeneratedClasses:TestElementWithNavProp");
    const ActualDerivedWithNavProp = imodel.getJsClass<typeof Element>("TestGeneratedClasses:DerivedWithNavProp");
    const ActualDerived2 = imodel.getJsClass<typeof Element>("TestGeneratedClasses:Derived2");
    const ActualDerived3 = imodel.getJsClass<typeof Element>("TestGeneratedClasses:Derived3");
    const ActualDerived4 = imodel.getJsClass<typeof Element>("TestGeneratedClasses:Derived4");
    const ActualDerived5 = imodel.getJsClass<typeof Element>("TestGeneratedClasses:Derived5");
    const ActualDerived6 = imodel.getJsClass<typeof Element>("TestGeneratedClasses:Derived6");
    /* eslint-enable @typescript-eslint/no-redeclare */

    expect(ActualTestElementWithNavProp.isGeneratedClass).to.be.true;
    expect(ActualDerivedWithNavProp.isGeneratedClass).to.be.true;
    expect(ActualDerived2.isGeneratedClass).to.be.false;
    expect(ActualDerived3.isGeneratedClass).to.be.true;
    expect(ActualDerived4.isGeneratedClass).to.be.false;
    expect(ActualDerived5.isGeneratedClass).to.be.true;
    expect(ActualDerived6.isGeneratedClass).to.be.true;

    assert.isTrue(ActualTestElementWithNavProp.prototype.hasOwnProperty("collectReferenceIds" )); // should have automatic impl
    assert.isTrue(ActualDerivedWithNavProp.prototype.hasOwnProperty("collectReferenceIds"));
    assert.isTrue(ActualDerived2.prototype.hasOwnProperty("collectReferenceIds")); // non-generated; manually implements so has method
    assert.isFalse(ActualDerived3.prototype.hasOwnProperty("collectReferenceIds")); // base is non-generated so it shouldn't get the automatic impl
    assert.isTrue(ActualDerived4.prototype.hasOwnProperty("collectReferenceIds")); // manually implements so it should have the method
    assert.isFalse(ActualDerived5.prototype.hasOwnProperty("collectReferenceIds")); // ancestor is non-generated so it shouldn't get the automatic impl
    assert.isFalse(ActualDerived6.prototype.hasOwnProperty("collectReferenceIds")); // ancestor is non-generated so it shouldn't get the automatic impl

    const testEntity1Id = imodel.elements.insertElement({
      classFullName: "TestGeneratedClasses:Derived6",
      prop: "sample-value-1",
      model: IModelDb.dictionaryId,
      code: Code.createEmpty(),
    } as TestEntityProps);

    const testEntity2Id = imodel.elements.insertElement({
      classFullName: "TestGeneratedClasses:TestEntity",
      prop: "sample-value-2",
      model: IModelDb.dictionaryId,
      code: Code.createEmpty(),
    } as TestEntityProps);

    const derived6Id = imodel.elements.insertElement({
      classFullName: Derived6.classFullName,
      model: IModelDb.dictionaryId,
      code: Code.createEmpty(),
      navProp: {
        id: testEntity1Id,
        relClassName: "TestGeneratedClasses:ElemRel",
      },
      derivedNavProp: {
        id: testEntity2Id,
        relClassName: "TestGeneratedClasses:DerivedElemRel",
      },
    } as DerivedWithNavPropProps);

    const derived6 = imodel.elements.getElement(derived6Id);

    /** it is not possible to make a spy of an already existing spy, so lazy try making one
     * this is necessary since due to prototypes, some "methods" we listen to are actually the same
     */
    function spyCollectReferenceIds(cls: typeof Element): sinon.SinonSpy {
      if ((cls.prototype as any).collectReferenceIds.isSinonProxy) {
        return (cls.prototype as any).collectReferenceIds;
      }
      return sinon.spy(cls.prototype, "collectReferenceIds" as any);
    }

    const elementMethodSpy = spyCollectReferenceIds(Element);
    const testElementWithNavPropSpy = spyCollectReferenceIds(ActualTestElementWithNavProp);
    const derivedWithNavPropSpy = spyCollectReferenceIds(ActualDerivedWithNavProp);
    const derived2Spy = spyCollectReferenceIds(ActualDerived2);
    const derived3Spy = spyCollectReferenceIds(ActualDerived3);
    const derived4Spy = spyCollectReferenceIds(ActualDerived4);
    const derived5Spy = spyCollectReferenceIds(ActualDerived5);
    const derived6Spy = spyCollectReferenceIds(ActualDerived6);

    // This demonstrates that if a generated class (Derived6) has a non-generated ancestor, it will not get a generated impl
    // instead it will just call the closest non-generated ancestor (Derived4)
    expect([...derived6.getReferenceIds()]).to.have.members(
      [
        EntityReferences.fromEntityType(derived6.model, ConcreteEntityTypes.Model),
        EntityReferences.fromEntityType(derived6.code.scope, ConcreteEntityTypes.Element),
        derived6.parent?.id && EntityReferences.fromEntityType(derived6.parent.id, ConcreteEntityTypes.Element),
        // "TestGeneratedClasses:Derived4" is MyDerived4 above, which extends the Derived4 class, which extends up
        // without any custom ancestor implementing collectReferenceIds, so Element.collectReferenceIds is called as the
        // super, and no navigation properties or other custom implementations are called so we only get "derived-4"
        EntityReferences.fromEntityType("derived-4", ConcreteEntityTypes.Element),
      ].filter((x) => x !== undefined),
    );

    expect(elementMethodSpy.called).to.be.true; // this is the `super.collectReferenceIds` call in MyDerived4
    expect(testElementWithNavPropSpy.called).to.be.false;
    expect(derivedWithNavPropSpy.called).to.be.false;

    // these are the same (tested below)
    expect(derived2Spy.called).to.be.false;
    expect(derived3Spy.called).to.be.false;

    // these are all the same (tested below)
    expect(derived4Spy.called).to.be.true;
    expect(derived5Spy.called).to.be.true;
    expect(derived6Spy.called).to.be.true;

    expect(
      new Set(
        [
          Element,
          ActualTestElementWithNavProp,
          ActualDerivedWithNavProp,
          Derived2,
          Derived3, // same as above (so will be removed from set)
          Derived4,
          Derived5, // save as above (so will be removed from set)
          Derived6, // save as above (so will be removed from set)
        ].map((e) => e.prototype["collectReferenceIds"]), // eslint-disable-line @typescript-eslint/dot-notation
      ),
    ).to.deep.equal(
      new Set(
        [
          Element,
          ActualTestElementWithNavProp,
          ActualDerivedWithNavProp,
          Derived2,
          Derived4,
        // eslint-disable-next-line @typescript-eslint/dot-notation
        ].map((e) => e.prototype["collectReferenceIds"]), // eslint-disable-line @typescript-eslint/dot-notation
      ),
    );

    MyTestGeneratedClasses.unregisterSchema();
    sinon.restore();
  });
});

class Base {
  public static staticProperty: string = "base";
  public static get sqlName(): string { return `s.${this.staticProperty}`; }
}

class Derived extends Base {
}

describe("Static Properties", () => {
  it("should be inherited, and the subclass should get its own copy", async () => {
    assert.equal(Base.staticProperty, "base");
    assert.equal(Derived.staticProperty, "base"); // Derived inherits Base's staticProperty (via its prototype)
    Derived.staticProperty = "derived";           // Derived now gets its own copy of staticProperty
    assert.equal(Base.staticProperty, "base");      // Base's staticProperty remains as it was
    assert.equal(Derived.staticProperty, "derived"); // Derived's staticProperty is now different
    assert.equal(Base.sqlName, "s.base");
    const d = new Derived();
    assert.equal((d.constructor as any).staticProperty, "derived"); // Instances of Derived see Derived.staticProperty
    const b = new Base();
    assert.equal((b.constructor as any).staticProperty, "base"); // Instances of Base see Base.staticProperty
  });

});

// TODO: add tests on the new model/aspect prefixes
