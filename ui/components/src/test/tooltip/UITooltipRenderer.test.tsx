/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as faker from "faker";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { PropertyRecord } from "@bentley/ui-abstract";
import { IElementPropertyDataProvider, PropertyCategory, PropertyData } from "../../ui-components";
import { UITooltipRenderer } from "../../ui-components/tooltip/UITooltipRenderer";
import TestUtils from "../TestUtils";

describe("UITooltipRenderer", () => {

  let dataProvider: IElementPropertyDataProvider;
  let renderer: UITooltipRenderer;
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    const categories: PropertyCategory[] = [
      { name: "Favorite", label: "Group 1", expand: true },
    ];
    const records: PropertyRecord[] = [
      TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
      TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
    ];

    dataProvider = {
      getData: async (): Promise<PropertyData> => ({
        label: PropertyRecord.fromString(faker.random.word()),
        description: faker.random.words(),
        categories,
        records: {
          Favorite: records,
        },
      }),
    };

    renderer = new UITooltipRenderer(dataProvider);
  });

  describe("renderTooltip", () => {

    it("should render a tooltip", async () => {
      const getDataStub = sinon.spy(dataProvider, "getData");
      const tooltip = await renderer.renderTooltip(imodelMock.object, "element id");
      expect(tooltip).to.not.be.null;
      expect(getDataStub.calledOnce).to.be.true;
    });

  });

});
