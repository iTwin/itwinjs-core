/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import * as React from "react";
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as moq from "@helpers/Mocks";
import * as faker from "faker";
import { createRandomECInstanceKey } from "@helpers/random";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { KeySet } from "@bentley/presentation-common";
import {
  Presentation,
  SelectionHandler, SelectionManager, SelectionChangeEvent, SelectionChangeType, ISelectionProvider,
} from "@bentley/presentation-frontend";
import { Orientation } from "@bentley/ui-core";
import { PropertyGrid, PropertyGridProps, PropertyData, PropertyDataChangeEvent } from "@bentley/ui-components";
import IUnifiedSelectionComponent from "@src/common/IUnifiedSelectionComponent";
import { PresentationPropertyDataProvider, withUnifiedSelection } from "@src/propertygrid";

// tslint:disable-next-line:variable-name naming-convention
const PresentationPropertyGrid = withUnifiedSelection(PropertyGrid);

describe("PropertyGrid withUnifiedSelection", () => {

  let testRulesetId: string;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<PresentationPropertyDataProvider>();
  const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();
  beforeEach(() => {
    testRulesetId = faker.random.word();
    selectionHandlerMock.reset();
    selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => []);
    selectionHandlerMock.setup((x) => x.getSelection(moq.It.isAnyNumber())).returns(() => new KeySet());
    setupDataProvider();
  });

  const setupDataProvider = (providerMock?: moq.IMock<PresentationPropertyDataProvider>, imodel?: IModelConnection, rulesetId?: string, propertyData?: PropertyData) => {
    if (!providerMock)
      providerMock = dataProviderMock;
    if (!imodel)
      imodel = imodelMock.object;
    if (!rulesetId)
      rulesetId = testRulesetId;
    if (!propertyData) {
      propertyData = {
        label: faker.random.word(),
        description: faker.random.words(),
        categories: [],
        records: {},
      };
    }
    providerMock.reset();
    providerMock.setup((x) => x.connection).returns(() => imodel!);
    providerMock.setup((x) => x.rulesetId).returns(() => rulesetId!);
    providerMock.setup((x) => x.getData()).returns(async () => propertyData!);
    providerMock.setup((x) => x.onDataChanged).returns(() => new PropertyDataChangeEvent());
  };

  it("mounts", () => {
    mount(<PresentationPropertyGrid
      orientation={Orientation.Horizontal}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object} />);
  });

  it("uses data provider's imodel and rulesetId", () => {
    const component = shallow(<PresentationPropertyGrid
      orientation={Orientation.Horizontal}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />).instance() as any as IUnifiedSelectionComponent;

    expect(component.imodel).to.equal(imodelMock.object);
    expect(component.rulesetId).to.equal(testRulesetId);
  });

  it("creates default implementation for selection handler when not provided through props", () => {
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
    selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
    selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAnyNumber())).returns(() => new KeySet());
    Presentation.selection = selectionManagerMock.object;

    const component = shallow(<PresentationPropertyGrid
      orientation={Orientation.Vertical}
      dataProvider={dataProviderMock.object} />).instance() as any as IUnifiedSelectionComponent;

    expect(component.selectionHandler).to.not.be.undefined;
    expect(component.selectionHandler!.name).to.not.be.undefined;
    expect(component.selectionHandler!.rulesetId).to.eq(testRulesetId);
    expect(component.selectionHandler!.imodel).to.eq(imodelMock.object);
  });

  it("renders correctly", () => {
    expect(shallow(<PresentationPropertyGrid
      orientation={Orientation.Horizontal}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />)).to.matchSnapshot();
  });

  it("disposes selection handler when unmounts", () => {
    const component = mount(<PresentationPropertyGrid
      orientation={Orientation.Vertical}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />);
    component.unmount();
    selectionHandlerMock.verify((x) => x.dispose(), moq.Times.once());
  });

  it("updates selection handler when data provider changes", () => {
    const component = shallow<PropertyGridProps>(<PresentationPropertyGrid
      orientation={Orientation.Horizontal}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />);

    const imodelMock2 = moq.Mock.ofType<IModelConnection>();
    const rulesetId2 = faker.random.word();
    const dataProviderMock2 = moq.Mock.ofType<PresentationPropertyDataProvider>();
    setupDataProvider(dataProviderMock2, imodelMock2.object, rulesetId2);

    component.setProps({
      dataProvider: dataProviderMock2.object,
    });

    selectionHandlerMock.verify((x) => x.imodel = imodelMock2.object, moq.Times.once());
    selectionHandlerMock.verify((x) => x.rulesetId = rulesetId2, moq.Times.once());
  });

  it("handles missing selection handler when unmounts", () => {
    const component = shallow(<PresentationPropertyGrid
      orientation={Orientation.Horizontal}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />, { disableLifecycleMethods: true });
    component.unmount();
  });

  it("handles missing selection handler when updates", () => {
    const component = shallow(<PresentationPropertyGrid
      orientation={Orientation.Horizontal}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />, { disableLifecycleMethods: true });
    component.instance().componentDidUpdate!(component.props(), component.state()!);
  });

  describe("selection handling", () => {

    it("sets data provider keys to overall selection when mounts", () => {
      const keysOverall = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
      selectionHandlerMock.reset();
      selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => [1, 2]);
      selectionHandlerMock.setup((x) => x.getSelection(2)).returns(() => new KeySet());
      selectionHandlerMock.setup((x) => x.getSelection(1)).returns(() => keysOverall);
      shallow(<PresentationPropertyGrid
        orientation={Orientation.Vertical}
        dataProvider={dataProviderMock.object}
        selectionHandler={selectionHandlerMock.object}
      />);
      dataProviderMock.verify((x) => x.keys = keysOverall, moq.Times.once());
    });

    it("sets data provider keys to overall selection on selection changes", () => {
      const keysOverall = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
      const keysAdded = new KeySet([createRandomECInstanceKey()]);
      selectionHandlerMock.reset();
      selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => []);
      selectionHandlerMock.setup((x) => x.getSelection(0)).returns(() => keysOverall);
      shallow(<PresentationPropertyGrid
        orientation={Orientation.Vertical}
        dataProvider={dataProviderMock.object}
        selectionHandler={selectionHandlerMock.object}
      />);
      selectionHandlerMock.target.onSelect!({
        imodel: imodelMock.object,
        source: faker.random.word(),
        changeType: SelectionChangeType.Add,
        level: 0,
        keys: keysAdded,
        timestamp: new Date(),
      }, moq.Mock.ofType<ISelectionProvider>().object);
      dataProviderMock.verify((x) => x.keys = keysOverall, moq.Times.once());
    });

    it("sets data provider keys to an empty KeySet when overall selection is empty", () => {
      const emptyKeySet = new KeySet();
      const selectionProviderMock = moq.Mock.ofType<ISelectionProvider>();
      selectionProviderMock.setup((x) => x.getSelection(imodelMock.object, 0))
        .returns(() => emptyKeySet);
      shallow(<PresentationPropertyGrid
        orientation={Orientation.Vertical}
        dataProvider={dataProviderMock.object}
        selectionHandler={selectionHandlerMock.object}
      />);
      selectionHandlerMock.target.onSelect!({
        imodel: imodelMock.object,
        source: faker.random.word(),
        changeType: SelectionChangeType.Clear,
        level: 0,
        keys: new KeySet(),
        timestamp: new Date(),
      }, selectionProviderMock.object);
      dataProviderMock.verify((x) => x.keys = emptyKeySet, moq.Times.once());
    });

  });

});
