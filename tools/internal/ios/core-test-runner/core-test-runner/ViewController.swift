/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import Foundation
import os

import IModelJsNative

/// Convenience type alias for a dictionary intended for interop via JSON.
typealias JSON = [String: Any]

class ViewController: ObservableObject {
    @Published var testStatus = "Tests not started."
    @Published var numFailed = -1
    private var configData: JSON = [:]
    private var exitAfterCompletion = false

    init() {
        parseArguments()
        exitAfterCompletion = configData["IMJS_EXIT_AFTER_COMPLETION"] as? String ?? "" == "1"
    }

    private func copyAssetsToTemp() throws {
        let srcPath = Bundle.main.bundlePath.appending("/Assets/assets")
        let dstPath = NSString(string: NSTemporaryDirectory()).appendingPathComponent("assets")
        let fm = FileManager.default
        if fm.fileExists(atPath: dstPath) {
            try fm.removeItem(atPath: dstPath)
        }
        try fm.copyItem(atPath: srcPath, toPath: dstPath)
    }

    private func trimResults(_ documentsDir: String, _ maxResults: Int = 10) {
        let fm = FileManager.default
        do {
            let files = try fm.contentsOfDirectory(atPath: documentsDir).filter { $0.hasPrefix("mocha_test_results-") }
            if files.count > maxResults {
                let documentsURL = URL(fileURLWithPath: documentsDir)
                let deleteNum = files.count - maxResults
                for file in files.sorted()[..<deleteNum] {
                    try fm.removeItem(at: documentsURL.appendingPathComponent(file))
                }
            }
        } catch {}
    }

    private func parseArguments() {
        // args can come from Xcode or when running the simulator (xcrun simctl launch), useful for automation
        ProcessInfo.processInfo.arguments[1...].forEach { arg in
            if arg.hasPrefix("IMJS_") {
                let split = arg.split(separator: "=", maxSplits: 1)
                if split.count == 2 {
                    configData[String(split[0])] = String(split[1])
                }
            }
        }
    }

    private func log(_ message: String) {
        if exitAfterCompletion {
            print(message)
        } else {
            NSLog(message)
        }
    }

    func runTests() {
        testStatus = "Starting tests..."
        do {
            try copyAssetsToTemp()
        } catch {
            log("Error copying assets to tmp: \(error)")
            self.testStatus = "Tests initialization error."
            return
        }
        // Environment variable is read in configureMocha.js and passed to BentleyMochaReporter.
        let documentsDirs = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true)
        guard documentsDirs.count >= 1 else {
            log("Error determining documents dir")
            self.testStatus = "Tests initialization error."
            return
        }
        let documentsDir = documentsDirs[0]
        trimResults(documentsDir)
        let dateFmt = DateFormatter()
        dateFmt.dateFormat = "yyyy-MM-dd HH-mm-ss-SSS"
        let testResultsUrl = URL(fileURLWithPath: documentsDir).appendingPathComponent("mocha_test_results-\(dateFmt.string(from: Date())).xml")
        setenv("TEST_RESULTS_PATH", testResultsUrl.path, 1)

        let host = IModelJsHost.sharedInstance()
        let bundlePath = Bundle.main.bundlePath
        let mainPath = bundlePath.appending("/Assets/main.js")
        let main = URL(fileURLWithPath: mainPath)
        log("(ios): Running tests.")
        host.loadBackend(main, withAuthClient: nil, withInspect: true) { [self] (numFailed: UInt32) in
            do {
                let text = try String(contentsOf: testResultsUrl, encoding: .utf8)
                for line in text.components(separatedBy: .newlines) {
                    log("[Mocha_Result_XML]: \(line)")
                }
            } catch {
                log("(ios): Failed to read mocha test results.")
            }

            // Indicate via UI that the tests have finished.
            self.testStatus = "Tests finished."
            self.numFailed = Int(numFailed)
            log("(ios): Tests finished. \(numFailed) tests failed.")
            if exitAfterCompletion {
                exit(EXIT_SUCCESS)
            }
        }
        if exitAfterCompletion {
            DispatchQueue.main.asyncAfter(deadline: .now() + 60 * 20) {
                self.log("(ios): Test timed out!")
                exit(EXIT_FAILURE)
            }
        }
    }
}

