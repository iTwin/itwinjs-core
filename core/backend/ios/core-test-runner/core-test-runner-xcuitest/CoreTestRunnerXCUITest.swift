//
//  core_test_runner_xcuitestLaunchTests.swift
//  core-test-runner-xcuitest
//
//  Created by Daniel Toby on 3/8/22.
//

import XCTest

class CoreTestRunnerXCUITest: XCTestCase {

    override class var runsForEachTargetApplicationUIConfiguration: Bool {
        true
    }

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLaunch() throws {
        let app = XCUIApplication()
        app.launch()

        let finishedText = app.staticTexts["Finished Running Tests."]
        XCTAssert(finishedText.waitForExistence(timeout: 30))

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Launch Screen"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
