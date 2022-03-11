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
