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

        let finishedText = app.staticTexts["Tests finished."]
        XCTAssert(finishedText.waitForExistence(timeout: 60 * 20)) // 20 minutes

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Tests Finished Screen"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
