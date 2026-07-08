/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Id64, Id64String } from "@itwin/core-bentley";
import { Code, IModel, QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { withEditTxn } from "../../EditTxn";
import { getRuntimeClass, reshapeInstanceRow, reshapePropertyValue } from "../../internal/ECSqlInstanceReshaper";
import { IModelJsFs, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

/* eslint-disable @typescript-eslint/naming-convention */

// Direct unit tests for the ECSqlInstanceReshaper helper, which reshapes rows/values queried with the
// non-deprecated QueryRowFormat.UseECSqlPropertyNames row format back into the legacy shape historically
// produced by the deprecated QueryRowFormat.UseJsPropertyNames row format. These call the helper's exported
// functions directly against real ECSQL rows, rather than only exercising them indirectly through
// ElementAspect/Relationship/annotation field call sites (which are covered elsewhere).
describe("ECSqlInstanceReshaper", () => {
  const schemaName = "ReshaperTest";
  const schemaAlias = "rst";
  const subDirName = "ECSqlInstanceReshaper";

  let iModel: SnapshotDb;
  let element1Id: Id64String;
  let element2Id: Id64String;
  let aspectId: Id64String;
  let relationshipId: Id64String;

  before(async () => {
    const schema = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="${schemaName}" alias="${schemaAlias}" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
        <ECStructClass typeName="PointStruct" modifier="None">
          <ECProperty propertyName="Label" typeName="string"/>
          <ECProperty propertyName="P3d" typeName="point3d"/>
        </ECStructClass>
        <ECEntityClass typeName="ReshaperElement" modifier="None">
          <BaseClass>bis:DefinitionElement</BaseClass>
        </ECEntityClass>
        <ECEntityClass typeName="ReshaperAspect" modifier="None">
          <BaseClass>bis:ElementUniqueAspect</BaseClass>
          <ECProperty propertyName="P2d" typeName="point2d"/>
          <ECProperty propertyName="P3d" typeName="point3d"/>
          <ECStructProperty propertyName="St" typeName="PointStruct"/>
          <ECArrayProperty propertyName="ArrayI" typeName="int" minOccurs="0" maxOccurs="unbounded"/>
          <ECArrayProperty propertyName="ArrayP3d" typeName="point3d" minOccurs="0" maxOccurs="unbounded"/>
          <ECStructArrayProperty propertyName="ArraySt" typeName="PointStruct" minOccurs="0" maxOccurs="unbounded"/>
        </ECEntityClass>
        <ECRelationshipClass typeName="ReshaperRelatesToElement" strength="referencing" modifier="Sealed">
          <BaseClass>bis:ElementRefersToElements</BaseClass>
          <Source multiplicity="(0..*)" roleLabel="refers to" polymorphic="true">
            <Class class="ReshaperElement"/>
          </Source>
          <Target multiplicity="(0..*)" roleLabel="is referenced by" polymorphic="true">
            <Class class="ReshaperElement"/>
          </Target>
          <ECProperty propertyName="Label" typeName="string"/>
        </ECRelationshipClass>
      </ECSchema>`;

    const testFileName = IModelTestUtils.prepareOutputFile(subDirName, "ECSqlInstanceReshaper.bim");
    const schemaPath = IModelTestUtils.prepareOutputFile(subDirName, `${schemaName}.01.00.00.xml`);
    IModelJsFs.writeFileSync(schemaPath, schema);

    iModel = SnapshotDb.createEmpty(testFileName, { rootSubject: { name: "ECSqlInstanceReshaperTest" } });
    await iModel.importSchemas([schemaPath]);

    withEditTxn(iModel, (txn) => {
      element1Id = txn.insertElement({
        classFullName: `${schemaName}:ReshaperElement`,
        model: IModel.dictionaryId,
        code: Code.createEmpty(),
      });
      element2Id = txn.insertElement({
        classFullName: `${schemaName}:ReshaperElement`,
        model: IModel.dictionaryId,
        code: Code.createEmpty(),
      });
      assert.isTrue(Id64.isValidId64(element1Id));
      assert.isTrue(Id64.isValidId64(element2Id));

      aspectId = txn.insertAspect({
        classFullName: `${schemaName}:ReshaperAspect`,
        element: { id: element1Id },
        p2d: { x: 100, y: 200 },
        p3d: { x: 1, y: 2, z: 3 },
        st: { label: "struct-label", p3d: { x: 4, y: 5, z: 6 } },
        arrayI: [10, 20, 30],
        arrayP3d: [{ x: 13, y: 14, z: 15 }, { x: 16, y: 17, z: 18 }],
        arraySt: [{ label: "arr-0", p3d: { x: 7, y: 8, z: 9 } }, { label: "arr-1", p3d: { x: 10, y: 11, z: 12 } }],
      } as any);
      assert.isTrue(Id64.isValidId64(aspectId));

      relationshipId = txn.insertRelationship({
        classFullName: `${schemaName}:ReshaperRelatesToElement`,
        sourceId: element1Id,
        targetId: element2Id,
        label: "rel-label",
      } as any);
      assert.isTrue(Id64.isValidId64(relationshipId));
    });
  });

  after(() => {
    iModel.close();
  });

  it("getRuntimeClass resolves a runtime class by full class name and throws for unknown classes", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperAspect`);
    assert.equal(ecClass.name, "ReshaperAspect");
    assert.equal(ecClass.schema.name, schemaName);

    assert.throws(() => getRuntimeClass(iModel, `${schemaName}:DoesNotExist`), /Class not found/);
  });

  it("reshapeInstanceRow reshapes an ElementAspect row: system properties, points, struct, primitive array, point array, and struct array", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperAspect`);
    const row = iModel.withQueryReader(`SELECT * FROM ${schemaAlias}.ReshaperAspect WHERE ECInstanceId=:aspectId`, (reader) => {
      assert.isTrue(reader.step());
      return reader.current.toRow();
    }, new QueryBinder().bindId("aspectId", aspectId), { rowFormat: QueryRowFormat.UseECSqlPropertyNames });

    const reshaped = reshapeInstanceRow(row, ecClass, iModel);

    // system properties: ECInstanceId -> id, ECClassId -> className (dot-separated)
    assert.equal(reshaped.id, aspectId);
    assert.equal(reshaped.className, `${schemaName}.ReshaperAspect`);

    // inherited navigation property from ElementUniqueAspect
    assert.deepEqual(reshaped.element, { id: element1Id, relClassName: "BisCore.ElementOwnsUniqueAspect" });

    // point2d property: first letter lowercased, X/Y -> x/y
    assert.deepEqual(reshaped.p2d, { x: 100, y: 200 });

    // point3d property: first letter lowercased, X/Y/Z -> x/y/z
    assert.deepEqual(reshaped.p3d, { x: 1, y: 2, z: 3 });

    // struct property: first letter lowercased, and its members recursively reshaped (including nested point)
    assert.deepEqual(reshaped.st, { label: "struct-label", p3d: { x: 4, y: 5, z: 6 } });

    // primitive (non-point) array: values pass through unchanged, only the key is lowercased
    assert.deepEqual(reshaped.arrayI, [10, 20, 30]);

    // point3d array: each scalar element reshaped like a standalone point, not just key-renamed
    assert.deepEqual(reshaped.arrayP3d, [{ x: 13, y: 14, z: 15 }, { x: 16, y: 17, z: 18 }]);

    // struct array: each element recursively reshaped like a standalone struct
    assert.deepEqual(reshaped.arraySt, [
      { label: "arr-0", p3d: { x: 7, y: 8, z: 9 } },
      { label: "arr-1", p3d: { x: 10, y: 11, z: 12 } },
    ]);
  });

  it("reshapeInstanceRow reshapes a Relationship row: source/target system properties and a primitive property", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperRelatesToElement`);
    const row = iModel.withQueryReader(`SELECT * FROM ${schemaAlias}.ReshaperRelatesToElement WHERE ECInstanceId=:relationshipId`, (reader) => {
      assert.isTrue(reader.step());
      return reader.current.toRow();
    }, new QueryBinder().bindId("relationshipId", relationshipId), { rowFormat: QueryRowFormat.UseECSqlPropertyNames });

    const reshaped = reshapeInstanceRow(row, ecClass, iModel);

    assert.equal(reshaped.id, relationshipId);
    assert.equal(reshaped.className, `${schemaName}.ReshaperRelatesToElement`);
    assert.equal(reshaped.sourceId, element1Id);
    assert.equal(reshaped.sourceClassName, `${schemaName}.ReshaperElement`);
    assert.equal(reshaped.targetId, element2Id);
    assert.equal(reshaped.targetClassName, `${schemaName}.ReshaperElement`);
    assert.equal(reshaped.label, "rel-label");
  });

  it("reshapeInstanceRow omits null/undefined members instead of propagating them", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperAspect`);
    const row = { ECInstanceId: aspectId, P3d: null, St: undefined, ArrayI: [10, 20, 30] };

    const reshaped = reshapeInstanceRow(row, ecClass, iModel);

    assert.equal(reshaped.id, aspectId);
    assert.isUndefined(reshaped.p3d);
    assert.isUndefined(reshaped.st);
    assert.deepEqual(reshaped.arrayI, [10, 20, 30]);
  });

  it("reshapePropertyValue reshapes a single Point2d, Point3d, and struct property value in isolation", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperAspect`);
    const p2dProp = ecClass.getPropertySync("P2d")!;
    const p3dProp = ecClass.getPropertySync("P3d")!;
    const stProp = ecClass.getPropertySync("St")!;
    assert.exists(p2dProp);
    assert.exists(p3dProp);
    assert.exists(stProp);

    assert.deepEqual(reshapePropertyValue({ X: 100, Y: 200 }, p2dProp, iModel), { x: 100, y: 200 });
    assert.deepEqual(reshapePropertyValue({ X: 1, Y: 2, Z: 3 }, p3dProp, iModel), { x: 1, y: 2, z: 3 });
    assert.deepEqual(
      reshapePropertyValue({ Label: "hello", P3d: { X: 1, Y: 2, Z: 3 } }, stProp, iModel),
      { label: "hello", p3d: { x: 1, y: 2, z: 3 } },
    );
  });

  it("reshapePropertyValue reshapes an array of Point3d scalars, not just a key rename", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperAspect`);
    const arrayP3dProp = ecClass.getPropertySync("ArrayP3d")!;
    assert.exists(arrayP3dProp);
    assert.isTrue(arrayP3dProp.isArray());

    const reshaped = reshapePropertyValue([{ X: 13, Y: 14, Z: 15 }, { X: 16, Y: 17, Z: 18 }], arrayP3dProp, iModel);
    assert.deepEqual(reshaped, [{ x: 13, y: 14, z: 15 }, { x: 16, y: 17, z: 18 }]);
  });

  it("reshapePropertyValue reshapes a navigation property value into {id, relClassName}", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperAspect`);
    const elementProp = ecClass.getPropertySync("Element")!;
    assert.exists(elementProp);
    assert.isTrue(elementProp.isNavigation());

    const row = iModel.withQueryReader(`SELECT Element FROM ${schemaAlias}.ReshaperAspect WHERE ECInstanceId=:aspectId`, (reader) => {
      assert.isTrue(reader.step());
      return reader.current.toRow();
    }, new QueryBinder().bindId("aspectId", aspectId), { rowFormat: QueryRowFormat.UseECSqlPropertyNames });

    const reshaped = reshapePropertyValue(row.Element, elementProp, iModel);
    expect(reshaped).to.deep.equal({ id: element1Id, relClassName: "BisCore.ElementOwnsUniqueAspect" });
  });

  it("reshapePropertyValue falls back to the raw classId instead of throwing when a navigation property's relationship class can't be resolved", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperAspect`);
    const elementProp = ecClass.getPropertySync("Element")!;
    assert.exists(elementProp);

    const unresolvableClassId = "0xdeadbeef";
    const reshaped = reshapePropertyValue({ Id: element1Id, RelECClassId: unresolvableClassId }, elementProp, iModel);
    assert.deepEqual(reshaped, { id: element1Id, relClassName: unresolvableClassId });
  });

  it("reshapePropertyValue omits relClassName entirely when a navigation property's relationship class Id is unset", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperAspect`);
    const elementProp = ecClass.getPropertySync("Element")!;
    assert.exists(elementProp);

    const reshaped = reshapePropertyValue({ Id: element1Id, RelECClassId: undefined }, elementProp, iModel);
    assert.deepEqual(reshaped, { id: element1Id });
    assert.isFalse("relClassName" in reshaped);
  });

  it("reshapeInstanceRow falls back to the raw classId instead of throwing when a system ECClassId column can't be resolved", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperAspect`);
    const unresolvableClassId = "0xdeadbeef";
    const reshaped = reshapeInstanceRow({ ECInstanceId: aspectId, ECClassId: unresolvableClassId }, ecClass, iModel);
    assert.equal(reshaped.id, aspectId);
    assert.equal(reshaped.className, unresolvableClassId);
  });

  it("reshapePropertyValue preserves a null/undefined struct-array element as an empty object, matching the native row adaptor", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperAspect`);
    const arrayStProp = ecClass.getPropertySync("ArraySt")!;
    assert.exists(arrayStProp);

    // A null struct-array element is rendered by the native row adaptor as an empty object placeholder
    // (unlike primitive arrays, where null elements are dropped entirely), preserving the array's length
    // and the positions of surrounding elements. The underlying query reader already normalizes a null
    // struct-array element to `{}` before it reaches the reshaper, but the reshaper is also exercised
    // directly here against raw `null`/`undefined` inputs to keep it robust regardless of caller.
    const reshaped = reshapePropertyValue(
      [{ Label: "arr-0", P3d: { X: 1, Y: 2, Z: 3 } }, null, undefined, { Label: "arr-3", P3d: { X: 4, Y: 5, Z: 6 } }],
      arrayStProp,
      iModel,
    );
    assert.deepEqual(reshaped, [
      { label: "arr-0", p3d: { x: 1, y: 2, z: 3 } },
      {},
      {},
      { label: "arr-3", p3d: { x: 4, y: 5, z: 6 } },
    ]);
  });

  it("reshapePropertyValue drops null/undefined elements from a primitive array, matching the native row adaptor", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperAspect`);
    const arrayIProp = ecClass.getPropertySync("ArrayI")!;
    assert.exists(arrayIProp);

    const reshaped = reshapePropertyValue([10, null, undefined, 30], arrayIProp, iModel);
    assert.deepEqual(reshaped, [10, 30]);
  });

  it("reshapeInstanceRow reshapes a row containing null array elements without throwing, matching the native row adaptor", () => {
    const ecClass = getRuntimeClass(iModel, `${schemaName}:ReshaperAspect`);
    let probeAspectId: string;
    withEditTxn(iModel, (txn) => {
      probeAspectId = txn.insertAspect({
        classFullName: `${schemaName}:ReshaperAspect`,
        element: { id: element1Id },
        arrayI: [10, null, 30],
        arraySt: [{ label: "a" }, null, { label: "c" }],
      } as any);
    });
    const row = iModel.withQueryReader(`SELECT * FROM ${schemaAlias}.ReshaperAspect WHERE ECInstanceId=:id`, (reader) => {
      assert.isTrue(reader.step());
      return reader.current.toRow();
    }, new QueryBinder().bindId("id", probeAspectId!), { rowFormat: QueryRowFormat.UseECSqlPropertyNames });

    const reshaped = reshapeInstanceRow(row, ecClass, iModel);
    assert.deepEqual(reshaped.arrayI, [10, 30]);
    assert.deepEqual(reshaped.arraySt, [{ label: "a" }, {}, { label: "c" }]);
  });
});
