/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import UIKit
import os

import IModelJsNative

class ViewController: UIViewController, WKUIDelegate, WKNavigationDelegate, UIDocumentPickerDelegate {
    private var webView : WKWebView? = nil
    private let logger = Logger(subsystem: "com.bentley.core-test-runner", category: "tests")
    private var numFailed = -1
    private var testsFinished = false

    override func viewDidLoad() {
        super.viewDidLoad()
        runTests()
    }

    private func runTests () {
        
        let host = IModelJsHost.sharedInstance()
        let bundlePath = Bundle.main.bundlePath
        let mainPath = bundlePath.appending("/Assets/main.js")
        let main = URL(fileURLWithPath: mainPath)
        let client = MobileAuthorizationClient(viewController: self)
        print("(ios): Running tests.")
        logger.log("(ios)(logger): Running tests.")
        host.loadBackend(main, withAuthClient: client, withInspect: true) { [self] (numFailed: UInt32) in
            self.numFailed = Int(numFailed)
            self.testsFinished = true
        }
        
        while !testsFinished {
        }
        
        logger.log("(ios)(logger): Finished running tests (2).")
        NSLog("(ios)(nslog): Finished running tests (2).")
        
        let testOutputPath = bundlePath.appending("/Assets/junit_results.xml")
        let fileManager = FileManager.default
        if !fileManager.fileExists(atPath: testOutputPath) {
            print("(ios): Test results not found. Path: \(testOutputPath)")
            exit(-1)
        }
    }
}

