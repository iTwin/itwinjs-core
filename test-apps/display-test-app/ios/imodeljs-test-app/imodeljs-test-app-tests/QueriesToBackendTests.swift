/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import Foundation
import Testing

extension IModelJsHostTests {
    @Suite @MainActor
    struct QueriesToBackend {
        @Test("Synchronous backend reply")
        func synchronousReply() async throws {
            let messenger = try await HostTestHelper.getMessenger()
            #expect(try await messenger.query("test.syncResolve", "hello") == .result("hello"))
        }

        @Test("Asynchronous backend reply")
        func asynchronousReply() async throws {
            let messenger = try await HostTestHelper.getMessenger()
            #expect(try await messenger.query("test.asyncResolve", "delayed hello") == .result("delayed hello"))
        }

        @Test("Backend rejects a query")
        func backendRejects() async throws {
            let messenger = try await HostTestHelper.getMessenger()
            #expect(try await messenger.query("test.reject", "") == .error("expected backend rejection"))
        }

        @Test("Unregistered backend query")
        func unregisteredQuery() async throws {
            let messenger = try await HostTestHelper.getMessenger()
            #expect(try await messenger.query("test.unregistered", "") == .error("MobileHost query handler not registered."))
        }

        @Test("Concurrent backend queries preserve their replies")
        func concurrentQueries() async throws {
            let messenger = try await HostTestHelper.getMessenger()
            let count = 20
            let messages = try (0..<count).map { index in
                let data = try JSONSerialization.data(withJSONObject: ["id": index, "delayMs": (count - index) * 20], options: .sortedKeys)
                return String(decoding: data, as: UTF8.self)
            }
            try await withThrowingTaskGroup(of: (Int, QueryReply).self) { group in
                for (index, message) in messages.enumerated() {
                    group.addTask { @MainActor in (index, try await messenger.query("test.echoDelayed", message)) }
                }
                for try await (index, reply) in group {
                    #expect(reply == .result(messages[index]), "query \(index): \(messages[index])")
                }
            }
        }

    }
}
