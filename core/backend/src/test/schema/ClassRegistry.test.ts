/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Code, DefinitionElementProps, ElementAspectProps, EntityMetaData, RelatedElement } from "@itwin/core-common";
import {
  DefinitionElement, IModelDb, RepositoryLink, Schema, SnapshotDb, SpatialViewDefinition, UrlLink, ViewDefinition3d,
} from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { Element } from "../../Element";
import { Schemas } from "../../Schema";
import { ClassRegistry } from "../../ClassRegistry";
import { Id64Set } from "@itwin/core-bentley";

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

describe("Class Registry - generated classes", () => {
  let imodel: SnapshotDb;
  const testSchemaPath = path.join(KnownTestLocations.assetsDir, "TestGeneratedClasses.ecschema.xml");

  before(async () => {
    const seedFileName = IModelTestUtils.resolveAssetFile("test.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("ClassRegistry", "ClassRegistryTest.bim");
    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    assert.exists(imodel);
    await imodel.importSchemas([testSchemaPath]); // will throw an exception if import fails
  });

  after(() => {
    imodel?.close();
  });

  interface TestEntityProps extends DefinitionElementProps {
    prop: string;
  }

  interface TestElementWithNavPropProps  extends DefinitionElementProps {
    navProp: RelatedElement;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TestNonElementWithNavPropProps  extends ElementAspectProps {
    navProp: RelatedElement;
  }

  class TestElementWithNavProp extends DefinitionElement implements TestElementWithNavPropProps {
    public static override get className(): string { return "TestElementWithNavProp"; }
    public navProp: RelatedElement;
    public constructor(props: TestElementWithNavPropProps, inIModel: IModelDb) {
      super(props, inIModel);
      this.navProp = props.navProp;
    }
  }

  class TestGeneratedClasses extends Schema {
    public static override get schemaName(): string { return "TestGeneratedClasses"; }
    public static classes = [TestElementWithNavProp];
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
  }

  it("should only generate automatic collectPredecessorIds implementations for Element subclasses", async () => {
    await imodel.importSchemas([testSchemaPath]); // will throw an exception if import fails

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const GeneratedTestElementWithNavProp = imodel.getJsClass("TestGeneratedClasses:TestElementWithNavProp");

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
    } as TestElementWithNavPropProps, imodel) as Element;

    assert.isDefined((GeneratedTestElementWithNavProp.prototype as any).getPredecessorIds);
    assert.includeDeepMembers([elemWithNavProp.model, testEntityId], [...elemWithNavProp.getPredecessorIds()]);

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const GeneratedTestNonElementWithNavProp = imodel.getJsClass("TestGeneratedClasses:TestNonElementWithNavProp");
    assert.isUndefined((GeneratedTestNonElementWithNavProp.prototype as any).getPredecessorIds);
  });

  it("should not override custom registered schema class implementations of collectPredecessorIds", async () => {
    const testImplPredecessorId = "TEST";
    class MyTestElementWithNavProp extends TestElementWithNavProp {
      protected override collectPredecessorIds(predecessorIds: Id64Set) {
        super.collectPredecessorIds(predecessorIds);
        predecessorIds.add(testImplPredecessorId);
      }
    }
    class MyTestGeneratedClasses extends TestGeneratedClasses {
      public static override classes = [MyTestElementWithNavProp];
    }
    MyTestGeneratedClasses.registerSchema();

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const ActualTestElementWithNavProp = imodel.getJsClass("TestGeneratedClasses:TestElementWithNavProp");

    const testEntityId = imodel.elements.insertElement({
      classFullName: "TestGeneratedClasses:TestEntity",
      prop: "sample-value",
      model: IModelDb.dictionaryId,
      code: Code.createEmpty(),
    } as TestEntityProps);

    const elemWithNavProp = new ActualTestElementWithNavProp({
      classFullName: "TestGeneratedClasses:TestElementWithNavProp",
      navProp: {
        id: testEntityId,
        relClassName: "TestGeneratedClasses:ElemRel",
      },
    } as TestElementWithNavPropProps, imodel) as Element;

    assert.isDefined((ActualTestElementWithNavProp.prototype as any).getPredecessorIds);
    assert.include([...elemWithNavProp.getPredecessorIds()], testImplPredecessorId);
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
