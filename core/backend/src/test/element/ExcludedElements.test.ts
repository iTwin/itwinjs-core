/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { BisCodeSpec, DisplayStyleProps, IModel, QueryBinder, QueryRowFormat } from "@itwin/core-common";
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
      for await (const row of imodel.query("SELECT jsonProperties FROM bis.Element WHERE ECInstanceId=?", QueryBinder.from([styleId]), QueryRowFormat.UseJsPropertyNames))
        rows.push(row);

      expect(rows.length).to.equal(1);
      const json = JSON.parse(rows[0].jsonProperties);
      expect(json.styles.excludedElements).to.equal(excludedElements);

      const getStyle = (compressExcludedElementIds?: boolean) => {
        const loadProps = { id: styleId, displayStyle: { compressExcludedElementIds } };
        return imodel.elements.getElementJson<DisplayStyle3d>(loadProps);
      };

      // Unless compressed Ids explicitly requested, the Ids are always decompressed regardless of how they are stored.
      // This is to preserve compatibility with older front-ends that don't understand the compressed Ids; it's an unfortunate default.
      // ###TODO change the default in iModel.js 3.0.
      expect(getStyle().jsonProperties.styles.excludedElements).to.deep.equal(excludedElementIds);
      expect(getStyle(false).jsonProperties.styles.excludedElements).to.deep.equal(excludedElementIds);
      expect(getStyle(true).jsonProperties.styles.excludedElements).to.equal(excludedElements);
    };

    await test(true);
    await test(false);
  });
});
