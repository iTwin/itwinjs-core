/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import Foundation
import IModelJsNative
import Testing

extension IModelJsHostTests {
    @Suite @MainActor
    struct QueriesFromBackend {
        private struct QueriesResult: Decodable {
            let cases: [String]
            let failures: [String]
        }

        @Test("Backend queries to native", .timeLimit(.minutes(1)))
        func backendQueriesToNative() async throws {
            let messenger = try await HostTestHelper.getMessenger()
            var handlerNames: [String] = []
            func addHandler(_ name: String, _ handler: @escaping QueryToNativeCallback) {
                messenger.addQueryHandler(name, handler)
                handlerNames.append(name)
            }
            defer {
                for name in handlerNames {
                    messenger.removeQueryHandler(name)
                }
            }

            addHandler("test.syncResolve") { _, message, reply in
                reply(message, false)
            }

            addHandler("test.asyncResolve") { _, message, reply in
                DispatchQueue.global().asyncAfter(deadline: .now() + 0.2) { reply(message, false) }
            }

            addHandler("test.reject") { _, _, reply in
                reply("expected native rejection", true)
            }

            addHandler("test.throw") { _, _, reply in
                // Swift does not allow throwing in handlers like Android does, just reply with error
                reply("expected native throw", true)
            }

            addHandler("test.duplicateReply") { _, _, reply in
                reply("first", false)
                reply("second", false)
            }

            addHandler("test.concurrentReply") { _, _, reply in
                DispatchQueue.global().async {
                    DispatchQueue.concurrentPerform(iterations: 2) { index in reply(index == 0 ? "a" : "b", false) }
                }
            }

            addHandler("test.echoDelayed") { _, message, reply in
                guard let json = (try? JSONSerialization.jsonObject(with: Data(message.utf8))) as? [String: Any],
                      let delayMs = json["delayMs"] as? Int else {
                    reply("Invalid delayed echo message", true)
                    return
                }
                DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(delayMs)) { reply(message, false) }
            }

            let reply = try await messenger.query("test.runQueriesFromBackendTest", "")
            guard case .result(let json) = reply else {
                Issue.record("test.runQueriesFromBackendTest: \(reply)")
                return
            }
            let result = try JSONDecoder().decode(QueriesResult.self, from: Data(json.utf8))
            #expect(!result.cases.isEmpty, "No backend-to-native cases ran")
            for failure in result.failures {
                Issue.record("\(failure)")
            }
        }
    }
}
