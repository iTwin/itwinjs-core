/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";

const outputDir = path.join(os.tmpdir(), "output");

describe.skip("IOS Platform Test", () => {
  it("Filesystem (Uint8Array) - writeFileSync, appendFileSync and readFileSync", () => {
    const testDir = path.join(outputDir, "mobile-introp");
    const testFile = path.join(testDir, "test.bin");
    if (fs.existsSync(testDir)) {
      fs.unlinkSync(testDir);
    }
    fs.mkdirSync(testDir);
    assert.isTrue(fs.existsSync(testDir));

    const testArray = new Uint8Array(1024);
    for (let i = 0; i < testArray.length; i++) {
      testArray[i] = i % 255;
    }

    fs.writeFileSync(testFile, testArray);
    // binary test
    const outArray = fs.readFileSync(testFile, { encoding: null });
    assert.equal(outArray.length, testArray.length, "array size must match");
    for (let i = 0; i < testArray.length; i++) {
      assert.equal(testArray[i], outArray[i], `content at offset ${i} missmatch`);
    }

    assert.equal(fs.lstatSync(testFile).size, testArray.length, "file size must match");

    fs.appendFileSync(testFile, testArray);

    // binary test
    const outArrayx2 = fs.readFileSync(testFile, { encoding: null });
    assert.equal(outArrayx2.length, testArray.length * 2, "array size must match after append");
    for (let i = 0; i < testArray.length; i++) {
      assert.equal(testArray[i], outArrayx2[i], `content at offset ${i} missmatch after append`);
    }
    // check append
    for (let k = 0; k < testArray.length; k++) {
      assert.equal(testArray[k], outArrayx2[k + testArray.length], `content at offset ${k} missmatch after append`);
    }
    assert.equal(fs.lstatSync(testFile).size, testArray.length * 2, "file size must match after append");

    fs.unlinkSync(testFile);
    assert.isFalse(fs.existsSync(testFile));
  });

  it("Filesystem (string) - writeFileSync, appendFileSync and readFileSync", () => {
    const testDir = path.join(outputDir, "mobile-introp");
    const testFile = path.join(testDir, "test.bin");
    if (fs.existsSync(testDir)) {
      fs.unlinkSync(testDir);
    }

    fs.mkdirSync(testDir);
    assert.isTrue(fs.existsSync(testDir));

    const testString = "*".repeat(1024);
    fs.writeFileSync(testFile, testString);

    // string test
    const outString = fs.readFileSync(testFile, { encoding: "utf-8" });
    assert.equal(testString, outString);

    fs.appendFileSync(testFile, testString);

    const outStringx2 = fs.readFileSync(testFile, { encoding: "utf-8" });
    assert.equal(testString.length * 2, outStringx2.length);
    assert.equal(testString + testString, outStringx2);

    fs.unlinkSync(testFile);
    assert.isFalse(fs.existsSync(testFile));
  });

  /*
- (bool) existsSync: (NSString*)path;
- (void) unlinkSync: (NSString*)path;
- (void) removeSync: (NSString*)path;
- (void) mkdirSync: (NSString*)path;
- (void) rmdirSync: (NSString*)path;
- (void) appendFileSync: (NSString*)path :(JSValue*)data;
- (NSArray<NSString*>*) readdirSync: (NSString*)path;
- (void) writeFileSync: (NSString*)path :(JSValue*)content;
- (void) copySync: (NSString*)fromPath :(NSString*)toPath;
- (JSValue*) lstatSync: (JSValue*)path;
- (JSValue*) readFileSync: (JSValue*)path :(JSValue*)options;
- (JSValue*) istatSync: (JSValue*)path;
- (NSString*) realpathSync: (JSValue*)path :(JSValue*)options;
- (void) closeSync: (JSValue*)fd;
- (JSValue*) openSync: (NSString*)path :(NSString*)flags :(JSValue*)mode; */

});
