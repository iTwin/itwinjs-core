/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64String } from "@itwin/core-bentley";
import {
  ElementDrivesTextAnnotation, FieldFormattingSpecProvider, IModelDb, PhysicalModel, SpatialCategory, StandaloneDb,
  TextAnnotation2d, withEditTxn,
} from "@itwin/core-backend";
import { Code, FieldRun, PhysicalElementProps, SubCategoryAppearance, TextBlock } from "@itwin/core-common";
import { FormatDefinition } from "@itwin/core-quantity";
import { FormatSet } from "@itwin/ecschema-metadata";
import { IModelTestUtils } from "./IModelTestUtils";

/** A minimal schema declaring a KindOfQuantity persisted in meters, and an element that uses it. */
const snippetsSchemaXml = `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="Snippets" alias="snip" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
  <ECSchemaReference name="Formats" version="01.00.00" alias="f"/>
  <ECSchemaReference name="Units" version="01.00.09" alias="u"/>

  <KindOfQuantity typeName="LENGTH" displayLabel="Length" persistenceUnit="u:M" relativeError="0.0001" presentationUnits="f:DefaultRealU(4)[u:M]"/>

  <ECEntityClass typeName="Widget" modifier="None">
    <BaseClass>bis:PhysicalElement</BaseClass>
    <ECProperty propertyName="length" typeName="double" kindOfQuantity="LENGTH"/>
  </ECEntityClass>
</ECSchema>`;

/** Renders a magnitude in `unitName`, labelled `unitLabel`. */
function decimalFormat(unitName: string, unitLabel: string, precision = 2): FormatDefinition {
  return {
    composite: { includeZero: true, units: [{ label: unitLabel, name: unitName }] },
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision,
    type: "Decimal",
    uomSeparator: " ",
  };
}

function formatSetOf(name: string, formats: Record<string, FormatDefinition>): FormatSet {
  return { name, label: name, unitSystem: "metric", formats };
}

describe("Text annotation field formatting", () => {
  let iModel: StandaloneDb;
  let elementId: Id64String;

  /** Formats Snippets.LENGTH in millimeters, so the 2.5 m widget renders as "2500 mm". */
  const millimeterFormatSet = formatSetOf("Millimeters", { "Snippets.LENGTH": decimalFormat("Units.MM", "mm") });

  before(async () => {
    iModel = StandaloneDb.createEmpty(IModelTestUtils.prepareOutputFile("TextAnnotationFields.bim"), {
      rootSubject: { name: "TextAnnotationFields" },
      enableTransactions: true,
    });

    await iModel.importSchemaStrings([snippetsSchemaXml]);

    withEditTxn(iModel, (txn) => {
      const modelId = PhysicalModel.insert(txn, IModelDb.rootSubjectId, "WidgetModel");
      const categoryId = SpatialCategory.insert(txn, IModelDb.dictionaryId, "WidgetCategory", new SubCategoryAppearance());

      // A widget 2.5 meters long. Every example below formats this value.
      const props: PhysicalElementProps & { length: number } = {
        classFullName: "Snippets:Widget",
        model: modelId,
        category: categoryId,
        code: Code.createEmpty(),
        length: 2.5,
      };
      elementId = txn.insertElement(props);
    });
  });

  after(() => {
    ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(iModel);
    iModel.close();
  });

  afterEach(() => {
    ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(iModel);
  });

  it("formats a field from an adopted FormatSet", async () => {
    // __PUBLISH_EXTRACT_START__ TextAnnotationFields.HappyPath
    // The `Snippets.LENGTH` KindOfQuantity persists its values in meters. This FormatSet
    // presents that KindOfQuantity in millimeters instead.
    const formatSet: FormatSet = {
      name: "Millimeters",
      label: "Millimeters",
      unitSystem: "metric",
      formats: {
        "Snippets.LENGTH": {
          type: "Decimal",
          precision: 2,
          formatTraits: ["keepSingleZero", "showUnitLabel"],
          uomSeparator: " ",
          composite: { includeZero: true, units: [{ name: "Units.MM", label: "mm" }] },
        },
      },
    };

    // Adopt it for the iModel. Registration is asynchronous because it pre-warms a
    // FormatterSpec for every requirement it is given, so evaluation itself needs no `await`.
    await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
      iModel,
      formatSet,
      requirements: FieldFormattingSpecProvider.collectSchemaFormattingRequirements(iModel),
    });
    iModel.onBeforeClose.addOnce(() => ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(iModel));

    // A field displaying the `length` property of a widget that is 2.5 meters long.
    const fieldRun = FieldRun.create({
      propertyHost: { elementId, schemaName: "Snippets", className: "Widget" },
      propertyPath: { propertyName: "length" },
    });

    const block = TextBlock.create();
    block.appendRun(fieldRun);

    // Evaluation updates the cached content of every field in the block, in memory.
    ElementDrivesTextAnnotation.evaluateFields({ iModel, block });

    const formattedContent = fieldRun.cachedContent; // "2500 mm"
    // __PUBLISH_EXTRACT_END__

    expect(formattedContent).to.equal("2500 mm");
  });

  /** Builds a block containing a single field targeting the widget's `length` property. */
  function blockWithLengthField(formatSetId?: string): { block: TextBlock, field: FieldRun } {
    // __PUBLISH_EXTRACT_START__ TextAnnotationFields.ConfigureFieldRun
    const fieldRun = FieldRun.create({
      propertyHost: { elementId, schemaName: "Snippets", className: "Widget" },
      propertyPath: { propertyName: "length" },
      formatOptions: {
        quantity: {
          // Look up a specific KindOfQuantity via the active FormatsProvider,
          // overriding the property's own KoQ.
          kindOfQuantity: "Snippets.LENGTH",
          // Optionally scope resolution to a specific registered FormatSet.
          formatSet: formatSetId,
        },
      },
    });
    // __PUBLISH_EXTRACT_END__

    const block = TextBlock.create();
    block.appendRun(fieldRun);
    return { block, field: fieldRun };
  }

  it("adopts a FormatSet when the iModel opens", async () => {
    const formatSet = millimeterFormatSet;

    // __PUBLISH_EXTRACT_START__ TextAnnotationFields.AdoptFormatSet
    const provider = await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
      iModel,
      formatSet,
      requirements: FieldFormattingSpecProvider.collectSchemaFormattingRequirements(iModel),
    });
    iModel.onBeforeClose.addOnce(() => ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(iModel));
    // __PUBLISH_EXTRACT_END__

    expect(provider).not.to.be.undefined;

    const { block, field } = blockWithLengthField();

    // __PUBLISH_EXTRACT_START__ TextAnnotationFields.EvaluateFields
    const numUpdated = ElementDrivesTextAnnotation.evaluateFields({ iModel, block });
    // __PUBLISH_EXTRACT_END__

    expect(numUpdated).to.equal(1);
    expect(field.cachedContent).to.equal("2500 mm");
  });

  it("finds annotations whose fields override the property's units", async () => {
    // __PUBLISH_EXTRACT_START__ TextAnnotationFields.QueryOverridingAnnotations
    // Pass 1: the two built-in classes carry TextAnnotationData, so the substring test runs inside
    // SQLite and non-overriding annotations never reach JavaScript.
    const sql = `
      SELECT ECInstanceId FROM BisCore.TextAnnotation2d
        WHERE TextAnnotationData LIKE '%"kindOfQuantity"%' OR TextAnnotationData LIKE '%"persistenceUnit"%'
      UNION ALL
      SELECT ECInstanceId FROM BisCore.TextAnnotation3d
        WHERE TextAnnotationData LIKE '%"kindOfQuantity"%' OR TextAnnotationData LIKE '%"persistenceUnit"%'`;
    // __PUBLISH_EXTRACT_END__

    const ids: Id64String[] = [];
    for await (const row of iModel.createQueryReader(sql))
      ids.push(row[0] as Id64String);

    // __PUBLISH_EXTRACT_START__ TextAnnotationFields.CollectBlockRequirements
    const requirements = ids.flatMap((id) =>
      [...iModel.elements.getElement<TextAnnotation2d>(id).getTextBlocks()].flatMap((b) =>
        ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block: b.textBlock })));
    // __PUBLISH_EXTRACT_END__

    // This iModel has no annotations yet, so the query is simply proven to be valid ECSQL.
    expect(requirements).to.deep.equal([]);
  });

  it("warms a block authored later in the session", async () => {
    const provider = await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
      iModel,
      formatSet: millimeterFormatSet,
      requirements: [],
    });

    const { block, field } = blockWithLengthField();

    // __PUBLISH_EXTRACT_START__ TextAnnotationFields.WarmBeforeWrite
    await provider.warmUp(ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel, block }));
    // __PUBLISH_EXTRACT_END__

    ElementDrivesTextAnnotation.evaluateFields({ iModel, block });
    expect(field.cachedContent).to.equal("2500 mm");
  });

  it("mixes formats within one iModel", async () => {
    // __PUBLISH_EXTRACT_START__ TextAnnotationFields.MultipleFormatSets
    // A second FormatSet presenting the same KindOfQuantity in feet, registered under an
    // application-chosen id that fields reference to opt into it.
    const imperialFormatSetId = "0x1000";
    const imperialFormatSet: FormatSet = {
      name: "Imperial",
      label: "Imperial",
      unitSystem: "imperial",
      formats: {
        "Snippets.LENGTH": {
          type: "Decimal",
          precision: 2,
          formatTraits: ["keepSingleZero", "showUnitLabel"],
          uomSeparator: " ",
          composite: { includeZero: true, units: [{ name: "Units.FT", label: "ft" }] },
        },
      },
    };

    await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
      iModel,
      formatSet: millimeterFormatSet,                 // applies to every field that names no other
      formatSets: [{ id: imperialFormatSetId, formatSet: imperialFormatSet }],
      requirements: FieldFormattingSpecProvider.collectSchemaFormattingRequirements(iModel),
    });

    // A field opts into the imperial set by naming its id.
    const imperialField = FieldRun.create({
      propertyHost: { elementId, schemaName: "Snippets", className: "Widget" },
      propertyPath: { propertyName: "length" },
      formatOptions: { quantity: { formatSet: imperialFormatSetId } },
    });

    const block = TextBlock.create();
    block.appendRun(imperialField);
    ElementDrivesTextAnnotation.evaluateFields({ iModel, block });

    const imperialContent = imperialField.cachedContent; // "8.2 ft"
    // __PUBLISH_EXTRACT_END__

    expect(imperialContent).to.equal("8.2 ft");

    // A field naming no FormatSet still renders through the adopted one.
    const metric = blockWithLengthField();
    ElementDrivesTextAnnotation.evaluateFields({ iModel, block: metric.block });
    expect(metric.field.cachedContent).to.equal("2500 mm");
  });

  it("detects and repairs a warm-up gap", async () => {
    // Registered with no requirements, so the first evaluation cannot resolve a spec.
    const provider = await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
      iModel,
      formatSet: millimeterFormatSet,
      requirements: [],
    });

    const { block, field } = blockWithLengthField();
    ElementDrivesTextAnnotation.evaluateFields({ iModel, block });

    // The field rendered raw, and the shortfall was recorded.
    expect(field.cachedContent).to.equal("2.5");
    expect(provider.misses.length).to.be.greaterThan(0);

    // __PUBLISH_EXTRACT_START__ TextAnnotationFields.HandleMisses
    if (provider.misses.length > 0) {
      await provider.warmUp(provider.misses);
      provider.clearMisses();
      ElementDrivesTextAnnotation.evaluateFields({ iModel, block });
    }
    // __PUBLISH_EXTRACT_END__

    expect(field.cachedContent).to.equal("2500 mm");
    expect(provider.misses).to.deep.equal([]);
  });
});
