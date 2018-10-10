/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/**
 * Similar to a normal Promise, a DelayedPromise represents the eventual completion (or failure)
 * and resulting value of an asynchronous operation ***that has not yet started***.
 *
 * The asynchronous operation behind a DelayedPromise will start when any of the following occurs:
 *  - The DelayedPromise is `await`ed.
 *  - A callback is attached via `.then()` or `.catch()`.
 *  - The asynchronous operation is explicitly started via `.start()`
 *
 * Just as normal Promises will never return to their pending state once fulfilled or rejected,
 * a DelayedPromise will never re-execute its asynchronous operation more than **once**.
 *
 * Ultimately, a DelayedPromise is nothing more than some syntactic sugar that allows you to
 * represent an (asynchronously) lazily-loaded value as an instance property instead of a method.
 * You could also accomplish something similar by defining an async function as a property getter.
 * However, since a property defined as a DelayedPromise will not start simply by being accessed,
 * additional (non-lazily-loaded) "nested" properties can be added.
 *
 * [!alert text="*Remember:* Unlike regular Promises in JavaScript, DelayedPromises represent processes that **may not** already be happening." kind="warning"]
 */
export class DelayedPromise<T> implements Promise<T> {

  /**
   * Constructs a DelayedPromise object.
   * @param startCallback The asynchronous callback to execute when this DelayedPromise should be "started".
   */
  constructor(startCallback: () => Promise<T>) {
    let pending: Promise<T> | undefined;
    this.start = () => {
      pending = pending || startCallback();
      return pending;
    };
  }

  // We need this in order to fulfill the Promise interface defined in lib.es2015.symbol.wellknown.d.ts
  public readonly [Symbol.toStringTag]: "Promise" = "Promise";

  /**
   * Explicitly starts the asynchronous operation behind this DelayedPromise (if it hasn't started already).
   */
  public start: () => Promise<T>;

  /**
   * Attaches callbacks for the resolution and/or rejection of the Promise.
   * @param onfulfilled The callback to execute when the Promise is resolved.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @return A Promise for the completion of which ever callback is executed.
   */
  public then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2> {
    return this.start().then(onfulfilled, onrejected);
  }

  /**
   * Attaches a callback for only the rejection of the Promise.
   * @param onrejected The callback to execute when the Promise is rejected.
   * @return A Promise for the completion of the callback.
   */
  public catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult> {
    return this.start().catch(onrejected);
  }
}

// This keeps us from accidentally overriding one of DelayedPromise's methods in the DelayedPromiseWithProps constructor
export interface NoDelayedPromiseMethods {
  [propName: string]: any;
  start?: never;
  then?: never;
  catch?: never;
}

// See definition of DelayedPromiseWithProps below
export interface DelayedPromiseWithPropsConstructor {

  /**
   * Constructs a DelayedPromiseWithProps object, which is at once both:
   *  - A DelayedPromise object representing the eventual completion (or failure)
   *    of an asynchronous operation returning a value of type `TPayload`
   *  - _and_ a readonly "wrapper" around an instance of type `TProps`
   *
   * @param props An object with properties and methods that will be accessible
   *              as if they were readonly properties of the DelayedPromiseWithProps object being constructed.
   * @param startCallback The asynchronous callback to execute when as soon as this DelayedPromise should be "started".
   */
  new <TProps extends NoDelayedPromiseMethods, TPayload>(props: TProps, startCallback: () => Promise<TPayload>): Readonly<TProps> & DelayedPromise<TPayload>;
}

// Because the property getters that wrap `props` are dynamically added, TypeScript isn't aware of them.
// So by defining this as a class _expression_, we can cast the constructed type to Readonly<TProps> & DelayedPromise<TPayload>
// tslint:disable-next-line:variable-name
export const DelayedPromiseWithProps = (class <TProps extends NoDelayedPromiseMethods, TPayload> extends DelayedPromise<TPayload> {
  constructor(props: TProps, cb: () => Promise<TPayload>) {
    super(cb);

    const handler = {
      get: (target: TProps, name: string) => {
        return (name in this) ? this[name as keyof this] : target[name as keyof TProps];
      },
    };

    return new Proxy(props, handler) as Readonly<TProps> & DelayedPromise<TPayload>;
  }
}) as DelayedPromiseWithPropsConstructor;

// Define the type of a DelayedPromiseWithProps instance
export type DelayedPromiseWithProps<TProps, TPayload> = Readonly<TProps> & DelayedPromise<TPayload>;
