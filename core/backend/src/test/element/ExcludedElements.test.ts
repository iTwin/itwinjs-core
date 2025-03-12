/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { BisCodeSpec, DisplayStyle3dProps, DisplayStyleProps, IModel, QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { DisplayStyle3d, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

// spell-checker: disable

describe("ExcludedElements", () => {
  let imodel: SnapshotDb;

  before(() => {
    imodel = IModelTestUtils.createSnapshotFromSeed(IModelTestUtils.prepareOutputFile("IModel", "test.bim"), IModelTestUtils.resolveAssetFile("test.bim"));
  });

  after(() => {
    imodel.close();
  });

  it("should persist as a string and return as requested type", async () => {
    const test = async (compressed: boolean) => {
      const excludedElements = "+123";
      const excludedElementIds = ["0x123"];
      const props: DisplayStyleProps = {
        classFullName: DisplayStyle3d.classFullName,
        model: IModel.dictionaryId,
        code: { spec: BisCodeSpec.displayStyle, scope: IModel.dictionaryId },
        isPrivate: false,
        jsonProperties: {
          styles: {
            excludedElements: compressed ? excludedElements : excludedElementIds,
          },
        },
      };

      const styleId = imodel.elements.insertElement(props);
      expect(styleId).not.to.equal(Id64.invalid);
      imodel.saveChanges();

      const rows: any[] = [];
      for await (const queryRow of imodel.createQueryReader("SELECT jsonProperties FROM bis.Element WHERE ECInstanceId=?", QueryBinder.from([styleId]), { rowFormat: QueryRowFormat.UseJsPropertyNames }))
        rows.push(queryRow.toRow());

      expect(rows.length).to.equal(1);
      const json = JSON.parse(rows[0].jsonProperties);
      expect(json.styles.excludedElements).to.equal(excludedElements);

      const getStyle = (compressExcludedElementIds?: boolean) => {
        const loadProps = { id: styleId, displayStyle: { compressExcludedElementIds } };
        return imodel.elements.getElement<DisplayStyle3d>(loadProps);
      };

      // Unless compressed Ids explicitly requested, the Ids are always decompressed regardless of how they are stored.
      // This is to preserve compatibility with older front-ends that don't understand the compressed Ids; it's an unfortunate default.
      expect(getStyle().jsonProperties.styles.excludedElements).to.deep.equal(excludedElementIds);
      expect(getStyle(false).jsonProperties.styles.excludedElements).to.deep.equal(excludedElementIds);
      expect(getStyle(true).jsonProperties.styles.excludedElements).to.equal(excludedElements);
    };

    await test(true);
    await test(false);
  });

  it("should exclude script element ids if requested", async () => {
    const styleHasNonEmptyElementIds = (styleProps: DisplayStyleProps) => {
      expect(styleProps.jsonProperties).not.to.be.undefined;
      expect(styleProps.jsonProperties!.styles).not.to.be.undefined;
      const script = styleProps.jsonProperties!.styles!.scheduleScript!;
      expect(script).not.to.be.undefined;

      expect(script.length).least(1);
      let numElementIdProps = 0;
      let numNonEmptyElementIdProps = 0;
      for (const modelTimeline of script) {
        expect(modelTimeline.elementTimelines.length).least(1);
        for (const elementTimeline of modelTimeline.elementTimelines) {
          expect(elementTimeline.elementIds).not.to.be.undefined;
          ++numElementIdProps;
          if (0 < elementTimeline.elementIds.length)
            ++numNonEmptyElementIdProps;
        }
      }

      expect(numElementIdProps).least(1);
      return numNonEmptyElementIdProps > 0;
    };

    const props: DisplayStyleProps = {
      classFullName: DisplayStyle3d.classFullName,
      model: IModel.dictionaryId,
      code: { spec: BisCodeSpec.displayStyle, scope: IModel.dictionaryId },
      isPrivate: false,
      jsonProperties: {
        styles: {
          scheduleScript: [{
            modelId: "0xadf",
            realityModelUrl: "askjeeves.com",
            elementTimelines: [{
              batchId: 54,
              elementIds: ["0x1", "0x2", "0x3", "0x4"],
            }],
          }],
        },
      },
    };

    const styleId = imodel.elements.insertElement(props);
    expect(styleId).not.to.equal(Id64.invalid);
    imodel.saveChanges();

    let elementProps = imodel.elements.getElementProps<DisplayStyle3dProps>({ id: styleId});
    expect(styleHasNonEmptyElementIds(elementProps)).to.be.true;

    elementProps = imodel.elements.getElementProps<DisplayStyle3dProps>({ id: styleId, displayStyle: { omitScheduleScriptElementIds: false }});
    expect(styleHasNonEmptyElementIds(elementProps)).to.be.true;

    elementProps = imodel.elements.getElementProps<DisplayStyle3dProps>({ id: styleId, displayStyle: { omitScheduleScriptElementIds: true }});
    expect(styleHasNonEmptyElementIds(elementProps)).to.be.false;
  });
});
