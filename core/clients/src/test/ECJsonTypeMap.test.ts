/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { WsgInstance, ECJsonTypeMap } from "../ECJsonTypeMap";

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

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[0].relatedInstance.properties.String_Property")
  @ECJsonTypeMap.propertyToJson("ecdb", "relatedStringProperty")
  public relatedStringProperty: string;
}

describe("ECJsonTypeMap", () => {
  let seedUntypedWsgInstance: any;
  let seedUntypedECDbInstance: any;

  let seedTypedWsgInstance: TestClass;
  let seedTypedECDbInstance: TestClass;

  before((done: MochaDone): any => {
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
          relatedInstance: {
            properties: {
              String_Property: "Test Related String Property",
            },
          },
        },
      ],
    };

    seedUntypedECDbInstance = {
      id: "TestECDbInstanceId",
      className: "TestSchema.TestClass",
      integerProperty: seedUntypedWsgInstance.Integer_Property,
      doubleProperty: seedUntypedWsgInstance.Double_Property,
      booleanProperty: seedUntypedWsgInstance.Boolean_Property,
      stringProperty: seedUntypedWsgInstance.String_Property,
      relatedStringProperty: seedUntypedWsgInstance.relationshipInstances[0].relatedInstance.properties.String_Property,
      abstractBaseStringProperty: seedUntypedWsgInstance.Abstract_Base_String_Property,
      baseStringProperty: seedUntypedWsgInstance.Base_String_Property,
    };

    seedTypedWsgInstance = new TestClass();
    seedTypedWsgInstance.wsgId = seedUntypedWsgInstance.instanceId;
    seedTypedWsgInstance.integerProperty = seedUntypedWsgInstance.Integer_Property;
    seedTypedWsgInstance.doubleProperty = seedUntypedWsgInstance.Double_Property;
    seedTypedWsgInstance.booleanProperty = seedUntypedWsgInstance.Boolean_Property;
    seedTypedWsgInstance.stringProperty = seedUntypedWsgInstance.String_Property;
    seedTypedWsgInstance.relatedStringProperty = seedUntypedWsgInstance.relationshipInstances[0].relatedInstance.properties.String_Property;
    seedTypedWsgInstance.abstractBaseStringProperty = seedUntypedWsgInstance.Abstract_Base_String_Property;
    seedTypedWsgInstance.baseStringProperty = seedUntypedWsgInstance.Base_String_Property;

    seedTypedECDbInstance = new TestClass();
    seedTypedECDbInstance.ecId = seedUntypedECDbInstance.id;
    seedTypedECDbInstance.integerProperty = seedUntypedECDbInstance.integerProperty;
    seedTypedECDbInstance.doubleProperty = seedUntypedECDbInstance.doubleProperty;
    seedTypedECDbInstance.booleanProperty = seedUntypedECDbInstance.booleanProperty;
    seedTypedECDbInstance.stringProperty = seedUntypedECDbInstance.stringProperty;
    seedTypedECDbInstance.relatedStringProperty = seedUntypedECDbInstance.relatedStringProperty;
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

});
