/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import Foundation
import os

import IModelJsNative

class ViewController: ObservableObject {
    private let logger = Logger(subsystem: "com.bentley.core-test-runner", category: "tests")
    @Published var testsFinished = false
    
    func runTests() {
        var testResultsUrl = URL(fileURLWithPath: NSTemporaryDirectory())
        testResultsUrl.appendPathComponent("mocha_test_results.xml")
        
        print(testResultsUrl.path)
        setenv("TEST_RESULTS_PATH", testResultsUrl.path, 1)
        
        let host = IModelJsHost.sharedInstance()
        let bundlePath = Bundle.main.bundlePath
        let mainPath = bundlePath.appending("/Assets/main.js")
        let main = URL(fileURLWithPath: mainPath)
        logger.log("(ios): Running tests.")
        host.loadBackend(main) { [self] (numFailed: UInt32) in
            logger.log("(ios): Finished Running tests. \(numFailed) tests failed.")
            
            do {
                let data = try String(contentsOfFile: testResultsUrl.path, encoding: .utf8)
                for line in data.components(separatedBy: .newlines) {
                    logger.log("[Mocha_Result_XML]: \(line)")
                }
            } catch {
                logger.log("Failed to read mocha test results.")
                print(error)
            }
            
            // Indicate via UI that the tests have finished.
            self.testsFinished = true
        }
    }
}

