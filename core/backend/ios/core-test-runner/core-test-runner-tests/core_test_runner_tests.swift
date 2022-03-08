//
//  core_test_runner_tests.swift
//  core-test-runner-tests
//
//  Created by Daniel Toby on 2/15/22.
//  Copyright © 2022 Bentley Systems, Inc. All rights reserved.
//

import XCTest

class core_test_runner_tests: XCTestCase {
    
    func testAll() throws {
        // UI tests must launch the application that they test.
        let app = XCUIApplication()
        app.launch()
    }
}
