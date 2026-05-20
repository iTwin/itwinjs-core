/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHost, SnapshotDb } from "@itwin/core-backend";
import { ClassType, PropertyKind, type SchemaView } from "@itwin/ecschema-metadata";
import { assert } from "chai";
import * as path from "path";
import { KnownTestLocations } from "./IModelTestUtils";

describe("SchemaView Examples", () => {
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

  it("obtaining the schema view", async () => {
    // __PUBLISH_EXTRACT_START__ SchemaView.obtain
    // Obtain the schema view (async, cached after first call)
    const view = await iModel.getSchemaView();

    // Subsequent calls return the cached view instantly
    const same = await iModel.getSchemaView();
    assert.strictEqual(view, same);
    // __PUBLISH_EXTRACT_END__
  });

  it("navigating schemas and classes", async () => {
    const view = await iModel.getSchemaView();

    // __PUBLISH_EXTRACT_START__ SchemaView.navigate-schemas
    // Look up a schema by name (case-insensitive)
    const bis = view.getSchema("BisCore");
    assert.isDefined(bis);

    // Iterate all schemas in the context
    for (const schema of view.getSchemas()) {
      // Every schema has a name, alias, and version
      assert.isNotEmpty(schema.name);
      assert.isNotEmpty(schema.alias);
      assert.isAtLeast(schema.readVersion, 1);
    }

    // Look up a class by qualified name - both ":" and "." separators work
    const element = view.findClass("BisCore:Element");
    const alsoElement = view.findClass("BisCore.Element");
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
    const view = await iModel.getSchemaView();

    // __PUBLISH_EXTRACT_START__ SchemaView.class-type-checks
    const element = view.findClass("BisCore:Element")!;
    const geom3d = view.findClass("BisCore:GeometricElement3d")!;
    const modelContains = view.findClass("BisCore:ModelContainsElements")!;

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
    const view = await iModel.getSchemaView();

    // __PUBLISH_EXTRACT_START__ SchemaView.properties
    const element = view.findClass("BisCore:Element")!;

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
    const view = await iModel.getSchemaView();

    // __PUBLISH_EXTRACT_START__ SchemaView.relationships
    const modelContains = view.findClass("BisCore:ModelContainsElements")!;
    assert.isTrue(modelContains.isRelationship());

    // Narrow to SchemaView.RelationshipClass for access to constraints
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
    const view = await iModel.getSchemaView();

    // __PUBLISH_EXTRACT_START__ SchemaView.enumerations
    // Look up an enumeration within a schema
    const bis = view.getSchema("BisCore")!;
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
    const view = await iModel.getSchemaView();

    // __PUBLISH_EXTRACT_START__ SchemaView.koq-and-categories
    // Some properties reference a KindOfQuantity
    const bis = view.getSchema("BisCore")!;
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
    const element = view.findClass("BisCore:Element")!;
    for (const prop of element.getProperties()) {
      const koq = prop.isPrimitive() ? prop.kindOfQuantity : undefined;
      if (koq !== undefined) {
        assert.isNotEmpty(koq.fullName);
      }
    }
    // __PUBLISH_EXTRACT_END__
  });

  it("views", async () => {
    const schemaView = await iModel.getSchemaView();

    // __PUBLISH_EXTRACT_START__ SchemaView.views
    // Iterate views within a schema - pass ClassType.View to filter to views only.
    for (const schema of schemaView.getSchemas()) {
      for (const view of schema.getClasses(ClassType.View)) {
        assert.isNotEmpty(view.name);
        assert.isNotEmpty(view.fullName); // "SchemaName:ViewName"

        // Views have their own properties (no inheritance)
        for (const prop of view.getProperties()) {
          assert.isNotEmpty(prop.name);
        }
      }
    }

    // Look up a view by qualified name - use findClass + isView() since views are
    // just classes with ClassType.View.
    // const cls = schemaView.findClass("SomeSchema:SomeView");
    // const view = cls?.isView() ? cls : undefined;
    // __PUBLISH_EXTRACT_END__
  });

  it("derived classes", async () => {
    const view = await iModel.getSchemaView();

    // __PUBLISH_EXTRACT_START__ SchemaView.derived-classes
    const element = view.findClass("BisCore:Element")!;

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
    const view = await iModel.getSchemaView();

    // __PUBLISH_EXTRACT_START__ SchemaView.exhaustive-walk
    // Walk every class and every property in the entire context
    let totalClasses = 0;
    let totalProperties = 0;

    for (const schema of view.getSchemas()) {
      for (const cls of schema.getClasses()) {
        totalClasses++;
        const props = cls.getProperties(); // includes inherited
        totalProperties += props.length;

        // Every class must be one of these types. Pass a ClassType to
        // schema.getClasses(...) if you want to filter to one kind.
        assert.isTrue(
          cls.type === ClassType.Entity
          || cls.type === ClassType.Relationship
          || cls.type === ClassType.Struct
          || cls.type === ClassType.CustomAttribute
          || cls.type === ClassType.Mixin
          || cls.type === ClassType.View,
        );
      }
    }

    // Even a minimal test iModel has BisCore schemas with hundreds of classes
    assert.isAbove(totalClasses, 0);
    assert.isAbove(totalProperties, 0);
    // __PUBLISH_EXTRACT_END__
  });

  it("using context for presentation-style provider", async () => {
    const view: SchemaView = await iModel.getSchemaView();

    // __PUBLISH_EXTRACT_START__ SchemaView.presentation-adapter
    // Adapt SchemaView for use with presentation-style consumers
    // that need schema/class/property lookup.
    function classDerivesFrom(view: SchemaView, classFullName: string, baseFullName: string): boolean {
      const cls = view.findClass(classFullName);
      if (cls === undefined)
        return false;
      return cls.is(baseFullName);
    }

    // Check whether a class derives from BisCore:GeometricElement
    const isGeometric = classDerivesFrom(view, "BisCore:GeometricElement3d", "BisCore:GeometricElement");
    assert.isTrue(isGeometric);

    // Get the properties of a class for display
    const element = view.findClass("BisCore:Element")!;
    const displayProps = element.getProperties()
      .filter((p) => !p.isHidden)
      .map((p) => ({ name: p.name, label: p.label, kind: p.kind }));
    assert.isAbove(displayProps.length, 0);
    // __PUBLISH_EXTRACT_END__
  });
});
