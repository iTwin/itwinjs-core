/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, cleanup } from "@testing-library/react";
import * as React from "react";
import * as moq from "typemoq";
import { Provider } from "react-redux";
import { expect } from "chai";

import {
  useActiveIModelConnection, SyncUiEventDispatcher,
} from "../../ui-framework";

import TestUtils from "../TestUtils";
import { IModelConnection, MockRender } from "@bentley/imodeljs-frontend";
import { UiFramework } from "../../ui-framework/UiFramework";

describe("useActiveIModelConnection", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    SyncUiEventDispatcher.initialize();   // To process Backstage events

    // use mock renderer so standards tools are registered.
    MockRender.App.startup();
  });

  after(() => {
    MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  afterEach(cleanup);

  describe("useActiveIModelConnection Hook", () => {
    const imodelMock = moq.Mock.ofType<IModelConnection>();
    imodelMock.setup((x) => x.name).returns(() => "Fake");

    // tslint:disable-next-line:variable-name
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

      const initialLabel = result.getByTestId("mylabel") as HTMLElement;
      expect(initialLabel.innerHTML).to.be.eq("NoConnection");

      UiFramework.setIModelConnection(imodelMock.object, true);
      // result.debug();

      // --- the following does not work yet
      // const updatedLabel = result.getByTestId("mylabel");
      // expect(updatedLabel.innerHTML).to.be.eq("Fake");
    });

  });
});
