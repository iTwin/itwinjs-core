/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as path from "path";
import { Guid, Id64String } from "@itwin/core-bentley";
import { Code, ElementProps, IModel } from "@itwin/core-common";
import { _nativeDb, DataTransformationStrategy, IModelJsFs, PostImportContext, StandaloneDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe.only("Schema Import Callbacks", () => {
  let imodel: StandaloneDb;

  // Test schema with version changes
  const testSchemaV100 = () => `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
      <ECEntityClass typeName="TestElement">
        <BaseClass>bis:DefinitionElement</BaseClass>
        <ECProperty propertyName="StringProp" typeName="string" />
        <ECProperty propertyName="IntProp" typeName="int" />
      </ECEntityClass>
    </ECSchema>`;

  const testSchemaV101 = () => `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema" alias="ts" version="1.0.1" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
      <ECEntityClass typeName="TestElement">
        <BaseClass>bis:DefinitionElement</BaseClass>
        <ECProperty propertyName="StringProp" typeName="string" />
        <ECProperty propertyName="IntProp" typeName="int" />
        <ECProperty propertyName="NewProp" typeName="string" />
      </ECEntityClass>
    </ECSchema>`;

  interface TestInitialElementProps extends ElementProps {
    stringProp: string;
    intProp: number;
  }

  interface TestUpdatedElementProps extends TestInitialElementProps {
    newProp?: string;
  }

  beforeEach(() => {
    const testFileName = IModelTestUtils.prepareOutputFile("SchemaImportCallbacks", `SchemaCallbackTest_${Guid.createValue()}.bim`);
    imodel = StandaloneDb.createEmpty(testFileName, {
      rootSubject: { name: "TestSubject" },
    });
    assert.exists(imodel);
  });

  afterEach(() => {
    if (imodel?.isOpen)
      imodel.close();
  });

  describe("Basic Callback Execution", () => {
    it("should work without callbacks (backward compatibility)", async () => {
      // This should not throw and should work as before
      await imodel.importSchemaStrings([testSchemaV100()]);
      assert.isTrue(imodel.containsClass(`TestSchema:TestElement`));
    });

    it("should call both callbacks in correct order", async () => {
      const callOrder: string[] = [];

      await imodel.importSchemaStrings([testSchemaV100()], {
        callbacks: {
          preSchemaImportCallback: async () => {
            callOrder.push("before");
            return { transformStrategy: DataTransformationStrategy.None };
          },
          postSchemaImportCallback: async () => {
            callOrder.push("after");
          },
        },
      });

      assert.deepEqual(callOrder, ["before", "after"]);
    });
  });

  describe("DataTransformationStrategy.None", () => {
    it("should not create snapshot or cache data with None strategy", async () => {
      await imodel.importSchemaStrings([testSchemaV100()], {
        callbacks: {
          preSchemaImportCallback: async () => ({ transformStrategy: DataTransformationStrategy.None }),
          postSchemaImportCallback: async (context) => {
            assert.isUndefined(context.resources.snapshot);
            assert.isUndefined(context.resources.cachedData);
          },
        },
      });
    });
  });

  describe("DataTransformationStrategy.InMemory", () => {
    it("should pass cached data from beforeImport to afterImport", async () => {
      interface CachedData {
        elements: ElementProps[];
        timestamp: number;
      }

      let receivedCachedData: CachedData | undefined;
      const expectedCachedData: CachedData = {
        elements: [
          { id: "0x1", classFullName: "BisCore:DefinitionElement" } as ElementProps,
          { id: "0x2", classFullName: "BisCore:DefinitionElement" } as ElementProps,
        ],
        timestamp: Date.now(),
      };

      await imodel.importSchemaStrings([testSchemaV100()], {
        callbacks: {
          preSchemaImportCallback: async () => ({
            transformStrategy: DataTransformationStrategy.InMemory,
            cachedData: {
              elements: [
                { id: "0x1", classFullName: "BisCore:DefinitionElement" } as ElementProps,
                { id: "0x2", classFullName: "BisCore:DefinitionElement" } as ElementProps,
              ],
              timestamp: Date.now(),
            },
          }),
          postSchemaImportCallback: async (context: PostImportContext) => {
            receivedCachedData = context.resources.cachedData as CachedData;
            assert.isDefined(context.resources.cachedData);
            assert.equal(context.resources.cachedData!.elements.length, 2);
            assert.deepEqual(receivedCachedData.elements, expectedCachedData.elements);
            assert.equal(receivedCachedData.timestamp, expectedCachedData.timestamp);
            assert.isUndefined(context.resources.snapshot);
          },
        },
      });
    });

    it("should cache element properties and use them after import", async () => {
      // First import the schema
      await imodel.importSchemaStrings([testSchemaV100()]);

      // Create a test element
      const model = imodel.models.getModel(IModel.dictionaryId);
      const elementProps: TestInitialElementProps = {
        classFullName: `TestSchema:TestElement`,
        model: model.id,
        code: Code.createEmpty(),
        stringProp: "original value of first element",
        intProp: 42,
      };

      const elementId1 = imodel.elements.insertElement(elementProps);

      // Now import updated schema and transform the element
      interface CachedElements {
        ids: Id64String[];
      }

      const elementIds: Id64String[] = [elementId1];

      await imodel.importSchemaStrings([testSchemaV101()], {
        callbacks: {
          preSchemaImportCallback: async (context) => {
            // Create another element before the schema import
            assert.equal(elementIds.length, 1);
            const element = context.iModel.elements.getElementProps<TestInitialElementProps>(elementIds[0]);
            assert.isDefined(element.stringProp);
            assert.isDefined(element.intProp);

            elementProps.stringProp = "original value of second element";
            elementProps.intProp = 84;
            elementIds.push(imodel.elements.insertElement(elementProps));

            const cached: CachedElements = { ids: elementIds };

            return {
              transformStrategy: DataTransformationStrategy.InMemory,
              cachedData: cached,
            };
          },
          postSchemaImportCallback: async (context: PostImportContext) => {
            // Use cached data to update element with new property
            assert.isDefined(context.resources.cachedData?.ids);
            const updatedElementProps = context.iModel.elements.getElementProps<TestUpdatedElementProps>(context.resources.cachedData!.ids[1]);
            assert.isDefined(updatedElementProps.stringProp);
            assert.isDefined(updatedElementProps.intProp);
            assert.isUndefined(updatedElementProps.newProp);
            updatedElementProps.stringProp = "modified in afterImport";
            updatedElementProps.newProp = `New Prop Added`;
            context.iModel.elements.updateElement<TestUpdatedElementProps>(updatedElementProps);
          },
        },
      });

      // Verify the transformation
      let finalElementProps = imodel.elements.getElementProps<TestUpdatedElementProps>(elementIds[0]);
      assert.equal(finalElementProps.stringProp, "original value of first element");
      assert.isUndefined(finalElementProps.newProp);

      finalElementProps = imodel.elements.getElementProps<TestUpdatedElementProps>(elementIds[1]);
      assert.equal(finalElementProps.stringProp, "modified in afterImport");
      assert.isDefined(finalElementProps.newProp);
      assert.equal(finalElementProps.newProp, "New Prop Added");
    });
  });

  describe("DataTransformationStrategy.Snapshot", () => {
    it("should provide snapshot in afterImport callback", async () => {
      let snapshotProvided = false;

      await imodel.importSchemaStrings([testSchemaV100()], {
        callbacks: {
          preSchemaImportCallback: async () => ({ transformStrategy: DataTransformationStrategy.Snapshot }),
          postSchemaImportCallback: async (context) => {
            assert.isDefined(context.resources.snapshot);
            assert.notEqual(context.resources.snapshot, context.iModel);
            assert.isTrue(context.resources.snapshot!.isSnapshot);
            snapshotProvided = true;
          },
        },
      });

      assert.isTrue(snapshotProvided);
    });

    it("should allow reading pre-import state from snapshot", async () => {
      // First import initial schema
      await imodel.importSchemaStrings([testSchemaV100()]);

      // Create element with original schema
      const model = imodel.models.getModel(IModel.dictionaryId);
      const elementProps: TestInitialElementProps = {
        classFullName: `TestSchema:TestElement`,
        model: model.id,
        code: Code.createEmpty(),
        stringProp: "snapshot test",
        intProp: 123,
      };

      const elementId = imodel.elements.insertElement(elementProps);
      imodel.saveChanges("Insert element before schema upgrade");

      // Import updated schema with snapshot strategy
      let originalStringValue: string | undefined;

      await imodel.importSchemaStrings([testSchemaV101()], {
        callbacks: {
          preSchemaImportCallback: async () => ({ transformStrategy: DataTransformationStrategy.Snapshot }),
          postSchemaImportCallback: async (context) => {
            assert.isDefined(context.resources.snapshot);
            assert.equal(context.resources.snapshot?.getSchemaProps("TestSchema").version, "01.00.00");
            assert.equal(imodel.getSchemaProps("TestSchema").version, "01.00.01");

            // Read original value from snapshot
            const snapshotElementProps = context.resources.snapshot!.elements.getElementProps<TestInitialElementProps>(elementId);
            originalStringValue = snapshotElementProps.stringProp;

            // Update element in main iModel with new property based on snapshot data
            const updatedElementProps = context.iModel.elements.getElementProps<TestUpdatedElementProps>(elementId);
            updatedElementProps.newProp = `Original was: ${originalStringValue}`;
            context.iModel.elements.updateElement(updatedElementProps);
          },
        },
      });

      assert.equal(originalStringValue, "snapshot test");
      const finalElement = imodel.elements.getElement(elementId);
      assert.equal((finalElement as any).newProp, "Original was: snapshot test");
    });

    it("should clean up snapshot after successful import", async () => {
      let snapshotPath: string | undefined;

      await imodel.importSchemaStrings([testSchemaV100()], {
        callbacks: {
          preSchemaImportCallback: async () => ({ transformStrategy: DataTransformationStrategy.Snapshot }),
          postSchemaImportCallback: async (context) => {
            assert.isDefined(context.resources.snapshot);
            snapshotPath = context.resources.snapshot!.pathName;
            assert.isTrue(IModelJsFs.existsSync(snapshotPath));
          },
        },
      });

      if (snapshotPath) {
        assert.isFalse(IModelJsFs.existsSync(snapshotPath), "Snapshot file should be cleaned up");
      }
    });
  });

  describe("Error Handling", () => {
    it("In memory strategy used without caching any data pre import", async () => {
      try {
        await imodel.importSchemaStrings([testSchemaV100()], {
          callbacks: {
            preSchemaImportCallback: async () => ({ transformStrategy: DataTransformationStrategy.InMemory }),
            postSchemaImportCallback: async (context) => {
              assert.isUndefined(context.resources.snapshot);
            },
          },
        })
        assert.fail("Should have thrown error");
      } catch (err: any) {
        expect(err.message).to.equal("InMemory transform strategy requires data to be cached before the schema import");
      }
    });

    it("should abandon changes if afterImport callback throws", async () => {
      // First import initial schema
      await imodel.importSchemaStrings([testSchemaV100()]);

      // Create element
      const model = imodel.models.getModel(IModel.dictionaryId);
      const elementProps: TestInitialElementProps = {
        classFullName: `TestSchema:TestElement`,
        model: model.id,
        code: Code.createEmpty(),
        stringProp: "test",
        intProp: 1,
      };

      const elementId = imodel.elements.insertElement(elementProps);
      imodel.saveChanges("Insert test element");

      // Try to import with failing callback
      try {
        await imodel.importSchemaStrings([testSchemaV101()], {
          callbacks: {
            preSchemaImportCallback: async () => ({ transformStrategy: DataTransformationStrategy.None }),
            postSchemaImportCallback: async (context) => {
              // Make a change
              const updatedElementProps = context.iModel.elements.getElementProps<TestUpdatedElementProps>(elementId);
              updatedElementProps.intProp += 1;
              updatedElementProps.stringProp = "should be reverted";
              updatedElementProps.newProp = "should be reverted";
              context.iModel.elements.updateElement(updatedElementProps);

              // Then throw error
              throw new Error("Intentional callback failure");
            },
          },
        });
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.equal(err.message, "Intentional callback failure");
      }

      // Changes should be abandoned - element should not have newProp
      const finalElementProps = imodel.elements.getElementProps<TestUpdatedElementProps>(elementId);
      assert.equal(finalElementProps.intProp, 1);
      assert.equal(finalElementProps.stringProp, "test");
      assert.isUndefined(finalElementProps.newProp);
    });

    it("should clean up snapshot when afterImport throws error", async () => {
      let snapshotPath: string | undefined;

      try {
        await imodel.importSchemaStrings([testSchemaV100()], {
          callbacks: {
            preSchemaImportCallback: async () => ({ transformStrategy: DataTransformationStrategy.Snapshot }),
            postSchemaImportCallback: async (context) => {
              snapshotPath = context.resources.snapshot!.pathName;
              throw new Error("Error after snapshot created");
            },
          },
        });
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.equal(err.message, "Error after snapshot created");
      }

      if (snapshotPath) {
        assert.isFalse(IModelJsFs.existsSync(snapshotPath), "Snapshot should be cleaned up even after error");
      }
    });

    it("should handle error in beforeImport callback", async () => {
      try {
        await imodel.importSchemaStrings([testSchemaV100()], {
          callbacks: {
            preSchemaImportCallback: async () => {
              throw new Error("Error in beforeImport");
            },
          },
        });
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.equal(err.message, "Error in beforeImport");
      }

      // Schema should not have been imported
      assert.isFalse(imodel.containsClass(`TestSchema:TestElement`));
    });

    it("Unsaved changes/txns when calling import schema", async () => {
      // First import the schema
      await imodel.importSchemaStrings([testSchemaV100()]);

      // Create a test element
      const model = imodel.models.getModel(IModel.dictionaryId);

      const elementId = imodel.elements.insertElement({
        classFullName: `TestSchema:TestElement`,
        model: model.id,
        code: Code.createEmpty(),
        stringProp: "original value of first element",
        intProp: 42,
      } as TestInitialElementProps);
      imodel.saveChanges();

      const elementProps = imodel.elements.getElementProps<TestInitialElementProps>(elementId);
      elementProps.stringProp = "modified value";
      elementProps.intProp = 100;
      imodel.elements.updateElement(elementProps);

      assert.isTrue(imodel[_nativeDb].hasUnsavedChanges());

      // Try to import with failing callback
      try {
        await imodel.importSchemaStrings([testSchemaV101()], {
          callbacks: {
            preSchemaImportCallback: async () => ({ transformStrategy: DataTransformationStrategy.None }),
            postSchemaImportCallback: async (context) => {
              // Make a change
              const updatedElementProps = context.iModel.elements.getElementProps<TestUpdatedElementProps>(elementId);
              updatedElementProps.intProp += 1;
              updatedElementProps.stringProp = "should be reverted";
              updatedElementProps.newProp = "should be reverted";
              context.iModel.elements.updateElement(updatedElementProps);

              // Then throw error
              throw new Error("Intentional callback failure");
            },
          },
        });
        assert.fail("Should have thrown error");
      } catch (err: any) {
        assert.equal(err.message, "Intentional callback failure");
      }

      // Changes should be abandoned - element should not have newProp
      const finalElementProps = imodel.elements.getElementProps<TestUpdatedElementProps>(elementId);
      assert.equal(finalElementProps.intProp, 1);
      assert.equal(finalElementProps.stringProp, "test");
      assert.isUndefined(finalElementProps.newProp);
    });
  });

  describe("File-based Schema Import", () => {
    it("should work with importSchemas() using file paths", async () => {
      const schemaPath = path.join(KnownTestLocations.outputDir, `TestSchema.01.00.00.ecschema.xml`);
      IModelJsFs.writeFileSync(schemaPath, testSchemaV100());

      let callbackExecuted = false;

      try {
        await imodel.importSchemas([schemaPath], {
          callbacks: {
            preSchemaImportCallback: async (context) => {
              assert.isDefined(context.schemaFileNames);
              assert.equal(context.schemaFileNames?.length, 1);
              assert.equal(context.schemaFileNames?.[0], schemaPath);
              callbackExecuted = true;
              return { transformStrategy: DataTransformationStrategy.None };
            },
          },
        });

        assert.isTrue(callbackExecuted);
        assert.isTrue(imodel.containsClass(`TestSchema:TestElement`));
      } finally {
        if (IModelJsFs.existsSync(schemaPath)) {
          IModelJsFs.removeSync(schemaPath);
        }
      }
    });
  });
});
