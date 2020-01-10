/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow, ReactWrapper } from "enzyme";
import * as moq from "typemoq";
import * as faker from "faker";
import sinon from "sinon";
import * as React from "react";
import ReactResizeDetector from "react-resize-detector";

import { Orientation } from "@bentley/ui-core";
import { PropertyCategoryBlock } from "../../../ui-components";
import { PropertyGrid, PropertyGridCategory } from "../../../ui-components/propertygrid/component/PropertyGrid";
import { IPropertyDataProvider, PropertyDataChangeEvent, PropertyCategory, PropertyData } from "../../../ui-components/propertygrid/PropertyDataProvider";
import { PropertyRecord, PropertyValueFormat } from "@bentley/imodeljs-frontend";
import { ResolvablePromise } from "../../test-helpers/misc";
import TestUtils from "../../TestUtils";

describe("PropertyGrid", () => {

  const categories: PropertyCategory[] = [
    { name: "Group_1", label: "Group 1", expand: true },
    { name: "Group_2", label: "Group 2", expand: false },
  ];
  const records: PropertyRecord[] = [
    TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8"),
    TestUtils.createPrimitiveStringProperty("CADID2", "0000 0005 00E0 02D8"),
  ];
  let dataProvider: IPropertyDataProvider;

  beforeEach(() => {
    const evt = new PropertyDataChangeEvent();
    dataProvider = {
      onDataChanged: evt,
      getData: async (): Promise<PropertyData> => ({
        label: faker.random.word(),
        description: faker.random.words(),
        categories,
        records: {
          Group_1: [records[0]],
          Group_2: [records[1]],
        },
      }),
    };
  });

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  describe("rendering", () => {

    it("renders correctly horizontally", async () => {
      const wrapper = mount(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} isOrientationFixed={true} />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      expect(wrapper.find(".components-property-list--horizontal").first().exists()).to.be.true;
    });

    it("renders correctly vertically", async () => {
      const wrapper = mount(<PropertyGrid orientation={Orientation.Vertical} dataProvider={dataProvider} isOrientationFixed={true} />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      expect(wrapper.find(".components-property-list--vertical").first().exists()).to.be.true;
    });

    it("renders PropertyCategoryBlocks correctly", async () => {
      const wrapper = mount(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      let categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "First category block does not exist").to.be.true;

      categoryBlock = wrapper.find(PropertyCategoryBlock).at(1);
      expect(categoryBlock.exists(), "Second category block does not exist").to.be.true;
    });

    it("if property record has links property set and onClick is not set, sets onClick property, otherwise not", async () => {
      const testMatcher = (_displayValue: string) => [];
      const testRecord = TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8");
      testRecord.links = {
        matcher: testMatcher,
      };
      dataProvider.getData = async (): Promise<PropertyData> => ({
        label: faker.random.word(),
        description: faker.random.words(),
        categories: [...categories],
        records: {
          Group_1: [testRecord],
          Group_2: [records[0]],
        },
      });
      const wrapper = mount(<PropertyGrid
        orientation={Orientation.Horizontal}
        dataProvider={dataProvider} />);

      await TestUtils.flushAsyncOperations();
      wrapper.update();

      expect(testRecord.links.matcher).to.be.equal(testMatcher);
      expect(testRecord.links.onClick).to.be.not.undefined;
      expect(records[0].links).to.be.undefined;
    });

    it("sets default onPropertyLinkClick event handler to records with link property if not passed with props", async () => {
      const testMatcher = (_displayValue: string) => [];
      const testNestedRecord1 = TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8");
      const testNestedRecord2 = TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8");
      // tslint:disable-next-line: object-literal-key-quotes
      const testStructRecord = TestUtils.createStructProperty("testStructRecord", { "testProperty": testNestedRecord2 });
      const testArrayRecord = TestUtils.createArrayProperty("testArrayRecord", [testNestedRecord1, testStructRecord]);
      testNestedRecord1.links = {
        matcher: testMatcher,
      };
      testNestedRecord2.links = {
        matcher: testMatcher,
      };
      testArrayRecord.links = {
        matcher: testMatcher,
      };

      dataProvider.getData = async (): Promise<PropertyData> => ({
        label: faker.random.word(),
        description: faker.random.words(),
        categories: [...categories],
        records: {
          Group_1: [testArrayRecord],
          Group_2: [records[0]],
        },
      });
      const wrapper = mount(<PropertyGrid
        orientation={Orientation.Horizontal}
        dataProvider={dataProvider} />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      expect(testArrayRecord.links!.onClick).to.be.not.undefined;
      expect(testNestedRecord1.links!.onClick).to.be.not.undefined;
      expect(testNestedRecord2.links!.onClick).to.be.not.undefined;
    });

    it("sets passed onPropertyLinkClick event handler to records with link property", async () => {
      const testMatcher = (_displayValue: string) => [];
      const testNestedRecord1 = TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8");
      const testNestedRecord2 = TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8");
      // tslint:disable-next-line: object-literal-key-quotes
      const testStructRecord = TestUtils.createStructProperty("testStructRecord", { "testProperty": testNestedRecord2 });
      const testArrayRecord = TestUtils.createArrayProperty("testArrayRecord", [testNestedRecord1, testStructRecord]);
      testNestedRecord1.links = {
        matcher: testMatcher,
      };
      testNestedRecord2.links = {
        matcher: testMatcher,
      };
      testStructRecord.links = {
        matcher: testMatcher,
      };

      dataProvider.getData = async (): Promise<PropertyData> => ({
        label: faker.random.word(),
        description: faker.random.words(),
        categories: [...categories],
        records: {
          Group_1: [testArrayRecord],
          Group_2: [records[0]],
        },
      });
      const propertyLinkClickFn = () => { };
      const wrapper = mount(<PropertyGrid
        orientation={Orientation.Horizontal}
        dataProvider={dataProvider}
        onPropertyLinkClick={propertyLinkClickFn} />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      expect(testNestedRecord1.links!.onClick).to.be.equal(propertyLinkClickFn);
      expect(testStructRecord.links!.onClick).to.be.equal(propertyLinkClickFn);
      expect(testNestedRecord2.links!.onClick).to.be.equal(propertyLinkClickFn);
    });

    describe("default onPropertyLinkClick behavior", () => {
      const locationMockRef: moq.IMock<Location> = moq.Mock.ofInstance(location);
      let testRecord: PropertyRecord;
      let wrapper: ReactWrapper<any, Readonly<{}>, React.Component<{}, {}, any>>;
      let spy: sinon.SinonStub<[(string | undefined)?, (string | undefined)?, (string | undefined)?, (boolean | undefined)?], Window | null>;

      before(() => {
        location = locationMockRef.object;
      });

      after(() => {
        locationMockRef.reset();
      });

      beforeEach(() => {
        const testMatcher = (_displayValue: string) => [];
        testRecord = TestUtils.createPrimitiveStringProperty("CADID1", "0000 0005 00E0 02D8");
        testRecord.links = {
          matcher: testMatcher,
        };
        dataProvider.getData = async (): Promise<PropertyData> => ({
          label: faker.random.word(),
          description: faker.random.words(),
          categories: [...categories],
          records: {
            Group_1: [testRecord],
            Group_2: [records[0]],
          },
        });
        wrapper = mount(<PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider} />);
      });

      afterEach(() => {
        spy.restore();
      });

      it("opens new window if the link text was found in record with no schema specified", async () => {
        await TestUtils.flushAsyncOperations();
        spy = sinon.stub(window, "open");
        spy.returns(moq.Mock.ofType<Window>().object);

        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "test display label with link www.testLink.com"), "www.testLink.com");
        expect(spy).to.be.calledOnceWith("http://www.testLink.com", "_blank");
      });

      it("opens new window if the link text was found in record with http schema", async () => {
        await TestUtils.flushAsyncOperations();
        spy = sinon.stub(window, "open");
        spy.returns(moq.Mock.ofType<Window>().object);

        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "test display label with link http://www.testLink.com"), "http://www.testLink.com");
        expect(spy).to.be.calledOnceWith("http://www.testLink.com", "_blank");
      });

      it("opens new window if the link text was found in record with https schema", async () => {
        await TestUtils.flushAsyncOperations();
        spy = sinon.stub(window, "open");
        spy.returns(moq.Mock.ofType<Window>().object);

        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "test display label with link https://www.testLink.com"), "https://www.testLink.com");
        expect(spy).to.be.calledOnceWith("https://www.testLink.com", "_blank");
      });

      it("does not open new window if there were no url links", async () => {
        await TestUtils.flushAsyncOperations();
        spy = sinon.stub(window, "open");
        spy.returns(moq.Mock.ofType<Window>().object);

        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "test display label with someLink@mail.com otherLink@mail.com"), "not an url link");
        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "test display label with someLink@mail.com otherLink@mail.com"), "testEmail@mail.com");
        sinon.assert.notCalled(spy);
      });

      it("sets location href value to value got in the text if it is an email link", async () => {
        await TestUtils.flushAsyncOperations();
        wrapper.update();

        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "test display label with testLink.com someLink@mail.com otherLink@mail.com"), "someOtherLink@mail.com");
        expect(locationMockRef.object.href).to.be.equal("mailto:someOtherLink@mail.com");
      });

      it("sets location href value to value got in the text if it is an ProjectWise Explorer link", async () => {
        await TestUtils.flushAsyncOperations();
        wrapper.update();

        // cSpell:disable
        testRecord.links!.onClick!(TestUtils.createPrimitiveStringProperty(
          "CADID1", "0000 0005 00E0 02D8",
          "pw://server.bentley.com:datasource-01/Documents/ProjectName"), "pw://server.bentley.com:datasource-01/Documents/ProjectName");
        expect(locationMockRef.object.href).to.be.equal("pw://server.bentley.com:datasource-01/Documents/ProjectName");
        // cSpell:enable
      });
    });

    it("renders PropertyCategoryBlock as collapsed when it gets clicked", async () => {
      const wrapper = mount(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      categoryBlock.find(".header").simulate("click");

      const isExpanded = (wrapper.state("categories") as PropertyGridCategory[])[0].propertyCategory.expand;
      expect(isExpanded, "Category did not get collapsed").to.be.false;
    });

    it("keeps the collapsed state of PropertyCategoryBlock when data is refreshed", async () => {
      const wrapper = mount(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />);
      await TestUtils.flushAsyncOperations();
      wrapper.update();

      const categoryBlock1 = wrapper.find(PropertyCategoryBlock).at(0);
      const categoryBlock2 = wrapper.find(PropertyCategoryBlock).at(1);
      expect(categoryBlock1.exists(), "First category block does not exist").to.be.true;
      expect(categoryBlock2.exists(), "Second category block does not exist").to.be.true;

      categoryBlock1.find(".header").simulate("click");
      categoryBlock2.find(".header").simulate("click");

      let isExpanded1 = (wrapper.state("categories") as PropertyGridCategory[])[0].propertyCategory.expand;
      let isExpanded2 = (wrapper.state("categories") as PropertyGridCategory[])[1].propertyCategory.expand;
      expect(isExpanded1, "First category did not get collapsed").to.be.false;
      expect(isExpanded2, "Second category did not get expanded").to.be.true;

      // Refresh PropertyGrid data.
      dataProvider.onDataChanged.raiseEvent();
      await TestUtils.flushAsyncOperations();

      isExpanded1 = (wrapper.state("categories") as PropertyGridCategory[])[0].propertyCategory.expand;
      isExpanded2 = (wrapper.state("categories") as PropertyGridCategory[])[1].propertyCategory.expand;
      expect(isExpanded1, "First category did not stay collapsed").to.be.false;
      expect(isExpanded2, "Second category did not stay expanded").to.be.true;
    });

    it("rerenders if data in the provider changes", async () => {
      const wrapper = mount(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />);

      dataProvider.getData = async (): Promise<PropertyData> => ({
        label: faker.random.word(),
        description: faker.random.words(),
        categories: [...categories, { name: "Group_3", label: "Group 3", expand: false }],
        records: {
          Group_1: [records[0]],
          Group_2: [records[1]],
          Group_3: [],
        },
      });
      dataProvider.onDataChanged.raiseEvent();

      await TestUtils.flushAsyncOperations();
      wrapper.update();

      const categoryBlocks = wrapper.find(PropertyCategoryBlock);
      expect(categoryBlocks.children().length).to.be.eq(3);
    });

    it("doesn't rerender on intermediate data changes", async () => {
      const data: PropertyData = {
        label: faker.random.word(),
        categories: [{ label: faker.random.word(), name: "test", expand: true }],
        records: {
          test: [
            new PropertyRecord(
              { valueFormat: PropertyValueFormat.Primitive, displayValue: faker.random.word() },
              { typename: faker.database.type(), name: faker.random.word(), displayLabel: faker.random.word() }),
          ],
        },
      };
      const dataPromise = new ResolvablePromise<PropertyData>();
      const dataFake = sinon.fake.returns(dataPromise);
      dataProvider.getData = dataFake;

      // first render
      shallow(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={dataProvider} />);
      expect(dataFake).to.be.calledOnce;

      // simulate multiple onDataChanged calls
      for (let i = 1; i <= 10; ++i)
        dataProvider.onDataChanged.raiseEvent();

      // resolve the data promise
      await dataPromise.resolve(data);

      // expect data to be requested one more time for the last change,
      // but not for intermediate ones
      expect(dataFake).to.be.calledTwice;
    });

    it("changes orientation when props change", async () => {
      const propertyGridMount = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isOrientationFixed={true}
        />);

      await TestUtils.flushAsyncOperations();
      propertyGridMount.update();

      expect(propertyGridMount.state("orientation")).to.be.eq(Orientation.Horizontal);

      propertyGridMount.setProps({ orientation: Orientation.Vertical });

      expect(propertyGridMount.state("orientation")).to.be.eq(Orientation.Vertical);
    });

    describe("responsive behavior", () => {

      it("changes orientation when width is lower than 300", async () => {
        const propertyGridMount = mount(
          <PropertyGrid
            dataProvider={dataProvider}
            horizontalOrientationMinWidth={275}
            isOrientationFixed={false}
          />);

        await TestUtils.flushAsyncOperations();
        propertyGridMount.update();

        const resizeDetector = propertyGridMount.find(ReactResizeDetector);
        expect(resizeDetector.length).to.eq(1);

        resizeDetector.prop("onResize")!(250, 400);
        propertyGridMount.update();

        expect(propertyGridMount.state("orientation")).to.be.eq(Orientation.Vertical);

        resizeDetector.prop("onResize")!(274, 400);
        propertyGridMount.update();

        expect(propertyGridMount.state("orientation")).to.be.eq(Orientation.Vertical);

        resizeDetector.prop("onResize")!(400, 400);
        propertyGridMount.update();

        expect(propertyGridMount.state("orientation")).to.be.eq(Orientation.Horizontal);

        resizeDetector.prop("onResize")!(400, 500);
        propertyGridMount.update();

        expect(propertyGridMount.state("orientation")).to.be.eq(Orientation.Horizontal);
      });

    });

  });

  describe("property selection", () => {

    it("calls onPropertySelectionChanged when property gets clicked and selection is enabled", async () => {
      const onPropertySelectionChanged = sinon.spy();
      const wrapper = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}
          onPropertySelectionChanged={onPropertySelectionChanged}
        />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      categoryBlock.find(".components--clickable").simulate("click");

      expect(onPropertySelectionChanged.called).to.be.true;
    });

    it("deselects if clicked a 2nd time", async () => {
      const wrapper = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}
        />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      categoryBlock.find(".components--clickable").simulate("click");
      wrapper.update();
      expect(wrapper.find(".components--selected").length).to.eq(1);

      categoryBlock.find(".components--clickable").simulate("click");
      wrapper.update();
      expect(wrapper.find(".components--selected").length).to.eq(0);
    });

    it("does not call onPropertySelectionChanged when property gets clicked and selection is disabled", async () => {
      const onPropertySelectionChanged = sinon.spy();
      const wrapper = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={false}
          onPropertySelectionChanged={onPropertySelectionChanged}
          isOrientationFixed={true}
        />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      categoryBlock.find(".components-property-record--horizontal").simulate("click");

      expect(onPropertySelectionChanged.called).to.be.false;
    });

    it("calls onPropertySelectionChanged when property gets right clicked and right click selection is enabled", async () => {
      const onPropertySelectionChanged = sinon.spy();
      const wrapper = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}
          isPropertySelectionOnRightClickEnabled={true}
          onPropertySelectionChanged={onPropertySelectionChanged}
        />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      categoryBlock.find(".components--clickable").simulate("contextMenu");

      expect(onPropertySelectionChanged.called).to.be.true;
    });

    it("calls onPropertySelectionChanged once when property gets right clicked after left clicked and both left and right click selections are enabled", async () => {
      const onPropertySelectionChanged = sinon.spy();
      const wrapper = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionOnRightClickEnabled={true}
          isPropertySelectionEnabled={true}
          onPropertySelectionChanged={onPropertySelectionChanged}
        />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      categoryBlock.find(".components--clickable").simulate("click");
      categoryBlock.find(".components--clickable").simulate("contextMenu");

      expect(onPropertySelectionChanged.callCount).to.be.equal(2);
    });

    it("does not deselect if right clicked a 2nd time", async () => {
      const wrapper = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}
          isPropertySelectionOnRightClickEnabled={true}
        />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      categoryBlock.find(".components--clickable").simulate("contextMenu");
      wrapper.update();
      expect(wrapper.find(".components--selected").length).to.eq(1);

      categoryBlock.find(".components--clickable").simulate("contextMenu");
      wrapper.update();
      expect(wrapper.find(".components--selected").length).to.eq(1);
    });

    it("deselects if left clicked after right clicked", async () => {
      const wrapper = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}
          isPropertySelectionOnRightClickEnabled={true}
        />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      categoryBlock.find(".components--clickable").simulate("contextMenu");
      wrapper.update();
      expect(wrapper.find(".components--selected").length).to.eq(1);

      categoryBlock.find(".components--clickable").simulate("click");
      wrapper.update();
      expect(wrapper.find(".components--selected").length).to.eq(0);
    });

    it("does not call onPropertySelectionChanged when property gets right clicked and selection is disabled", async () => {
      const onPropertySelectionChanged = sinon.spy();
      const wrapper = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}
          isPropertySelectionOnRightClickEnabled={false}
          onPropertySelectionChanged={onPropertySelectionChanged}
          isOrientationFixed={true}
        />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      categoryBlock.find(".components-property-record--horizontal").simulate("contextMenu");

      expect(onPropertySelectionChanged.called).to.be.false;
    });
  });

  describe("property editing", () => {

    it("starts editor on click & commits on Enter", async () => {
      const spyMethod = sinon.spy();
      const wrapper = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertyEditingEnabled={true}
          onPropertyUpdated={spyMethod}
        />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      categoryBlock.find(".components--clickable").simulate("click");
      wrapper.update();

      expect(wrapper.find("input.components-cell-editor").length).to.eq(1);

      const inputNode = wrapper.find("input");
      expect(inputNode.length).to.eq(1);

      inputNode.simulate("keyDown", { key: "Enter" });
      await TestUtils.flushAsyncOperations();
      expect(spyMethod.calledOnce).to.be.true;
    });

    it("does not start editor on click if not selected yet", async () => {
      const wrapper = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}   // when this is true, user must click once to select then again to edit
          isPropertyEditingEnabled={true}
        />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      categoryBlock.find(".components--clickable").simulate("click");
      wrapper.update();

      expect(wrapper.find(".components-cell-editor").length).to.eq(0);
    });

    it("starts editor on click if clicked before to select", async () => {
      const wrapper = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          isPropertySelectionEnabled={true}   // when this is true, user must click once to select then again to edit
          isPropertyEditingEnabled={true}
        />);

      await TestUtils.flushAsyncOperations();

      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      categoryBlock.find(".components--clickable").simulate("click");
      wrapper.update();
      expect(wrapper.find(".components--selected").length).to.eq(1);

      categoryBlock.find(".components--clickable").simulate("click");
      wrapper.update();
      expect(wrapper.find("input.components-cell-editor").length).to.eq(1);

      const inputNode = wrapper.find("input");
      expect(inputNode.length).to.eq(1);
      inputNode.simulate("keyDown", { key: "Escape" });
      await TestUtils.flushAsyncOperations();
      wrapper.update();
      expect(wrapper.find(".components-cell-editor").length, "Cell editor did not disappear after pressing Escape").to.eq(0);
    });

  });

  describe("context menu", () => {

    it("calls onPropertyContextMenu callback when right clicked on a property", async () => {
      const callback = sinon.spy();
      const wrapper = mount(
        <PropertyGrid
          orientation={Orientation.Horizontal}
          dataProvider={dataProvider}
          onPropertyContextMenu={callback}
          isOrientationFixed={true}
        />);
      await TestUtils.flushAsyncOperations();
      wrapper.update();

      const categoryBlock = wrapper.find(PropertyCategoryBlock).at(0);
      expect(categoryBlock.exists(), "Category block does not exist").to.be.true;

      const propertyView = categoryBlock.find(".components-property-record--horizontal");
      propertyView.simulate("contextMenu");
      expect(callback).to.be.calledOnce;
      expect(callback.firstCall.args[0].propertyRecord).to.deep.eq(records[0]);
    });

  });

  it("handles onDataChanged event subscriptions when mounting, changing props and unmounting", () => {
    const evt1 = new PropertyDataChangeEvent();
    const providerMock1 = moq.Mock.ofType<IPropertyDataProvider>();
    providerMock1.setup(async (x) => x.getData()).returns(async () => ({ label: "", categories: [], records: {} }));
    providerMock1.setup((x) => x.onDataChanged).returns(() => evt1);

    const evt2 = new PropertyDataChangeEvent();
    const providerMock2 = moq.Mock.ofType<IPropertyDataProvider>();
    providerMock2.setup(async (x) => x.getData()).returns(async () => ({ label: "", categories: [], records: {} }));
    providerMock2.setup((x) => x.onDataChanged).returns(() => evt2);

    const pane = shallow(<PropertyGrid orientation={Orientation.Horizontal} dataProvider={providerMock1.object} />);
    expect(evt1.numberOfListeners).to.eq(1, "listener should be added when component is mounted");

    pane.setProps({ orientation: Orientation.Horizontal, dataProvider: providerMock1.object });
    expect(evt1.numberOfListeners).to.eq(1, "additional listener should not be added when data provider doesn't change");

    pane.setProps({ orientation: Orientation.Horizontal, dataProvider: providerMock2.object });
    expect(evt1.numberOfListeners).to.eq(0, "listener should be removed when data provider is not used anymore");
    expect(evt2.numberOfListeners).to.eq(1, "listener should be added when data provider changes");

    pane.unmount();
    expect(evt2.numberOfListeners).to.eq(0, "listener should be removed when component is unmounted");
  });

});
