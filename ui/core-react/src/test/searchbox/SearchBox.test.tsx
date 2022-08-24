/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { SearchBox } from "../../core-react";
import TestUtils from "../TestUtils";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("SearchBox", () => {
  let fakeTimers: sinon.SinonFakeTimers;
  let theUserTo: ReturnType<typeof userEvent.setup>;
  const throttleMs = 16;

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  beforeEach(() => {
    fakeTimers = sinon.useFakeTimers();
    theUserTo = userEvent.setup({
      advanceTimers:(delay) => {
        fakeTimers.tick(delay);
      },
      delay: throttleMs,
    });
  });

  afterEach(() => {
    fakeTimers.restore();
  });

  describe("renders", () => {
    it("renders correctly", () => {
      render(<SearchBox onValueChanged={() => { }} />);

      expect(screen.getByRole("searchbox")).to.exist;
      expect(screen.getByRole("button")).to.exist;
    });
  });

  describe("track change", () => {
    it("should call onValueChanged", async () => {
      const spyMethod = sinon.spy();
      render(<SearchBox onValueChanged={spyMethod} />);

      await theUserTo.type(screen.getByRole("searchbox"), "T");
      expect(spyMethod).to.be.calledOnce;
    });

    it("should ignore if value specified is not different", async () => {
      const spyMethod = sinon.spy();
      render(<SearchBox onValueChanged={spyMethod} valueChangedDelay={throttleMs*2} />);

      await theUserTo.type(screen.getByRole("searchbox"), "T[Backspace]");
      fakeTimers.tick(throttleMs*3);
      expect(spyMethod).not.to.be.called;
    });

    it("should honor valueChangedDelay", async () => {
      const spyMethod = sinon.spy();
      render(<SearchBox onValueChanged={spyMethod} valueChangedDelay={100} />);

      await theUserTo.type(screen.getByRole("searchbox"), "Test"); // 16ms / letter => 64ms
      expect(spyMethod.called).to.be.false;
      await fakeTimers.tickAsync(100);
      expect(spyMethod.calledOnce).to.be.true;
    });

    it("should call onEscPressed", async () => {
      const spyMethod = sinon.spy();
      render(<SearchBox onValueChanged={() => { }} onEscPressed={spyMethod} />);

      await theUserTo.type(screen.getByRole("searchbox"), "[Escape]");
      expect(spyMethod.calledOnce).to.be.true;
    });

    it("should call onEnterPressed", async () => {
      const spyMethod = sinon.spy();
      render(<SearchBox onValueChanged={() => { }} onEnterPressed={spyMethod} />);

      await theUserTo.type(screen.getByRole("searchbox"), "[Enter]");
      expect(spyMethod.calledOnce).to.be.true;
    });

    it("should call onClear", async () => {
      const spyMethod = sinon.spy();
      render(<SearchBox onValueChanged={() => { }} onClear={spyMethod} initialValue="Test" />);

      await theUserTo.click(screen.getByRole("button"));
      expect(spyMethod.calledOnce).to.be.true;
    });

    it("should set focus to input", () => {
      const searchBox = React.createRef<SearchBox>();
      render(<SearchBox ref={searchBox} onValueChanged={() => { }} placeholder="Search" />);
      searchBox.current?.focus();
      const inputElement = screen.getByRole("searchbox");
      const focusedElement = document.activeElement;
      expect(inputElement).to.eq(focusedElement);
    });
  });
});
