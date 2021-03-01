/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import UIKit
import WebKit

class ProxyAuthClient : NSObject, AuthorizationClient {
    var expiresAt = 1614626585925.5581;
    var startsAt = 1614622987085.1082;
    var userToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IkJlbnRsZXlRQSIsInBpLmF0bSI6ImE4bWUifQ.eyJzY29wZSI6WyJvcGVuaWQiLCJlbWFpbCIsInByb2ZpbGUiLCJvcmdhbml6YXRpb24iLCJpbW9kZWxodWIiLCJjb250ZXh0LXJlZ2lzdHJ5LXNlcnZpY2U6cmVhZC1vbmx5IiwicHJvZHVjdC1zZXR0aW5ncy1zZXJ2aWNlIiwicHJvamVjdHdpc2Utc2hhcmUiLCJ1cmxwcy10aGlyZC1wYXJ0eSIsImltb2RlbC1leHRlbnNpb24tc2VydmljZS1hcGkiLCJvZmZsaW5lX2FjY2VzcyJdLCJjbGllbnRfaWQiOiJpbW9kZWxqcy1lbGVjdHJvbi10ZXN0IiwiYXVkIjpbImh0dHBzOi8vcWEtaW1zLmJlbnRsZXkuY29tL2FzL3Rva2VuLm9hdXRoMiIsImh0dHBzOi8vcWEtaW1zb2lkYy5iZW50bGV5LmNvbS9hcy90b2tlbi5vYXV0aDIiLCJodHRwczovL3FhMi1pbXMuYmVudGxleS5jb20vYXMvdG9rZW4ub2F1dGgyIiwiaHR0cHM6Ly9xYTItaW1zb2lkYy5iZW50bGV5LmNvbS9hcy90b2tlbi5vYXV0aDIiLCJodHRwczovL3FhLWltc29pZGMuYmVudGxleS5jb20vcmVzb3VyY2VzIiwiaHR0cHM6Ly9xYTItaW1zLmJlbnRsZXkuY29tL3Jlc291cmNlcyIsImltb2RlbC1odWItc2VydmljZXMtMjQ4NSIsImNvbnRleHQtcmVnaXN0cnktMjc3NyIsInByb2R1Y3Qtc2V0dGluZ3Mtc2VydmljZS0yNzUyIiwicHJvamVjdHdpc2Utc2hhcmUtMjU2NyIsInVsYXMtcmVhbHRpbWUtbG9nLXBvc3RpbmctMjczMyIsImltb2RlbC1wbHVnLWluLXNlcnZpY2UtYXBpIl0sInN1YiI6IjYwZTViZGZhLWU3ZDgtNDRjOS1iZjZhLTdkOTczMzk4ZWFjMCIsInJvbGUiOlsiUHJvamVjdCBTaGFyZSBXZWJWaWV3IiwiQkVOVExFWV9FTVBMT1lFRSIsIkRlc2lnbiBJbnNpZ2h0cyBFYXJseSBBY2Nlc3MiLCJDT05ORUNUIEdlby1Mb2NhdGlvbiJdLCJvcmciOiI3MmFkYWQzMC1jMDdjLTQ2NWQtYTFmZS0yZjJkZmFjOTUwYTQiLCJzdWJqZWN0IjoiNjBlNWJkZmEtZTdkOC00NGM5LWJmNmEtN2Q5NzMzOThlYWMwIiwiaXNzIjoiaHR0cHM6Ly9xYS1pbXNvaWRjLmJlbnRsZXkuY29tIiwiZW50aXRsZW1lbnQiOiJTRUxFQ1RfMjAwNiIsInByZWZlcnJlZF91c2VybmFtZSI6IkFmZmFuLktoYW5AYmVudGxleS5jb20iLCJnaXZlbl9uYW1lIjoiQWZmYW4iLCJzaWQiOiJ0VkhYaklnaURrNkhRNEtHR28yS0czZk51cFEuVVVGSlRWTXRRbVZ1ZEd4bGVTMVZVdy5QVEQxLm1yMWZJRnRwemdzS0VMR2pYV1Y0TXlwa1UiLCJuYmYiOjE2MTQ2MjI2ODQsInVsdGltYXRlX3NpdGUiOiIxMDAxMzg5MTE3IiwidXNhZ2VfY291bnRyeV9pc28iOiJVUyIsImF1dGhfdGltZSI6MTYxNDYyMjk4NCwibmFtZSI6IkFmZmFuLktoYW5AYmVudGxleS5jb20iLCJvcmdfbmFtZSI6IkJlbnRsZXkgU3lzdGVtcyBJbmMiLCJmYW1pbHlfbmFtZSI6IktoYW4iLCJlbWFpbCI6IkFmZmFuLktoYW5AYmVudGxleS5jb20iLCJleHAiOjE2MTQ2MjY1ODZ9.cWSTqtmMuRA_l0qZkII485vV5fI45XvHvL-0HKFIT_Kk23CrHNJ4xyGN9LQqidD9xuAuwJbyeJ5oSIT7GEiPpPGaSLICwu0ADqTcZPhTje7qQ-i2TxmN5U3Uvrg6zysHed1L0A-19_H_3IWq8MUWcVJFvXSMmK0Fid6_LcNizwO12fU7cOFGMyGSVe86abgMwC9MS73tkW6i0Vk5NFsdoJe3BxUmyAHcbzzzBIg4S54W16VRG-H6paV5N9zTmVexnOkpQR_zvQuRlu4o9wvi-QnqaxiH7vcD0t2HO7qgnkigvk4L0upYc42v9sLUGGrBBwLOwKHuErQpRNs-oRHpIg";
    
    func initialize(_ requestContext: ClientRequestContext?, settings authSettings: AuthSettings, onComplete completion: @escaping AuthorizationClientCallback) {
        completion(requestContext ?? ClientRequestContext(), nil);
    }
    func sign(in requestContext: ClientRequestContext?, onComplete completion: @escaping AuthorizationClientCallback) {
        completion(requestContext ?? ClientRequestContext(), nil);
        raiseOnUserStateChanged(token: userToken, err: nil);
    }
    func signOut(_ requestContext: ClientRequestContext?, onComplete completion: @escaping AuthorizationClientCallback) {
        let ctx = requestContext ?? ClientRequestContext();
        completion(ctx, nil);
        raiseOnUserStateChanged(token: userToken, err: nil);
    }
    func wrapTokenInJson(token: String?) -> String? {
        var jsonString: String? = nil;
        if (token != nil) {
            let jsonDic : [String: Any] = [
                "_tokenString": token!,
                "_expiresAt" : expiresAt,
                "_startsAt" : startsAt,
            ];
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: jsonDic, options: []);
                jsonString = String(data: jsonData, encoding: String.Encoding.ascii)!;
            } catch {}
        }
        return jsonString;
    }
    func raiseOnUserStateChanged(token: String?, err:Error?) -> Void {
        let jToken = wrapTokenInJson(token: token);
        if (onUserStateChanged != nil) {
            onUserStateChanged!(jToken, err);
        }
    }
    func getAccessToken(_ requestContext: ClientRequestContext?, onComplete completion: @escaping AccessTokenCallback) {
        let jToken = wrapTokenInJson(token: userToken);
        completion(requestContext ?? ClientRequestContext(), jToken, nil);
    }
    func resumeExternalUserAgentFlow(_ url: URL) -> Bool {
        return true;
    }
    
    var onUserStateChanged: UserStateChanged?
    var isAuthorized: Bool {
        get {
            return true;
        }
    }
}

class MainViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {
    private var webView : WKWebView? = nil
    private var timer = Timer()
    func setupBackend () {
        let host = IModelJsHost.sharedInstance();
        let bundlePath = Bundle.main.bundlePath;
        let mainPath = bundlePath.appending ("/Assets/main.js");
        let main = URL(fileURLWithPath: mainPath);
        let client = MobileAuthorizationClient(viewController: self);
        //let client = ProxyAuthClient();
        host.loadBackend(main, withAuthClient: client,withInspect: true)
    }

    func setupFrontend (bimFile: URL?) {

        let config = WKWebViewConfiguration()
        let wwwRoot = URL.init(fileURLWithPath: String(format: "%@/Assets/www", Bundle.main.resourcePath!))
        config.setURLSchemeHandler(AssetHandler(root: wwwRoot), forURLScheme: "imodeljs")
        self.webView = WKWebView(frame: .zero, configuration: config)

        webView!.translatesAutoresizingMaskIntoConstraints = false
        self.view.addSubview(self.webView!)
        webView!.uiDelegate = self
        webView!.navigationDelegate = self
        NSLayoutConstraint.activate([
            self.webView!.leftAnchor.constraint(equalTo: self.view.leftAnchor),
            self.webView!.bottomAnchor.constraint(equalTo: self.view.bottomAnchor),
            self.webView!.rightAnchor.constraint(equalTo: self.view.rightAnchor),
            self.webView!.topAnchor.constraint(equalTo: self.view.topAnchor),
            ])

        self.view.setNeedsLayout()

        let host = IModelJsHost.sharedInstance();

        // let frontProvider = "http://192.168.1.242:3000";

        let frontProvider = "imodeljs://app";

        var queryParam = String(format: "#port=%u&platform=ios", host.getPort());
        if (bimFile != nil) {
            let encodedPath = bimFile?.path.replacingOccurrences(of: "/", with: "%2F");
            queryParam.append("&standalone=true");
            queryParam.append("&iModelName=" + encodedPath!);
        }

        let url = URL.init(string: frontProvider + queryParam);
        let req = URLRequest(url: url!);
        self.webView!.load(req)
        host.register(self.webView!);
    }
    /// Show alert for webkit alert
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {

        let alert = UIAlertController(title: message, message: nil, preferredStyle: .alert);
        alert.addAction(UIAlertAction(title: "OK", style: .cancel,
                                      handler: {
                                        action in completionHandler();
        }));

        self.present(alert, animated: true);
      }

    override func viewDidLoad() {
        super.viewDidLoad()
        setupBackend()
        timer = Timer.scheduledTimer(withTimeInterval: 2, repeats: false, block: { (Timer) in
            self.setupFrontend(bimFile: nil);
        })
    }

}


