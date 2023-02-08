/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { Provider } from "react-redux";
import { render, screen } from "@testing-library/react";
import { SpecialKey } from "@itwin/appui-abstract";
import TestUtils from "../TestUtils";
import { ConfigurableUiContent } from "../../appui-react/configurableui/ConfigurableUiContent";
import { FrameworkToolAdmin } from "../../appui-react/tools/FrameworkToolAdmin";
import userEvent from "@testing-library/user-event";
import { CursorInformation, UiFramework } from "../../appui-react";

describe("ConfigurableUiContent", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  before(async () => {
    await TestUtils.initializeUiFramework(true);
  });

  it("key presses should be handled", async () => {
    render(<Provider store={TestUtils.store} >
      <ConfigurableUiContent />
    </Provider>);
    expect(UiFramework.keyboardShortcuts.isFocusOnHome).to.be.true;

    const toolAdmin = new FrameworkToolAdmin();
    let keyEvent = new KeyboardEvent("keydown", { key: "a" });
    expect(await toolAdmin.processShortcutKey(keyEvent, true)).to.be.true;
    keyEvent = new KeyboardEvent("keyup", { key: "a" });
    expect(await toolAdmin.processShortcutKey(keyEvent, false)).to.be.false;
    keyEvent = new KeyboardEvent("keydown", { key: SpecialKey.Escape });
    expect(await toolAdmin.processShortcutKey(keyEvent, true)).to.be.false;
  });

  it("mouse moves should be handled", async () => {
    const spy = sinon.spy();
    const removeListener = CursorInformation.onCursorUpdatedEvent.addListener(spy);
    render(
      <Provider store={TestUtils.store} >
        <ConfigurableUiContent />
      </Provider>);

    await theUserTo.pointer({target: screen.getByRole("main"), coords: {x: 10, y: 10}});

    expect(spy).to.have.been.calledWith(sinon.match({oldPt: sinon.match.any, newPt: sinon.match.any, direction: sinon.match.any}));

    removeListener();
  });

  after(() => {
    // clear out the framework key
    TestUtils.terminateUiFramework();
  });
});
