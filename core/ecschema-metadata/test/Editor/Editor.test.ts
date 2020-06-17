/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaContextEditor } from "../../src/Editor/Editor";
import { SchemaContext } from "../../src/Context";
import { Schema } from "../../src/Metadata/Schema";
import { expect } from "chai";
import { ECVersion, SchemaKey, SchemaItemKey } from "../../src/SchemaKey";
import { ECClassModifier, SchemaItemType, PrimitiveType, StrengthDirection } from "../../src/ECObjects";
import { EntityClass, EntityClassProps, RelationshipClassProps, RelationshipConstraintProps, RelationshipClass, PrimitiveArrayProperty, PrimitiveProperty, StructClass, StructProperty, StructArrayProperty, Enumeration, EnumerationProperty, NavigationProperty } from "../../src/ecschema-metadata";
describe("Editor tests", () => {
  describe("SchemaEditor tests", () => {
    let testEditor: SchemaContextEditor;
    let testSchema: Schema;
    let testKey: SchemaKey;
    let context: SchemaContext;
    describe("should create a new schema from a context", () => {
      beforeEach(() => {
        context = new SchemaContext();
        testEditor = new SchemaContextEditor(context);
      });

      it("should create a new schema and return a SchemaEditResults", async () => {
        const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
        expect(result).to.not.eql(undefined);
      });

      it("upon schema creation, return a defined SchemaKey from SchemaEditResults", async () => {
        const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
        expect(result.schemaKey?.name).to.eql("testSchema");
        expect(result.schemaKey?.version).to.eql(new ECVersion(1, 0, 0));
      });

    });

    describe("edits an existing schema", () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        alias: "ts",
        items: {
          testEnum: {
            schemaItemType: "Enumeration",
            type: "int",
            enumerators: [
              {
                name: "ZeroValue",
                value: 0,
                label: "None",
              },
            ],
          },
          testClass: {
            schemaItemType: "EntityClass",
            label: "ExampleEntity",
            description: "An example entity class.",
          },
          ExampleMixin: {
            schemaItemType: "Mixin",
            appliesTo: "TestSchema.testClass",
          },
          ExampleStruct: {
            schemaItemType: "StructClass",
            name: "ExampleStruct",
            modifier: "sealed",
            properties: [
              {
                type: "PrimitiveArrayProperty",
                name: "ExamplePrimitiveArray",
                typeName: "TestSchema.testEnum",
                minOccurs: 7,
                maxOccurs: 20,
              },
            ],
          },
        },
      };
      beforeEach(async () => {
        context = new SchemaContext();
        testSchema = await Schema.fromJson(schemaJson, context);
        testEditor = new SchemaContextEditor(context);
        testKey = testSchema.schemaKey;
      });

      it("should get the correct Schema", async () => {
        expect(await testEditor.schemaContext.getSchema(testKey)).to.eql(testSchema);
      });

      it("upon manual key creation, still create a valid property to an existing entity", async () => {
        const schemaKey = new SchemaKey("TestSchema");
        const entityKey = new SchemaItemKey("testClass", schemaKey);
        const result = await testEditor.entities.createPrimitiveProperty(entityKey!, "testProperty", PrimitiveType.Integer);
        const testEntity = await testEditor.schemaContext.getSchemaItem(entityKey) as EntityClass;
        expect(await testEntity.getProperty("testProperty")).to.not.eql(undefined);
      });

      it("should get the right entity class from existing schema", async () => {
        const createdKey = new SchemaKey("TestSchema");
        const schema = testEditor.schemaContext.getCachedSchema(createdKey);
        const testEntity = await testSchema.getItem("testClass");
        expect(testEntity?.label).to.eql("ExampleEntity");
      });

      it("should add a property to existing entity", async () => {
        const schemaKey = testKey;
        const entityKey = new SchemaItemKey("testClass", testKey);
        const result = await testEditor.entities.createPrimitiveProperty(entityKey!, "testProperty", PrimitiveType.Integer);
        const testEntity = await testSchema.getItem("testClass") as EntityClass;
        expect(await testEntity.getProperty("testProperty")).to.not.eql(undefined);
      });
    });

    describe("Entities tests", () => {
      beforeEach(async () => {
        context = new SchemaContext();
        testEditor = new SchemaContextEditor(context);
        const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
        testKey = result.schemaKey!;
      });

      it("should create a new entity class using a SchemaEditor", async () => {
        await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
        const schema = await testEditor.schemaContext.getCachedSchema(testKey);
        expect((await schema?.getItem("testEntity"))?.schemaItemType).to.eql(SchemaItemType.EntityClass);
      });

      it("should create a new entity class with a base class", async () => {
        const testEntityBaseRes = await testEditor.entities.create(testKey, "testEntityBase", ECClassModifier.None);
        const result = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None, testEntityBaseRes.itemKey!);

        const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result.itemKey!);
        expect(await testEntity?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(testEntityBaseRes.itemKey!));
      });

      it("should create a new entity class using EntityClassProps", async () => {
        const entityClassProps: EntityClassProps = {
          name: "testEntity",
          modifier: "abstract",
        };

        const result = await testEditor.entities.createFromProps(testKey, entityClassProps);
        const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result.itemKey!);
        expect(testEntity?.modifier).to.eql(ECClassModifier.Abstract);
      });

      it("should create a new entity class using EntityClassProps with a base class provided.", async () => {
        const testEntityBaseRes = await testEditor.entities.create(testKey, "testEntityBase", ECClassModifier.None);
        const entityClassProps: EntityClassProps = {
          name: "testEntity",
          modifier: "abstract",
          baseClass: testEntityBaseRes.itemKey?.fullName, // Must be full name to reflect the key.
        };

        const result = await testEditor.entities.createFromProps(testKey, entityClassProps);
        const testEntity = await testEditor.schemaContext.getSchemaItem<EntityClass>(result.itemKey!);
        expect(await testEntity?.baseClass).to.eql(await testEditor.schemaContext.getSchemaItem(testEntityBaseRes.itemKey!));
      });
    });

    describe("Mixins tests", () => {
      let entityKey: SchemaItemKey;
      beforeEach(async () => {
        context = new SchemaContext();
        testEditor = new SchemaContextEditor(context);
        const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
        testKey = result.schemaKey!;

        const entityResult = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
        entityKey = entityResult.itemKey!;

      });

      it("should create a new mixin", async () => {
        const mixinResult = await testEditor.mixins.create(testKey, "testMixin", entityKey);
        expect(testEditor.schemaContext.getSchemaItemSync(mixinResult.itemKey!)?.name).to.eql("testMixin");
      });
    });

    describe("Relationship tests from an existing schema", () => {
      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          SourceBaseEntity: {
            schemaItemType: "EntityClass",
          },
          TargetBaseEntity: {
            schemaItemType: "EntityClass",
          },
          TestSourceEntity: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.SourceBaseEntity",
          },
          TestTargetEntity: {
            schemaItemType: "EntityClass",
            baseClass: "TestSchema.TargetBaseEntity",
          },
        },
      };
      beforeEach(async () => {
        context = new SchemaContext();
        testSchema = await Schema.fromJson(schemaJson, context);
        testEditor = new SchemaContextEditor(context);
        testKey = testSchema.schemaKey;
      });

      it("should create a relationship class given a valid RelationshipClassProps", async () => {
        const sourceJson: RelationshipConstraintProps = {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          abstractConstraint: "TestSchema.SourceBaseEntity",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };
        const targetJson: RelationshipConstraintProps = {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Target RoleLabel",
          abstractConstraint: "TestSchema.TargetBaseEntity",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const relClassProps: RelationshipClassProps = {
          name: "TestRelationship",
          strength: "Embedding",
          strengthDirection: "Forward",
          source: sourceJson,
          target: targetJson,
        };

        const result = await testEditor.relationships.createFromProps(testKey, relClassProps);
        const relClass = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as RelationshipClass;
        const baseSourceClassKey = testSchema.getSchemaItemKey("TestSchema.SourceBaseEntity");
        expect(await relClass.source.abstractConstraint).to.eql(await testEditor.schemaContext.getSchemaItem(baseSourceClassKey));
      });
    });

    describe("Property creation tests", () => {
      // Uses an entity class to create properties.
      let entityKey: SchemaItemKey;
      let entity: EntityClass | undefined;
      beforeEach(async () => {
        context = new SchemaContext();
        testEditor = new SchemaContextEditor(context);
        const result = await testEditor.createSchema("TestSchema", "test", 1, 0, 0);
        testKey = result.schemaKey!;
        const entityRes = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
        entityKey = entityRes.itemKey!;
        entity = await testEditor.schemaContext.getSchemaItem(entityKey);
      });

      it("should successfully create a PrimitiveProperty from a JSON prop", async () => {
        const propertyJson = {
          name: "TestProperty",
          type: "PrimitiveProperty",
          typeName: "double",
          minLength: 2,
          maxLength: 4,
          minValue: 6,
          maxValue: 8,
          extendedTypeName: "SomeExtendedType",
        };
        const propResult = await testEditor.entities.createPrimitivePropertyFromProps(entityKey, "TestProperty", PrimitiveType.Double, propertyJson);
        const property = await entity?.getProperty(propResult.propertyName!) as PrimitiveProperty;
        expect(property.extendedTypeName).to.eql("SomeExtendedType");
        expect(property.minValue).to.eql(6);
        expect(property.maxValue).to.eql(8);
        expect(property.propertyType).to.eql(PrimitiveType.Double);
      });

      it("should successfully create an EnumerationProperty from a JSON prop", async () => {
        const enumJson = {
          name: "TestEnum",
          type: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: 6 },
            { name: "EightValue", value: 8, label: "An enumerator label" },
          ],
        };
        const propertyJson = {
          name: "TestProperty",
          type: "PrimitiveProperty",
          typeName: "TestSchema.TestEnum",
          minLength: 2,
          maxLength: 4,
          minValue: 6,
          maxValue: 8,
          extendedTypeName: "SomeExtendedType",
        };
        const enumResult = await testEditor.enumerations.createFromProps(testKey, enumJson);
        const enumeration = await testEditor.schemaContext.getSchemaItem(enumResult.itemKey!) as Enumeration;
        const propResult = await testEditor.entities.createEnumerationPropertyFromProps(entityKey, "TestProperty", enumeration, propertyJson);
        const property = await entity?.getProperty(propResult.propertyName!) as EnumerationProperty;
        expect(await property.enumeration).to.eql(enumeration);
      });

      it("should create a NavigationProperty", async () => {
        const schemaJson = {
          $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
          name: "TestSchema",
          version: "1.2.3",
          items: {
            SourceBaseEntity: {
              schemaItemType: "EntityClass",
            },
            TargetBaseEntity: {
              schemaItemType: "EntityClass",
            },
            TestSourceEntity: {
              schemaItemType: "EntityClass",
              baseClass: "TestSchema.SourceBaseEntity",
            },
            TestTargetEntity: {
              schemaItemType: "EntityClass",
              baseClass: "TestSchema.TargetBaseEntity",
            },
          },
        };
        const sourceJson: RelationshipConstraintProps = {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          abstractConstraint: "TestSchema.SourceBaseEntity",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };
        const targetJson: RelationshipConstraintProps = {
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Target RoleLabel",
          abstractConstraint: "TestSchema.TargetBaseEntity",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const relClassProps: RelationshipClassProps = {
          name: "TestRelationship",
          strength: "Embedding",
          strengthDirection: "Forward",
          source: sourceJson,
          target: targetJson,
        };
        context = new SchemaContext();
        testSchema = await Schema.fromJson(schemaJson, context);
        testEditor = new SchemaContextEditor(context);
        testKey = testSchema.schemaKey;
        const relationshipResult = await testEditor.relationships.createFromProps(testKey, relClassProps);
        const relationship = await testEditor.schemaContext.getSchemaItem(relationshipResult.itemKey!) as RelationshipClass;
        const propResult = await testEditor.relationships.createNavigationProperty(relationship.key, "TestProperty", relationship, "Forward");
        const navProperty = await relationship.getProperty(propResult.propertyName!) as NavigationProperty;
        expect(navProperty.direction).to.eql(StrengthDirection.Forward);
        expect(await navProperty.relationshipClass).to.eql(relationship);
      });

      it("should successfully create a PrimitiveArrayProperty from a JSON prop", async () => {
        const propertyJson = {
          name: "TestProperty",
          type: "PrimitiveArrayProperty",
          typeName: "int",
          minOccurs: 42,
          maxOccurs: 55,
        };

        const propResult = await testEditor.entities.createPrimitiveArrayPropertyFromProps(entityKey, "TestProperty", PrimitiveType.Integer, propertyJson);
        const property = await entity?.getProperty(propResult.propertyName!) as PrimitiveArrayProperty;
        expect(property.minOccurs).to.eql(42);
        expect(property.maxOccurs).to.eql(55);
      });

      it("should successfully create a StructProperty from a JSON prop", async () => {
        const propertyJson = {
          name: "TestProperty",
          type: "StructProperty",
          typeName: "TestSchema.TestStruct",
        };
        const classResult = await testEditor.structs.create(testKey, "TestStruct");
        const structClass = await testEditor.schemaContext.getSchemaItem(classResult.itemKey!) as StructClass;
        const propResult = await testEditor.entities.createStructPropertyFromProps(entityKey, "TestProperty", structClass, propertyJson);
        const property = await entity?.getProperty(propResult.propertyName!) as StructProperty;
        expect(property.structClass).to.eql(structClass);
      });

      it("should successfully create a StructArrayProperty from a JSON prop", async () => {
        const propertyJson = {
          name: "TestProperty",
          type: "StructArrayProperty",
          typeName: "TestSchema.TestStruct",
          minOccurs: 20,
          maxOccurs: 32,
        };

        const classResult = await testEditor.structs.create(testKey, "TestStruct");
        const structClass = await testEditor.schemaContext.getSchemaItem(classResult.itemKey!) as StructClass;

        const propResult = await testEditor.entities.createStructArrayPropertyFromProps(entityKey, "TestProperty", structClass, propertyJson);
        const property = await entity?.getProperty(propResult.propertyName!) as StructArrayProperty;
        expect(property.structClass).to.eql(structClass);
        expect(property.minOccurs).to.eql(20);
        expect(property.maxOccurs).to.eql(32);
      });
    });

    // TODO: Add a test to compare previous SchemaContext with the SchemaContext returned when SchemaEditor.finish() is called.
  });
  //   describe("should make successful edits on an existing schema", () => {
  //     const schemaJson = {
  //       $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  //       name: "TestSchema",
  //       version: "1.2.3",
  //       alias: "ts",
  //       references: [
  //         {
  //           name: "RefSchema",
  //           version: "1.0.5",
  //         },
  //       ],
  //       items: {
  //         testEnum: {
  //           schemaItemType: "Enumeration",
  //           type: "int",
  //           enumerators: [
  //             {
  //               name: "ZeroValue",
  //               value: 0,
  //               label: "None",
  //             },
  //           ],
  //         },
  //         testClass: {
  //           schemaItemType: "EntityClass",
  //           label: "ExampleEntity",
  //           description: "An example entity class.",
  //         },
  //         ExampleMixin: {
  //           schemaItemType: "Mixin",
  //           appliesTo: "TestSchema.testClass",
  //         },
  //         ExampleStruct: {
  //           schemaItemType: "StructClass",
  //           name: "ExampleStruct",
  //           modifier: "sealed",
  //           properties: [
  //             {
  //               type: "PrimitiveArrayProperty",
  //               name: "ExamplePrimitiveArray",
  //               typeName: "TestSchema.testEnum",
  //               minOccurs: 7,
  //               maxOccurs: 20,
  //             },
  //           ],
  //         },
  //       },
  //     };
  //     beforeEach(() => {
  //       context = new SchemaContext();
  //       const refSchema = new Schema(new SchemaContext(), "RefSchema", "ref", 1, 0, 5);
  //       context.addSchemaSync(refSchema);
  //       testSchema = Schema.fromJsonSync(schemaJson, context);
  //       testEditor = new SchemaEditor(testSchema);
  //     });
  //     it("should create references and handle duplicate references", async () => {
  //       testEditor.addReferenceSync(new Schema(context, "RefSchema2", "ref", 2, 5, 4));
  //       expect(testEditor.references.length).to.equal(2);
  //       const referenceSchema = new Schema(context, "RefSchema", "ref", 1, 2, 0);
  //       await expect(testEditor.addReference(referenceSchema)).to.be.rejectedWith(ECObjectsError, "The reference schema RefSchema cannot be added to the schema TestSchema because the reference already exists.");
  //     });

  //     it("should create and add ECClass objects", () => {

  //       // EntityClass
  //       testEditor.createEntityClassSync("testEntity");
  //       expect(testEditor.schema.getItemSync("testEntity")?.schemaItemType).to.eql(SchemaItemType.EntityClass);

  //       // Multiple different classes
  //       testEditor.createStructClassSync("testStruct");
  //       testEditor.createCustomAttributeClassSync("testCA");
  //       expect(Array.from(testEditor.schema.getItems()).length).to.eql(7);
  //     });

  //     it("should get an existing ECClass as an Editor", () => {
  //       const testClassEditor = testEditor.getECClassAsEditor("ExampleStruct");
  //       expect(testClassEditor instanceof ECClassEditor).to.eql(true);
  //       expect(testClassEditor?.ecClass.name).to.eql("ExampleStruct");
  //       expect(testClassEditor?.ecClass.schemaItemType).to.eql(SchemaItemType.StructClass);
  //     });

  //     it("should edit ECClass properties and specific EntityClass properties using EntityClassEditor. ", () => {
  //       const entityEditor = testEditor.getEntityClassAsEditor("testClass");
  //       entityEditor?.createPrimitivePropertySync("testInteger", PrimitiveType.Integer);
  //       expect(entityEditor?.ecClass.getPropertySync("testInteger")).to.not.eql(undefined);
  //     });
  //   });
  // });

});
