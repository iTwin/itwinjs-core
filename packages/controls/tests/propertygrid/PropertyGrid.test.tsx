/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import * as React from "react";
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as moq from "@helpers/Mocks";
import * as faker from "faker";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  ECPresentation, ECPresentationManager,
  SelectionHandler, SelectionManager, SelectionChangeEvent, SelectionChangeType, ISelectionProvider,
} from "@bentley/ecpresentation-frontend";
import { Orientation } from "@bentley/ui-core";
import { PropertyData, PropertyDataChangeEvent } from "@bentley/ui-components";
import DataProvider from "@src/propertygrid/DataProvider";
import PropertyGrid, { Props as PropertyGridProps } from "@src/propertygrid/PropertyGrid";
import { KeySet } from "@bentley/ecpresentation-common/lib";
import { createRandomECInstanceKey } from "@helpers/random/EC";

describe("PropertyGrid", () => {

  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<DataProvider>();
  const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();
  beforeEach(() => {
    selectionHandlerMock.reset();
    setupDataProvider();
  });

  const setupDataProvider = (propertyData?: PropertyData) => {
    dataProviderMock.reset();
    if (!propertyData) {
      propertyData = {
        label: faker.random.word(),
        description: faker.random.words(),
        categories: [],
        records: {},
      };
    }
    dataProviderMock.setup((x) => x.getData()).returns(async () => propertyData!);
    dataProviderMock.setup((x) => x.onDataChanged).returns(() => new PropertyDataChangeEvent());
  };

  it("mounts", () => {
    mount(<PropertyGrid
      orientation={Orientation.Horizontal}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
      imodel={imodelMock.object}
      rulesetId={faker.random.word()} />);
  });

  it("creates default implementation for selection handler and data provider when not provided through props", () => {
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
    ECPresentation.selection = selectionManagerMock.object;

    const presentationManagerMock = moq.Mock.ofType<ECPresentationManager>();
    presentationManagerMock
      .setup((x) => x.getContentDescriptor(imodelMock.object, moq.It.isAnyString(), moq.It.isAny(), undefined, moq.It.isAny()))
      .returns(async () => undefined);
    ECPresentation.presentation = presentationManagerMock.object;

    const rulesetId = faker.random.word();

    const tree = mount(<PropertyGrid
      orientation={Orientation.Vertical}
      imodel={imodelMock.object}
      rulesetId={rulesetId} />).instance() as PropertyGrid;

    expect(tree.selectionHandler.name).to.not.be.undefined;
    expect(tree.selectionHandler.rulesetId).to.eq(rulesetId);
    expect(tree.selectionHandler.imodel).to.eq(imodelMock.object);

    expect(tree.dataProvider.rulesetId).to.eq(rulesetId);
    expect(tree.dataProvider.connection).to.eq(imodelMock.object);
  });

  it("renders correctly", () => {
    expect(shallow(<PropertyGrid
      orientation={Orientation.Horizontal}
      id={faker.random.uuid()}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
      imodel={imodelMock.object}
      rulesetId={faker.random.word()} />)).to.matchSnapshot();
  });

  it("disposes selection handler when unmounts", () => {
    const tree = mount(<PropertyGrid
      orientation={Orientation.Vertical}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
      imodel={imodelMock.object}
      rulesetId={faker.random.word()} />);
    tree.unmount();
    selectionHandlerMock.verify((x) => x.dispose(), moq.Times.once());
  });

  it("updates selection handler and data provider when props change", () => {
    const tree = mount<PropertyGridProps>(<PropertyGrid
      orientation={Orientation.Horizontal}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
      imodel={imodelMock.object}
      rulesetId={faker.random.word()} />);

    const imodelMock2 = moq.Mock.ofType<IModelConnection>();
    const rulesetId2 = faker.random.word();

    tree.setProps({
      imodel: imodelMock2.object,
      rulesetId: rulesetId2,
    });

    selectionHandlerMock.verify((x) => x.imodel = imodelMock2.object, moq.Times.once());
    selectionHandlerMock.verify((x) => x.rulesetId = rulesetId2, moq.Times.once());

    dataProviderMock.verify((x) => x.connection = imodelMock2.object, moq.Times.once());
    dataProviderMock.verify((x) => x.rulesetId = rulesetId2, moq.Times.once());
  });

  describe("selection handling", () => {

    it("sets data provider keys to overall selection on selection changes", () => {
      const keysOverall = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
      const keysAdded = new KeySet([createRandomECInstanceKey()]);
      const selectionProviderMock = moq.Mock.ofType<ISelectionProvider>();
      selectionProviderMock.setup((x) => x.getSelection(imodelMock.object, 0))
        .returns(() => keysOverall);
      mount(<PropertyGrid
        orientation={Orientation.Vertical}
        dataProvider={dataProviderMock.object}
        selectionHandler={selectionHandlerMock.object}
        imodel={imodelMock.object}
        rulesetId={faker.random.word()} />);
      selectionHandlerMock.target.onSelect!({
        imodel: imodelMock.object,
        source: faker.random.word(),
        changeType: SelectionChangeType.Add,
        level: 0,
        keys: keysAdded,
        timestamp: new Date(),
      }, selectionProviderMock.object);
      dataProviderMock.verify((x) => x.keys = keysOverall, moq.Times.once());
    });

    it("sets data provider keys to an empty KeySet when overall selection is empty", () => {
      const emptyKeySet = new KeySet();
      const selectionProviderMock = moq.Mock.ofType<ISelectionProvider>();
      selectionProviderMock.setup((x) => x.getSelection(imodelMock.object, 0))
        .returns(() => emptyKeySet);
      mount(<PropertyGrid
        orientation={Orientation.Vertical}
        dataProvider={dataProviderMock.object}
        selectionHandler={selectionHandlerMock.object}
        imodel={imodelMock.object}
        rulesetId={faker.random.word()} />);
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
