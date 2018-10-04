/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module redux-ts */

import { combineReducers as baseCombineReducers } from "redux";

// tslint:disable

/** Shorthand for "any function".  TSLint doesn't like the built-in `Function` type for some reason. */
export type FunctionType = (...args: any[]) => any;

/**
 * Similar to the built-in [Readonly](https://www.typescriptlang.org/docs/handbook/advanced-types.html#mapped-types), type alias but applied recursively.
 * This basically makes all nested properties/members of an object/array immutable.
 */
export type DeepReadonly<T> =
  T extends ReadonlyArray<infer R> ? (R extends object ? DeepReadonlyArray<R> : ReadonlyArray<R>) :
  T extends FunctionType ? T :
  T extends object ? DeepReadonlyObject<T> :
  T;

/** TypeScript doesn't actually allow recursive type aliases, so these are just sort of a hack to make DeepReadonly work */
export interface DeepReadonlyArray<T> extends ReadonlyArray<DeepReadonly<T>> { }
/** TypeScript doesn't actually allow recursive type aliases, so these are just sort of a hack to make DeepReadonly work */
export type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

/**
 * A basic Redux [Action](https://redux.js.org/basics/actions).
 * Technically, redux only requires actions to have a `type` property.
 *
 * We use a TypeScript [Generic](https://www.typescriptlang.org/docs/handbook/generics.html) interface here to preserve the "literal-ness" of the `type` property.
 * In other words, `Action<"FOO">` will be of type `{ type: "FOO" }`; it won't be simplified to `{ type: string }`.
 *
 * See the [TS Handbook](https://www.typescriptlang.org/docs/handbook/advanced-types.html#string-literal-types) for more info on TypeScript string literal types.
 */
export interface Action<T extends string> {
  type: T;
}

/**
 * A Redux [Action](https://redux.js.org/basics/actions), with additional "payload" information.
 * Technically, Redux allows actions to take any shape, provided they specify a `type` property.
 *
 * However, in order to simplify TypeScript typings, we follow this [Flux Standard Actions](https://github.com/redux-utilities/flux-standard-action)-like
 * convention, where all additional action information goes into a `payload` property.
 */
export interface ActionWithPayload<T extends string, P> extends Action<T> {
  payload: P;
}

/**
 * Creates a basic Redux Redux [Action](https://redux.js.org/basics/actions) without a payload.
 * **This is meant to be used as a shortcut for defining Action Creators.**
 *
 * For example,
 * ```
 *   () => createAction("FOO", ids)
 * ```
 * defines an action creator of type:
 * ```
 *   () => { type: "FOO" }
 *   // which is equivalent to:
 *   () => Action<"FOO">
 * ```
 *
 * Note that the generic type parameters can always be omitted - TypeScript will be able to infer them.
 * @param type The string to use as the action's type property. Should have a [string literal type](https://www.typescriptlang.org/docs/handbook/advanced-types.html#string-literal-types).
 */
export function createAction<T extends string>(type: T): Action<T>;
/**
 * Creates a basic Redux Redux [Action](https://redux.js.org/basics/actions) _with_ a payload value.
 * **This is meant to be used as a shortcut for defining Action Creators.**
 *
 * For example,
 * ```
 *   (ids: number[]) => createAction("FOO", ids)
 * ```
 * defines an action creator of type:
 * ```
 *   (ids: number[]) => { type: "FOO", payload: ReadonlyArray<number> }
 *   // which is equivalent to:
 *   (ids: number[]) => ActionWithPayload<"FOO", ReadonlyArray<number>>
 * ```
 *
 * Note that the generic type parameters can always be omitted - TypeScript will be able to infer them.
 * @param type The string to use as the action's type property. Should have a [string literal type](https://www.typescriptlang.org/docs/handbook/advanced-types.html#string-literal-types).
 * @param payload The value to use as the action's payload property. May be of any type.
 */
export function createAction<T extends string, P>(type: T, payload: P): ActionWithPayload<T, DeepReadonly<P>>;
export function createAction<T extends string, P>(type: T, payload?: P) {
  return (payload === undefined) ? { type } : { type, payload };
}

/**
 * Just an object where every property is a Redux [Action Creator](https://redux.js.org/basics/actions#action-creators).
 */
export type ActionCreatorsObject = { [actionCreatorName: string]: FunctionType; };

/**
 * A TypeScript type alias that represents the [Union Type](https://www.typescriptlang.org/docs/handbook/advanced-types.html#union-types) of all actions
 * possibly created by _any_ of the action creators in a given `ActionCreatorsObject`.
 *
 * For example,
 * ```
 *   // given:
 *   const MyActionCreators = {
 *     createBanana: () => createAction("BANANA"),
 *     createApple:  () => createAction("APPLE", true),
 *     createOrange: (n: number) => createAction("BANANA", n),
 *   }
 *   // then:
 *   type X = ActionsUnion<typeof MyActionCreators>;
 *   // is equivalent to:
 *   type X = Action<"BANANA">
 *            | ActionWithPayload<"APPLE", boolean>
 *            | ActionWithPayload<"ORANGE", number>;
 * ```
 */
export type ActionsUnion<A extends ActionCreatorsObject> = ReturnType<A[keyof A]>;

/**
 * A TypeScript type alias that uses [conditional types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html) (read: magic)
 * to represent the _exact_ (literal) type of an action's `type` property.
 *
 * More importantly, this can be used to determine a union type which represents the `type` string literal types for _any_ action in a given `ActionsUnion`.
 *
 * For example,
 * ```
 *   // given:
 *   type MyActions = Action<"BANANA">
 *                    | ActionWithPayload<"APPLE", boolean>
 *                    | ActionWithPayload<"ORANGE", number>;
 *   // then:
 *   type X = ActionTypes<MyActions>;
 *   // is equivalent to:
 *   type X = "BANANA" | "APPLE" | "ORANGE";
 * ```
 */
export type ActionTypes<A extends Action<any>> = A["type"] extends infer X ? X : never;

/**
 * A helper function for defining a type-safe Redux [Reducer](https://redux.js.org/basics/reducers).
 * **You do not need this to define a type-safe reducer** - this just helps avoid boilerplate and tries to deduce as many types as possible.
 *
 * Here's an example:
 * ```
 * // given:
 * type MyActions = Action<"BANANA">
 *                  | ActionWithPayload<"APPLE", boolean>
 *                  | ActionWithPayload<"ORANGE", number>;
 * // you could write:
 * const myReducer = (state: string = "", action: MyActions) => {
 *  switch(action.type) {
 *    case "BANANA": return state + "a banana ";
 *    case "APPLE": return state + `a ${action.payload} apple `;
 *    case "ORANGE": return state + `${action.payload} oranges `;
 *  }
 *  return state;
 * };
 * // *OR*, you write this as:
 * const myReducer = createReducer<Actions, string>("", {
 *  "BANANA": (state, action) => state + "a banana ",
 *  "APPLE": (state, action) => state + `a ${action.payload} apple `,
 *  "ORANGE": (state, action) => state + `${action.payload} oranges `,
 * });
 * ```
 * Note that the generic type parameters to `createReducer` **are always required**.
 *
 * //@template TActions The union type of all actions potentially handled by this reducer
 * //@template TState The type of the state that this reducer will accept / return.
 * @param initialState The initial state, to be used when the current state is undefined
 * @param handlers An object which is basically a map of action types to "mini-reducer" functions.
 * Each property of this object should:
 *   - Have a name that matches the `type` property of one of the Actions handled by this reducer
 *   - Define a "mini-reducer" function, which will be only be called when the action's `type` matches the property name.
 *     - Because the exact action type is know for each of these "mini-reducer" functions, you can omit parameter type annotations.
 */
export function createReducer<TActions extends Action<any>, TState>(initialState: DeepReadonly<TState>, handlers: ReducerHandler<DeepReadonly<TState>, TActions>) {
  return function reducer(state = initialState as DeepReadonly<TState>, action: TActions): DeepReadonly<TState> {
    const type: ActionTypes<typeof action> = action.type;
    if (handlers.hasOwnProperty(type))
      return handlers[type]!(state, action as any);

    return state;
  };
}

/**
 * A type alias used in the "handlers" parameter of `createReducer` (see above).
 */
export type ReducerHandler<S, A extends Action<any>> = {
  [actionType in ActionTypes<A>]?: (state: S, action: Extract<A, Action<actionType>>) => S;
};

/**
 * A Redux [Reducer](https://redux.js.org/basics/reducers).
 */
export type Reducer<S, A> = (state: S, action: A) => S;

/**
 * A TypeScript type alias that represents a union of all action types handled by a Redux [Reducer](https://redux.js.org/basics/reducers).
 *
 * If you have created a type-safe reducer function using `combineReducers`, you can use this to infer your actions union type instead of having to define it manually.
 */
export type ReducerActions<R> =
  R extends Reducer<any, infer X> ? (
    X extends ActionWithPayload<infer T, infer P> ? DeepReadonly<ActionWithPayload<T, P>> :
    X extends Action<infer T2> ? DeepReadonly<Action<T2>> :
    X
  ) : R;

/**
 * A TypeScript type alias that represents the return type of a Redux [Reducer](https://redux.js.org/basics/reducers).
 *
 * If you have created a type-safe reducer function using `combineReducers`, you can use this to infer your state type instead of having to define it manually.
 */
export type StateType<R extends Reducer<any, any>> = DeepReadonly<ReturnType<R>>;


/**
 * So we don't actually need to implement our own version of combineReducers, but we are going to cast it
 * to this type, which will do a better job of preserving/deducing the Action and State types.
 */
export type CombineReducersFunction = <A>(reducers: A) =>
  (state: CombinedReducerState<A>, action: ReducerMapActions<A>) => CombinedReducerState<A>;

/**
 * A type alias which represents the state created by the reducer returned by combineReducers for a given `reducers` argument.
 * Used above by `CombineReducersFunction`, our custom type definition for combineReducers.
 */
export type CombinedReducerState<R> = { readonly [K in keyof R]: R[K] extends FunctionType ? StateType<R[K]> : never };

/**
 * A type alias which represents the union type of all actions handled by the reducer returned by combineReducers for a given `reducers` argument.
 * Used above by `CombineReducersFunction`, our custom type definition for combineReducers.
 */
export type ReducerMapActions<R> = ReducerActions<R[keyof R]>;


// Since the implementation is copied from redux, we'll copy the docs as well:
/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * //@template S Combined state object type.
 *
 * @param reducers An object whose values correspond to different reducer
 *   functions that need to be combined into one. One handy way to obtain it
 *   is to use ES6 `import * as reducers` syntax. The reducers may never
 *   return undefined for any action. Instead, they should return their
 *   initial state if the state passed to them was undefined, and the current
 *   state for any unrecognized action.
 *
 * Returns: A reducer function that invokes every reducer inside the passed
 *   object, and builds a state object with the same shape.
 */
export const combineReducers: CombineReducersFunction = baseCombineReducers as any;
