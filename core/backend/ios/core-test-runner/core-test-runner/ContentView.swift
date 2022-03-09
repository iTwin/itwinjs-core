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
        ZStack {
            if !viewController.testsFinished {
                Text("Running tests...")
            } else {
                Text("Finished Running Tests.")
            }
        }.onAppear {
            viewController.runTests()
        }
    }
}
