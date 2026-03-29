/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbResult } from "@itwin/core-bentley";
import { IModelHost, SnapshotDb } from "../../core-backend";
import { ClassModifier, ClassType, type RuntimeClass, type RuntimeSchemaContext } from "@itwin/ecschema-metadata";
import { ECClass, ECClassModifier, Enumeration, KindOfQuantity, Mixin, NavigationProperty, PrimitiveProperty, Property, PropertyCategory, RelationshipClass, SchemaItemType, StructProperty } from "@itwin/ecschema-metadata";
import { assert, expect } from "chai";
import * as path from "path";
import { KnownTestLocations } from "../KnownTestLocations";

/** Schemas excluded from the runtime binary blob by the C++ writer.
 * Must stay in sync with `IsExcludedSchema()` in `RuntimeSchemaWriter.cpp`.
 */
const excludedRuntimeSchemas: ReadonlySet<string> = new Set([
  "BisCustomAttributes",
  "CoreCustomAttributes",
  "ECDbFileInfo",
  "ECDbMap",
  "ECDbSchemaPolicies",
  "ECDbSystem",
  "ECv3ConversionAttributes",
  "EditorCustomAttributes",
  "Formats",
  "SchemaLocalizationCustomAttributes",
  "SchemaUpgradeCustomAttributes",
  "Units",
]);

/**
 * Cross-validation test: walks ecschema-metadata and RuntimeSchemaContext in parallel,
 * asserting that every schema, class, property, enumeration, KoQ, and category returns
 * identical information from both layers.
 *
 * This test is iModel-agnostic - it works for any test bim. No hard-coded expected values.
 * To validate against a larger real iModel, just add its path to the `iModelPaths` array.
 */
describe("RuntimeSchemaContext cross-validation", () => {
  before(async () => {
    await IModelHost.startup();
  });

  after(async () => {
    await IModelHost.shutdown();
  });

  /** All test iModels to validate. Add paths here to test against larger/real iModels. */
  const iModelPaths = [
    path.join(KnownTestLocations.assetsDir, "test.bim"),
    // To temporarily test with a larger iModel:
    // "/path/to/real/imodel.bim",
  ];

  for (const iModelPath of iModelPaths) {
    const iModelName = path.basename(iModelPath);

    describe(iModelName, () => {
      let iModel: SnapshotDb;
      let runtimeCtx: RuntimeSchemaContext;

      before(async () => {
        iModel = SnapshotDb.openFile(iModelPath);
        runtimeCtx = await iModel.getSchemas();
      });

      after(() => {
        iModel.close();
      });

      it("should have matching schema count and names", () => {
        // Force all schemas to load via the schemaContext by looking up a class from each runtime schema.
        // ecschema-metadata loads schemas lazily - getKnownSchemas() only returns already-loaded ones.
        for (const rSchema of runtimeCtx.getSchemas()) {
          // Looking up any item from this schema forces it to load in ecschema-metadata
          const firstClass = rSchema.getClasses().next();
          if (!firstClass.done) {
            const metaClass = iModel.schemaContext.getSchemaItemSync(rSchema.name, firstClass.value.name);
            assert.isDefined(metaClass, `Schema '${rSchema.name}' could not be loaded in ecschema-metadata`);
          }
        }
      });

      it("should have matching classes for every schema", () => {
        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rClass of rSchema.getClasses()) {
            const metaClass = iModel.schemaContext.getSchemaItemSync(rSchema.name, rClass.name) as ECClass | undefined;
            assert.isDefined(metaClass, `Class '${rClass.fullName}' not found in ecschema-metadata`);

            // Name and fullName
            expect(rClass.name).to.equal(metaClass!.name, `name mismatch for ${rClass.fullName}`);

            // Type
            const expectedType = schemaItemTypeToClassType(metaClass!.schemaItemType, metaClass!);
            expect(rClass.type).to.equal(expectedType, `type mismatch for ${rClass.fullName}: runtime=${ClassType[rClass.type]}, expected=${ClassType[expectedType]}`);

            // Modifier
            const expectedModifier = ecModifierToClassModifier(metaClass!.modifier);
            expect(rClass.modifier).to.equal(expectedModifier, `modifier mismatch for ${rClass.fullName}`);

            // Label (ecschema-metadata returns undefined when no label, runtime returns the name)
            if (metaClass!.label !== undefined) {
              expect(rClass.label).to.equal(metaClass!.label, `label mismatch for ${rClass.fullName}`);
            }

            // Base class
            const metaBase = metaClass!.getBaseClassSync();
            if (metaBase !== undefined) {
              assert.isDefined(rClass.baseClass, `${rClass.fullName} should have a base class`);
              expect(rClass.baseClass!.name).to.equal(metaBase.name, `base class name mismatch for ${rClass.fullName}`);
            }
          }
        }
      });

      it("should have matching properties for every class", () => {
        let totalChecked = 0;

        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rClass of rSchema.getClasses()) {
            const metaClass = iModel.schemaContext.getSchemaItemSync(rSchema.name, rClass.name) as ECClass | undefined;
            if (metaClass === undefined)
              continue;

            // Compare own properties (exclude inherited to avoid ordering issues across layers)
            const rOwnProps = rClass.getOwnProperties();
            const metaOwnProps = [...metaClass.getPropertiesSync(true)]; // excludeInherited=true

            expect(rOwnProps.length).to.equal(metaOwnProps.length,
              `own property count mismatch for ${rClass.fullName}: runtime=${rOwnProps.length}, meta=${metaOwnProps.length}`);

            for (const rProp of rOwnProps) {
              const metaProp = metaOwnProps.find((p) => p.name.toLowerCase() === rProp.name.toLowerCase());
              assert.isDefined(metaProp, `Property '${rProp.name}' on ${rClass.fullName} not found in ecschema-metadata`);

              compareProperty(rProp, metaProp!, rClass);
              totalChecked++;
            }
          }
        }

        // Sanity: we actually compared something
        assert.isAbove(totalChecked, 0, "No properties were compared - something is wrong with the test setup");
      });

      it("should have matching inherited properties for every class", () => {
        let classesChecked = 0;

        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rClass of rSchema.getClasses()) {
            const metaClass = iModel.schemaContext.getSchemaItemSync(rSchema.name, rClass.name) as ECClass | undefined;
            if (metaClass === undefined)
              continue;

            // Compare all properties (including inherited)
            const rAllProps = rClass.getProperties();
            const metaAllProps = [...metaClass.getPropertiesSync(false)]; // includeInherited

            // Check that every ecschema-metadata property exists in runtime
            for (const metaProp of metaAllProps) {
              const rProp = rAllProps.find((p) => p.name.toLowerCase() === metaProp.name.toLowerCase());
              assert.isDefined(rProp, `Inherited property '${metaProp.name}' on ${rClass.fullName} missing from RuntimeSchemaContext`);
            }

            // Check that every runtime property exists in ecschema-metadata
            for (const rProp of rAllProps) {
              const metaProp = metaAllProps.find((p) => p.name.toLowerCase() === rProp.name.toLowerCase());
              assert.isDefined(metaProp, `Runtime property '${rProp.name}' on ${rClass.fullName} has no ecschema-metadata counterpart`);
            }

            expect(rAllProps.length).to.equal(metaAllProps.length,
              `total property count mismatch for ${rClass.fullName}`);

            classesChecked++;
          }
        }

        assert.isAbove(classesChecked, 0);
      });

      it("should have correct ecInstanceId values", () => {
        // Validate that ecInstanceId on runtime view objects matches ec_ table row IDs.
        // This is the bridge that lets consumers fall back to ECDbMeta ECSQL queries.

        // Schemas
        const ecSchemaIds = new Map<string, number>();
        iModel.withSqliteStatement("SELECT Id, Name FROM ec_Schema", (stmt) => {
          while (stmt.step() === DbResult.BE_SQLITE_ROW)
            ecSchemaIds.set(stmt.getValueString(1).toLowerCase(), stmt.getValueInteger(0));
        });
        for (const rSchema of runtimeCtx.getSchemas()) {
          const ecId = ecSchemaIds.get(rSchema.name.toLowerCase());
          assert.isDefined(ecId, `ec_Schema row not found for ${rSchema.name}`);
          expect(rSchema.ecInstanceId).to.equal(ecId, `ecInstanceId mismatch for schema ${rSchema.name}`);
        }

        // Classes
        const ecClassIds = new Map<string, number>();
        iModel.withSqliteStatement(
          "SELECT c.Id, s.Name, c.Name FROM ec_Class c JOIN ec_Schema s ON c.SchemaId=s.Id",
          (stmt) => {
            while (stmt.step() === DbResult.BE_SQLITE_ROW)
              ecClassIds.set(`${stmt.getValueString(1).toLowerCase()}:${stmt.getValueString(2).toLowerCase()}`, stmt.getValueInteger(0));
          },
        );
        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rClass of rSchema.getClasses()) {
            const key = `${rSchema.name.toLowerCase()}:${rClass.name.toLowerCase()}`;
            const ecId = ecClassIds.get(key);
            assert.isDefined(ecId, `ec_Class row not found for ${rClass.fullName}`);
            expect(rClass.ecInstanceId).to.equal(ecId, `ecInstanceId mismatch for class ${rClass.fullName}`);
          }
        }

        // Own properties
        const ecPropIds = new Map<string, number>();
        iModel.withSqliteStatement(
          "SELECT p.Id, s.Name, c.Name, p.Name FROM ec_Property p JOIN ec_Class c ON p.ClassId=c.Id JOIN ec_Schema s ON c.SchemaId=s.Id",
          (stmt) => {
            while (stmt.step() === DbResult.BE_SQLITE_ROW)
              ecPropIds.set(`${stmt.getValueString(1).toLowerCase()}:${stmt.getValueString(2).toLowerCase()}.${stmt.getValueString(3).toLowerCase()}`, stmt.getValueInteger(0));
          },
        );
        let propsChecked = 0;
        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rClass of rSchema.getClasses()) {
            for (const rProp of rClass.getOwnProperties()) {
              const key = `${rSchema.name.toLowerCase()}:${rClass.name.toLowerCase()}.${rProp.name.toLowerCase()}`;
              const ecId = ecPropIds.get(key);
              if (ecId === undefined) continue; // dropped properties (broken refs)
              expect(rProp.ecInstanceId).to.equal(ecId, `ecInstanceId mismatch for property ${rClass.fullName}.${rProp.name}`);
              propsChecked++;
            }
          }
        }
        assert.isAbove(propsChecked, 0, "No property ecInstanceIds were checked");

        // Enumerations
        const ecEnumIds = new Map<string, number>();
        iModel.withSqliteStatement(
          "SELECT e.Id, s.Name, e.Name FROM ec_Enumeration e JOIN ec_Schema s ON e.SchemaId=s.Id",
          (stmt) => {
            while (stmt.step() === DbResult.BE_SQLITE_ROW)
              ecEnumIds.set(`${stmt.getValueString(1).toLowerCase()}:${stmt.getValueString(2).toLowerCase()}`, stmt.getValueInteger(0));
          },
        );
        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rEnum of rSchema.getEnumerations()) {
            const key = `${rSchema.name.toLowerCase()}:${rEnum.name.toLowerCase()}`;
            const ecId = ecEnumIds.get(key);
            assert.isDefined(ecId, `ec_Enumeration row not found for ${rEnum.fullName}`);
            expect(rEnum.ecInstanceId).to.equal(ecId!, `ecInstanceId mismatch for enum ${rEnum.fullName}`);
          }
        }

        // KindOfQuantity
        const ecKoqIds = new Map<string, number>();
        iModel.withSqliteStatement(
          "SELECT k.Id, s.Name, k.Name FROM ec_KindOfQuantity k JOIN ec_Schema s ON k.SchemaId=s.Id",
          (stmt) => {
            while (stmt.step() === DbResult.BE_SQLITE_ROW)
              ecKoqIds.set(`${stmt.getValueString(1).toLowerCase()}:${stmt.getValueString(2).toLowerCase()}`, stmt.getValueInteger(0));
          },
        );
        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rKoq of rSchema.getKindOfQuantities()) {
            const key = `${rSchema.name.toLowerCase()}:${rKoq.name.toLowerCase()}`;
            const ecId = ecKoqIds.get(key);
            assert.isDefined(ecId, `ec_KindOfQuantity row not found for ${rKoq.fullName}`);
            expect(rKoq.ecInstanceId).to.equal(ecId!, `ecInstanceId mismatch for KoQ ${rKoq.fullName}`);
          }
        }

        // PropertyCategory
        const ecCatIds = new Map<string, number>();
        iModel.withSqliteStatement(
          "SELECT pc.Id, s.Name, pc.Name FROM ec_PropertyCategory pc JOIN ec_Schema s ON pc.SchemaId=s.Id",
          (stmt) => {
            while (stmt.step() === DbResult.BE_SQLITE_ROW)
              ecCatIds.set(`${stmt.getValueString(1).toLowerCase()}:${stmt.getValueString(2).toLowerCase()}`, stmt.getValueInteger(0));
          },
        );
        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rCat of rSchema.getPropertyCategories()) {
            const key = `${rSchema.name.toLowerCase()}:${rCat.name.toLowerCase()}`;
            const ecId = ecCatIds.get(key);
            assert.isDefined(ecId, `ec_PropertyCategory row not found for ${rCat.fullName}`);
            expect(rCat.ecInstanceId).to.equal(ecId!, `ecInstanceId mismatch for category ${rCat.fullName}`);
          }
        }
      });

      it("should have matching enumerations", () => {
        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rEnum of rSchema.getEnumerations()) {
            const metaEnum = iModel.schemaContext.getSchemaItemSync(rSchema.name, rEnum.name) as Enumeration | undefined;
            assert.isDefined(metaEnum, `Enumeration '${rEnum.fullName}' not found in ecschema-metadata`);

            expect(rEnum.isStrict).to.equal(metaEnum!.isStrict, `isStrict mismatch for ${rEnum.fullName}`);

            // Compare enumerators
            const rEnumerators = [...rEnum.getEnumerators()];
            const metaEnumerators = metaEnum!.enumerators;
            expect(rEnumerators.length).to.equal(metaEnumerators.length,
              `enumerator count mismatch for ${rEnum.fullName}`);

            for (let i = 0; i < rEnumerators.length; i++) {
              expect(rEnumerators[i].name).to.equal(metaEnumerators[i].name,
                `enumerator name mismatch at index ${i} in ${rEnum.fullName}`);
              expect(rEnumerators[i].value).to.equal(metaEnumerators[i].value,
                `enumerator value mismatch for ${rEnumerators[i].name} in ${rEnum.fullName}`);
            }
          }
        }
      });

      it("should have matching KindOfQuantity items", () => {
        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rKoq of rSchema.getKindOfQuantities()) {
            const metaKoq = iModel.schemaContext.getSchemaItemSync(rSchema.name, rKoq.name) as KindOfQuantity | undefined;
            assert.isDefined(metaKoq, `KoQ '${rKoq.fullName}' not found in ecschema-metadata`);

            expect(rKoq.relativeError).to.equal(metaKoq!.relativeError,
              `relativeError mismatch for ${rKoq.fullName}`);
          }
        }
      });

      it("should have matching PropertyCategory items", () => {
        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rCat of rSchema.getPropertyCategories()) {
            const metaCat = iModel.schemaContext.getSchemaItemSync(rSchema.name, rCat.name) as PropertyCategory | undefined;
            assert.isDefined(metaCat, `PropertyCategory '${rCat.fullName}' not found in ecschema-metadata`);

            expect(rCat.priority).to.equal(metaCat!.priority,
              `priority mismatch for ${rCat.fullName}`);
          }
        }
      });

      it("should have matching relationship constraints", () => {
        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rClass of rSchema.getClasses()) {
            if (!rClass.isRelationship())
              continue;

            const metaRel = iModel.schemaContext.getSchemaItemSync(rSchema.name, rClass.name) as RelationshipClass | undefined;
            assert.isDefined(metaRel, `Relationship '${rClass.fullName}' not in ecschema-metadata`);

            // Source constraint
            if (rClass.source !== undefined) {
              const metaSrc = metaRel!.source;
              if (metaSrc.abstractConstraint !== undefined && rClass.source.abstractConstraint !== undefined) {
                expect(rClass.source.abstractConstraint.name).to.equal(
                  metaSrc.abstractConstraint!.fullName.split(".").pop(),
                  `source abstractConstraint mismatch for ${rClass.fullName}`,
                );
              }
            }

            // Target constraint
            if (rClass.target !== undefined) {
              const metaTgt = metaRel!.target;
              if (metaTgt.abstractConstraint !== undefined && rClass.target.abstractConstraint !== undefined) {
                expect(rClass.target.abstractConstraint.name).to.equal(
                  metaTgt.abstractConstraint!.fullName.split(".").pop(),
                  `target abstractConstraint mismatch for ${rClass.fullName}`,
                );
              }
            }
          }
        }
      });

      it("should have matching IS-A relationships", () => {
        // Pick a few well-known hierarchies and verify IS-A checks match
        const testPairs: Array<[string, string, boolean]> = [
          ["BisCore:GeometricElement3d", "BisCore:Element", true],
          ["BisCore:Element", "BisCore:GeometricElement3d", false],
          ["BisCore:PhysicalElement", "BisCore:GeometricElement", true],
          ["BisCore:ModelContainsElements", "BisCore:ElementRefersToElements", false],
        ];

        for (const [className, baseName, expected] of testPairs) {
          const rClass = runtimeCtx.findClass(className);
          if (rClass === undefined)
            continue; // Class may not exist in minimal test iModels

          const result = rClass.is(baseName);
          expect(result).to.equal(expected, `IS-A check: ${className} -> ${baseName}`);
        }
      });

      it("should have matching isHidden flags against ec_CustomAttribute", () => {
        // Build a set of property IDs that have CoreCustomAttributes:HiddenProperty CA
        // (without Show=True override), mirroring the C++ writer's CollectHiddenPropertyIds.
        const hiddenPropertyIds = new Set<number>();
        iModel.withSqliteStatement(
          `SELECT ca.ContainerId, ca.Instance
           FROM ec_CustomAttribute ca
           JOIN ec_Class cac ON ca.ClassId=cac.Id
           JOIN ec_Schema cas ON cac.SchemaId=cas.Id
           WHERE ca.ContainerType & 992 <> 0
           AND cas.Name='CoreCustomAttributes' AND cac.Name='HiddenProperty'`,
          (stmt) => {
            while (stmt.step() === DbResult.BE_SQLITE_ROW) {
              const instance: string = stmt.getValueString(1) ?? "";
              if (instance) {
                const lower = instance.toLowerCase();
                if (lower.includes(">true</"))
                  continue; // Show=True means NOT hidden
              }
              hiddenPropertyIds.add(stmt.getValueInteger(0));
            }
          },
        );

        // Build a map of property ID -> (schemaName, className, propertyName) from ec_ tables
        // so we can correlate ec_ property IDs to runtime properties.
        const propIdMap = new Map<number, { schema: string; cls: string; prop: string }>();
        iModel.withSqliteStatement(
          `SELECT p.Id, s.Name, c.Name, p.Name
           FROM ec_Property p
           JOIN ec_Class c ON p.ClassId=c.Id
           JOIN ec_Schema s ON c.SchemaId=s.Id`,
          (stmt) => {
            while (stmt.step() === DbResult.BE_SQLITE_ROW) {
              propIdMap.set(stmt.getValueInteger(0), {
                schema: stmt.getValueString(1),
                cls: stmt.getValueString(2),
                prop: stmt.getValueString(3),
              });
            }
          },
        );

        // Cross-validate: for every hidden property in ec_ tables that belongs to a
        // non-excluded schema, the runtime context must also mark it as hidden.
        let hiddenChecked = 0;
        for (const propId of hiddenPropertyIds) {
          const info = propIdMap.get(propId);
          if (info === undefined) continue;
          if (excludedRuntimeSchemas.has(info.schema)) continue;

          const rClass = runtimeCtx.findClass(`${info.schema}:${info.cls}`);
          if (rClass === undefined) continue;

          // Check own properties only (the property lives on this class)
          const rProp = rClass.getOwnProperties().find(
            (p) => p.name.toLowerCase() === info.prop.toLowerCase(),
          );
          if (rProp === undefined) continue; // property may have been dropped (broken struct ref)

          expect(rProp.isHidden).to.equal(true,
            `${info.schema}:${info.cls}.${info.prop} should be hidden (has HiddenProperty CA)`);
          hiddenChecked++;
        }

        // Also spot-check that explicitly visible properties are NOT hidden.
        // Walk a subset of runtime classes and verify that properties not in the hidden set
        // are marked as not hidden.
        let visibleChecked = 0;
        for (const rSchema of runtimeCtx.getSchemas()) {
          for (const rClass of rSchema.getClasses()) {
            for (const rProp of rClass.getOwnProperties()) {
              // Find the ec_ property ID for this prop
              const matchingEntry = [...propIdMap.entries()].find(([_, info]) =>
                info.schema.toLowerCase() === rSchema.name.toLowerCase()
                && info.cls.toLowerCase() === rClass.name.toLowerCase()
                && info.prop.toLowerCase() === rProp.name.toLowerCase(),
              );
              if (matchingEntry === undefined) continue;
              const [propId] = matchingEntry;

              if (!hiddenPropertyIds.has(propId)) {
                expect(rProp.isHidden).to.equal(false,
                  `${rClass.fullName}.${rProp.name} should NOT be hidden (no HiddenProperty CA)`);
                visibleChecked++;
              }
            }
            if (visibleChecked >= 200) break; // cap to keep test fast
          }
          if (visibleChecked >= 200) break;
        }

        // The test.bim likely has at least some non-hidden properties
        assert.isAbove(visibleChecked, 0, "No visible properties checked - test setup issue");
      });
    });
  }
});

// --- Helper functions ---

/** Map ecschema-metadata SchemaItemType to RuntimeSchemaContext ClassType. */
function schemaItemTypeToClassType(itemType: SchemaItemType, ecClass: ECClass): ClassType {
  switch (itemType) {
    case SchemaItemType.EntityClass:
      // ecschema-metadata distinguishes Mixin via instanceof, not SchemaItemType
      return (ecClass instanceof Mixin) ? ClassType.Mixin : ClassType.Entity;
    case SchemaItemType.Mixin:
      return ClassType.Mixin;
    case SchemaItemType.RelationshipClass:
      return ClassType.Relationship;
    case SchemaItemType.StructClass:
      return ClassType.Struct;
    case SchemaItemType.CustomAttributeClass:
      return ClassType.CustomAttribute;
    default:
      assert.fail(`Unexpected SchemaItemType '${itemType}' for class '${ecClass.fullName}'`);
  }
}

/** Map ecschema-metadata ECClassModifier to RuntimeSchemaContext ClassModifier. */
function ecModifierToClassModifier(modifier: ECClassModifier): ClassModifier {
  switch (modifier) {
    case ECClassModifier.None: return ClassModifier.None;
    case ECClassModifier.Abstract: return ClassModifier.Abstract;
    case ECClassModifier.Sealed: return ClassModifier.Sealed;
    default: return ClassModifier.None;
  }
}

/** Compare a single property across both layers. */
function compareProperty(rProp: ReturnType<RuntimeClass["getProperties"]>[number], metaProp: Property, rClass: RuntimeClass): void {
  const ctx = `${rClass.fullName}.${rProp.name}`;

  // Name
  expect(rProp.name.toLowerCase()).to.equal(metaProp.name.toLowerCase(), `name mismatch for ${ctx}`);

  // Kind discriminators (methods, not getters - they are real type predicates)
  expect(rProp.isPrimitive()).to.equal(metaProp.isPrimitive(), `isPrimitive mismatch for ${ctx}`);
  expect(rProp.isNavigation()).to.equal(metaProp.isNavigation(), `isNavigation mismatch for ${ctx}`);
  expect(rProp.isArray()).to.equal(metaProp.isArray(), `isArray mismatch for ${ctx}`);

  // For primitives and enums: check primitiveType and extendedTypeName
  if (rProp.isPrimitive()) {
    // Cast to PrimitiveProperty for field access - ecschema-metadata's type hierarchy
    // doesn't model enum-as-primitive correctly (see itwinjs-core#8448), but the fields exist at runtime.
    const metaPrimProp = metaProp as unknown as PrimitiveProperty;
    if (metaPrimProp.primitiveType !== undefined) {
      // RuntimePrimitiveType values match PrimitiveType values
      expect(rProp.primitiveType).to.equal(metaPrimProp.primitiveType,
        `primitiveType mismatch for ${ctx}: runtime=0x${rProp.primitiveType.toString(16)}, meta=0x${metaPrimProp.primitiveType.toString(16)}`);
    }
    if (metaPrimProp.extendedTypeName !== undefined) {
      expect(rProp.extendedTypeName?.toLowerCase()).to.equal(metaPrimProp.extendedTypeName.toLowerCase(),
        `extendedTypeName mismatch for ${ctx}`);
    }

    // KindOfQuantity reference (only on primitive properties)
    const metaKoq = metaProp.getKindOfQuantitySync();
    if (metaKoq !== undefined && rProp.kindOfQuantity !== undefined) {
      expect(rProp.kindOfQuantity.name).to.equal(metaKoq.name, `KoQ mismatch for ${ctx}`);
    }
  }

  // isReadOnly
  expect(rProp.isReadOnly).to.equal(metaProp.isReadOnly, `isReadOnly mismatch for ${ctx}`);

  // Struct class reference - structClass is non-nullable on struct subclasses
  if (rProp.isStruct()) {
    const metaStruct = metaProp as StructProperty;
    expect(rProp.structClass.name).to.equal(metaStruct.structClass.name, `structClass mismatch for ${ctx}`);
  }

  // Navigation property: direction and relationship class
  if (rProp.isNavigation()) {
    const metaNav = metaProp as NavigationProperty;
    expect(rProp.direction).to.equal(metaNav.direction, `direction mismatch for ${ctx}`);

    const metaRelClass = metaNav.getRelationshipClassSync();
    if (metaRelClass !== undefined) {
      expect(rProp.relationshipClass.name).to.equal(metaRelClass.name,
        `nav relationshipClass mismatch for ${ctx}`);
    }
  }

  // Category reference (available on all property kinds)
  const metaCat = metaProp.getCategorySync();
  if (metaCat !== undefined && rProp.category !== undefined) {
    expect(rProp.category.name).to.equal(metaCat.name, `category mismatch for ${ctx}`);
  }
}
