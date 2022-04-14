/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import SwiftUI

struct ContentView: View {
    @ObservedObject var viewController = ViewController()

    var body: some View {
        VStack {
            Text(viewController.testStatus)
            if (viewController.numFailed != -1) {
                Text("\(viewController.numFailed) tests failed.")
            }
        }.onAppear {
            viewController.runTests()
        }
    }
}
