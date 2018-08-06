/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import * as enzyme from "enzyme";
import * as chaiJestSnapshot from "chai-jest-snapshot";
import "../../../scripts/setup-tests.js";

// configure enzyme (testing utils for React)
enzyme.configure({ adapter: new (require("enzyme-adapter-react-16"))() }); // tslint:disable-line:no-var-requires
chaiJestSnapshot.addSerializer(require("enzyme-to-json/serializer")); // tslint:disable-line:no-var-requires

const shouldRecurseIntoDirectory = (directoryPath: string) => {
  return fs.lstatSync(directoryPath).isDirectory()
    && directoryPath !== "lib"
    && directoryPath !== "node_modules";
};
const requireLibModules = (dir: string) => {
  const files = fs.readdirSync(dir);
  files.map((fileName) => path.join(dir, fileName)).filter(shouldRecurseIntoDirectory).forEach((filePath) => {
    requireLibModules(filePath);
  });
  files.filter((fileName) => {
    return [".ts"].some((ext) => fileName.endsWith(ext) && !fileName.endsWith(".test" + ext));
  }).forEach((fileName) => {
    const requirePath = path.resolve(dir, path.basename(fileName));
    require(requirePath);
  });
};
requireLibModules(path.resolve(process.cwd(), "src"));
