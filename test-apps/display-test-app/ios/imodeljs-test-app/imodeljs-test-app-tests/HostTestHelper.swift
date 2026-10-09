/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import Foundation
import IModelJsNative

@MainActor
final class HostTestHelper {
    private final class BundleMarker: NSObject {}

    private static let instance = Task { @MainActor in
        guard let backendUrl = Bundle(for: BundleMarker.self).url(forResource: "main", withExtension: "js", subdirectory: "Assets/www/mobile") else {
            throw NSError(domain: "HostTestHelper", code: 1, userInfo: [NSLocalizedDescriptionKey: "Assets/www/mobile/main.js is missing from the test bundle"])
        }

        setenv("IMJS_DTA_INTEGRATION_TEST", "true", 1)
        let helper = HostTestHelper(host: IModelJsHost.sharedInstance())

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            var pending: CheckedContinuation<Void, Error>? = continuation
            helper.messenger.addQueryHandler("dtaBackendStarted") { _, _, reply in
                reply("", false)
                guard let completion = pending else { return }
                pending = nil
                helper.messenger.removeQueryHandler("dtaBackendStarted")
                completion.resume()
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 90) {
                guard let completion = pending else { return }
                pending = nil
                helper.messenger.removeQueryHandler("dtaBackendStarted")
                completion.resume(throwing: NSError(domain: "HostTestHelper", code: 2, userInfo: [NSLocalizedDescriptionKey: "Backend startup timed out after 90s"]))
            }
            helper.host.loadBackend(backendUrl, withAuthClient: nil, withInspect: false, onReady: { _ in })
        }
        return helper
    }

    private let host: IModelJsHost
    private let messenger: TestMessenger

    private init(host: IModelJsHost) {
        self.host = host
        messenger = TestMessenger(host: host)
    }

    static func getHost() async throws -> IModelJsHost {
        try await instance.value.host
    }

    static func getMessenger() async throws -> TestMessenger {
        try await instance.value.messenger
    }
}
