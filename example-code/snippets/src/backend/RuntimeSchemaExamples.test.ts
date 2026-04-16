/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHost, SnapshotDb } from "@itwin/core-backend";
import { ClassType, PropertyKind, type RuntimeSchemaContext } from "@itwin/ecschema-metadata";
import { assert } from "chai";
import * as path from "path";
import { KnownTestLocations } from "./IModelTestUtils";

describe("RuntimeSchemaContext Examples", () => {
  let iModel: SnapshotDb;

  before(async () => {
    if (!IModelHost.isValid)
      await IModelHost.startup();
    iModel = SnapshotDb.openFile(path.join(KnownTestLocations.assetsDir, "test.bim"));
  });

  after(() => {
    if (iModel?.isOpen)
      iModel.close();
  });

  it("obtaining the context", async () => {
    // __PUBLISH_EXTRACT_START__ RuntimeSchemaContext.obtain
    // Obtain the runtime schema context (async, cached after first call)
    const ctx = await iModel.getSchemas();

    // Subsequent calls return the cached context instantly
    const same = await iModel.getSchemas();
    assert.strictEqual(ctx, same);
    // __PUBLISH_EXTRACT_END__
  });

  it("navigating schemas and classes", async () => {
    const ctx = await iModel.getSchemas();

    // __PUBLISH_EXTRACT_START__ RuntimeSchemaContext.navigate-schemas
    // Look up a schema by name (case-insensitive)
    const bis = ctx.getSchema("BisCore");
    assert.isDefined(bis);

    // Iterate all schemas in the context
    for (const schema of ctx.getSchemas()) {
      // Every schema has a name, alias, and version
      assert.isNotEmpty(schema.name);
      assert.isNotEmpty(schema.alias);
      assert.isAtLeast(schema.readVersion, 1);
    }

    // Look up a class by qualified name - both ":" and "." separators work
    const element = ctx.findClass("BisCore:Element");
    const alsoElement = ctx.findClass("BisCore.Element");
    assert.isDefined(element);
    assert.isDefined(alsoElement);
    assert.strictEqual(element!.fullName, alsoElement!.fullName);

    // Look up a class within a schema
    const model = bis!.getClass("Model");
    assert.isDefined(model);
    assert.strictEqual(model!.schema.name, "BisCore");
    // __PUBLISH_EXTRACT_END__
  });

  it("class type guards and IS-A checks", async () => {
    const ctx = await iModel.getSchemas();

    // __PUBLISH_EXTRACT_START__ RuntimeSchemaContext.class-type-checks
    const element = ctx.findClass("BisCore:Element")!;
    const geom3d = ctx.findClass("BisCore:GeometricElement3d")!;
    const modelContains = ctx.findClass("BisCore:ModelContainsElements")!;

    // Type guards
    assert.isTrue(element.isEntity());
    assert.isTrue(modelContains.isRelationship());

    // IS-A check - walks base classes and mixins transitively, result is cached
    assert.isTrue(geom3d.is(element));            // GeometricElement3d derives from Element
    assert.isTrue(geom3d.is("BisCore:Element"));  // Also works with qualified name strings
    assert.isFalse(element.is(geom3d));            // Element does not derive from GeometricElement3d

    // Class hierarchy
    assert.isDefined(geom3d.baseClass);
    assert.strictEqual(geom3d.baseClass!.name, "GeometricElement");
    // __PUBLISH_EXTRACT_END__
  });

  it("working with properties", async () => {
    const ctx = await iModel.getSchemas();

    // __PUBLISH_EXTRACT_START__ RuntimeSchemaContext.properties
    const element = ctx.findClass("BisCore:Element")!;

    // Get all properties including inherited (base-first order)
    const allProps = element.getProperties();
    assert.isAbove(allProps.length, 0);

    // Look up a specific property by name (case-insensitive)
    const codeValue = element.getProperty("CodeValue");
    assert.isDefined(codeValue);
    assert.isTrue(codeValue!.isPrimitive());
    assert.strictEqual(codeValue!.kind, PropertyKind.Primitive);

    // Property type information
    for (const prop of allProps) {
      if (prop.isPrimitive()) {
        // Primitives have a type and optionally an extended type name
        assert.notStrictEqual(prop.primitiveType, 0);
      } else if (prop.isNavigation()) {
        // Navigation properties have a direction and a relationship class
        assert.isDefined(prop.relationshipClass);
      } else if (prop.isStruct()) {
        // Struct properties reference a struct class
        assert.isDefined(prop.structClass);
      }
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("relationship constraints", async () => {
    const ctx = await iModel.getSchemas();

    // __PUBLISH_EXTRACT_START__ RuntimeSchemaContext.relationships
    const modelContains = ctx.findClass("BisCore:ModelContainsElements")!;
    assert.isTrue(modelContains.isRelationship());

    // Narrow to RuntimeRelationshipClass for access to constraints
    if (modelContains.isRelationship()) {
      // Relationship classes have source and target constraints
      const source = modelContains.source;
      const target = modelContains.target;
      assert.isDefined(source);
      assert.isDefined(target);

      // Constraints have multiplicity, polymorphism, and constraint classes
      assert.isAbove(source!.constraintClasses.length, 0);
      assert.isAbove(target!.constraintClasses.length, 0);

      // Abstract constraint class is optional - not all relationships define one
      // When present, it restricts which classes can participate in the relationship
      if (target!.abstractConstraint !== undefined)
        assert.isNotEmpty(target!.abstractConstraint.name);
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("enumerations", async () => {
    const ctx = await iModel.getSchemas();

    // __PUBLISH_EXTRACT_START__ RuntimeSchemaContext.enumerations
    // Look up an enumeration within a schema
    const bis = ctx.getSchema("BisCore")!;
    for (const enumeration of bis.getEnumerations()) {
      // Enumerations have a name, primitiveType, and enumerators
      assert.isNotEmpty(enumeration.name);
      for (const enumerator of enumeration.getEnumerators()) {
        assert.isNotEmpty(enumerator.name);
      }
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("kind of quantity and property categories", async () => {
    const ctx = await iModel.getSchemas();

    // __PUBLISH_EXTRACT_START__ RuntimeSchemaContext.koq-and-categories
    // Some properties reference a KindOfQuantity
    const bis = ctx.getSchema("BisCore")!;
    for (const koq of bis.getKindOfQuantities()) {
      assert.isNotEmpty(koq.name);
      assert.isNotEmpty(koq.fullName); // "SchemaName:KoqName"

      // Parsed presentation formats - each has the format name, optional precision,
      // and optional unit overrides (all alias-qualified, e.g. "f:DefaultRealU", "u:M").
      for (const fmt of koq.presentationFormats) {
        assert.isNotEmpty(fmt.name);
        // fmt.precision - number or undefined
        // fmt.unitAndLabels - array of [unitName, labelOverride] tuples or undefined
      }

      // The raw JSON string is available for custom parsing
      // koq.presentationFormatsRaw - e.g. '["f:DefaultRealU(2)[u:M]","f:DefaultRealU(2)[u:FT]"]'
    }

    // Properties can reference a category
    const element = ctx.findClass("BisCore:Element")!;
    for (const prop of element.getProperties()) {
      const koq = prop.isPrimitive() ? prop.kindOfQuantity : undefined;
      if (koq !== undefined) {
        assert.isNotEmpty(koq.fullName);
      }
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("views", async () => {
    const ctx = await iModel.getSchemas();

    // __PUBLISH_EXTRACT_START__ RuntimeSchemaContext.views
    // Iterate views within a schema
    for (const schema of ctx.getSchemas()) {
      for (const view of schema.getViews()) {
        assert.isNotEmpty(view.name);
        assert.isNotEmpty(view.fullName); // "SchemaName:ViewName"

        // Views have their own properties (no inheritance)
        for (const prop of view.getProperties()) {
          assert.isNotEmpty(prop.name);
        }
      }
    }

    // Look up a view by qualified name
    // const view = ctx.findView("SomeSchema:SomeView");
    // __PUBLISH_EXTRACT_END__
  });

  it("derived classes", async () => {
    const ctx = await iModel.getSchemas();

    // __PUBLISH_EXTRACT_START__ RuntimeSchemaContext.derived-classes
    const element = ctx.findClass("BisCore:Element")!;

    // Walk direct derived classes (reverse map built lazily on first call)
    const directDerived = element.derivedClasses;
    assert.isAbove(directDerived.length, 0);

    // Each derived class has Element as its base
    for (const derived of directDerived) {
      assert.isTrue(derived.is(element));
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("derived classes and exhaustive walk", async () => {
    const ctx = await iModel.getSchemas();

    // __PUBLISH_EXTRACT_START__ RuntimeSchemaContext.exhaustive-walk
    // Walk every class and every property in the entire context
    let totalClasses = 0;
    let totalProperties = 0;

    for (const schema of ctx.getSchemas()) {
      for (const cls of schema.getClasses()) {
        totalClasses++;
        const props = cls.getProperties(); // includes inherited
        totalProperties += props.length;

        // Every class must be one of these types
        // (Views are accessed separately via schema.getViews(), not getClasses())
        assert.isTrue(
          cls.type === ClassType.Entity
          || cls.type === ClassType.Relationship
          || cls.type === ClassType.Struct
          || cls.type === ClassType.CustomAttribute
          || cls.type === ClassType.Mixin,
        );
      }
    }

    // Even a minimal test iModel has BisCore schemas with hundreds of classes
    assert.isAbove(totalClasses, 0);
    assert.isAbove(totalProperties, 0);
    // __PUBLISH_EXTRACT_END__
  });

  it("using context for presentation-style provider", async () => {
    const ctx: RuntimeSchemaContext = await iModel.getSchemas();

    // __PUBLISH_EXTRACT_START__ RuntimeSchemaContext.presentation-adapter
    // Adapt RuntimeSchemaContext for use with presentation-style consumers
    // that need schema/class/property lookup.
    function classDerivesFrom(ctx: RuntimeSchemaContext, classFullName: string, baseFullName: string): boolean {
      const cls = ctx.findClass(classFullName);
      if (cls === undefined)
        return false;
      return cls.is(baseFullName);
    }

    // Check whether a class derives from BisCore:GeometricElement
    const isGeometric = classDerivesFrom(ctx, "BisCore:GeometricElement3d", "BisCore:GeometricElement");
    assert.isTrue(isGeometric);

    // Get the properties of a class for display
    const element = ctx.findClass("BisCore:Element")!;
    const displayProps = element.getProperties()
      .filter((p) => !p.isHidden)
      .map((p) => ({ name: p.name, label: p.label, kind: p.kind }));
    assert.isAbove(displayProps.length, 0);
    // __PUBLISH_EXTRACT_END__
  });
});
