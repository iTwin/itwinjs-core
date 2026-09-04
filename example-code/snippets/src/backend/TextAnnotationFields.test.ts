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
  /** Formats the same KindOfQuantity in feet, for the multi-FormatSet example. */
  const imperialFormatSet = formatSetOf("Imperial", { "Snippets.LENGTH": decimalFormat("Units.FT", "ft") });

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
    const formatSet = millimeterFormatSet;
    const imperialFormatSetId = "0x1000";

    // __PUBLISH_EXTRACT_START__ TextAnnotationFields.MultipleFormatSets
    await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
      iModel,
      formatSet,                                      // applies to every field that names no other
      formatSets: [{ id: imperialFormatSetId, formatSet: imperialFormatSet }],
      requirements: FieldFormattingSpecProvider.collectSchemaFormattingRequirements(iModel),
    });
    // __PUBLISH_EXTRACT_END__

    const metric = blockWithLengthField();
    ElementDrivesTextAnnotation.evaluateFields({ iModel, block: metric.block });
    expect(metric.field.cachedContent).to.equal("2500 mm");

    const imperial = blockWithLengthField(imperialFormatSetId);
    ElementDrivesTextAnnotation.evaluateFields({ iModel, block: imperial.block });
    expect(imperial.field.cachedContent).to.equal("8.2 ft");
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
