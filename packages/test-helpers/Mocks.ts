/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as moq from "typemoq";
export * from "typemoq";

/** Should be called if mock.object is used to resolve a Promise. Otherwise
 * typemoq tries to handle 'then' method of the mocked object and the promise
 * never resolves. See https://github.com/florinn/typemoq/issues/70.
 */
export const configureForPromiseResult = <T>(mock: moq.IMock<T>): void => {
  mock.setup((x: any) => x.then).returns(() => undefined);
};
