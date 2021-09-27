/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon from "sinon";
import { FlatGridTestUtils } from "./flat-items/FlatGridTestUtils";
import { MutablePropertyGridModel } from "../../../../components-react/propertygrid/internal/PropertyGridModel";
import { PropertyGridEventHandler } from "../../../../components-react/propertygrid/internal/PropertyGridEventHandler";
import { PropertyGridModelChangeEvent } from "../../../../components-react/propertygrid/internal/PropertyGridModelChangeEvent";
import { PropertyGridModelSource } from "../../../../components-react/propertygrid/internal/PropertyGridModelSource";

describe("PropertyGridEventHandler", () => {
  describe("onExpansionToggledFactory", () => {
    let modelSourceStub: sinon.SinonStubbedInstance<PropertyGridModelSource>;
    let modelStub: sinon.SinonStubbedInstance<MutablePropertyGridModel>;

    beforeEach(() => {
      modelStub = sinon.createStubInstance(MutablePropertyGridModel);
      modelSourceStub = sinon.createStubInstance(PropertyGridModelSource, {
        modifyModel: sinon.stub<Parameters<PropertyGridModelSource["modifyModel"]>>().callsArgWith(0, modelStub),
      });
      modelSourceStub.onModelChanged = new PropertyGridModelChangeEvent();

    });

    it("Should return function which sets expansion to true when current expansion is false and updates model", () => {
      const eventHandler = new PropertyGridEventHandler(modelSourceStub);
      const isExpandedSpy = sinon.spy();

      const mockItem = FlatGridTestUtils.createMockCategorizedStruct("Struct");
      sinon.stub(mockItem, "isExpanded").get(() => false).set(isExpandedSpy);

      modelStub.getItem.returns(mockItem);

      const expectedSelectionKey = "SomeSelectionKey";
      eventHandler.onExpansionToggled(expectedSelectionKey);

      expect(modelStub.getItem.calledOnceWithExactly(expectedSelectionKey)).to.be.true;
      expect(isExpandedSpy.calledOnceWithExactly(true)).to.be.true;
    });
  });
});
