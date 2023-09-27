/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import Foundation
import os

import IModelJsNative

class ViewController: ObservableObject {
    @Published var testStatus = "Tests not started."
    @Published var numFailed = -1

    func copyAssetsToTemp() throws {
        let srcPath = Bundle.main.bundlePath.appending("/Assets/assets")
        let dstPath = NSString(string: NSTemporaryDirectory()).appendingPathComponent("assets")
        let fm = FileManager.default
        if fm.fileExists(atPath: dstPath) {
            try fm.removeItem(atPath: dstPath)
        }
        try fm.copyItem(atPath: srcPath, toPath: dstPath)
    }

    func runTests() {
        testStatus = "Starting tests..."
        do {
            try copyAssetsToTemp()
        } catch {
            NSLog("Error copying assets to tmp: \(error)")
            self.testStatus = "Tests initialization error."
            return
        }
        // Environment variable is read in configureMocha.js and passed to BentleyMochaReporter.
        let testResultsUrl = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("mocha_test_results.xml")
        setenv("TEST_RESULTS_PATH", testResultsUrl.path, 1)

        let host = IModelJsHost.sharedInstance()
        let bundlePath = Bundle.main.bundlePath
        let mainPath = bundlePath.appending("/Assets/main.js")
        let main = URL(fileURLWithPath: mainPath)
        NSLog("(ios): Running tests.")
        host.loadBackend(main) { [self] (numFailed: UInt32) in
            do {
                let text = try String(contentsOf: testResultsUrl, encoding: .utf8)
                for line in text.components(separatedBy: .newlines) {
                    NSLog("[Mocha_Result_XML]: \(line)")
                }
            } catch {
                NSLog("(ios): Failed to read mocha test results.")
            }

            // Indicate via UI that the tests have finished.
            self.testStatus = "Tests finished."
            self.numFailed = Int(numFailed)
            NSLog("(ios): Tests finished. \(numFailed) tests failed.")
        }
    }
}

