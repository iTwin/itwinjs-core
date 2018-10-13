/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect, assert } from "chai";
import { BeEvent, BeEventList } from "../bentleyjs-core";

// tslint:disable:no-empty
class Dummy {
  constructor(_name: string) { }
}

type DummyListener = (d: Dummy, r: number) => void;

describe("BeEvent tests", () => {

  describe("BeEvent", () => {

    it("Subscribing to the event dispatcher", () => {

      const carolus = new Dummy("Carolus");

      const dispatcher = new BeEvent<DummyListener>();
      let resultNr: number = 0;
      let resultDummy: Dummy | undefined;

      const listen = (dummy: Dummy, nr: number) => {
        resultDummy = dummy;
        resultNr = nr;
        dispatcher.removeListener(listen);
      };

      dispatcher.addListener(listen);
      dispatcher.raiseEvent(carolus, 7);

      expect(resultDummy, "resultDummy should be Carolus").to.equal(carolus);
      expect(resultNr, "resultNr should be 7.").to.equal(7);

      dispatcher.raiseEvent(carolus, 7);
      expect(dispatcher.numberOfListeners, "num listens 0").to.equal(0);
    });

    it("Multiple subscribers to an  event dispatcher", () => {
      const ev = new BeEvent<() => void>();
      let a = 0;
      let b = 0;
      let c = 0;
      const dropA = ev.addListener(() => a++);
      const dropB = ev.addListener(() => b++);
      const dropC = ev.addListener(() => c++);
      ev.raiseEvent();
      ev.raiseEvent();
      assert.equal(a, 2, "a=2");
      assert.equal(b, 2, "b=2");
      assert.equal(c, 2, "c=2");

      dropB();
      ev.raiseEvent();
      ev.raiseEvent();
      assert.equal(a, 4, "a=4");
      assert.equal(b, 2, "b=2");
      assert.equal(c, 4, "c=4");

      dropC();
      ev.raiseEvent();
      ev.raiseEvent();
      assert.equal(a, 6, "a=4");
      assert.equal(b, 2, "b=2");
      assert.equal(c, 4, "c=4");

      dropA();
      ev.raiseEvent();
      ev.raiseEvent();
      assert.equal(a, 6, "a=4");
      assert.equal(b, 2, "b=2");
      assert.equal(c, 4, "c=4");
    });

    it("Sub to the event dispatcher", () => {
      const carolus = new Dummy("Carolus");
      const dispatcher = new BeEvent<DummyListener>();
      let resultNr: number = 0;
      let resultDummy: Dummy | undefined;

      dispatcher.addListener((dummy, nr) => {
        resultDummy = dummy;
        resultNr = nr;
      });

      dispatcher.raiseEvent(carolus, 7);

      expect(resultDummy, "resultDummy should be Carolus").to.equal(carolus);
      expect(resultNr, "resultNr should be 7.").to.equal(7);
    });

    it("Subscribing to the event dispatcher. Fire twice", () => {

      const carolus = new Dummy("Carolus");

      const dispatcher = new BeEvent<DummyListener>();
      let resultNr = 0;
      let resultDummy: Dummy | undefined;

      dispatcher.addListener((dummy, nr) => {
        resultDummy = dummy;
        resultNr += nr;
      });

      dispatcher.raiseEvent(carolus, 7);
      dispatcher.raiseEvent(carolus, 6);

      expect(resultDummy, "resultDummy should be Carolus").to.equal(carolus);
      expect(resultNr, "resultNr should be 13.").to.equal(13);
    });

    it("Sub to the event dispatcher. Fire twice", () => {

      const carolus = new Dummy("Carolus");

      const dispatcher = new BeEvent<DummyListener>();
      let resultNr = 0;
      let resultDummy: Dummy | undefined;

      dispatcher.addListener((dummy, nr) => {
        resultDummy = dummy;
        resultNr += nr;
      });

      dispatcher.raiseEvent(carolus, 7);
      dispatcher.raiseEvent(carolus, 6);

      expect(resultDummy, "resultDummy should be Carolus").to.equal(carolus);
      expect(resultNr, "resultNr should be 13.").to.equal(13);
    });

    it("One subscription to the event dispatcher. Fire twice.", () => {

      const carolus = new Dummy("Carolus");

      const dispatcher = new BeEvent<DummyListener>();
      let resultNr = 0;
      let resultDummy: Dummy | undefined;

      dispatcher.addOnce((dummy, nr) => {
        resultDummy = dummy;
        resultNr += nr;
      });

      dispatcher.raiseEvent(carolus, 7);
      dispatcher.raiseEvent(carolus, 6);

      expect(resultDummy, "resultDummy should be Carolus").to.equal(carolus);
      expect(resultNr, "resultNr should be 7.").to.equal(7);
    });

    it("Unsubscribing from the event dispatcher.", () => {

      const carolus = new Dummy("Carolus");

      const dispatcher = new BeEvent<DummyListener>();
      let resultNr = 0;
      let resultDummy: Dummy | undefined;

      const fn = (dummy: Dummy, nr: number) => {
        resultDummy = dummy;
        resultNr += nr;
      };

      dispatcher.addListener(fn);
      dispatcher.removeListener(fn);
      dispatcher.raiseEvent(carolus, 6);

      expect(resultDummy, "resultDummy should be empty.").to.equal(undefined);
      expect(resultNr, "resultNr should be 0.").to.equal(0);

    });

    it("Unsubscribe from the event dispatcher.", () => {

      const carolus = new Dummy("Carolus");

      const dispatcher = new BeEvent<DummyListener>();
      let resultNr = 0;
      let resultDummy: Dummy | undefined;

      const fn = (dummy: Dummy, nr: number) => {
        resultDummy = dummy;
        resultNr += nr;
      };

      dispatcher.addListener(fn);
      dispatcher.removeListener(fn);
      dispatcher.raiseEvent(carolus, 6);

      expect(resultDummy, "resultDummy should be empty.").to.equal(undefined);
      expect(resultNr, "resultNr should be 0.").to.equal(0);
    });

    it("Unsubscribing to a one subscription.", () => {

      const carolus = new Dummy("Carolus");

      const dispatcher = new BeEvent<DummyListener>();
      let resultNr = 0;
      let resultDummy: Dummy | undefined;

      const fn = (dummy: Dummy, nr: number) => {
        resultDummy = dummy;
        resultNr += nr;
      };

      dispatcher.addOnce(fn);
      dispatcher.removeListener(fn);
      dispatcher.raiseEvent(carolus, 6);

      expect(resultDummy, "resultDummy should be empty.").to.equal(undefined);
      expect(resultNr, "resultNr should be 0.").to.equal(0);
    });

    it("Has no event.", () => {
      const fn = (_dummy: Dummy, _nr: number) => { };
      const dispatcher = new BeEvent<DummyListener>();
      const result = dispatcher.has(fn);
      expect(result, "Handler should not be present.").to.equal(false);
    });

    it("Has event through subscribe.", () => {
      const fn = (_dummy: Dummy, _nr: number) => { };
      const dispatcher = new BeEvent<DummyListener>();
      dispatcher.addListener(fn);
      const result = dispatcher.has(fn);
      expect(result, "Handler should be present.").to.equal(true);
    });

    it("Has event through one.", () => {
      const fn = (_dummy: Dummy, _nr: number) => { };
      const dispatcher = new BeEvent<DummyListener>();
      dispatcher.addOnce(fn);
      const result = dispatcher.has(fn);
      expect(result, "Handler should be present.").to.equal(true);
    });

    it("Test subscribe -> unsubscribe -> has", () => {
      const fn = (_dummy: Dummy, _nr: number) => { };
      const dispatcher = new BeEvent<DummyListener>();
      dispatcher.addListener(fn);
      dispatcher.removeListener(fn);
      const result = dispatcher.has(fn);
      expect(result, "Handler should not be present because of unsubscribe.").to.equal(false);
    });

    it("Clear subscriptions.", () => {

      const carolus = new Dummy("Carolus");
      const willem = new Dummy("Willem");

      const dispatcher = new BeEvent<DummyListener>();
      let resultNr = 0;
      let resultDummy = willem;

      dispatcher.addListener((dummy, nr) => {
        resultDummy = dummy;
        resultNr = nr;
      });

      dispatcher.clear();
      dispatcher.raiseEvent(carolus, 7);

      expect(resultDummy, "resultDummy should be Willem").to.equal(willem);
      expect(resultNr, "resultNr should be 0.").to.equal(0);
    });

  });

  describe("BeEventList", () => {

    it("Subscribe to event name", () => {
      const event = "myEvent";
      const list = new BeEventList<DummyListener>();
      const fn = (_dummy: Dummy, _nr: number) => { };

      list.get(event).addListener(fn);
      const result = list.get(event).has(fn);
      expect(result, "result should be true.").to.equals(true);
    });

    it("Unsubscribe to event name", () => {
      const event = "myEvent";
      const list = new BeEventList<DummyListener>();
      const fn = (_dummy: Dummy, _nr: number) => { };

      list.get(event).addListener(fn);
      list.get(event).removeListener(fn);

      const result = list.get(event).has(fn);
      expect(result, "result should be false due to unsubscribe.").to.equals(false);
    });

    it("Test firing two events in one list", () => {

      const list = new BeEventList<DummyListener>();
      let result: string | undefined;

      const event1 = "ev1";
      const fn1 = (_dummy: Dummy | undefined, nr: number) => { result = "ev1:" + nr; };

      const event2 = "ev2";
      const fn2 = (_dummy: Dummy | undefined, nr: number) => { result = "ev2:" + nr; };

      list.get(event1).addListener(fn1);
      list.get(event2).addListener(fn2);

      list.get(event2).raiseEvent(undefined, 16);
      expect(result, 'Result should be "ev2:16.').to.equal("ev2:16");

      list.get(event1).raiseEvent(undefined, 8);
      expect(result, 'Result should be "ev1:8.').to.equal("ev1:8");
    });

    it("Test remove from list.", () => {

      const list = new BeEventList<DummyListener>();
      const fn = (_dummy: Dummy, _nr: number) => { };

      const event1 = "ev1";
      list.get(event1).addListener(fn);

      const event2 = "ev2";
      list.get(event2).addListener(fn);

      let result = list.get(event2).has(fn);
      expect(result, "Event 2 should be present.").to.equal(true);

      list.remove(event2);

      result = list.get(event1).has(fn);
      expect(result, "Event 1 should still be present.").to.equal(true);

      result = list.get(event2).has(fn);
      expect(result, "Event 2 should not be present.").to.equal(false);
    });
  });
});
