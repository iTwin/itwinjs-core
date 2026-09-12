/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ClassType } from "@itwin/ecschema-metadata";
import { IModelHost } from "../../IModelHost";
import { SnapshotDb } from "../../IModelDb";
import { readSchemasFromIModel } from "../../IModelSchemaSource";
import { IModelTestUtils } from "../IModelTestUtils";
import { TestUtils } from "../TestUtils";

/** One step of an alignment between two sequences. */
interface DiffStep {
  kind: "same" | "moved" | "onlyLeft" | "onlyRight";
  name: string;
}

/** Aligns two name sequences with a longest-common-subsequence walk, then reports an entry that was
 * deleted on one side and inserted on the other as a single `moved` step - which separates "the two
 * APIs disagree about order" from "one of them is missing a property". */
function alignNames(left: readonly string[], right: readonly string[]): DiffStep[] {
  const lengths: number[][] = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));
  for (let row = left.length - 1; row >= 0; row--) {
    for (let column = right.length - 1; column >= 0; column--) {
      lengths[row][column] = left[row] === right[column]
        ? lengths[row + 1][column + 1] + 1
        : Math.max(lengths[row + 1][column], lengths[row][column + 1]);
    }
  }

  const steps: DiffStep[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      steps.push({ kind: "same", name: left[i] });
      i++;
      j++;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      steps.push({ kind: "onlyLeft", name: left[i++] });
    } else {
      steps.push({ kind: "onlyRight", name: right[j++] });
    }
  }
  while (i < left.length)
    steps.push({ kind: "onlyLeft", name: left[i++] });
  while (j < right.length)
    steps.push({ kind: "onlyRight", name: right[j++] });

  const onlyRight = new Set(steps.filter((s) => s.kind === "onlyRight").map((s) => s.name));
  const moved = new Set(steps.filter((s) => s.kind === "onlyLeft" && onlyRight.has(s.name)).map((s) => s.name));
  return steps
    .filter((s) => !(s.kind === "onlyRight" && moved.has(s.name)))
    .map((s) => (moved.has(s.name) ? { kind: "moved" as const, name: s.name } : s));
}

function describeDifferences(className: string, view: readonly string[], document: readonly string[]): string[] {
  const steps = alignNames(view, document);
  return steps
    .filter((s) => s.kind !== "same")
    .map((s) => {
      switch (s.kind) {
        case "moved": return `${className}.${s.name}: at ${view.indexOf(s.name)} in SchemaView, at ${document.indexOf(s.name)} in SchemaDocument`;
        case "onlyLeft": return `${className}.${s.name}: only SchemaView has it`;
        default: return `${className}.${s.name}: only SchemaDocument has it`;
      }
    });
}

describe("Expanded properties: SchemaView against SchemaDocument", () => {
  let iModel: SnapshotDb;

  before(async () => {
    if (!IModelHost.isValid)
      await TestUtils.startBackend();
    iModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("SchemaView", "PropertyExpansionCrossCheck.bim"), {
      rootSubject: { name: "Property expansion cross-check" },
    });
  });

  after(() => {
    iModel?.close();
  });

  /** Every class of every schema, walked with both APIs. Reports every difference at once rather
   * than failing on the first - a systematic disagreement should be readable as one list. */
  async function crossCheck(schemaNames: string[]): Promise<void> {
    const view = await iModel.getSchemaView();
    const { schemaSet, issues } = await readSchemasFromIModel(iModel, { schemaNames });
    assert.deepEqual(issues.errors.map((e) => `${e.name}: ${e.message}`), []);

    const differences: string[] = [];
    let classesCompared = 0;
    for (const schemaName of schemaNames) {
      const viewSchema = view.getSchema(schemaName);
      const document = schemaSet.getSchema(schemaName);
      assert.isDefined(viewSchema, `SchemaView has no ${schemaName}`);
      assert.isDefined(document, `SchemaSet has no ${schemaName}`);

      for (const viewClass of viewSchema!.getClasses()) {
        // A View's properties are its own by definition on both sides, so there is nothing to align.
        if (viewClass.type === ClassType.View)
          continue;
        const documentClass = document!.getItem(viewClass.name);
        assert.isDefined(documentClass, `${schemaName}:${viewClass.name} is missing from the document`);
        if (!documentClass!.isClass())
          continue;

        classesCompared++;
        const fromView = viewClass.getProperties().map((p) => p.name);
        const fromDocument = documentClass.getExpandedProperties().map((p) => p.name);
        differences.push(...describeDifferences(`${schemaName}:${viewClass.name}`, fromView, fromDocument));

        // The declaring class is what says which declaration won, so an ordering match alone is not
        // enough - a wrong override resolves to the same name from the wrong class.
        for (const property of documentClass.getExpandedProperties()) {
          const viewProperty = viewClass.getProperties().find((p) => p.name.toLowerCase() === property.name.toLowerCase());
          if (viewProperty === undefined)
            continue;
          const viewOrigin = viewProperty.declaringClass?.name;
          if (viewOrigin !== undefined && viewOrigin !== property.declaringClass.name) {
            differences.push(
              `${schemaName}:${viewClass.name}.${property.name}: declared by ${viewOrigin} per SchemaView, by ${property.declaringClass.name} per SchemaDocument`,
            );
          }
        }
      }
    }

    assert.isAbove(classesCompared, 0, "nothing was compared");
    assert.deepEqual(differences, [], `${differences.length} differences across ${classesCompared} classes`);
  }

  it("agrees on every class of BisCore", async () => {
    await crossCheck(["BisCore"]);
  });

  it("agrees on a schema built to hit the awkward cases", async () => {
    // BisCore has no mixin extending another mixin and no class that reorders its overrides, which
    // are exactly the places the two walks could diverge.
    await iModel.importSchemaStrings([`<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="ExpansionTest" alias="et" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
      <ECEntityClass typeName="Base" modifier="Abstract">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECProperty propertyName="Alpha" typeName="string"/>
        <ECProperty propertyName="Beta" typeName="string"/>
        <ECProperty propertyName="Gamma" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="IBaseMixin" modifier="Abstract">
        <ECCustomAttributes>
          <IsMixin xmlns="CoreCustomAttributes.01.00.00">
            <AppliesToEntityClass>Base</AppliesToEntityClass>
          </IsMixin>
        </ECCustomAttributes>
        <ECProperty propertyName="Shared" typeName="string"/>
        <ECProperty propertyName="MixinOnly" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="IDerivedMixin" modifier="Abstract">
        <BaseClass>IBaseMixin</BaseClass>
        <ECCustomAttributes>
          <IsMixin xmlns="CoreCustomAttributes.01.00.00">
            <AppliesToEntityClass>Base</AppliesToEntityClass>
          </IsMixin>
        </ECCustomAttributes>
        <ECProperty propertyName="Shared" typeName="string" displayLabel="Overridden by the derived mixin"/>
      </ECEntityClass>
      <ECEntityClass typeName="Reordered">
        <BaseClass>Base</BaseClass>
        <BaseClass>IDerivedMixin</BaseClass>
        <ECProperty propertyName="Gamma" typeName="string" displayLabel="Reordered override"/>
        <ECProperty propertyName="Beta" typeName="string" displayLabel="Reordered override"/>
        <ECProperty propertyName="Alpha" typeName="string" displayLabel="Reordered override"/>
        <ECProperty propertyName="Own" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`]);

    await crossCheck(["ExpansionTest"]);
  });
});
