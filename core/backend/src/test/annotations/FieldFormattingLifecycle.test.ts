/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Code, FieldRun, PhysicalElementProps, SubCategoryAppearance, TextAnnotation, TextBlock, traverseTextBlockComponent } from "@itwin/core-common";
import { FormatDefinition } from "@itwin/core-quantity";
import { DbResult, Id64String, UnexpectedErrors } from "@itwin/core-bentley";
import { Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { StandaloneDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { SpatialCategory } from "../../Category";
import { Schema, Schemas } from "../../Schema";
import { ClassRegistry } from "../../ClassRegistry";
import { PhysicalElement } from "../../Element";
import { FontFile, TextAnnotation3d } from "../../core-backend";
import { ElementDrivesTextAnnotation, TextAnnotationUsesTextStyleByDefault } from "../../annotations/ElementDrivesTextAnnotation";
import { decimalFormat, toFormatSet } from "../AnnotationTestUtils";
import { withEditTxn } from "../../EditTxn";

/**
 * The lifecycle of [[ElementDrivesTextAnnotation.registerFieldFormatting]] and the persistence
 * contract of [[ElementDrivesTextAnnotation.evaluateFields]]: when the change event fires, what a
 * registration does (and does not do) to already-persisted `cachedContent`, and which code paths
 * consult the registered FormatSets.
 *
 * Which format a given field resolves to is covered exhaustively by FieldFormat.test.ts; nothing
 * here varies `kindOfQuantity` or `persistenceUnit`. The registration-level `unitSystem` argument
 * is covered here because it is part of the registration contract rather than the per-field one.
 */

const lifecycleSchemaXml = `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="FieldLifecycle" alias="flc" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
  <ECSchemaReference name="Formats" version="01.00.00" alias="f"/>
  <ECSchemaReference name="Units" version="01.00.09" alias="u"/>

  <KindOfQuantity typeName="LENGTH" displayLabel="Length" persistenceUnit="u:M" relativeError="0.0001" presentationUnits="f:DefaultRealU(4)[u:M]"/>
  <KindOfQuantity typeName="DUAL_LENGTH" displayLabel="Dual Length" persistenceUnit="u:M" relativeError="0.0001" presentationUnits="f:DefaultRealU(4)[u:M];f:DefaultRealU(4)[u:FT]"/>

  <ECEntityClass typeName="LifecycleElement" modifier="None">
    <BaseClass>bis:PhysicalElement</BaseClass>
    <ECProperty propertyName="lengthProp" typeName="double" kindOfQuantity="LENGTH"/>
    <ECProperty propertyName="dualLengthProp" typeName="double" kindOfQuantity="DUAL_LENGTH"/>
    <ECProperty propertyName="maybeNull" typeName="double"/>
    <ECArrayProperty propertyName="strings" typeName="string"/>
  </ECEntityClass>
</ECSchema>
`;

interface LifecycleElementProps extends PhysicalElementProps {
  lengthProp: number;
  dualLengthProp: number;
  maybeNull?: number;
  strings: string[];
}

class LifecycleElement extends PhysicalElement {
  public static override get className() { return "LifecycleElement"; }
  declare public lengthProp: number;
  declare public dualLengthProp: number;
  declare public maybeNull?: number;
  declare public strings: string[];
}

class FieldLifecycleSchema extends Schema {
  public static override get schemaName() { return "FieldLifecycle"; }
}

describe("Field formatting lifecycle", () => {
  let imodel: StandaloneDb;
  let model: Id64String;
  let category: Id64String;
  let sourceElementId: Id64String;

  const propertyHost = (elementId: Id64String) => ({ elementId, schemaName: "FieldLifecycle", className: "LifecycleElement" });

  // Id referenced by fields via formatOptions.quantity.formatSet and supplied through the
  // `formatSets` array at registration time.
  const PRIMARY_FORMAT_SET = "0x111";

  before(async () => {
    const iModelPath = IModelTestUtils.prepareOutputFile("FieldFormattingLifecycle", "test.bim");
    imodel = StandaloneDb.createEmpty(iModelPath, { rootSubject: { name: "FieldFormattingLifecycle" }, enableTransactions: true });

    if (!Schemas.getRegisteredSchema("FieldLifecycle")) {
      Schemas.registerSchema(FieldLifecycleSchema);
      ClassRegistry.register(LifecycleElement, FieldLifecycleSchema);
    }
    await imodel.importSchemaStrings([lifecycleSchemaXml]);

    await withEditTxn(imodel, async (txn) => {
      model = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, Code.createEmpty(), true)[1];
      category = SpatialCategory.insert(txn, StandaloneDb.dictionaryId, "FieldFormattingLifecycleCategory", new SubCategoryAppearance());
      await imodel.fonts.embedFontFile({
        file: FontFile.createFromTrueTypeFileName(IModelTestUtils.resolveFontFile("Karla-Regular.ttf")),
      });
      sourceElementId = txn.insertElement(sourceElementProps());
    });
  });

  after(() => {
    imodel.close();
  });

  afterEach(() => {
    ElementDrivesTextAnnotation.registerFieldFormatting({ iModel: imodel });
    // Drop the annotations inserted below so their ElementDrivesTextAnnotation relationships do
    // not leak into the next test.
    const ids: Id64String[] = [];
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    imodel.withPreparedStatement("SELECT ECInstanceId FROM BisCore.TextAnnotation3d", (stmt) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW)
        ids.push(stmt.getValue(0).getId());
    });
    if (ids.length > 0)
      withEditTxn(imodel, (txn) => { for (const id of ids) txn.deleteElement(id); });
  });

  function sourceElementProps(): LifecycleElementProps {
    return {
      classFullName: "FieldLifecycle:LifecycleElement",
      model,
      category,
      code: Code.createEmpty(),
      lengthProp: 2.5,
      dualLengthProp: 2.5,
      strings: ["a", "b"],
      placement: { origin: new Point3d(0, 0, 0), angles: new YawPitchRollAngles() },
    };
  }

  // Configures `imodel` with the given per-field FormatSets.
  function registerSets(formatSets: ReadonlyArray<{ id: string, formats: Record<string, FormatDefinition> }>): void {
    ElementDrivesTextAnnotation.registerFieldFormatting({
      iModel: imodel,
      formatSets: formatSets.map(({ id, formats }) => ({ id, formatSet: toFormatSet("TestSet", formats) })),
    });
  }

  // A mm FormatSet: 2.5 m -> "2500 mm".
  function mmSet(): Record<string, FormatDefinition> {
    return { "FieldLifecycle.LENGTH": decimalFormat("Units.MM", "mm", 2) };
  }

  function readFieldCachedContent(block: TextBlock): string | undefined {
    for (const { child } of traverseTextBlockComponent(block)) {
      if (child.type === "field")
        return child.cachedContent;
    }
    return undefined;
  }

  function readFieldCachedContentById(annotationElementId: Id64String): string | undefined {
    const reloaded = imodel.elements.getElement<TextAnnotation3d>(annotationElementId);
    const reloadedBlock = reloaded.getAnnotation()?.textBlock;
    return reloadedBlock ? readFieldCachedContent(reloadedBlock) : undefined;
  }

  function insertAnnotationElement(textBlock: TextBlock): Id64String {
    const elem = TextAnnotation3d.fromJSON({
      model,
      category,
      code: Code.createEmpty(),
      placement: {
        origin: { x: 0, y: 0, z: 0 },
        angles: YawPitchRollAngles.createDegrees(0, 0, 0).toJSON(),
      },
      classFullName: TextAnnotation3d.classFullName,
      defaultTextStyle: new TextAnnotationUsesTextStyleByDefault("0x123").toJSON(),
    }, imodel);
    elem.setAnnotation(TextAnnotation.fromJSON({ textBlock: textBlock.toJSON() }));
    return withEditTxn(imodel, (txn) => txn.insertElement(elem.toJSON()));
  }

  /** Inserts an annotation whose single field reads `lengthProp` of `sourceId` through
   * `PRIMARY_FORMAT_SET`, and wires up its dependency so txn callbacks evaluate it.
   */
  function insertAnnotationWithLengthField(sourceId: Id64String, formatSet: string | undefined = PRIMARY_FORMAT_SET): Id64String {
    const textBlock = TextBlock.create();
    const field = FieldRun.create({
      styleOverrides: { font: { name: "Karla" } },
      propertyHost: propertyHost(sourceId),
      propertyPath: { propertyName: "lengthProp" },
      formatOptions: formatSet ? { quantity: { formatSet } } : undefined,
      cachedContent: "old",
    });
    textBlock.appendRun(field);
    const annotationElementId = insertAnnotationElement(textBlock);
    withEditTxn(imodel, (txn) => {
      ElementDrivesTextAnnotation.updateFieldDependencies(txn, annotationElementId);
    });
    return annotationElementId;
  }

  describe("evaluateFields", () => {
    it("preserves non-quantity field formatting", () => {
      const textBlock = TextBlock.create();
      const stringField = FieldRun.create({
        propertyHost: propertyHost(sourceElementId),
        propertyPath: { propertyName: "strings", accessors: [0] },
        formatOptions: { prefix: "[", suffix: "]" },
        cachedContent: "old",
      });
      textBlock.appendRun(stringField);

      registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);
      const updatedCount = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block: textBlock });

      expect(updatedCount).to.equal(1);
      expect(stringField.cachedContent).to.equal("[a]");
    });

    it("marks the field invalid when a quantity property value is missing", () => {
      const textBlock = TextBlock.create();
      const field = FieldRun.create({
        propertyHost: propertyHost(sourceElementId),
        // maybeNull has no value on the source element.
        propertyPath: { propertyName: "maybeNull" },
        formatOptions: { quantity: { persistenceUnit: "Units.M" } },
        cachedContent: "old",
      });
      textBlock.appendRun(field);

      const updatedCount = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block: textBlock });

      expect(updatedCount).to.equal(1);
      expect(field.cachedContent).to.equal(FieldRun.invalidContentIndicator);
    });

    it("mutates the in-memory TextBlock but does not persist to the element on its own", () => {
      // Contract: evaluateFields formats in place and returns a count. Persistence is the
      // caller's responsibility (setAnnotation + element.update inside an EditTxn).
      const annotationElementId = insertAnnotationWithLengthField(sourceElementId);
      const persistedBefore = readFieldCachedContentById(annotationElementId);
      expect(persistedBefore).to.equal("2.5 m");

      registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);

      const reloaded = imodel.elements.getElement<TextAnnotation3d>(annotationElementId);
      const inMemoryBlock = reloaded.getAnnotation()!.textBlock;

      const updated = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block: inMemoryBlock });

      // The in-memory half of the contract: the field resolved through the registered FormatSet
      // and the call reported the one field it changed.
      expect(updated).to.equal(1);
      expect(readFieldCachedContent(inMemoryBlock)).to.equal("2500 mm");

      // The persisted half: the disk copy is untouched, because nothing called `update`.
      expect(readFieldCachedContentById(annotationElementId)).to.equal(persistedBefore);
    });
  });

  describe("registerFieldFormatting", () => {
    it("raises onFieldFormattingChanged on every register call", () => {
      let events = 0;
      const drop = ElementDrivesTextAnnotation.onFieldFormattingChanged.addListener((args) => {
        expect(args.iModel).to.equal(imodel);
        ++events;
      });

      try {
        registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);
        // Re-registering the same configuration still reports.
        registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);
        // Reverting to the schema default is a register call too.
        ElementDrivesTextAnnotation.registerFieldFormatting({ iModel: imodel });

        expect(events).to.equal(3);
      } finally {
        drop();
      }
    });

    it("keeps the registration when a listener throws", () => {
      // BeEvent routes listener exceptions to UnexpectedErrors rather than to the caller.
      const unexpected: unknown[] = [];
      const previousHandler = UnexpectedErrors.setHandler((e) => unexpected.push(e));
      const drop = ElementDrivesTextAnnotation.onFieldFormattingChanged.addListener(() => {
        throw new Error("listener failure");
      });

      try {
        expect(() => registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }])).not.to.throw();
      } finally {
        drop();
        UnexpectedErrors.setHandler(previousHandler);
      }

      expect(unexpected.length).to.equal(1);
      const annotationElementId = insertAnnotationWithLengthField(sourceElementId);
      expect(readFieldCachedContentById(annotationElementId)).to.equal("2500 mm");
    });

    it("selects the KindOfQuantity's presentation format for the registered unitSystem", () => {
      // DUAL_LENGTH lists a metric and an imperial presentation format. The unit system chosen
      // at registration decides which one the schema provider hands back, and an explicit
      // `unitSystem` wins over the adopted FormatSet's own.
      // Persisted on the element: dualLengthProp 2.5 m
      const evaluate = () => {
        const block = TextBlock.create();
        const field = FieldRun.create({
          propertyHost: propertyHost(sourceElementId),
          propertyPath: { propertyName: "dualLengthProp" },
          cachedContent: "old",
        });
        block.appendRun(field);
        ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block });
        return field.cachedContent;
      };

      // Nothing registered: metric.
      expect(evaluate()).to.equal("2.5 m");

      // An explicit unit system alone.
      ElementDrivesTextAnnotation.registerFieldFormatting({ iModel: imodel, unitSystem: "imperial" });
      expect(evaluate()).to.equal("8.2021 ft");

      // An adopted metric FormatSet that does not define the key defers to the schema, using the
      // set's own system when none is given and the explicit one when it is.
      const metricSet = toFormatSet("Adopted", mmSet());
      ElementDrivesTextAnnotation.registerFieldFormatting({ iModel: imodel, formatSet: metricSet });
      expect(evaluate()).to.equal("2.5 m");
      ElementDrivesTextAnnotation.registerFieldFormatting({ iModel: imodel, formatSet: metricSet, unitSystem: "imperial" });
      expect(evaluate()).to.equal("8.2021 ft");
    });

    it("formats through the schema default on the txn callback path when nothing is registered", () => {
      const annotationElementId = insertAnnotationWithLengthField(sourceElementId, undefined);
      expect(readFieldCachedContentById(annotationElementId)).to.equal("2.5 m");
    });

    it("routes txn-driven field updates through the registered FormatSet", () => {
      registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);

      const annotationElementId = insertAnnotationWithLengthField(sourceElementId);

      expect(readFieldCachedContentById(annotationElementId)).to.equal("2500 mm");
    });

    it("documents the registration-lifecycle contract for persisted cachedContent", () => {
      // Deliberately one narrative test rather than one per step: this is documentation of an
      // accepted contract, not a bug under guard. The contract is that registering never walks
      // existing annotations, so persisted cachedContent changes only on the next source-element
      // edit -- which formats according to whatever happens to be registered at that moment.
      const sourceId = withEditTxn(imodel, (txn) => txn.insertElement(sourceElementProps()));

      // 1. Nothing registered: insert persists the schema's presentation format.
      const annotationElementId = insertAnnotationWithLengthField(sourceId);
      expect(readFieldCachedContentById(annotationElementId)).to.equal("2.5 m");

      // 2. Registering is not retroactive; persisted content is untouched.
      registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);
      expect(readFieldCachedContentById(annotationElementId)).to.equal("2.5 m");

      // 3. The next source edit fires the txn callback, which routes through the FormatSet.
      const source = imodel.elements.getElement<LifecycleElement>(sourceId);
      source.lengthProp = 4.25;
      withEditTxn(imodel, "source update", (txn) => {
        source.update(txn);
        txn.saveChanges("source update");
      });
      expect(readFieldCachedContentById(annotationElementId)).to.equal("4250 mm");

      // 4. Reverting to the schema default is likewise not retroactive...
      ElementDrivesTextAnnotation.registerFieldFormatting({ iModel: imodel });
      expect(readFieldCachedContentById(annotationElementId)).to.equal("4250 mm");

      // ...but the following edit falls back to the schema default and overwrites the FormatSet's
      // millimeters with the schema's meters. This is why registerFieldFormatting's docs tell
      // hosts to swap FormatSets with a single re-register rather than reverting first.
      const reloadedSource = imodel.elements.getElement<LifecycleElement>(sourceId);
      reloadedSource.lengthProp = 3.5;
      withEditTxn(imodel, "source update after revert", (txn) => {
        reloadedSource.update(txn);
        txn.saveChanges("source update after revert");
      });
      expect(readFieldCachedContentById(annotationElementId)).to.equal("3.5 m");
    });
  });
});
