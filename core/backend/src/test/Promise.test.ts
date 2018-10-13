/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// import { assert } from "chai";

// class PromiseTestError extends Error { }

// class PromiseTest {
//   public result: string = "";
//   public sleepCount: number = 0;

//   private append(s: string): void {
//     this.result += s;
//   }

//   public static async sleep(millis: number): Promise<any> {
//     return new Promise((resolve) => setTimeout(resolve, millis));
//   }

//   public async sleepyAppend(s: string, millis: number = 0): Promise<number> {
//     if (millis > 0) {
//       this.sleepCount++;
//       await PromiseTest.sleep(millis);
//     }

//     this.append(s);
//     return this.result.length;
//   }

//   public static async alwaysReject(): Promise<number> {
//     return Promise.reject(new PromiseTestError());
//   }

//   public static async doubleWithDelay(n: number, millis: number = 0): Promise<number> {
//     return new Promise<number>((resolve) => setTimeout(() => { resolve(n * 2); }, millis));
//   }

//   public static async doubleWithDelayWrapper1(n: number, millis: number = 0): Promise<number> {
//     return PromiseTest.doubleWithDelay(n, millis);
//   }

//   public static doubleWithDelayWrapper2(n: number, millis: number = 0): Promise<number> {
//     return PromiseTest.doubleWithDelay(n, millis);
//   }

//   public static async quadrupleWithDelay(n: number, millis: number = 0): Promise<number> {
//     return await PromiseTest.doubleWithDelay(n, millis / 2) + await PromiseTest.doubleWithDelay(n, millis / 2);
//   }
// }

// describe.only("Promise Test", () => {

//   it("1", async () => {
//     const p = new PromiseTest();
//     let len: number;
//     len = await p.sleepyAppend("A");
//     assert.equal(p.result, "A");
//     assert.equal(len, 1);
//     len = await p.sleepyAppend("B");
//     assert.equal(p.result, "AB");
//     assert.equal(len, 2);
//     len = await p.sleepyAppend("C");
//     assert.equal(p.result, "ABC");
//     assert.equal(len, 3);
//   });

//   it("2", async () => {
//     const p = new PromiseTest();
//     let len: number;
//     len = await p.sleepyAppend("A", 1000);
//     assert.equal(p.result, "A");
//     assert.equal(len, 1);
//     len = await p.sleepyAppend("B", 500);
//     assert.equal(p.result, "AB");
//     assert.equal(len, 2);
//     len = await p.sleepyAppend("C");
//     assert.equal(p.result, "ABC");
//     assert.equal(len, 3);
//   });

//   it("3", async () => {
//     const p = new PromiseTest();
//     let len: number;
//     p.sleepyAppend("A", 1000);
//     assert.equal(p.result, "");
//     assert.equal(p.sleepCount, 1);
//     p.sleepyAppend("B", 500);
//     assert.equal(p.result, "");
//     assert.equal(p.sleepCount, 2);
//     len = await p.sleepyAppend("C");
//     assert.equal(p.result, "C");
//     assert.equal(len, 1);
//     len = await p.sleepyAppend("D", 1200);
//     assert.equal(p.sleepCount, 3);
//     assert.equal(p.result, "CBAD");
//     assert.equal(len, 4);
//   });

//   it("4", async () => {
//     const p = new PromiseTest();
//     await Promise.all([p.sleepyAppend("A", 1000), p.sleepyAppend("B", 500), p.sleepyAppend("C")]);
//     assert.equal(p.result, "CBA");
//   });

//   it("5", async () => {
//     const p = new PromiseTest();
//     await Promise.all([p.sleepyAppend("A"), p.sleepyAppend("B"), p.sleepyAppend("C")]);
//     assert.equal(p.result, "ABC");
//   });

//   it("6", async () => {
//     const p = new PromiseTest();
//     const chain: Promise<number> = p.sleepyAppend("A", 1000).then(() => p.sleepyAppend("B", 500)).then(() => p.sleepyAppend("C")).then(() => { assert.equal(p.result, "ABC"); return p.result.length; });
//     assert.equal(p.sleepCount, 1);
//     assert.equal(p.result, "");
//     const len = await chain;
//     assert.equal(p.result, "ABC");
//     assert.equal(len, 3);
//     assert.equal(p.sleepCount, 2);
//   });

//   it("7", async () => {
//     let b: boolean = false;
//     const p = new PromiseTest();
//     PromiseTest.alwaysReject().then(() => p.sleepyAppend("A")).catch((reason) => { b = true; assert.isTrue(reason instanceof PromiseTestError); });
//     await p.sleepyAppend("B", 500);
//     assert.isTrue(b);
//     assert.equal(p.result, "B");
//   });

//   it("8", async () => {
//     let b: boolean = false;
//     const p = new PromiseTest();
//     PromiseTest.alwaysReject().then(() => p.sleepyAppend("A"), (reason) => { b = true; assert.isTrue(reason instanceof PromiseTestError); });
//     await p.sleepyAppend("B", 500);
//     assert.isTrue(b);
//     assert.equal(p.result, "B");
//   });

//   it("9", async () => {
//     const p = new PromiseTest();
//     try {
//       await p.sleepyAppend("A");
//       await p.sleepyAppend("B");
//       await PromiseTest.alwaysReject();
//       await p.sleepyAppend("C");
//     } catch (error) {
//       assert.isTrue(error instanceof PromiseTestError);
//     }
//     assert.equal(p.result, "AB");
//   });

//   it("10", async () => {
//     const x: number = await PromiseTest.doubleWithDelay(2, 1000);
//     const y: number = await PromiseTest.doubleWithDelay(3, 500);
//     const z: number = await PromiseTest.doubleWithDelay(5);
//     assert.equal(x + y + z, 20);
//   });

//   it("11", async () => {
//     const [x, y, z] = await Promise.all([PromiseTest.doubleWithDelay(2, 1000), PromiseTest.doubleWithDelay(3, 500), PromiseTest.doubleWithDelay(5)]);
//     assert.equal(x + y + z, 20);
//   });

//   it("12", async () => {
//     let total: number = 0;
//     PromiseTest.doubleWithDelay(2, 1000).then((x) => total += x);
//     PromiseTest.doubleWithDelay(3, 500).then((y) => total += y);
//     PromiseTest.doubleWithDelay(5).then((z) => total += z);
//     await PromiseTest.sleep(1200);
//     assert.equal(total, 20);
//   });

//   it("13", async () => {
//     const x: number = await PromiseTest.quadrupleWithDelay(2, 1000);
//     const y: number = await PromiseTest.quadrupleWithDelay(3, 500);
//     const z: number = await PromiseTest.quadrupleWithDelay(5);
//     assert.equal(x + y + z, 40);
//   });

//   it("14", async () => {
//     const [x, y, z] = await Promise.all([PromiseTest.quadrupleWithDelay(2, 1000), PromiseTest.quadrupleWithDelay(3, 500), PromiseTest.quadrupleWithDelay(5)]);
//     assert.equal(x + y + z, 40);
//   });

//   it("15", async () => {
//     let total: number = 0;
//     PromiseTest.quadrupleWithDelay(2, 1000).then((x) => total += x);
//     PromiseTest.quadrupleWithDelay(3, 500).then((y) => total += y);
//     PromiseTest.quadrupleWithDelay(5).then((z) => total += z);
//     await PromiseTest.sleep(1200);
//     assert.equal(total, 40);
//   });

//   it("16", async () => {
//     for (let i: number = 0; i < 1000; i++) {
//       await PromiseTest.doubleWithDelayWrapper1(i + 1, 1);
//     }
//   });

//   it("17", async () => {
//     for (let i: number = 0; i < 1000; i++) {
//       await PromiseTest.doubleWithDelayWrapper2(i + 1, 1);
//     }
//   });

// });
