/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import Foundation

/// A struct to hold the settings used by DtaServiceAuthSettings
struct DtaServiceAuthSettings {
    var clientId: String
    var clientSecret: String
    var scope: String
    var authority: String
}

typealias DtaServiceAuthorizationClientCallback = (Error?) -> ()

class DtaServiceAuthorizationClient: NSObject, DtaAuthorizationClient {
    /// Instance for `onAccessTokenChanged` property from the `AuthorizationClient` protocol.
    public var onAccessTokenChanged: AccessTokenChangedCallback?
    /// Instance for `errorDomain` property from the `DtaAuthorizationClient` protocol.
    public let errorDomain = "com.bentley.display-test-app"
    var issuerURL = URL(string: "https://ims.bentley.com")!
    var authSettings: DtaServiceAuthSettings
    var userInfo: NSDictionary?
    var accessToken: String?
    var expirationDate: Date?

    init?(configData: JSON) {
        let clientId = configData["IMJS_OIDC_CLIENT_ID"] as? String ?? ""
        let clientSecret = configData["IMJS_OIDC_CLIENT_SECRET"] as? String ?? ""
        let scope = configData["IMJS_OIDC_SCOPE"] as? String ?? ""
        let authority = configData["IMJS_SERVICE_AUTHORITY"] as? String ?? "https://ims.bentley.com"
        authSettings = DtaServiceAuthSettings(clientId: clientId, clientSecret: clientSecret, scope: scope, authority: authority)
        super.init()
        guard (try? checkSettings()) != nil else {
            return nil
        }
        if var prefix = configData["IMJS_URL_PREFIX"] as? String,
           let authorityURL = URL(string: authority),
           var authorityURLComponents = URLComponents(url: authorityURL, resolvingAgainstBaseURL: false) {
            prefix = prefix == "dev-" ? "qa-" : prefix
            authorityURLComponents.host = prefix + authorityURLComponents.host!
            if authorityURLComponents.path.hasSuffix("/") {
                authorityURLComponents.path.removeLast()
            }
            if let url = authorityURLComponents.url {
                self.issuerURL = url
            }
        }
    }

    func checkSettings() throws {
        if authSettings.clientId.count == 0 {
            throw error(reason: "DtaServiceAuthSettings: initialize() was called with invalid or empty clientId")
        }
        if authSettings.clientSecret.count == 0 {
            throw error(reason: "DtaServiceAuthSettings: initialize() was called with invalid or empty clientSecret")
        }
        if authSettings.scope.count == 0 {
            throw error(reason: "DtaServiceAuthSettings: initialize() was called with invalid or empty scope")
        }
        let scope = authSettings.scope
        if scope.contains("openid") || scope.contains("email") || scope.contains("profile") || scope.contains("organization") {
            throw error(reason: "DtaServiceAuthSettings: Scopes for a service cannot include 'openid email profile organization'")
        }
    }

    func generateAccessToken(_ completion: @escaping DtaServiceAuthorizationClientCallback) {
        let session = URLSession(configuration: URLSessionConfiguration.default)
        let requestURL = issuerURL.appendingPathComponent("connect").appendingPathComponent("token")
        var request = URLRequest(url: requestURL)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpMethod = "POST"
        let bodyString = "grant_type=client_credentials&scope=\(authSettings.scope.encodedForURLQuery()!)"
        let bodyData = Data(bodyString.utf8)
        request.setValue("\(bodyData.count)", forHTTPHeaderField: "Content-Length")
        request.httpBody = bodyData
        let encoded = "\(authSettings.clientId.encodedForURLQuery()!):\(authSettings.clientSecret.encodedForURLQuery()!)"
        request.setValue("Basic \(encoded.toBase64())", forHTTPHeaderField: "Authorization")
        let task = session.dataTask(with: request) { (data, response, error) in
            if let error = error {
                completion(error)
                return
            }
            guard let response = response as? HTTPURLResponse else {
                completion(self.error(reason: "Invalid response."))
                return
            }
            guard response.statusCode == 200 else {
                completion(self.error(reason: "Status code: \(response.statusCode)"))
                return
            }
            guard let data = data, let json = try? JSONSerialization.jsonObject(with: data) as? JSON else {
                completion(self.error(reason: "Invalid response body."))
                return
            }

            self.accessToken = (json["access_token"] as? String).map { "Bearer \($0)" }
            self.expirationDate = (json["expires_in"] as? Double).map { Date(timeIntervalSinceNow: $0) }
            completion(nil)
        }
        task.resume()
    }

    // MARK: - AuthorizationClient Protocol implementation
    public func getAccessToken(_ completion: @escaping GetAccessTokenCallback) {
        if accessToken != nil, expirationDate != nil {
            completion(accessToken, expirationDate, nil)
        }
        generateAccessToken() { error in
            completion(self.accessToken, self.expirationDate, error)
        }
    }
}
