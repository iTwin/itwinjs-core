import { ECClass, IncrementalSchemaLocater, ISchemaLocater, Schema, SchemaContext, SchemaInfo, SchemaItem, SchemaItemKey,
  SchemaItemType, SchemaJsonLocater, SchemaKey, SchemaMatchType, SchemaProps, WithSchemaKey }
  from "@itwin/ecschema-metadata";
import { TestIModel } from "./utils/TestIModel";
import { expect } from "chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { IModelIncrementalSchemaLocater } from "../../IModelIncrementalSchemaLocater";
import * as path from "path";

/* eslint-disable @typescript-eslint/no-require-imports */
const configPath = path.join(__dirname, "../assets/IncrementalSchemaLocater/configs");
const oldConfiguration = require(path.join(configPath, "old.config.json"));
const simpleConfiguration = require(path.join(configPath, "simple.config.json"));

chai.use(chaiAsPromised);

const testIModelConfigurations = [
  simpleConfiguration,
  oldConfiguration
];

function parseSchemaItemKey(itemKey: string): SchemaItemKey {
  const [schemaName, itemName] = SchemaItem.parseFullName(itemKey);
  const schemaKey = SchemaKey.parseString(`${schemaName}.0.0.0`);
  return new SchemaItemKey(itemName, schemaKey);
}

describe("Incremental Schema Loading", function () {
  testIModelConfigurations.forEach((iModelConfiguration) => {
    describe(`iModel: ${iModelConfiguration.label}`, () => {
      const testIModel = new TestIModel();

      before("Setup", async function () {
        await testIModel.load(iModelConfiguration.bimFile);
      });

      after(async () => {
        await testIModel.close();
      });

      const resolveSchemaKey = async (schemaName: string): Promise<SchemaKey> => {
        const schemaFullName = (await testIModel.getSchemaNames()).find((name) => name.startsWith(schemaName));
        if (schemaFullName === undefined) {
          throw new Error(`Test schema '${schemaName}' not found`);
        }
        return SchemaKey.parseString(schemaFullName);
      }

      const iModelSchemaJsonLocater = new SchemaJsonLocater((schemaName) => {
        return testIModel.iModel.getSchemaProps(schemaName) as SchemaProps;
      });

      iModelConfiguration.schemas.forEach((testSchemaConfiguration: any) => {
        describe(`Schema: ${testSchemaConfiguration.name}`, () => {
          let testSchemaKey: SchemaKey;

          before(async function () {
            testSchemaKey = await resolveSchemaKey(testSchemaConfiguration.name);
          });

          beforeEach(function () {
            // this.currentTest!.iModel = iModelConfiguration.label;
            // this.currentTest!.schemaName = testSchemaKey.name;
          });

          describe("get schema info", async () => {
            const executeTest = async (locater: ISchemaLocater) => {
              const schemaContext = new SchemaContext();
              schemaContext.addLocater(locater);

              const schemaInfo = await schemaContext.getSchemaInfo(testSchemaKey, SchemaMatchType.Exact) as SchemaInfo;
              expect(schemaInfo).to.be.not.undefined;
              expect(schemaInfo).to.have.nested.property("schemaKey.name", testSchemaKey.name);

              expect(schemaInfo).to.have.property("references").to.have.a.lengthOf(testSchemaConfiguration.references.length);
              expect(schemaInfo).to.have.property("references").to.satisfy((refs: WithSchemaKey[]) => {
                for (const ref of refs) {
                  expect(testSchemaConfiguration.references, `Could not find referenced schema: ${ref.schemaKey.name}`).to.include(ref.schemaKey.name);
                }
                return true;
              });
            };

            it("load schema info (json props - iModel)", async () => {
              await executeTest(iModelSchemaJsonLocater);
            });

            it("load schema info (incremental - backend)", async function () {
              await executeTest(new IModelIncrementalSchemaLocater(testIModel.iModel, { loadPartialSchemaOnly: true }));
            });
          });

          describe("get schema", () => {
            const executeTest = async (locater: ISchemaLocater) => {
              const schemaContext = new SchemaContext();
              schemaContext.addLocater(locater);

              const schema = await schemaContext.getSchema(testSchemaKey) as Schema;
              expect(schema).to.be.not.undefined;
              expect(schema).to.have.property("name", testSchemaKey.name);

              expect(schema).to.have.property("references").to.have.a.lengthOf(testSchemaConfiguration.references.length);
              for (const item of schema.getItems()) {
                expect(item).to.have.property("name");
                expect(item).to.have.property("schemaItemType").to.satisfy((type: string) => SchemaItemType[type as keyof typeof SchemaItemType] !== undefined);
              }

              return schema;
            };

            describe("with items stubs", () => {
              const executeItemsStubsTest = async (locater: ISchemaLocater) => {
                const schema = await executeTest(locater);
                expect(schema).to.be.not.undefined;
                expect(schema).to.have.property("name", testSchemaKey.name);

                const items = [...schema.getItems()];
                expect(items).to.have.a.lengthOf(testSchemaConfiguration.itemCount);

                for (const checkStub of testSchemaConfiguration.checkStubs) {
                  const item = await schema.lookupItem(checkStub.item);
                  expect(item).to.be.not.undefined;
                  const props = item!.schemaItemType === SchemaItemType.KindOfQuantity
                    ? SchemaItem.prototype.toJSON.call(item)
                    : item!.toJSON();
                  for (const [propertyName, propertyValue] of Object.entries(checkStub.properties)) {
                    expect(props).to.have.property(propertyName).deep.equalInAnyOrder(propertyValue);
                  }
                }
              };

              it("load schema (incremental - backend)", async function () {
                await executeItemsStubsTest(new IModelIncrementalSchemaLocater(testIModel.iModel, { loadPartialSchemaOnly: true }));
              });
            });

            describe("with class hierarchy", () => {
              const executeClassHierarchyTest = async (locater: ISchemaLocater) => {
                const schemaContext = new SchemaContext();
                schemaContext.addLocater(locater);

                const schema = await schemaContext.getSchema(testSchemaKey) as Schema;

                expect(schema).to.be.not.undefined;
                expect(schema).to.have.property("name", testSchemaKey.name);

                const derivedClassKey = parseSchemaItemKey(testSchemaConfiguration.checkHierachy.derivedClass);
                const derivedClass = await schemaContext.getSchemaItem(derivedClassKey) as ECClass;
                expect(derivedClass, `${derivedClassKey.fullName} was not found`).to.be.not.undefined;

                const baseClassKey = parseSchemaItemKey(testSchemaConfiguration.checkHierachy.baseClass);
                const baseClass = await schemaContext.getSchemaItem(baseClassKey) as ECClass;
                expect(baseClass, `${baseClassKey.fullName} was not found`).to.be.not.undefined;

                const isDerivedFrom = await derivedClass.is(baseClass);
                expect(isDerivedFrom, `${derivedClass.name} is not derived from ${baseClass.name}`).to.be.true;
              };

              it("check class inheritance (json props - iModel)", async () => {
                await executeClassHierarchyTest(iModelSchemaJsonLocater);
              });

              it("check class inheritance (incremental - backend)", async function () {
                await executeClassHierarchyTest(new IModelIncrementalSchemaLocater(testIModel.iModel, { loadPartialSchemaOnly: true }));
              });
            });

            describe("full schema stack", () => {
              const executeTestWaitAllLoaded = async (locater: IncrementalSchemaLocater) => {
                const schema = await executeTest(locater);
                expect(schema).to.be.not.undefined;
                expect(schema).to.have.property("name", testSchemaKey.name);

                // Old meta profile fallback queries will not have a controller initialized.
                if (schema.loadingController)
                  await schema.loadingController.wait();

                const items = [...schema.getItems()];
                expect(items).to.have.a.lengthOf(testSchemaConfiguration.itemCount);

                for (const checkItem of testSchemaConfiguration.checkFullLoad) {
                  const item = await schema.lookupItem(checkItem.item);
                  expect(item).to.be.not.undefined;

                  const itemProps = item!.toJSON();
                  for (const [propertyName, propertyValue] of Object.entries(checkItem.properties)) {
                    expect(itemProps).to.have.property(propertyName).deep.equalInAnyOrder(propertyValue);
                  }
                }
              };

              it("load schema (json props - iModel)", async () => {
                await executeTest(iModelSchemaJsonLocater);
              });

              it("load schema (incremental - backend)", async function () {
                await executeTestWaitAllLoaded(new IModelIncrementalSchemaLocater(testIModel.iModel));
              });
            });
          });
        });
      });
    })
  });
});
