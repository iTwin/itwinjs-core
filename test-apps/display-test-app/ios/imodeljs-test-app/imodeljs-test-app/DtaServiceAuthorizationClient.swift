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
    let logger = PrintLogger()
    var userInfo: NSDictionary?
    var accessToken: String?
    var expirationDate: Date?

    init?(configData: JSON) {
        let clientId = configData["IMJS_OIDC_CLIENT_ID"] as? String ?? ""
        let clientSecret = configData["IMJS_OIDC_CLIENT_SECRET"] as? String ?? ""
        let scope = configData["IMJS_OIDC_SCOPE"] as? String ?? "email openid profile organization itwinjs"
        let authority = configData["IMJS_SERVICE_AUTHORITY"] as? String ?? "https://ims.bentley.com"
        authSettings = DtaServiceAuthSettings(clientId: clientId, clientSecret: clientSecret, scope: scope, authority: authority)
        super.init()
        if checkSettings() != nil {
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

    func checkSettings() -> NSError? {
        if authSettings.clientId.count == 0 {
            return error(reason: "DtaServiceAuthSettings: initialize() was called with invalid or empty clientId")
        }
        if authSettings.clientSecret.count == 0 {
            return error(reason: "DtaServiceAuthSettings: initialize() was called with invalid or empty clientSecret")
        }
        if authSettings.scope.count == 0 {
            return error(reason: "DtaServiceAuthSettings: initialize() was called with invalid or empty scope")
        }
        let scope = authSettings.scope
        if scope.contains("openid") || scope.contains("email") || scope.contains("profile") || scope.contains("organization") {
            return error(reason: "DtaServiceAuthSettings: Scopes for a service cannot include 'openid email profile organization'")
        }
        return nil
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
            if error == nil {
                if let response = response as? HTTPURLResponse {
                    if response.statusCode == 200 {
                        if let data = data,
                           let json = try? JSONSerialization.jsonObject(with: data) as? JSON {
                            if let accessToken = json["access_token"] as? String {
                                self.accessToken = "Bearer \(accessToken)"
                            } else {
                                self.accessToken = nil
                            }
                            if let expiresIn = json["expires_in"] as? Double {
                                self.expirationDate = Date(timeIntervalSinceNow: expiresIn)
                            } else {
                                self.expirationDate = nil
                            }
                            completion(nil)
                        } else {
                            completion(self.error(reason: "Invalid response body."))
                        }
                    } else {
                        completion(self.error(reason: "Status code: \(response.statusCode)"))
                    }
                } else {
                    completion(self.error(reason: "Invalid response."))
                }
            } else {
                completion(error)
            }
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
