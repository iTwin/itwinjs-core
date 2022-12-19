/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { Provider } from "react-redux";
import * as moq from "typemoq";
import * as sinon from "sinon";

import { initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { IModelConnection, MockRender, SelectionSet } from "@itwin/core-frontend";
import { render } from "@testing-library/react";
import { IModelRpcProps } from "@itwin/core-common";
import { SyncUiEventDispatcher, UiFramework, useActiveIModelConnection } from "../../appui-react";
import TestUtils from "../TestUtils";

describe("useActiveIModelConnection", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    await initializePresentationTesting();

    // use mock renderer so standards tools are registered.
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
    await terminatePresentationTesting();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("useActiveIModelConnection Hook", () => {
    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const imodelToken: IModelRpcProps = { key: "" };
    imodelMock.setup((x) => x.name).returns(() => "Fake");
    imodelMock.setup((x) => x.getRpcProps()).returns(() => imodelToken);
    const ss = new SelectionSet(imodelMock.object);
    imodelMock.setup((x) => x.selectionSet).returns(() => ss);

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const HookTester = () => {
      const activeIModelConnection = useActiveIModelConnection();
      // I expected the following to work
      // const connectionLabel = activeIModelConnection ? activeIModelConnection.name : "NoConnection";

      // But it did not so I tried this way .... and it still did not update when I call UiFramework.setIModelConnection below
      const [connectionLabel, setConnectionLabel] = React.useState("NoConnection");
      React.useEffect(() => {
        const label = activeIModelConnection ? activeIModelConnection.name : "NoConnection";
        setConnectionLabel(label);
      }, [activeIModelConnection]);
      return <div data-testid="mylabel">{connectionLabel}</div>;
    };

    it("should render", async () => {
      // make sure redux store is set up via Provider
      const result = render(<Provider store={TestUtils.store} >
        <div><HookTester /></div>
      </Provider>);

      const initialLabel = result.getByTestId("mylabel");
      expect(initialLabel.innerHTML).to.be.eq("NoConnection");

      const initEventStub = sinon.stub(SyncUiEventDispatcher, "initializeConnectionEvents");
      const clearEventStub = sinon.stub(SyncUiEventDispatcher, "clearConnectionEvents");

      // should trigger dispatch action
      UiFramework.setIModelConnection(imodelMock.object, true);
      expect(initEventStub).to.be.called;
      expect(clearEventStub).not.to.be.called;
      initEventStub.resetHistory();

      // already set, so should not trigger dispatch action
      UiFramework.setIModelConnection(imodelMock.object, true);
      expect(initEventStub).not.to.be.called;
      expect(clearEventStub).not.to.be.called;

      // should trigger clearing action
      UiFramework.setIModelConnection(undefined, true);
      expect(clearEventStub).to.be.called;
      expect(initEventStub).not.to.be.called;

      // --- the following does not work yet
      // const updatedLabel = result.getByTestId("mylabel");
      // expect(updatedLabel.innerHTML).to.be.eq("Fake");
    });

  });
});
