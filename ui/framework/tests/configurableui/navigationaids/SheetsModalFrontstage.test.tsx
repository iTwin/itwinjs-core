/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import TestUtils from "../../TestUtils";
import * as moq from "typemoq";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { SheetsModalFrontstage, CardContainer, CardInfo, SheetCard } from "../../../src/configurableui/navigationaids/SheetsModalFrontstage";
import { SheetData } from "../../../src/configurableui/navigationaids/SheetNavigationAid";
import { expect } from "chai";
import * as sinon from "sinon";

describe("SheetsModalFrontstage", () => {

  let modal: SheetsModalFrontstage;
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  const connection = moq.Mock.ofType<IModelConnection>();
  describe("SheetModalFrontstage", () => {
    it("constructs correctly", () => {
      modal = new SheetsModalFrontstage(new Array<SheetData>({
        name: "Name",
        viewId: "viewId",
      }), connection.object, 0);
    });

    it("contains readable content", () => {
      const content = modal.content;
      expect(content).to.not.be.null;
    });

    it("contains app bar content", () => {
      const content = modal.appBarRight;
      expect(content).to.not.be.null;
    });
  });

  describe("CardContainer", () => {
    it("renders correctly", () => {
      shallow(<CardContainer
        cards={new Array<CardInfo>({ index: 0, label: "", iconClass: "", viewId: "", isActive: false })}
        searchValue={"Test"}
        connection={connection.object} />);

      shallow(<CardContainer
        cards={new Array<CardInfo>({ index: 0, label: "Test", iconClass: "", viewId: "", isActive: false })}
        searchValue={""}
        connection={connection.object} />);

      shallow(<CardContainer
        cards={new Array<CardInfo>({ index: 0, label: "Test", iconClass: "", viewId: "", isActive: false })}
        searchValue={"Testing"}
        connection={connection.object} />);

      shallow(<CardContainer
        cards={new Array<CardInfo>({ index: 0, label: "Testing", iconClass: "", viewId: "", isActive: false })}
        searchValue={"Test"}
        connection={connection.object} />);
    });
  });

  describe("SheetCard", () => {
    it("handles card selection", () => {
      const onClick = sinon.spy();
      const card = shallow(<SheetCard label="" iconClass="" onClick={onClick} isActive={false} index={0} />);
      card.simulate("click");
      expect(onClick.called).to.be.true;
    });
  });
});
