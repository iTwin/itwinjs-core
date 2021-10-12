/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tween
 */

/**
 * Adapted from:
 *
 * Tween.js - Licensed under the MIT license
 * https://github.com/tweenjs/tween.js
 * ----------------------------------------------
 *
 * See https://github.com/tweenjs/tween.js/graphs/contributors for the full list of contributors.
 * Thank you all, you're awesome!
 */

// cSpell:ignore tweens yoyo catmull
/* eslint-disable guard-for-in */
/* eslint-disable @typescript-eslint/prefer-for-of */
/* eslint-disable @typescript-eslint/naming-convention */

/** A group of `Tween`s. This class is called `Group` in the tween.js library.
 * @note Unlike tween.js, we do NOT create any global instances of this class
 * like the global object `TWEEN` in tween.js. You must create an instance of this class, and then create [[Tween]]s by
 * calling [[Tweens.create]] or by calling `new Tween()` and pass your Group as its first argument.
 * @see The [tween.js users guide](https://github.com/tweenjs/tween.js/blob/master/docs/user_guide.md)
 * @public
 */
export class Tweens {
  private _tweens: any = {};
  private _tweensAddedDuringUpdate: any = {};
  private _nextId = 0;
  public nextId() { return this._nextId++; }

  public getAll() {
    return Object.keys(this._tweens).map((tweenId) => this._tweens[tweenId]);
  }

  public removeAll() {
    this._tweens = {};
  }

  public add(tween: Tween) {
    this._tweens[tween.getId()] = tween;
    this._tweensAddedDuringUpdate[tween.getId()] = tween;
  }

  public remove(tween: Tween) {
    delete this._tweens[tween.getId()];
    delete this._tweensAddedDuringUpdate[tween.getId()];
  }

  public update(time?: number, preserve?: boolean) {
    let tweenIds = Object.keys(this._tweens);

    if (tweenIds.length === 0)
      return false;

    time = time !== undefined ? time : Date.now();

    // Tweens are updated in "batches". If you add a new tween during an
    // update, then the new tween will be updated in the next batch.
    // If you remove a tween during an update, it may or may not be updated.
    // However, if the removed tween was added during the current batch,
    // then it will not be updated.
    while (tweenIds.length > 0) {
      this._tweensAddedDuringUpdate = {};

      for (const tweenId of tweenIds) {
        const tween = this._tweens[tweenId];
        if (tween && tween.update(time) === false) {
          tween._isPlaying = false;

          if (!preserve) {
            delete this._tweens[tweenId];
          }
        }
      }

      tweenIds = Object.keys(this._tweensAddedDuringUpdate);
    }

    return true;
  }

  /** Create a new Tween owned by this Group. Equivalent to `new TWEEN.Tween` in tween.js library. */
  public create(from: any, opts?: {
    to: any;
    duration: number;
    onUpdate: UpdateCallback;
    onComplete?: TweenCallback;
    delay?: number;
    start?: boolean;
    easing?: EasingFunction;
    interpolation?: InterpolationFunction;
  }) {
    const t = new Tween(this, from);
    if (opts) {
      t.to(opts.to)
        .duration(opts.duration)
        .onUpdate(opts.onUpdate)
        .delay(opts.delay)
        .easing(opts.easing)
        .interpolation(opts.interpolation)
        .onComplete(opts.onComplete);
      if (opts.start)
        t.start();
    }
    return t;
  }
}

/** @public */
export type TweenCallback = (obj: any) => void;
/** @public */
export type UpdateCallback = (obj: any, t: number) => void;
/** @public */
export type EasingFunction = (k: number) => number;
/** @public */
export type InterpolationFunction = (v: any, k: number) => number;

/** A Tween for interpolating values of an object. Instances of this class are owned by a `Tweens` group.
 * @see The [tween.js users guide](https://github.com/tweenjs/tween.js/blob/master/docs/user_guide.md)
 * @public
 */
export class Tween {
  private _isPaused = false;
  private _pauseStart?: number;
  private _valuesStart: any = {};
  private _valuesEnd: any = {};
  private _valuesStartRepeat: any = {};
  private _duration = 1000;
  private _repeat = 0;
  private _repeatDelayTime?: number;
  private _yoyo = false;
  private _isPlaying = false;
  private _reversed = false;
  private _delayTime = 0;
  private _startTime?: number;
  private _easingFunction = Easing.Linear.None;
  private _interpolationFunction = Interpolation.Linear;
  private _chainedTweens: Tween[] = [];
  private _onStartCallback?: TweenCallback;
  private _onStartCallbackFired = false;
  private _onUpdateCallback?: UpdateCallback;
  private _onRepeatCallback?: TweenCallback;
  private _onCompleteCallback?: TweenCallback;
  private _onStopCallback?: TweenCallback;
  private _id: number;

  constructor(private _group: Tweens, private _object: any) {
    this._id = _group.nextId();
  }

  public getId() { return this._id; }
  public get isPlaying() { return this._isPlaying; }
  public get isPaused() { return this._isPaused; }

  public to(properties: any, duration?: number) {
    this._valuesEnd = Object.create(properties);

    if (duration !== undefined)
      this._duration = duration;

    return this;
  }

  public duration(d: number) {
    this._duration = d;
    return this;
  }

  public start(time?: string | number) {
    this._group.add(this);
    this._isPlaying = true;
    this._isPaused = false;
    this._onStartCallbackFired = false;
    this._startTime = time !== undefined ? typeof time === "string" ? Date.now() + parseFloat(time) : time : Date.now();
    this._startTime += this._delayTime;

    for (const property in this._valuesEnd) {
      // Check if an Array was provided as property value
      if (this._valuesEnd[property] instanceof Array) {
        if (this._valuesEnd[property].length === 0)
          continue;

        // Create a local copy of the Array with the start value at the front
        this._valuesEnd[property] = [this._object[property]].concat(this._valuesEnd[property]);
      }

      // If `to()` specifies a property that doesn't exist in the source object,
      // we should not set that property in the object
      if (this._object[property] === undefined)
        continue;

      // Save the starting value, but only once.
      if (typeof (this._valuesStart[property]) === "undefined")
        this._valuesStart[property] = this._object[property];

      if ((this._valuesStart[property] instanceof Array) === false)
        this._valuesStart[property] *= 1.0; // Ensures we're using numbers, not strings

      this._valuesStartRepeat[property] = this._valuesStart[property] || 0;
    }

    return this;
  }

  public stop() {
    if (!this._isPlaying)
      return this;

    this._group.remove(this);
    this._isPlaying = false;
    this._isPaused = false;

    if (this._onStopCallback !== undefined)
      this._onStopCallback(this._object);

    this.stopChainedTweens();
    return this;
  }

  public end() {
    this.update(Infinity);
    return this;
  }

  public pause(time: number) {
    if (this._isPaused || !this._isPlaying)
      return this;

    this._isPaused = true;
    this._pauseStart = time === undefined ? Date.now() : time;
    this._group.remove(this);
    return this;
  }

  public resume(time?: number) {
    if (!this._isPaused || !this._isPlaying)
      return this;

    this._isPaused = false;
    this._startTime! += (time === undefined ? Date.now() : time) - this._pauseStart!;
    this._pauseStart = 0;
    this._group.add(this);
    return this;
  }

  public stopChainedTweens() {
    for (let i = 0, numChainedTweens = this._chainedTweens.length; i < numChainedTweens; i++) {
      this._chainedTweens[i].stop();
    }
  }

  public group(group: Tweens) {
    this._group = group;
    return this;
  }

  public delay(amount?: number) {
    if (undefined !== amount)
      this._delayTime = amount;
    return this;
  }

  public repeat(times: number) {
    this._repeat = times;
    return this;
  }

  public repeatDelay(amount: number) {
    this._repeatDelayTime = amount;
    return this;
  }

  public yoyo(yoyo: boolean) {
    this._yoyo = yoyo;
    return this;
  }

  public easing(easingFunction?: EasingFunction) {
    if (easingFunction)
      this._easingFunction = easingFunction;
    return this;
  }

  public interpolation(interpolationFunction?: InterpolationFunction) {
    if (interpolationFunction)
      this._interpolationFunction = interpolationFunction;
    return this;
  }

  public chain(...tweens: Tween[]) {
    this._chainedTweens = tweens;
    return this;
  }

  public onStart(callback: TweenCallback) {
    this._onStartCallback = callback;
    return this;
  }

  public onUpdate(callback: UpdateCallback) {
    this._onUpdateCallback = callback;
    return this;
  }

  public onRepeat(callback: TweenCallback) {
    this._onRepeatCallback = callback;
    return this;
  }

  public onComplete(callback?: TweenCallback) {
    this._onCompleteCallback = callback;
    return this;
  }

  public onStop(callback: TweenCallback) {
    this._onStopCallback = callback;
    return this;
  }

  public update(time: number) {
    if (undefined === this._startTime || time < this._startTime)
      return true;

    if (this._onStartCallbackFired === false) {
      if (this._onStartCallback !== undefined) {
        this._onStartCallback(this._object);
      }

      this._onStartCallbackFired = true;
    }

    let elapsed = (time - this._startTime) / this._duration;
    elapsed = (this._duration === 0 || elapsed > 1) ? 1 : elapsed;

    const value = this._easingFunction(elapsed);

    let property: any;

    for (property in this._valuesEnd) {
      // Don't update properties that do not exist in the source object
      if (this._valuesStart[property] === undefined)
        continue;

      const start = this._valuesStart[property] || 0;
      let end = this._valuesEnd[property];

      if (end instanceof Array) {
        this._object[property] = this._interpolationFunction(end, value);
      } else {
        // Parses relative end values with start as base (e.g.: +10, -3)
        if (typeof (end) === "string") {

          if (end.charAt(0) === "+" || end.charAt(0) === "-")
            end = start + parseFloat(end);
          else
            end = parseFloat(end);
        }

        // Protect against non numeric properties.
        if (typeof (end) === "number")
          this._object[property] = start + (end - start) * value;
      }
    }

    if (this._onUpdateCallback !== undefined)
      this._onUpdateCallback(this._object, elapsed);

    if (elapsed === 1) {
      if (this._repeat > 0) {
        if (isFinite(this._repeat))
          this._repeat--;

        // Reassign starting values, restart by making startTime = now
        for (property in this._valuesStartRepeat) {

          if (typeof (this._valuesEnd[property]) === "string") {
            this._valuesStartRepeat[property] = this._valuesStartRepeat[property] + parseFloat(this._valuesEnd[property]);
          }

          if (this._yoyo) {
            const tmp = this._valuesStartRepeat[property];

            this._valuesStartRepeat[property] = this._valuesEnd[property];
            this._valuesEnd[property] = tmp;
          }

          this._valuesStart[property] = this._valuesStartRepeat[property];
        }

        if (this._yoyo)
          this._reversed = !this._reversed;

        if (this._repeatDelayTime !== undefined)
          this._startTime = time + this._repeatDelayTime;
        else
          this._startTime = time + this._delayTime;

        if (this._onRepeatCallback !== undefined)
          this._onRepeatCallback(this._object);

        return true;

      } else {

        if (this._onCompleteCallback !== undefined)
          this._onCompleteCallback(this._object);

        for (let i = 0, numChainedTweens = this._chainedTweens.length; i < numChainedTweens; i++) {
          // Make the chained tweens start exactly at the time they should,
          // even if the `update()` method was called way past the duration of the tween
          this._chainedTweens[i].start(this._startTime + this._duration);
        }
        return false;
      }

    }
    return true;
  }
}

/** Easing functions from tween.js
 * @public
 */
export const Easing = {
  Linear: {
    None: (k: number) => {
      return k;
    },
  },

  Quadratic: {
    In: (k: number) => {
      return k * k;
    },

    Out: (k: number) => {
      return k * (2 - k);
    },

    InOut: (k: number) => {
      if ((k *= 2) < 1) {
        return 0.5 * k * k;
      }
      return - 0.5 * (--k * (k - 2) - 1);
    },
  },

  Cubic: {
    In: (k: number) => {
      return k * k * k;
    },

    Out: (k: number) => {
      return --k * k * k + 1;
    },

    InOut: (k: number) => {
      if ((k *= 2) < 1) {
        return 0.5 * k * k * k;
      }

      return 0.5 * ((k -= 2) * k * k + 2);
    },
  },

  Quartic: {
    In: (k: number) => {
      return k * k * k * k;
    },

    Out: (k: number) => {
      return 1 - (--k * k * k * k);
    },

    InOut: (k: number) => {
      if ((k *= 2) < 1) {
        return 0.5 * k * k * k * k;
      }

      return - 0.5 * ((k -= 2) * k * k * k - 2);
    },
  },

  Quintic: {
    In: (k: number) => {
      return k * k * k * k * k;
    },

    Out: (k: number) => {
      return --k * k * k * k * k + 1;
    },

    InOut: (k: number) => {
      if ((k *= 2) < 1) {
        return 0.5 * k * k * k * k * k;
      }

      return 0.5 * ((k -= 2) * k * k * k * k + 2);
    },
  },

  Sinusoidal: {
    In: (k: number) => {
      return 1 - Math.cos(k * Math.PI / 2);
    },

    Out: (k: number) => {
      return Math.sin(k * Math.PI / 2);
    },

    InOut: (k: number) => {
      return 0.5 * (1 - Math.cos(Math.PI * k));
    },
  },

  Exponential: {
    In: (k: number) => {
      return k === 0 ? 0 : Math.pow(1024, k - 1);
    },

    Out: (k: number) => {
      return k === 1 ? 1 : 1 - Math.pow(2, - 10 * k);
    },

    InOut: (k: number) => {
      if (k === 0)
        return 0;

      if (k === 1)
        return 1;

      if ((k *= 2) < 1)
        return 0.5 * Math.pow(1024, k - 1);

      return 0.5 * (- Math.pow(2, - 10 * (k - 1)) + 2);
    },
  },

  Circular: {
    In: (k: number) => {
      return 1 - Math.sqrt(1 - k * k);
    },

    Out: (k: number) => {
      return Math.sqrt(1 - (--k * k));
    },

    InOut: (k: number) => {
      if ((k *= 2) < 1)
        return - 0.5 * (Math.sqrt(1 - k * k) - 1);

      return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
    },
  },

  Elastic: {
    In: (k: number) => {
      if (k === 0)
        return 0;

      if (k === 1)
        return 1;

      return -Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);
    },

    Out: (k: number) => {
      if (k === 0)
        return 0;

      if (k === 1)
        return 1;

      return Math.pow(2, -10 * k) * Math.sin((k - 0.1) * 5 * Math.PI) + 1;
    },

    InOut: (k: number) => {
      if (k === 0)
        return 0;

      if (k === 1)
        return 1;

      k *= 2;

      if (k < 1)
        return -0.5 * Math.pow(2, 10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI);

      return 0.5 * Math.pow(2, -10 * (k - 1)) * Math.sin((k - 1.1) * 5 * Math.PI) + 1;
    },
  },

  Back: {
    In: (k: number) => {
      const s = 1.70158;
      return k * k * ((s + 1) * k - s);
    },

    Out: (k: number) => {
      const s = 1.70158;
      return --k * k * ((s + 1) * k + s) + 1;
    },

    InOut: (k: number) => {
      const s = 1.70158 * 1.525;
      if ((k *= 2) < 1)
        return 0.5 * (k * k * ((s + 1) * k - s));

      return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
    },
  },

  Bounce: {
    In: (k: number) => {
      return 1 - Easing.Bounce.Out(1 - k);
    },

    Out: (k: number) => {
      if (k < (1 / 2.75))
        return 7.5625 * k * k;
      if (k < (2 / 2.75))
        return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
      if (k < (2.5 / 2.75))
        return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
      return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
    },

    InOut: (k: number) => {
      if (k < 0.5)
        return Easing.Bounce.In(k * 2) * 0.5;

      return Easing.Bounce.Out(k * 2 - 1) * 0.5 + 0.5;
    },
  },
};

/** Interpolation functions from tween.js
 *  @public
 */
export const Interpolation = {

  Linear: (v: any, k: number) => {
    const m = v.length - 1;
    const f = m * k;
    const i = Math.floor(f);
    const fn = Interpolation.Utils.Linear;

    if (k < 0)
      return fn(v[0], v[1], f);

    if (k > 1)
      return fn(v[m], v[m - 1], m - f);

    return fn(v[i], v[i + 1 > m ? m : i + 1], f - i);
  },

  Bezier: (v: any, k: number) => {
    let b = 0;
    const n = v.length - 1;
    const pw = Math.pow;
    const bn = Interpolation.Utils.Bernstein;

    for (let i = 0; i <= n; i++)
      b += pw(1 - k, n - i) * pw(k, i) * v[i] * bn(n, i);

    return b;
  },

  CatmullRom: (v: any, k: number) => {
    const m = v.length - 1;
    let f = m * k;
    let i = Math.floor(f);
    const fn = Interpolation.Utils.CatmullRom;

    if (v[0] === v[m]) {
      if (k < 0) {
        i = Math.floor(f = m * (1 + k));
      }
      return fn(v[(i - 1 + m) % m], v[i], v[(i + 1) % m], v[(i + 2) % m], f - i);
    } else {
      if (k < 0)
        return v[0] - (fn(v[0], v[0], v[1], v[1], -f) - v[0]);

      if (k > 1)
        return v[m] - (fn(v[m], v[m], v[m - 1], v[m - 1], f - m) - v[m]);

      return fn(v[i ? i - 1 : 0], v[i], v[m < i + 1 ? m : i + 1], v[m < i + 2 ? m : i + 2], f - i);
    }
  },

  Utils: {
    Linear: (p0: number, p1: number, t: number) => {
      return (p1 - p0) * t + p0;
    },

    Bernstein: (n: number, i: number) => {
      const fc = Interpolation.Utils.Factorial;
      return fc(n) / fc(i) / fc(n - i);
    },

    Factorial: (() => {
      const a = [1];
      return (n: number) => {
        let s = 1;

        if (a[n])
          return a[n];

        for (let i = n; i > 1; i--)
          s *= i;

        a[n] = s;
        return s;
      };

    })(),

    CatmullRom: (p0: number, p1: number, p2: number, p3: number, t: number) => {
      const v0 = (p2 - p0) * 0.5;
      const v1 = (p3 - p1) * 0.5;
      const t2 = t * t;
      const t3 = t * t2;
      return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (- 3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
    },
  },
};
