/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as moq from "typemoq";
import * as React from "react";
import { Orientation } from "@bentley/ui-core";
import { PropertyGrid } from "../../../src/propertygrid/component/PropertyGrid";
import { PropertyDataProvider, PropertyDataChangeEvent } from "../../../src/propertygrid/PropertyDataProvider";

describe("PropertyGrid", () => {

  it("handles onDataChanged event subscriptions when mounting, changing props and unmounting", () => {
    const evt1 = new PropertyDataChangeEvent();
    const providerMock1 = moq.Mock.ofType<PropertyDataProvider>();
    providerMock1.setup((x) => x.getData()).returns(async () => ({ label: "", categories: [], records: {} }));
    providerMock1.setup((x) => x.onDataChanged).returns(() => evt1);

    const evt2 = new PropertyDataChangeEvent();
    const providerMock2 = moq.Mock.ofType<PropertyDataProvider>();
    providerMock2.setup((x) => x.getData()).returns(async () => ({ label: "", categories: [], records: {} }));
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
