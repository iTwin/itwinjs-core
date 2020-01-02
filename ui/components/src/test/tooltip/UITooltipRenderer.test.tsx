/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as faker from "faker";
import * as moq from "typemoq";
import * as sinon from "sinon";
import { PropertyRecord, IModelConnection } from "@bentley/imodeljs-frontend";
import { PropertyCategory, IElementPropertyDataProvider, PropertyData } from "../../ui-components";
import TestUtils from "../TestUtils";
import { UITooltipRenderer } from "../../ui-components/tooltip/UITooltipRenderer";

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
        label: faker.random.word(),
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
