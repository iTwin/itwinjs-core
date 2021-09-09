/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable deprecation/deprecation */

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { I18N } from "@bentley/imodeljs-i18n";
import { createRandomECInstanceKey, isKeySet, KeySet } from "@bentley/presentation-common";
import {
  ISelectionProvider, Presentation, PresentationManager, SelectionChangeEvent, SelectionChangeType, SelectionHandler, SelectionManager
} from "@bentley/presentation-frontend";
import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import { PropertyRecord } from "@bentley/ui-abstract";
import { PropertyData, PropertyDataChangeEvent, PropertyGrid, PropertyGridProps } from "@bentley/ui-components";
import { Orientation } from "@bentley/ui-core";
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as faker from "faker";
import * as path from "path";
import * as React from "react";
import * as moq from "typemoq";
import { IPresentationPropertyDataProvider, IUnifiedSelectionComponent, propertyGridWithUnifiedSelection } from "../../presentation-components";
import { initializeLocalization } from "../../presentation-components/common/Utils";

// eslint-disable-next-line @typescript-eslint/naming-convention
const PresentationPropertyGrid = propertyGridWithUnifiedSelection(PropertyGrid);

describe("PropertyGrid withUnifiedSelection", () => {

  before(async () => {
    Presentation.setPresentationManager(moq.Mock.ofType<PresentationManager>().object);
    Presentation.setI18nManager(new I18N("", {
      urlTemplate: `file://${path.resolve("public/locales")}/{{lng}}/{{ns}}.json`,
    }));
    await initializeLocalization();
  });

  after(() => {
    Presentation.terminate();
  });

  let testRulesetId: string;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const dataProviderMock = moq.Mock.ofType<IPresentationPropertyDataProvider>();
  const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();
  beforeEach(() => {
    testRulesetId = faker.random.word();
    selectionHandlerMock.reset();
    selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => []);
    selectionHandlerMock.setup((x) => x.getSelection(moq.It.isAnyNumber())).returns(() => new KeySet());
    setupDataProvider();
  });

  const setupDataProvider = (providerMock?: moq.IMock<IPresentationPropertyDataProvider>, imodel?: IModelConnection, rulesetId?: string, propertyData?: PropertyData) => {
    if (!providerMock)
      providerMock = dataProviderMock;
    if (!imodel)
      imodel = imodelMock.object;
    if (!rulesetId)
      rulesetId = testRulesetId;
    if (!propertyData) {
      propertyData = {
        label: PropertyRecord.fromString(faker.random.word()),
        description: faker.random.words(),
        categories: [],
        records: {},
      };
    }
    const evt = new PropertyDataChangeEvent();
    providerMock.reset();
    providerMock.setup((x) => x.imodel).returns(() => imodel!);
    providerMock.setup((x) => x.rulesetId).returns(() => rulesetId!);
    providerMock.setup(async (x) => x.getData()).returns(async () => propertyData!);
    providerMock.setup((x) => x.onDataChanged).returns(() => evt);
  };

  it("mounts", () => {
    mount(<PresentationPropertyGrid
      orientation={Orientation.Horizontal}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object} />);
  });

  it("uses data provider's imodel", () => {
    const component = shallow(<PresentationPropertyGrid
      orientation={Orientation.Horizontal}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />).instance() as any as IUnifiedSelectionComponent;
    expect(component.imodel).to.equal(imodelMock.object);
  });

  it("creates default implementation for selection handler when not provided through props", () => {
    const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
    selectionManagerMock.setup((x) => x.getSelectionLevels(imodelMock.object)).returns(() => []);
    selectionManagerMock.setup((x) => x.getSelection(imodelMock.object, moq.It.isAnyNumber())).returns(() => new KeySet());
    Presentation.setSelectionManager(selectionManagerMock.object);

    const component = shallow(<PresentationPropertyGrid
      orientation={Orientation.Vertical}
      dataProvider={dataProviderMock.object} />).instance() as any as IUnifiedSelectionComponent;

    expect(component.selectionHandler).to.not.be.undefined;
    expect(component.selectionHandler?.name).to.not.be.undefined;
    expect(component.selectionHandler?.rulesetId).to.eq(testRulesetId);
    expect(component.selectionHandler?.imodel).to.eq(imodelMock.object);
  });

  it("renders correctly with no data", () => {
    expect(shallow(<PresentationPropertyGrid
      orientation={Orientation.Horizontal}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
    />)).to.matchSnapshot();
  });

  it("renders correctly when data provider keys count exceeds limit", () => {
    const keys = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
    selectionHandlerMock.reset();
    selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => [0]);
    selectionHandlerMock.setup((x) => x.getSelection(moq.It.isAnyNumber())).returns(() => keys);
    const wrapper = shallow(<PresentationPropertyGrid
      orientation={Orientation.Horizontal}
      dataProvider={dataProviderMock.object}
      selectionHandler={selectionHandlerMock.object}
      requestedContentInstancesLimit={1}
    />);
    expect(wrapper).to.matchSnapshot();
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
    const dataProviderMock2 = moq.Mock.ofType<IPresentationPropertyDataProvider>();
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

    beforeEach(() => {
      selectionHandlerMock.reset();
    });

    it("sets data provider keys to overall selection when mounts", () => {
      const keysOverall = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
      selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => [1, 2]);
      selectionHandlerMock.setup((x) => x.getSelection(2)).returns(() => new KeySet());
      selectionHandlerMock.setup((x) => x.getSelection(1)).returns(() => keysOverall);
      shallow(<PresentationPropertyGrid
        orientation={Orientation.Vertical}
        dataProvider={dataProviderMock.object}
        selectionHandler={selectionHandlerMock.object}
      />);
      dataProviderMock.verify((x) => x.keys = isKeySet(keysOverall), moq.Times.once());
    });

    it("sets data provider keys to overall selection on selection changes", () => {
      const keysOverall = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
      const keysAdded = new KeySet([createRandomECInstanceKey()]);
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
      dataProviderMock.verify((x) => x.keys = isKeySet(keysOverall), moq.Times.once());
    });

    it("sets data provider keys to an empty KeySet when overall selection is empty", () => {
      const emptyKeySet = new KeySet();
      selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => []);
      selectionHandlerMock.setup((x) => x.getSelection(0)).returns(() => emptyKeySet);
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
        keys: emptyKeySet,
        timestamp: new Date(),
      }, moq.Mock.ofType<ISelectionProvider>().object);
      dataProviderMock.verify((x) => x.keys = isKeySet(emptyKeySet), moq.Times.once());
    });

    it("sets data provider keys to an empty KeySet when overall selection contains more keys than set limit", () => {
      const emptyKeySet = new KeySet();
      const twoInstanceKeys = new KeySet([createRandomECInstanceKey(), createRandomECInstanceKey()]);
      selectionHandlerMock.setup((x) => x.getSelectionLevels()).returns(() => []);
      selectionHandlerMock.setup((x) => x.getSelection(0)).returns(() => twoInstanceKeys);
      shallow(<PresentationPropertyGrid
        orientation={Orientation.Vertical}
        dataProvider={dataProviderMock.object}
        selectionHandler={selectionHandlerMock.object}
        requestedContentInstancesLimit={1}
      />);
      selectionHandlerMock.target.onSelect!({
        imodel: imodelMock.object,
        source: faker.random.word(),
        changeType: SelectionChangeType.Clear,
        level: 0,
        keys: emptyKeySet,
        timestamp: new Date(),
      }, moq.Mock.ofType<ISelectionProvider>().object);
      dataProviderMock.verify((x) => x.keys = isKeySet(emptyKeySet), moq.Times.once());
    });

  });

});
