/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ECJsonTypeMap, WsgInstance } from "../ECJsonTypeMap";

abstract class TestAbstractBaseClass extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "Abstract_Base_String_Property")
  @ECJsonTypeMap.propertyToJson("ecdb", "abstractBaseStringProperty")
  public abstractBaseStringProperty: string;
}

@ECJsonTypeMap.classToJson("wsg", "Test_Schema.Test_Base_Class", { schemaPropertyName: "schemaName", classPropertyName: "className" })
@ECJsonTypeMap.classToJson("ecdb", "TestSchema.TestBaseClass", { classKeyPropertyName: "className" })
class TestBaseClass extends TestAbstractBaseClass {
  @ECJsonTypeMap.propertyToJson("wsg", "Base_String_Property")
  @ECJsonTypeMap.propertyToJson("ecdb", "baseStringProperty")
  public baseStringProperty: string;
}

@ECJsonTypeMap.classToJson("wsg", "Test_Schema.Test_Class", { schemaPropertyName: "schemaName", classPropertyName: "className" })
@ECJsonTypeMap.classToJson("ecdb", "TestSchema.TestClass", { classKeyPropertyName: "className" })
class TestClass extends TestBaseClass {
  @ECJsonTypeMap.propertyToJson("wsg", "Integer_Property")
  @ECJsonTypeMap.propertyToJson("ecdb", "integerProperty")
  public integerProperty: number;

  @ECJsonTypeMap.propertyToJson("wsg", "Double_Property")
  @ECJsonTypeMap.propertyToJson("ecdb", "doubleProperty")
  public doubleProperty: number;

  @ECJsonTypeMap.propertyToJson("wsg", "Boolean_Property")
  @ECJsonTypeMap.propertyToJson("ecdb", "booleanProperty")
  public booleanProperty: boolean;

  @ECJsonTypeMap.propertyToJson("wsg", "String_Property")
  @ECJsonTypeMap.propertyToJson("ecdb", "stringProperty")
  public stringProperty: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[Test_Relationship_Class1].relatedInstance[Test_Related_Class1].properties.String_Property1")
  @ECJsonTypeMap.propertyToJson("ecdb", "relatedStringProperty1")
  public relatedStringProperty1: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[Test_Relationship_Class2](direction:Forward).relatedInstance[Test_Related_Class2].properties.String_Property2")
  @ECJsonTypeMap.propertyToJson("ecdb", "relatedStringProperty2")
  public relatedStringProperty2: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[Test_Relationship_Class1].relatedInstance[Test_Related_Class2].properties.String_Property3")
  @ECJsonTypeMap.propertyToJson("ecdb", "relatedStringProperty3")
  public relatedStringProperty3: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[Test_Relationship_Class1].relatedInstance[Test_Related_Class2].properties.String_Property4")
  @ECJsonTypeMap.propertyToJson("ecdb", "relatedStringProperty4")
  public relatedStringProperty4: string;
}

describe("ECJsonTypeMap", () => {
  let seedUntypedWsgInstance: any;
  let seedUntypedECDbInstance: any;

  let seedTypedWsgInstance: TestClass;
  let seedTypedECDbInstance: TestClass;

  before((done: Mocha.Done): any => {
    /* eslint-disable @typescript-eslint/naming-convention */
    seedUntypedWsgInstance = {
      instanceId: "TestWsgInstanceId",
      schemaName: "Test_Schema",
      className: "Test_Class",
      Integer_Property: 123,
      Double_Property: 123.456,
      Boolean_Property: true,
      String_Property: "Test String Property",
      Abstract_Base_String_Property: "Test Abstract Base String Property",
      Base_String_Property: "Test Base String Property",
      relationshipInstances: [
        {
          className: "Test_Relationship_Class1",
          schemaName: "Test_Schema",
          relatedInstance: {
            className: "Test_Related_Class1",
            schemaName: "Test_Schema",
            properties: {
              String_Property1: "Test Related String Property 1",
            },
          },
        },
        {
          className: "Test_Relationship_Class2",
          schemaName: "Test_Schema",
          direction: "Forward",
          relatedInstance: {
            className: "Test_Related_Class2",
            schemaName: "Test_Schema",
            properties: {
              String_Property2: "Test Related String Property 2",
            },
          },
        },
        {
          className: "Test_Relationship_Class1",
          schemaName: "Test_Schema",
          relatedInstance: {
            className: "Test_Related_Class2",
            schemaName: "Test_Schema",
            properties: {
              String_Property3: "Test Related String Property 3",
              String_Property4: "Test Related String Property 4",
            },
          },
        },
      ],
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    seedUntypedECDbInstance = {
      id: "TestECDbInstanceId",
      className: "TestSchema.TestClass",
      integerProperty: seedUntypedWsgInstance.Integer_Property,
      doubleProperty: seedUntypedWsgInstance.Double_Property,
      booleanProperty: seedUntypedWsgInstance.Boolean_Property,
      stringProperty: seedUntypedWsgInstance.String_Property,
      relatedStringProperty1: seedUntypedWsgInstance.relationshipInstances[0].relatedInstance.properties.String_Property1,
      relatedStringProperty2: seedUntypedWsgInstance.relationshipInstances[1].relatedInstance.properties.String_Property2,
      relatedStringProperty3: seedUntypedWsgInstance.relationshipInstances[2].relatedInstance.properties.String_Property3,
      relatedStringProperty4: seedUntypedWsgInstance.relationshipInstances[2].relatedInstance.properties.String_Property4,
      abstractBaseStringProperty: seedUntypedWsgInstance.Abstract_Base_String_Property,
      baseStringProperty: seedUntypedWsgInstance.Base_String_Property,
    };

    seedTypedWsgInstance = new TestClass();
    seedTypedWsgInstance.wsgId = seedUntypedWsgInstance.instanceId;
    seedTypedWsgInstance.integerProperty = seedUntypedWsgInstance.Integer_Property;
    seedTypedWsgInstance.doubleProperty = seedUntypedWsgInstance.Double_Property;
    seedTypedWsgInstance.booleanProperty = seedUntypedWsgInstance.Boolean_Property;
    seedTypedWsgInstance.stringProperty = seedUntypedWsgInstance.String_Property;
    seedTypedWsgInstance.relatedStringProperty1 = seedUntypedWsgInstance.relationshipInstances[0].relatedInstance.properties.String_Property1;
    seedTypedWsgInstance.relatedStringProperty2 = seedUntypedWsgInstance.relationshipInstances[1].relatedInstance.properties.String_Property2;
    seedTypedWsgInstance.relatedStringProperty3 = seedUntypedWsgInstance.relationshipInstances[2].relatedInstance.properties.String_Property3;
    seedTypedWsgInstance.relatedStringProperty4 = seedUntypedWsgInstance.relationshipInstances[2].relatedInstance.properties.String_Property4;
    seedTypedWsgInstance.abstractBaseStringProperty = seedUntypedWsgInstance.Abstract_Base_String_Property;
    seedTypedWsgInstance.baseStringProperty = seedUntypedWsgInstance.Base_String_Property;

    seedTypedECDbInstance = new TestClass();
    seedTypedECDbInstance.ecId = seedUntypedECDbInstance.id;
    seedTypedECDbInstance.integerProperty = seedUntypedECDbInstance.integerProperty;
    seedTypedECDbInstance.doubleProperty = seedUntypedECDbInstance.doubleProperty;
    seedTypedECDbInstance.booleanProperty = seedUntypedECDbInstance.booleanProperty;
    seedTypedECDbInstance.stringProperty = seedUntypedECDbInstance.stringProperty;
    seedTypedECDbInstance.relatedStringProperty1 = seedUntypedECDbInstance.relatedStringProperty1;
    seedTypedECDbInstance.relatedStringProperty2 = seedUntypedECDbInstance.relatedStringProperty2;
    seedTypedECDbInstance.relatedStringProperty3 = seedUntypedECDbInstance.relatedStringProperty3;
    seedTypedECDbInstance.relatedStringProperty4 = seedUntypedECDbInstance.relatedStringProperty4;
    seedTypedECDbInstance.abstractBaseStringProperty = seedUntypedECDbInstance.abstractBaseStringProperty;
    seedTypedECDbInstance.baseStringProperty = seedUntypedECDbInstance.baseStringProperty;
    done();
  });

  it("should create typed instances from JSON", () => {
    const typedWsgInstance: TestClass | undefined = ECJsonTypeMap.fromJson<TestClass>(TestClass, "wsg", seedUntypedWsgInstance);
    chai.expect(typedWsgInstance).to.deep.equal(seedTypedWsgInstance);

    const typedECDbInstance: TestClass | undefined = ECJsonTypeMap.fromJson<TestClass>(TestClass, "ecdb", seedUntypedECDbInstance);
    chai.expect(typedECDbInstance).to.deep.equal(seedTypedECDbInstance);
  });

  it("should create JSON from typed instances", () => {
    const untypedWsgInstance: any = ECJsonTypeMap.toJson<TestClass>("wsg", seedTypedWsgInstance);
    chai.expect(untypedWsgInstance).to.deep.equal(seedUntypedWsgInstance);

    const untypedECDbInstance: any = ECJsonTypeMap.toJson<TestClass>("ecdb", seedTypedECDbInstance);
    chai.expect(untypedECDbInstance).to.deep.equal(seedUntypedECDbInstance);
  });

  it("should create JSON from typed instance with multiple relathionship descriptors", () => {
    @ECJsonTypeMap.classToJson("wsg", "Test_Schema.Test_ClassMultipleRelationshipDescriptors", { schemaPropertyName: "schemaName", classPropertyName: "className" })
    class TestClassMultipleRelationshipDescriptors extends WsgInstance {
      @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[Test_Relationship_Class3](direction:Backward,secondAccessor:anotherValue,schemaName:DifferentSchema).relatedInstance[Test_Related_Class2].properties.String_Property1")
      public relatedStringProperty1: string;

      @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[Test_Relationship_Class3](direction:Backward,secondAccessor:anotherValue,schemaName:DifferentSchema).relatedInstance[Test_Related_Class2].properties.ArrayProperty1")
      public arrayProperty1?: string[];

      @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[Test_Relationship_Class3](direction:Backward,secondAccessor:anotherValue,schemaName:DifferentSchema).relatedInstance[Test_Related_Class2].properties.ArrayProperty2")
      public arrayProperty2?: string[];
    }

    /* eslint-disable @typescript-eslint/naming-convention */
    const expectedUntypedWsgInstance = {
      instanceId: "TestWsgInstanceId",
      schemaName: "Test_Schema",
      className: "Test_ClassMultipleRelationshipDescriptors",
      relationshipInstances: [
        {
          className: "Test_Relationship_Class3",
          schemaName: "DifferentSchema",
          direction: "Backward",
          secondAccessor: "anotherValue",
          relatedInstance: {
            className: "Test_Related_Class2",
            schemaName: "Test_Schema",
            properties: {
              String_Property1: "Test Related with Direction String Property 1",
              ArrayProperty1: ["value11", "value12"],
              ArrayProperty2: ["value21", "value22"],
            },
          },
        },
      ],
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    const expectedTypedInstance: TestClassMultipleRelationshipDescriptors = new TestClassMultipleRelationshipDescriptors();
    expectedTypedInstance.className = expectedUntypedWsgInstance.className;
    expectedTypedInstance.wsgId = expectedUntypedWsgInstance.instanceId;
    expectedTypedInstance.relatedStringProperty1 = expectedUntypedWsgInstance.relationshipInstances[0].relatedInstance.properties.String_Property1;
    expectedTypedInstance.arrayProperty1 = new Array(2);
    let arrayPropIndex: number = 0;
    expectedTypedInstance.arrayProperty1[arrayPropIndex] = expectedUntypedWsgInstance.relationshipInstances[0].relatedInstance.properties.ArrayProperty1[arrayPropIndex];
    arrayPropIndex++;
    expectedTypedInstance.arrayProperty1[arrayPropIndex] = expectedUntypedWsgInstance.relationshipInstances[0].relatedInstance.properties.ArrayProperty1[arrayPropIndex];
    arrayPropIndex = 0;
    expectedTypedInstance.arrayProperty2 = new Array(2);
    expectedTypedInstance.arrayProperty2[arrayPropIndex] = expectedUntypedWsgInstance.relationshipInstances[0].relatedInstance.properties.ArrayProperty2[arrayPropIndex];
    arrayPropIndex++;
    expectedTypedInstance.arrayProperty2[arrayPropIndex] = expectedUntypedWsgInstance.relationshipInstances[0].relatedInstance.properties.ArrayProperty2[arrayPropIndex];

    const actualUntypedWsgInstance: any = ECJsonTypeMap.toJson<TestClassMultipleRelationshipDescriptors>("wsg", expectedTypedInstance);
    chai.expect(actualUntypedWsgInstance).to.deep.equal(expectedUntypedWsgInstance);
  });

  it("should fail to create JSON from typed instances with different relationship descriptor", () => {
    @ECJsonTypeMap.classToJson("wsg", "Test_Schema.Negative_Test_Class", { schemaPropertyName: "schemaName", classPropertyName: "className" })
    class NegativeTestClass extends WsgInstance {
      @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[Test_Relationship_Class3](direction:Backward).relatedInstance[Test_Related_Class2].properties.String_Property5")
      public relatedStringProperty5: string;

      @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[Test_Relationship_Class3](direction:Forward).relatedInstance[Test_Related_Class2].properties.String_Property6")
      public relatedStringProperty6: string;
    }

    /* eslint-disable @typescript-eslint/naming-convention */
    const expectedUntypedWsgInstance = {
      instanceId: "TestWsgInstanceId",
      schemaName: "Test_Schema",
      className: "Negative_Test_Class",
      relationshipInstances: [
        {
          className: "Test_Relationship_Class3",
          schemaName: "Test_Schema",
          direction: "Backward",
          relatedInstance: {
            className: "Test_Related_Class2",
            schemaName: "Test_Schema",
            properties: {
              String_Property5: "Test Related with Direction String Property 5",
              String_Property6: "Test Related with Direction String Property 6",
            },
          },
        },
      ],
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    const expectedTypedInstance: NegativeTestClass = new NegativeTestClass();
    expectedTypedInstance.className = expectedUntypedWsgInstance.className;
    expectedTypedInstance.wsgId = expectedUntypedWsgInstance.instanceId;
    expectedTypedInstance.relatedStringProperty5 = expectedUntypedWsgInstance.relationshipInstances[0].relatedInstance.properties.String_Property5;
    expectedTypedInstance.relatedStringProperty6 = expectedUntypedWsgInstance.relationshipInstances[0].relatedInstance.properties.String_Property6;

    let error: Error | undefined;
    try {
      ECJsonTypeMap.toJson<NegativeTestClass>("wsg", expectedTypedInstance);
    } catch (err) {
      if (err instanceof Error)
        error = err;
    }
    chai.assert(error);
    chai.expect(error.message).to.deep.equal("Relationship for class 'Test_Relationship_Class3' cannot contain same descriptor 'direction' with different values: existing - 'Backward', new - 'Forward'.");
  });
});
