/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import Timer from "../../src/utils/Timer";

describe("Timer", () => {
  it("should create timer with specified delay", () => {
    const sut = new Timer(100);
    sut.delay.should.eq(100);
  });

  it("should not be running when created", () => {
    const sut = new Timer(100);
    sut.isRunning.should.be.false;
  });

  it("should set delay", () => {
    const sut = new Timer(100);
    sut.delay = 200;
    sut.delay.should.eq(200);
  });

  it("should start the timer", () => {
    const sut = new Timer(100);
    sut.start();
  });

  it("should be running when started", () => {
    const sut = new Timer(100);
    sut.start();

    sut.isRunning.should.be.true;
  });

  it("stopping the timer that is not running should have no effect", () => {
    const sut = new Timer(100);
    sut.stop();
  });

  it("start timer should set the timeout", () => {
    const clock = sinon.useFakeTimers();
    const spy = sinon.spy();
    clock.setTimeout = spy;

    const sut = new Timer(100);
    sut.start();

    clock.tick(50);
    clock.restore();

    spy.calledOnce.should.true;
  });

  it("should have no effect if no handler is set", () => {
    const clock = sinon.useFakeTimers();

    const sut = new Timer(100);
    sut.start();

    clock.tick(100);
    clock.restore();

    sut.isRunning.should.be.false;
  });

  it("should call handler after clock ticks the delay", () => {
    const clock = sinon.useFakeTimers();
    const spy = sinon.spy();

    const sut = new Timer(100);
    sut.setOnExecute(spy);
    sut.start();

    clock.tick(100);
    clock.restore();

    spy.calledOnce.should.true;
  });

  it("should stop the started timer", () => {
    const clock = sinon.useFakeTimers();
    const spy = sinon.spy();

    const sut = new Timer(100);
    sut.setOnExecute(spy);
    sut.start();
    sut.stop();

    clock.tick(100);
    clock.restore();

    spy.should.not.have.been.called;
  });

  it("should restart the started timer", () => {
    const clock = sinon.useFakeTimers();
    const clearTimeoutSpy = sinon.spy();
    const setTimeoutSpy = sinon.spy();
    clock.clearTimeout = clearTimeoutSpy;
    clock.setTimeout = setTimeoutSpy;

    const sut = new Timer(100);
    sut.start();
    sut.start();

    clock.restore();

    setTimeoutSpy.calledTwice.should.true;
    clearTimeoutSpy.calledOnce.should.true;
  });
});
