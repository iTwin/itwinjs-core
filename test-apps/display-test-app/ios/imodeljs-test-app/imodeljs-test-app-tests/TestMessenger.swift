/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import Foundation
import IModelJsNative

enum QueryReply: Equatable, Sendable {
    case result(String)
    case error(String)
}

@MainActor
final class TestMessenger {
    private let host: IModelJsHost
    private var queryHandlers: [String: QueryToNativeCallback] = [:]

    init(host: IModelJsHost) {
        self.host = host
        host.queryCallback = { [weak self] name, message, reply in
            DispatchQueue.main.async {
                guard let handler = self?.queryHandlers[name] else {
                    reply("No registered handler", true)
                    return
                }
                handler(name, message, reply)
            }
        }
    }

    func addQueryHandler(_ name: String, _ handler: @escaping QueryToNativeCallback) {
        queryHandlers[name] = handler
    }

    func removeQueryHandler(_ name: String) {
        queryHandlers.removeValue(forKey: name)
    }

    func query(_ name: String, _ message: String) async throws -> QueryReply {
        try await withCheckedThrowingContinuation { continuation in
            host.queryBackend(name, message: message) { result, isError in
                continuation.resume(returning: isError ? .error(result) : .result(result))
            }
        }
    }
}
