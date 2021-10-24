/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// import { LocalExtensionProps } from "../extension/Extension";
// import { ExtensionAdmin } from "../extension/ExtensionAdmin";

// // emulates a main.js for use as the `main` in the Extension Manifest
// const testExtensionMain = `export default {
//   activate: function activate(_vm) {console.log("hello world");}
// }`;
// // emulates a loader.js file as a `module` in the Extension Manifest
// const testExtensionLoader = `export default {
//   manifest: import("../package.json"),
//   load: () => import("./main.js"),
// }`;

// (await import("./index.js").default()

// describe.only("", async () => {
//   it("", async () => {
//     // const admin = new ExtensionAdmin();
//     // const localExtProp: LocalExtensionProps = {
//     //   manifest: {
//     //     name: "test",
//     //     version: "2.1.1",
//     //     main: testExtensionMain,
//     //     module: testExtensionLoader,
//     //   },
//     //   location: "",
//     // };

//     // await admin.addExtension(localExtProp, async () => import ("ext"));

//     // const executableMain = Function(localExtProp.manifest.main!);
//     // executableMain();
//   });
// });
