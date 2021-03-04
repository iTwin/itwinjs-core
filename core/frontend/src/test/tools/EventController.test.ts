/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ScreenViewport } from "../../imodeljs-frontend";
import { EventController } from "../../tools/EventController";

describe("EventController", () => {
  it("should ignore events from the viewport decorations", () => {
    const fakeViewport = {
      parentDiv: document.createElement("div"),
      decorationDiv: document.createElement("div"),
    } as ScreenViewport;

    const sampleHtmlDecoration = document.createElement("img");
    fakeViewport.decorationDiv.append(sampleHtmlDecoration);

    new EventController(fakeViewport);

    expect(fakeViewport.parentDiv.onmousedown).to.not.be.undefined;

    let decorationGotEvent = false;
    sampleHtmlDecoration.addEventListener(
      "mousedown",
      () => (decorationGotEvent = true)
    );
    const resetDecorationGotEvent = () => {
      decorationGotEvent = false;
    };

    // probably best to make sure it's being clicked on and intercepted in puppeteer
    fakeViewport.parentDiv.dispatchEvent(new MouseEvent("mousedown"));
    expect(decorationGotEvent).to.be.false;
    resetDecorationGotEvent();

    sampleHtmlDecoration.dispatchEvent(new MouseEvent("mousedown"));
    expect(decorationGotEvent).to.be.true;
    resetDecorationGotEvent();
  });
});
