import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { Code, ColorDef, GeometricElementProps, GeometryStreamProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Arc3d, IModelJson as GeomJson, Point3d } from "@itwin/core-geometry";
import { assert } from "chai";
import { SpatialCategory } from "../../Category";
import { IModelDb, StandaloneDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";

describe.only("Schema evolution", async () => {
  it("upgrade schema to new major version with no change", async () => {
    const ctx = await setupIModel(`
      <?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00"
          xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
        <ECEntityClass typeName="Foo" modifier="None">
          <BaseClass>bis:PhysicalElement</BaseClass>
        </ECEntityClass>
      </ECSchema>`,
    );

    await assertThrowsAsync(async () =>
      ctx.db.importSchemaStrings([
        `<?xml version="1.0" encoding="UTF-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="02.00.00"
            xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
          <ECEntityClass typeName="Foo" modifier="None">
            <BaseClass>bis:PhysicalElement</BaseClass>
          </ECEntityClass>
        </ECSchema>`,
      ]), "");
    cleanupIModel(ctx);
  });

  it("upgrade dynamic schema to new major version with no change", async () => {
    const ctx = await setupIModel(`
    <?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00"
        xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
      <ECCustomAttributes>
        <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
      </ECCustomAttributes>
      <ECEntityClass typeName="Foo" modifier="None">
        <BaseClass>bis:PhysicalElement</BaseClass>
      </ECEntityClass>
    </ECSchema>`);

    await ctx.db.importSchemaStrings([
      `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestSchema" alias="ts" version="02.00.00"
          xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
        <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
        <ECCustomAttributes>
          <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
        </ECCustomAttributes>
        <ECEntityClass typeName="Foo" modifier="None">
          <BaseClass>bis:PhysicalElement</BaseClass>
        </ECEntityClass>
      </ECSchema>`,
    ]);
    cleanupIModel(ctx);
  });

  it("dynamic schema - major change with read version change", async () => {
    const ctx = await setupIModel(`
  <?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00"
      xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
    <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
    <ECCustomAttributes>
      <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
    </ECCustomAttributes>
    <ECEntityClass typeName="Foo" modifier="None">
      <BaseClass>bis:PhysicalElement</BaseClass>
      <ECProperty propertyName="strProp" typeName="string"/>
    </ECEntityClass>
  </ECSchema>`);

    await assertThrowsAsync(async () =>
      ctx.db.importSchemaStrings([`
      <?xml version="1.0" encoding="UTF-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00"
            xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
          <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
          <ECCustomAttributes>
            <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
          </ECCustomAttributes>
          <ECEntityClass typeName="Foo" modifier="None">
            <BaseClass>bis:PhysicalElement</BaseClass>
          </ECEntityClass>
        </ECSchema>`,
      ]), "Error importing schema");
    cleanupIModel(ctx);
  });

  it("dynamic schema - delete property", async () => {
    const ctx = await setupIModel(`
  <?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00"
      xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
    <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
    <ECCustomAttributes>
      <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
    </ECCustomAttributes>
    <ECEntityClass typeName="Foo" modifier="None">
      <BaseClass>bis:PhysicalElement</BaseClass>
      <ECProperty propertyName="strProp" typeName="string"/>
    </ECEntityClass>
  </ECSchema>`);

    const eid = createElement(ctx, "TestSchema:Foo", { strProp: "Hello, World." });
    assert.equal(ctx.db.elements.getElement(eid).asAny.strProp, "Hello, World.");
    assert.isTrue(doesPropertyExists(ctx, "TestSchema:Foo.strProp"));
    assert.deepEqual(getPropertyMap(ctx, "TestSchema:Foo", "strProp"), [{ accessString: "strProp", column: "bis_GeometricElement3d:js2" }]);

    await ctx.db.importSchemaStrings([`
    <?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema" alias="ts" version="02.00.00"
        xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
      <ECCustomAttributes>
        <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
      </ECCustomAttributes>
      <ECEntityClass typeName="Foo" modifier="None">
        <BaseClass>bis:PhysicalElement</BaseClass>
      </ECEntityClass>
    </ECSchema>`,
    ]);
    assert.isUndefined(ctx.db.elements.getElement(eid).asAny.strProp);
    assert.isFalse(doesPropertyExists(ctx, "TestSchema:Foo.strProp"));
    assert.deepEqual(getPropertyMap(ctx, "TestSchema:Foo", "strProp"), []);

    cleanupIModel(ctx);
  });

  it("dynamic schema - delete property set property to null", async () => {
    const ctx = await setupIModel(`
  <?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00"
      xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
    <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
    <ECCustomAttributes>
      <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
    </ECCustomAttributes>
    <ECEntityClass typeName="Foo" modifier="None">
      <BaseClass>bis:PhysicalElement</BaseClass>
      <ECProperty propertyName="strProp" typeName="string"/>
    </ECEntityClass>
  </ECSchema>`);

    const eid = createElement(ctx, "TestSchema:Foo", { strProp: "Hello, World." });
    assert.equal(ctx.db.elements.getElement(eid).asAny.strProp, "Hello, World.");
    assert.isTrue(doesPropertyExists(ctx, "TestSchema:Foo.strProp"));
    assert.deepEqual(getPropertyMap(ctx, "TestSchema:Foo", "strProp"), [{ accessString: "strProp", column: "bis_GeometricElement3d:js2" }]);

    await ctx.db.importSchemaStrings([`
    <?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema" alias="ts" version="02.00.00"
        xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
      <ECCustomAttributes>
        <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
      </ECCustomAttributes>
      <ECEntityClass typeName="Foo" modifier="None">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECProperty propertyName="strProp1" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`,
    ]);
    assert.isUndefined(ctx.db.elements.getElement(eid).asAny.strProp);
    assert.isFalse(doesPropertyExists(ctx, "TestSchema:Foo.strProp"));

    assert.isUndefined(ctx.db.elements.getElement(eid).asAny.strProp1);
    assert.isTrue(doesPropertyExists(ctx, "TestSchema:Foo.strProp1"));

    assert.deepEqual(getPropertyMap(ctx, "TestSchema:Foo", "strProp"), []);
    // map to same column as previous property but previous value is set to null.
    assert.deepEqual(getPropertyMap(ctx, "TestSchema:Foo", "strProp1"), [{ accessString: "strProp1", column: "bis_GeometricElement3d:js2" }]);

    cleanupIModel(ctx);
  });
  it("dynamic schema - delete class", async () => {
    const ctx = await setupIModel(`
  <?xml version="1.0" encoding="UTF-8"?>
  <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00"
      xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
    <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
    <ECCustomAttributes>
      <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
    </ECCustomAttributes>
    <ECEntityClass typeName="Foo" modifier="None">
      <BaseClass>bis:PhysicalElement</BaseClass>
      <ECProperty propertyName="strProp" typeName="string"/>
    </ECEntityClass>
  </ECSchema>`);

    const eid = createElement(ctx, "TestSchema:Foo", { strProp: "Hello, World." });
    assert.equal(ctx.db.elements.getElement(eid).asAny.strProp, "Hello, World.");
    assert.isTrue(doesPropertyExists(ctx, "TestSchema:Foo.strProp"));

    await ctx.db.importSchemaStrings([`
    <?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema" alias="ts" version="02.00.00"
        xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
      <ECCustomAttributes>
        <DynamicSchema xmlns="CoreCustomAttributes.01.00.03"/>
      </ECCustomAttributes>
    </ECSchema>`,
    ]);
    assert.throws(() => ctx.db.elements.getElement(eid), `Element=${eid}`);
  });
});
function doesPropertyExists(ctx: IModelContext, path: string) {
  const parts = path.split(".");
  const className = parts[0];
  const propertyName = parts[1];
  const metaData = ctx.db.getMetaData(className);
  return metaData.properties.hasOwnProperty(propertyName);
}
interface IModelContext {
  db: IModelDb;
  category: Id64String;
  model: Id64String;
}
export interface AutoHandledProperties {
  [key: string]: any;
}
function createElement(context: IModelContext, className: string, autoHandledProp?: AutoHandledProperties): Id64String {
  const geomArray: Arc3d[] = [
    Arc3d.createXY(Point3d.create(0, 0), 5),
    Arc3d.createXY(Point3d.create(5, 5), 2),
    Arc3d.createXY(Point3d.create(-5, -5), 20),
  ];
  const geometryStream: GeometryStreamProps = [];
  for (const geom of geomArray) {
    const arcData = GeomJson.Writer.toIModelJson(geom);
    geometryStream.push(arcData);
  }
  // Create props
  const elementProps: GeometricElementProps = {
    classFullName: `${className}`,
    model: context.model,
    category: context.category,
    code: Code.createEmpty(),
    geom: geometryStream,
  };

  if (autoHandledProp)
    Object.assign(elementProps, autoHandledProp);

  const geomElement = context.db.elements.createElement(elementProps);
  const id = context.db.elements.insertElement(geomElement.toJSON());
  assert.isTrue(Id64.isValidId64(id), "insert worked");
  return id;
}

async function setupIModel(schemaXml?: string): Promise<IModelContext> {
  const categoryName = "SchemaEvolutionCategory";
  const iModelPath = IModelTestUtils.prepareOutputFile("schema_evolution", `delete_property.bim`);
  const iModel = StandaloneDb.createEmpty(iModelPath, { rootSubject: { name: "Schema Evolution" } });
  if (schemaXml) {
    await iModel.importSchemaStrings([schemaXml]);
  }
  const spatialCategoryId = SpatialCategory.insert(iModel, IModel.dictionaryId, categoryName,
    new SubCategoryAppearance({ color: ColorDef.create("rgb(255,0,0)").toJSON() }));
  const [, modelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(iModel, Code.createEmpty(), true);
  iModel.saveChanges();
  return { db: iModel, category: spatialCategoryId, model: modelId };
}

function cleanupIModel(ctx: IModelContext) {
  ctx.db.saveChanges();
  ctx.db.close();
}
function getPropertyMap(ctx: IModelContext, classFullName: string, propertyName: string): IPropertyMap[] {
  const sql = `
    SELECT JSON_GROUP_ARRAY (
            JSON_OBJECT (
              'accessString', [pp].[AccessString],
              'column', FORMAT ('%s:%s', [tb].[Name], [cn].[Name])))
    FROM   [ec_Schema] [ss]
          JOIN [ec_Class] [cc] ON [ss].[Id] = [cc].[SchemaId]
          JOIN [ec_PropertyMap] [pm] ON [cc].[Id] = [pm].[ClassId]
          JOIN [ec_Column] [cn] ON [cn].[Id] = [pm].[ColumnId]
          JOIN [ec_Table] [tb] ON [tb].[Id] = [cn].[TableId]
          JOIN [ec_PropertyPath] [pp] ON [pp].[Id] = [pm].[PropertyPathId]
          JOIN [ec_Property] [pr] ON [pr].[Id] = [pp].[RootPropertyId]
    WHERE  FORMAT ('%s:%s', [ss].[Name], [cc].[Name]) = ?
            AND [pr].[Name] = ?`;

  return ctx.db.withPreparedSqliteStatement(sql, (stmt) => {
    stmt.bindString(1, classFullName);
    stmt.bindString(2, propertyName);
    if (stmt.step() === DbResult.BE_SQLITE_ROW) {
      return JSON.parse(stmt.getValueString(0)) as IPropertyMap[];
    }
    return [];
  });
}
interface IPropertyMap {
  accessString: string;
  column: string;
}
async function assertThrowsAsync<T>(test: () => Promise<T>, msg?: string) {
  try {
    await test();
  } catch (e) {
    if (e instanceof Error && msg) {
      assert.equal(e.message, msg);
    }
    return;
  }
  throw new Error(`Failed to throw error with message: "${msg}"`);
}
