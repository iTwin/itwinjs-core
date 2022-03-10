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
        // Environment variable is read in configureMocha.js and passed to BentleyMochaReporter.
        let testResultsUrl = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("mocha_test_results.xml")
        setenv("TEST_RESULTS_PATH", testResultsUrl.path, 1)
        
        let host = IModelJsHost.sharedInstance()
        let bundlePath = Bundle.main.bundlePath
        let mainPath = bundlePath.appending("/Assets/main.js")
        let main = URL(fileURLWithPath: mainPath)
        logger.log("(ios): Running tests.")
        host.loadBackend(main) { [self] (numFailed: UInt32) in
            logger.log("(ios): Finished Running tests. \(numFailed) tests failed.")
            do {
                let text = try String(contentsOf: testResultsUrl, encoding: .utf8)
                for line in text.components(separatedBy: .newlines) {
                    logger.log("[Mocha_Result_XML]: \(line)")
                }
            } catch {
                logger.log("Failed to read mocha test results.")
            }
            
            // Indicate via UI that the tests have finished.
            self.testsFinished = true
        }
    }
}

