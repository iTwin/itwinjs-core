//
//  ContentView.swift
//  core-test-runner
//
//  Created by Daniel Toby on 3/8/22.
//  Copyright © 2022 Bentley Systems, Inc. All rights reserved.
//

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
