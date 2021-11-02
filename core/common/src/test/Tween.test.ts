/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Easing, Tween, Tweens } from "../Tween";

/** adapted from
 * Tween.js - Licensed under the MIT license
 * https://github.com/tweenjs/tween.js
 * ----------------------------------------------
 *
 * See https://github.com/tweenjs/tween.js/graphs/contributors for the full list of contributors.
 * Thank you all, you're awesome!
 */

// cSpell:ignore tweens tweening yoyo progressess tween's

const tweenCallback = (_obj: any) => { };
const updateCallback = (_obj: any, _t: number) => { };
const interpolationFunction = (_v: any, _k: number) => 1;

describe("Tween", () => {
  const tweens = new Tweens();

  it("object stores tweens automatically on start", () => {
    const numTweensBefore = tweens.getAll().length,
      t = tweens.create({});

    t.start();

    const numTweensAfter = tweens.getAll().length;
    assert.equal(numTweensBefore + 1, numTweensAfter);
  });

  it("removeAll()", () => {

    tweens.getAll();
    const t = tweens.create({});

    tweens.removeAll();

    assert.equal(tweens.getAll().length, 0, "No tweens left");

    t.start();

    assert.equal(tweens.getAll().length, 1, "A tween has been added");

    tweens.removeAll();

    assert.equal(tweens.getAll().length, 0, "No tweens left");
  });

  it("add()", () => {
    const all = tweens.getAll(),
      numTweens = all.length,
      t = tweens.create({});

    tweens.add(t);

    assert.equal(numTweens + 1, tweens.getAll().length);
  });

  it("remove()", () => {
    const all = tweens.getAll(),
      numTweens = all.length,
      t = tweens.create({});

    tweens.add(t);

    assert.ok(tweens.getAll().indexOf(t) !== -1);

    tweens.remove(t);

    assert.equal(numTweens, tweens.getAll().length);
    assert.equal(tweens.getAll().indexOf(t), -1);
  });

  it("update() returns false when done (no tweens to animate)", () => {
    tweens.removeAll();
    assert.deepEqual(tweens.update(), false);
  });

  it("update() returns true when there are active tweens", () => {

    tweens.removeAll();

    const t = tweens.create({});
    t.start();

    assert.deepEqual(tweens.update(), true);
  });

  it("update() removes tweens when they are finished", () => {

    tweens.removeAll();

    const t1 = tweens.create({}).to({}, 1000),
      t2 = tweens.create({}).to({}, 2000);

    assert.equal(tweens.getAll().length, 0);

    t1.start(0);
    t2.start(0);

    assert.equal(tweens.getAll().length, 2);

    tweens.update(0);
    assert.equal(tweens.getAll().length, 2);

    tweens.update(999);
    assert.equal(tweens.getAll().length, 2);

    tweens.update(1000);
    assert.equal(tweens.getAll().length, 1);
    assert.equal(tweens.getAll().indexOf(t1), -1);
    assert.ok(tweens.getAll().indexOf(t2) !== -1);
  });

  it("update() does not remove tweens when they are finished with preserve flag", () => {

    tweens.removeAll();

    const t1 = tweens.create({}).to({}, 1000),
      t2 = tweens.create({}).to({}, 2000);

    assert.equal(tweens.getAll().length, 0);

    t1.start(0);
    t2.start(0);

    assert.equal(tweens.getAll().length, 2);

    tweens.update(0, true);
    assert.equal(tweens.getAll().length, 2);

    tweens.update(999, true);
    assert.equal(tweens.getAll().length, 2);

    tweens.update(1000, true);
    assert.equal(tweens.getAll().length, 2);

    tweens.update(1001, true);
    assert.equal(tweens.getAll().length, 2);
    assert.ok(tweens.getAll().indexOf(t1) !== -1);
    assert.ok(tweens.getAll().indexOf(t2) !== -1);
  });

  it("Unremoved tweens which have been updated past their finish time may be reused", () => {

    tweens.removeAll();

    const target1 = { a: 0 };
    const target2 = { b: 0 };

    const t1 = tweens.create(target1).to({ a: 1 }, 1000),
      t2 = tweens.create(target2).to({ b: 1 }, 2000);

    t1.start(0);
    t2.start(0);

    tweens.update(200, true);
    tweens.update(2500, true);
    tweens.update(500, true);

    assert.equal(tweens.getAll().length, 2);
    assert.equal(target1.a, 0.5);
    assert.equal(target2.b, 0.25);
  });

  it("constructor", () => {

    const t = tweens.create({});

    assert.ok(t instanceof Tween, "Pass");
  });

  it("Return the same tween instance for method chaining", () => {
    const t = tweens.create({});

    assert.ok(t.to({}, 0) instanceof Tween);
    assert.equal(t.to({}, 0), t);

    assert.ok(t.start() instanceof Tween);
    assert.equal(t.start(), t);

    assert.ok(t.stop() instanceof Tween);
    assert.equal(t.stop(), t);

    assert.equal(t.delay(0), t);

    assert.equal(t.easing(Easing.Back.In), t);

    assert.ok(t.interpolation(interpolationFunction) instanceof Tween);
    assert.equal(t.interpolation(interpolationFunction), t);

    assert.ok(t.chain() instanceof Tween);
    assert.equal(t.chain(), t);

    assert.ok(t.onStart(tweenCallback) instanceof Tween);
    assert.equal(t.onStart(tweenCallback), t);

    assert.ok(t.onStop(tweenCallback) instanceof Tween);
    assert.equal(t.onStop(tweenCallback), t);

    assert.ok(t.onUpdate(updateCallback) instanceof Tween);
    assert.equal(t.onUpdate(updateCallback), t);

    assert.ok(t.onComplete(tweenCallback) instanceof Tween);
    assert.equal(t.onComplete(tweenCallback), t);

    assert.ok(t.duration(0) instanceof Tween);
    assert.equal(t.duration(0), t);

    assert.ok(t.group(tweens) instanceof Tween);
    assert.equal(t.group(tweens), t);

  });

  it("Tween existing property", () => {

    const obj = { x: 1 },
      t = tweens.create(obj);

    t.to({ x: 2 }, 1000);
    t.start(0);
    t.update(1000);

    assert.deepEqual(obj.x, 2);
  });

  it("Tween non-existing property", () => {

    const obj: any = { x: 1 },
      t = tweens.create(obj);

    t.to({ y: 0 }, 1000);
    t.start(0);
    t.update(1000);

    assert.deepEqual(obj.x, 1);
    assert.equal(obj.y, undefined);
  });

  it("Tween non-null property", () => {

    const obj = { x: 1 },
      t = tweens.create(obj);

    t.to({ x: 2 }, 1000);
    t.start(0);
    t.update(1000);

    assert.deepEqual(obj.x, 2);
    assert.ok(obj.x !== null);
  });

  it("Tween function property", () => {

    const myFunction = () => { };

    const obj = { x: myFunction },
      t = tweens.create(obj);

    t.to({ x: myFunction });
    t.start(0);
    t.update(1000);

    assert.ok(obj.x === myFunction);
  });

  it("Tween boolean property", () => {

    const obj = { x: true },
      t = tweens.create(obj);

    t.to({ x: () => { } });
    t.start(0);
    t.update(1000);

    assert.ok(typeof obj.x === "boolean");
    assert.ok(obj.x);
  });

  it("Tween null property", () => {

    const obj = { x: null },
      t = tweens.create(obj);

    t.to({ x: 2 }, 1000);
    t.start(0);
    t.update(1000);

    assert.deepEqual(obj.x, 2);
  });

  it("Tween undefined property", () => {

    const obj: any = {},
      t = tweens.create(obj);

    t.to({ x: 2 }, 1000);
    t.start(0);
    t.update(1000);

    assert.equal(obj.x, undefined);
  });

  it("Tween relative positive value, with sign", () => {

    const obj = { x: 0 },
      t = tweens.create(obj);

    t.to({ x: "+100" }, 1000);
    t.start(0);
    t.update(1000);

    assert.equal(obj.x, 100);
  });

  it("Tween relative negative value", () => {

    const obj = { x: 0 },
      t = tweens.create(obj);

    t.to({ x: "-100" }, 1000);
    t.start(0);
    t.update(1000);

    assert.equal(obj.x, -100);
  });

  it("String values without a + or - sign should not be interpreted as relative", () => {

    const obj = { x: 100 },
      t = tweens.create(obj);

    t.to({ x: "100" }, 1000);
    t.start(0);
    t.update(1000);

    assert.equal(obj.x, 100);
  });

  it("Test Tween.start()", () => {

    const obj = {},
      t = tweens.create(obj);

    t.to({}, 1000);

    tweens.removeAll();
    assert.equal(tweens.getAll().length, 0); // TODO move to TWEEN test

    t.start(0);

    assert.equal(tweens.getAll().length, 1); // TODO ditto
    assert.equal(tweens.getAll()[0], t);
  });

  it("Test Tween.stop()", () => {

    const obj = {},
      t = tweens.create(obj);

    t.to({ x: 2 }, 1000);

    tweens.removeAll();

    t.start();
    t.stop();

    assert.equal(tweens.getAll().length, 0);
  });

  it("Test Tween.delay()", () => {

    const obj = { x: 1 },
      t = tweens.create(obj);

    t.to({ x: 2 }, 1000);
    t.delay(500);
    t.start(0);

    t.update(100);

    assert.deepEqual(obj.x, 1, "Tween hasn't started yet");

    t.update(1000);

    assert.ok((obj.x !== 1) && (obj.x !== 2), "Tween has started but hasn't finished yet");

    t.update(1500);

    assert.equal(obj.x, 2, "Tween finishes when expected");
  });

  // TODO: not really sure how to test this. Advice appreciated!
  it("Test Easing()", () => {

    const obj = { x: 0 },
      t = tweens.create(obj);

    t.to({ x: 1 }, 1000);

    t.easing(Easing.Quadratic.In);
    t.start(0);
    t.update(500);
    assert.equal(obj.x, Easing.Quadratic.In(0.5));
  });

  // TODO test interpolation()

  it("Test Tween.chain --with one tween", () => {

    const t2 = tweens.create({}),
      t = tweens.create({});
    let tStarted = false,
      tCompleted = false,
      t2Started = false;

    tweens.removeAll();

    t.to({}, 1000);
    t2.to({}, 1000);

    t.chain(t2);

    t.onStart(() => {
      tStarted = true;
    });

    t.onComplete(() => {
      tCompleted = true;
    });

    t2.onStart(() => {
      assert.equal(tStarted, true);
      assert.equal(tCompleted, true);
      assert.equal(t2Started, false);
      t2Started = true;
    });

    assert.equal(tStarted, false);
    assert.equal(t2Started, false);

    t.start(0);
    tweens.update(0);

    assert.equal(tStarted, true);
    assert.equal(t2Started, false);

    tweens.update(1000);

    assert.equal(tCompleted, true);

    tweens.update(1001);

    assert.equal(t2Started, true, "t2 is automatically started by t");
  });

  it("Test Tween.chain --with several tweens in an array", () => {

    const t = tweens.create({}),
      chainedTweens = [],
      numChained = 3;
    let numChainedStarted = 0;

    tweens.removeAll();

    t.to({}, 1000);

    function onChainedStart() {
      numChainedStarted++;
    }

    for (let i = 0; i < numChained; i++) {
      const chained = tweens.create({});
      chained.to({}, 1000);

      chainedTweens.push(chained);

      chained.onStart(onChainedStart);
    }

    // NOTE: This is not the normal way to chain several tweens simultaneously
    // The usual way would be to specify them explicitly:
    // t.chain( tween1, tween2, ... tweenN)
    // ... not to use apply to send an array of tweens
    t.chain.apply(t, chainedTweens);

    assert.equal(numChainedStarted, 0);

    t.start(0);
    tweens.update(0);
    tweens.update(1000);
    tweens.update(1001);

    assert.equal(numChainedStarted, numChained, "All chained tweens have been started");
  });

  it("Test Tween.chain allows endless loops", () => {

    const obj = { x: 0 },
      t1 = tweens.create(obj).to({ x: 100 }, 1000),
      t2 = tweens.create(obj).to({ x: 0 }, 1000);

    tweens.removeAll();

    t1.chain(t2);
    t2.chain(t1);

    assert.equal(obj.x, 0);

    // x == 0
    t1.start(0);
    tweens.update(0);

    assert.equal(obj.x, 0);

    tweens.update(500);
    assert.equal(obj.x, 50);

    // there... (x == 100)

    tweens.update(1000);
    assert.equal(obj.x, 100);

    tweens.update(1500);
    assert.equal(obj.x, 50);

    // ... and back again (x == 0)

    tweens.update(2000);
    assert.equal(obj.x, 0);

    tweens.update(2500);
    assert.equal(obj.x, 50);

    tweens.update(3000);
    assert.equal(obj.x, 100); // and x == 100 again

    // Repeat the same test but with the tweens added in the
    // opposite order.
    const obj2 = { x: 0 };
    const t3 = tweens.create(obj2).to({ x: 200 }, 1000);
    const t4 = tweens.create(obj2).to({ x: 100 }, 1000);

    t4.chain(t3);
    t3.chain(t4);

    assert.equal(obj2.x, 0);

    t4.start(0);

    tweens.update(0);
    assert.equal(obj2.x, 0);

    tweens.update(500);
    assert.equal(obj2.x, 50);

    tweens.update(1000);
    assert.equal(obj2.x, 100);

    tweens.update(1500);
    assert.equal(obj2.x, 150);

    tweens.update(2000);
    assert.equal(obj2.x, 0);

    tweens.update(2500);
    assert.equal(obj2.x, 50);

    tweens.update(3000);
    assert.equal(obj2.x, 100);

    tweens.update(3500);
    assert.equal(obj2.x, 150);

    tweens.update(4000);
    assert.equal(obj2.x, 0);

    tweens.update(4500);
    assert.equal(obj2.x, 50);

  });

  it("Test Tween.onStart", () => {

    const obj = {},
      t = tweens.create(obj);
    let counter = 0;

    t.to({ x: 2 }, 1000);
    t.onStart(() => {
      assert.ok(true, "onStart callback is called");
      counter++;
    });

    assert.deepEqual(counter, 0);

    t.start(0);
    tweens.update(0);

    assert.deepEqual(counter, 1);

    tweens.update(500);

    assert.deepEqual(counter, 1, "onStart callback is not called again");
  });

  it("Test Tween.onStop", () => {

    const obj = {},
      t = tweens.create(obj);
    let counter = 0;

    t.to({ x: 2 }, 1000);
    t.onStop(() => {
      assert.ok(true, "onStop callback is called");
      counter++;
    });

    assert.deepEqual(counter, 0);

    t.stop();
    tweens.update(0);

    assert.deepEqual(counter, 0, "onStop callback not called when the tween hasn't started yet");

    t.start(0);
    tweens.update(0);
    t.stop();

    assert.deepEqual(counter, 1, "onStop callback is called if the tween has been started already and stop is invoked");

    tweens.update(500);
    t.stop();

    assert.deepEqual(counter, 1, "onStop callback is not called again once the tween is stopped");
  });

  it("Test Tween.onUpdate", () => {

    const obj = {},
      t = tweens.create(obj);
    let counter = 0;

    t.to({ x: 2 }, 1000);
    t.onUpdate(() => {
      counter++;
    });

    assert.deepEqual(counter, 0);

    t.start(0);

    tweens.update(0);
    assert.deepEqual(counter, 1);

    tweens.update(500);
    assert.deepEqual(counter, 2);

    tweens.update(600);
    assert.deepEqual(counter, 3);

    tweens.update(1000);
    assert.deepEqual(counter, 4);

    tweens.update(1500);
    assert.deepEqual(counter, 4, "onUpdate callback should not be called after the tween has finished");

  });

  it("Test Tween.onComplete", () => {

    const obj = {},
      t = tweens.create(obj);
    let counter = 0;

    t.to({ x: 2 }, 1000);
    t.onComplete(() => {
      counter++;
    });

    assert.deepEqual(counter, 0);

    t.start(0);

    tweens.update(0);
    assert.deepEqual(counter, 0);

    tweens.update(500);
    assert.deepEqual(counter, 0);

    tweens.update(600);
    assert.deepEqual(counter, 0);

    tweens.update(1000);
    assert.deepEqual(counter, 1);

    tweens.update(1500);
    assert.deepEqual(counter, 1, "onComplete callback must be called only once");
  });

  it("Tween does not repeat by default", () => {

    tweens.removeAll();

    const obj = { x: 0 },
      t = tweens.create(obj).to({ x: 100 }, 100);

    t.start(0);

    tweens.update(0);
    assert.equal(obj.x, 0);

    tweens.update(50);
    assert.equal(obj.x, 50);

    tweens.update(100);
    assert.equal(obj.x, 100);

    tweens.update(150);
    assert.equal(obj.x, 100);
  });

  it("Test single repeat happens only once", () => {

    tweens.removeAll();

    const obj = { x: 0 },
      t = tweens.create(obj).to({ x: 100 }, 100).repeat(1);

    t.start(0);

    tweens.update(0);
    assert.equal(obj.x, 0);

    tweens.update(50);
    assert.equal(obj.x, 50);

    tweens.update(100);
    assert.equal(obj.x, 100);

    tweens.update(150);
    assert.equal(obj.x, 50);

    tweens.update(200);
    assert.equal(obj.x, 100);
  });

  it("Test Infinity repeat happens forever", () => {

    tweens.removeAll();

    const obj = { x: 0 },
      t = tweens.create(obj).to({ x: 100 }, 100).repeat(Infinity);

    t.start(0);

    tweens.update(0);
    assert.equal(obj.x, 0);

    tweens.update(50);
    assert.equal(obj.x, 50);

    tweens.update(100);
    assert.equal(obj.x, 100);

    tweens.update(150);
    assert.equal(obj.x, 50);

    tweens.update(200);
    assert.equal(obj.x, 100);

    tweens.update(250);
    assert.equal(obj.x, 50);
  });

  it("Test tweening relatively with repeat", () => {

    tweens.removeAll();

    const obj = { x: 0, y: 0 },
      t = tweens.create(obj).to({ x: "+100", y: "-100" }, 100).repeat(1);

    t.start(0);

    tweens.update(0);
    assert.equal(obj.x, 0);
    assert.equal(obj.y, 0);

    tweens.update(50);
    assert.equal(obj.x, 50);
    assert.equal(obj.y, -50);

    tweens.update(100);
    assert.equal(obj.x, 100);
    assert.equal(obj.y, -100);

    tweens.update(150);
    assert.equal(obj.x, 150);
    assert.equal(obj.y, -150);

    tweens.update(200);
    assert.equal(obj.x, 200);
    assert.equal(obj.y, -200);
  });

  it("Test yoyo with repeat Infinity happens forever", () => {

    tweens.removeAll();

    const obj = { x: 0 },
      t = tweens.create(obj).to({ x: 100 }, 100).repeat(Infinity).yoyo(true);

    t.start(0);

    tweens.update(0);
    assert.equal(obj.x, 0);

    tweens.update(25);
    assert.equal(obj.x, 25);

    tweens.update(100);
    assert.equal(obj.x, 100);

    tweens.update(125);
    assert.equal(obj.x, 75);

    tweens.update(200);
    assert.equal(obj.x, 0);

    tweens.update(225);
    assert.equal(obj.x, 25);
  });

  it("Test yoyo with repeat 1 happens once", () => {

    tweens.removeAll();

    const obj = { x: 0 },
      t = tweens.create(obj).to({ x: 100 }, 100).repeat(1).yoyo(true);

    t.start(0);

    tweens.update(0);
    assert.equal(obj.x, 0);

    tweens.update(25);
    assert.equal(obj.x, 25);

    tweens.update(100);
    assert.equal(obj.x, 100);

    tweens.update(125);
    assert.equal(obj.x, 75);

    tweens.update(200);
    assert.equal(obj.x, 0);

    tweens.update(225);
    assert.equal(obj.x, 0);
  });

  it("Test Tween.chain progressess into chained tweens", () => {

    const obj = { t: 1000 };

    // 1000 of nothing
    const blank = tweens.create({}).to({}, 1000);

    // tween obj.t from 1000 -> 2000 (in time with update time)
    const next = tweens.create(obj).to({ t: 2000 }, 1000);

    blank.chain(next).start(0);

    tweens.update(1500);
    assert.equal(obj.t, 1500);

    tweens.update(2000);
    assert.equal(obj.t, 2000);

  });

  it("Test that Tween.end sets the final values.", () => {

    const object1 = { x: 0, y: -50, z: 1000 };
    const target1 = { x: 50, y: 123, z: "+234" };

    const tween1 = tweens.create(object1).to(target1, 1000);

    tween1.start();
    tween1.end();

    assert.equal(object1.x, 50);
    assert.equal(object1.y, 123);
    assert.equal(object1.z, 1234);

    const object2 = { x: 0, y: -50, z: 1000 };
    const target2 = { x: 50, y: 123, z: "+234" };

    const tween2 = tweens.create(object2).to(target2, 1000);

    tween2.start(300);
    tween2.update(500);
    tween2.end();

    assert.equal(object2.x, 50);
    assert.equal(object2.y, 123);
    assert.equal(object2.z, 1234);

  });

  it("Test that Tween.end calls the onComplete callback of the tween.", () => {
    const tween1 = tweens.create({}).to({}, 1000).onComplete(() => {
      assert.ok(true);
    });

    tween1.start();
    tween1.end();

  });

  it("Test delay adds delay before each repeat", () => {

    // If repeatDelay isn't specified then delay is used since
    // that's the way it worked before repeatDelay was added.

    tweens.removeAll();

    const obj = { x: 0 },
      t = tweens.create(obj).to({ x: 100 }, 100).repeat(1).delay(100);

    t.start(0);

    tweens.update(100);
    assert.equal(obj.x, 0);

    tweens.update(150);
    assert.equal(obj.x, 50);

    tweens.update(200);
    assert.equal(obj.x, 100);

    tweens.update(250);
    assert.equal(obj.x, 100);

    tweens.update(300);
    assert.equal(obj.x, 0);

    tweens.update(350);
    assert.equal(obj.x, 50);

    tweens.update(400);
    assert.equal(obj.x, 100);

  });

  it("Test repeatDelay adds delay before each repeat", () => {

    tweens.removeAll();

    const obj = { x: 0 },
      t = tweens.create(obj).to({ x: 100 }, 100).repeat(1).repeatDelay(200);

    t.start(0);

    tweens.update(0);
    assert.equal(obj.x, 0);

    tweens.update(50);
    assert.equal(obj.x, 50);

    tweens.update(100);
    assert.equal(obj.x, 100);

    tweens.update(200);
    assert.equal(obj.x, 100);

    tweens.update(300);
    assert.equal(obj.x, 0);

    tweens.update(350);
    assert.equal(obj.x, 50);

    tweens.update(400);
    assert.equal(obj.x, 100);

  });

  it("Test repeatDelay and delay can be used together", () => {

    tweens.removeAll();

    const obj = { x: 0 },
      t = tweens.create(obj).to({ x: 100 }, 100).delay(100).repeat(1).repeatDelay(200);

    t.start(0);

    tweens.update(100);
    assert.equal(obj.x, 0);

    tweens.update(150);
    assert.equal(obj.x, 50);

    tweens.update(200);
    assert.equal(obj.x, 100);

    tweens.update(300);
    assert.equal(obj.x, 100);

    tweens.update(400);
    assert.equal(obj.x, 0);

    tweens.update(450);
    assert.equal(obj.x, 50);

    tweens.update(500);
    assert.equal(obj.x, 100);

  });

  it("js compatible with Object.defineProperty getter / setters", () => {

    const obj: any = { _x: 0 }; // eslint-disable-line @typescript-eslint/naming-convention

    Object.defineProperty(obj, "x", {
      get: () => {
        return obj._x;
      },
      set: (x) => {
        obj._x = x;
      },
    });

    assert.equal(obj.x, 0);

    const t = tweens.create(obj).to({ x: 100 }, 100);

    t.start(0);

    assert.equal(obj.x, 0);

    tweens.update(37);
    assert.equal(obj.x, 37);

    tweens.update(100);
    assert.equal(obj.x, 100);

    tweens.update(115);
    assert.equal(obj.x, 100);

  });

  it("isPlaying is false before the tween starts", () => {
    tweens.removeAll();

    const t = tweens.create({ x: 0 }).to({ x: 1 }, 100);

    assert.equal(t.isPlaying, false);
  });

  it("isPlaying is true when a tween is started and before it ends", () => {
    tweens.removeAll();

    const t = tweens.create({ x: 0 }).to({ x: 1 }, 100);
    t.start(0);
    assert.equal(t.isPlaying, true);
  });

  it("isPlaying is false after a tween ends", () => {
    tweens.removeAll();

    const t = tweens.create({ x: 0 }).to({ x: 1 }, 100);
    t.start(0);
    tweens.update(150);
    assert.equal(t.isPlaying, false);
  });

  it("A zero-duration tween finishes at its starting time without an error.", () => {
    tweens.removeAll();

    const object = { x: 0 };
    const t = tweens.create(object).to({ x: 1 }, 0);
    t.start(0);
    tweens.update(0);

    assert.equal(t.isPlaying, false);
    assert.equal(object.x, 1);
  });

  it("Stopping a tween within an update callback will not cause an error.", () => {
    tweens.removeAll();

    const tweenA = tweens.create({ x: 1, y: 2 })
      .to({ x: 3, y: 4 }, 1000)
      .onUpdate((_values) => {
        tweenB.stop();
      })
      .start(0);
    const tweenB = tweens.create({ x: 5, y: 6 })
      .to({ x: 7, y: 8 })
      .onUpdate((_values) => {
        tweenA.stop();
      })
      .start(0);

    let success = true;

    try {
      tweens.update(500);
    } catch (exception) {
      success = false;
    } finally {
      assert.ok(success);
    }
  });

  it("Set the duration with .duration", () => {
    const obj = { x: 1 };
    const t = tweens.create(obj)
      .to({ x: 2 })
      .duration(1000)
      .start(0);

    t.update(1000);

    assert.deepEqual(obj.x, 2);
  });

  it("group sets the tween's group.", () => {

    const group = new Tweens();

    const groupTweenA = tweens.create({})
      .group(group);

    groupTweenA.start();

    assert.equal(group.getAll().length, 1);
  });

  it("Test Tween.pause() and Tween.resume()", () => {

    const obj = { x: 0.0 },
      t = tweens.create(obj);

    t.to({ x: 1.0 }, 1000);

    tweens.removeAll();

    assert.equal(tweens.getAll().length, 0);

    t.start(0);

    assert.equal(tweens.getAll().length, 1);
    assert.equal(t.isPaused, false);

    tweens.update(400);

    assert.equal(obj.x, 0.4);

    t.pause(450);

    assert.equal(t.isPaused, true);
    assert.equal(tweens.getAll().length, 0);
    assert.equal(obj.x, 0.4);

    tweens.update(900);

    assert.equal(obj.x, 0.4);

    tweens.update(3000);

    assert.equal(obj.x, 0.4);

    t.resume(3200);

    // values do not change until an update
    assert.equal(obj.x, 0.4);

    assert.equal(tweens.getAll().length, 1);
    assert.equal(t.isPaused, false);

    tweens.update(3500);

    assert.equal(obj.x, 0.75);

    tweens.update(5000);

    assert.equal(obj.x, 1.0);

  });

  it("Arrays in the object passed to to() are not modified by start().", () => {

    const start = { x: 10, y: 20 };
    const end = { x: 100, y: 200, values: ["a", "b"] };
    const valuesArray = end.values;
    tweens.create(start).to(end).start();
    assert.equal(valuesArray, end.values);
    assert.equal(end.values.length, 2);
    assert.equal(end.values[0], "a");
    assert.equal(end.values[1], "b");
  });
});
