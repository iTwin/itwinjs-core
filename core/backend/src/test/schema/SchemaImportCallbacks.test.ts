/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Guid, Id64String } from "@itwin/core-bentley";
import { Code, ElementProps, IModel } from "@itwin/core-common";
import {
  AfterSchemaImportContext,
  IModelJsFs,
  SchemaImportStrategy,
  StandaloneDb,
} from "../../core-backend";
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
          beforeImport: async () => {
            callOrder.push("before");
            return { transformStrategy: SchemaImportStrategy.None };
          },
          afterImport: async () => {
            callOrder.push("after");
          },
        },
      });

      assert.deepEqual(callOrder, ["before", "after"]);
    });
  });

  describe("SchemaImportStrategy.None", () => {
    it("should not create snapshot or cache data with None strategy", async () => {
      await imodel.importSchemaStrings([testSchemaV100()], {
        callbacks: {
          beforeImport: async () => ({ transformStrategy: SchemaImportStrategy.None }),
          afterImport: async (context) => {
            assert.isUndefined(context.snapshot);
            assert.isUndefined(context.cachedData);
          },
        },
      });
    });
  });

  describe("SchemaImportStrategy.InMemory", () => {
    it("should pass cached data from beforeImport to afterImport", async () => {
      interface CachedData {
        elements: ElementProps[];
        timestamp: number;
      }

      const cachedData: CachedData = {
        elements: [
          { id: "0x1", classFullName: "BisCore:DefinitionElement" } as ElementProps,
          { id: "0x2", classFullName: "BisCore:DefinitionElement" } as ElementProps,
        ],
        timestamp: Date.now(),
      };

      let receivedCachedData: CachedData | undefined;

      await imodel.importSchemaStrings([testSchemaV100()], {
        callbacks: {
          beforeImport: async () => ({
            transformStrategy: SchemaImportStrategy.InMemory,
            cachedData,
          }),
          afterImport: async (context: AfterSchemaImportContext<CachedData>) => {
            receivedCachedData = context.cachedData;
            assert.isDefined(context.cachedData);
            assert.equal(context.cachedData!.elements.length, 2);
            assert.equal(context.cachedData!.timestamp, cachedData.timestamp);
            assert.isUndefined(context.snapshot);
          },
        },
      });

      assert.deepEqual(receivedCachedData, cachedData);
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
          beforeImport: async (context) => {
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
              transformStrategy: SchemaImportStrategy.InMemory,
              cachedData: cached,
            };
          },
          afterImport: async (context: AfterSchemaImportContext<CachedElements>) => {
            // Use cached data to update element with new property
            assert.isDefined(context.cachedData?.ids);
            const updatedElementProps = context.iModel.elements.getElementProps<TestUpdatedElementProps>(context.cachedData!.ids[1]);
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

  describe("SchemaImportStrategy.Snapshot", () => {
    it("should provide snapshot in afterImport callback", async () => {
      let snapshotProvided = false;

      await imodel.importSchemaStrings([testSchemaV100()], {
        callbacks: {
          beforeImport: async () => ({ transformStrategy: SchemaImportStrategy.Snapshot }),
          afterImport: async (context) => {
            assert.isDefined(context.snapshot);
            assert.notEqual(context.snapshot, context.iModel);
            assert.isTrue(context.snapshot!.isSnapshot);
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
          beforeImport: async () => ({ transformStrategy: SchemaImportStrategy.Snapshot }),
          afterImport: async (context) => {
            assert.isDefined(context.snapshot);
            // Read original value from snapshot
            const snapshotElementProps = context.snapshot!.elements.getElementProps<TestInitialElementProps>(elementId);
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
          beforeImport: async () => ({ transformStrategy: SchemaImportStrategy.Snapshot }),
          afterImport: async (context) => {
            assert.isDefined(context.snapshot);
            snapshotPath = context.snapshot!.pathName;
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
            beforeImport: async () => ({ transformStrategy: SchemaImportStrategy.None }),
            afterImport: async (context) => {
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
            beforeImport: async () => ({ transformStrategy: SchemaImportStrategy.Snapshot }),
            afterImport: async (context) => {
              snapshotPath = context.snapshot!.pathName;
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
            beforeImport: async () => {
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
  });

  describe("File-based Schema Import", () => {
    it("should work with importSchemas() using file paths", async () => {
      const schemaPath = path.join(KnownTestLocations.outputDir, `TestSchema.01.00.00.ecschema.xml`);
      IModelJsFs.writeFileSync(schemaPath, testSchemaV100());

      let callbackExecuted = false;

      try {
        await imodel.importSchemas([schemaPath], {
          callbacks: {
            beforeImport: async (context) => {
              assert.equal(context.schemaFiles.length, 1);
              assert.equal(context.schemaFiles[0], schemaPath);
              callbackExecuted = true;
              return { transformStrategy: SchemaImportStrategy.None };
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
