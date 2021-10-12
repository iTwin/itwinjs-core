/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


#import <XCTest/XCTest.h>

@interface imodeljs_backend_test_appUITests : XCTestCase

@end

@implementation imodeljs_backend_test_appUITests

- (void)setUp {
    // Put setup code here. This method is called before the invocation of each test method in the class.

    // In UI tests it is usually best to stop immediately when a failure occurs.
    self.continueAfterFailure = NO;

    // UI tests must launch the application that they test. Doing this in setup will make sure it happens for each test method.
    [[[XCUIApplication alloc] init] launch];

    // In UI tests it’s important to set the initial state - such as interface orientation - required for your tests before they run. The setUp method is a good place to do this.
}

- (void)tearDown {
    // Put teardown code here. This method is called after the invocation of each test method in the class.
}

- (void)testIModelJsBackend {

    XCUIApplication *app = [[XCUIApplication alloc] init];
    XCUIElement *startStandardTestButton = app.toolbars[@"Toolbar"].buttons[@"Start Standard Test"];
    [startStandardTestButton tap];


    XCUIElement *textView = [[app.otherElements containingType:XCUIElementTypeToolbar identifier:@"Toolbar"] childrenMatchingType:XCUIElementTypeTextView].element;
    [textView tap];

    // Use recording to get started writing UI tests.
    // Use XCTAssert and related functions to verify your tests produce the correct results.

    NSPredicate* exists = [NSPredicate predicateWithFormat:@"enabled == true"];
     XCTestExpectation* expect = [self expectationForPredicate:exists evaluatedWithObject:startStandardTestButton handler:nil];
    [self waitForExpectations:@[expect] timeout:150];
}

@end
