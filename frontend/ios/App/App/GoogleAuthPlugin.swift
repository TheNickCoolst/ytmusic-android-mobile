import UIKit
import WebKit
import Capacitor

/// Registers the app's local plugins with the Capacitor bridge.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GoogleAuthPlugin())
    }
}

/// Google login in an in-app window; returns the music.youtube.com cookie (iOS counterpart of GoogleAuthPlugin.java).
@objc(GoogleAuthPlugin)
public class GoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GoogleAuthPlugin"
    public let jsName = "GoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openSystemBrowser", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInEmbedded", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
    ]

    static let loginURL = "https://accounts.google.com/ServiceLogin?service=youtube&passive=true&continue=https%3A%2F%2Fmusic.youtube.com%2F"

    private var loginController: LoginViewController?

    @objc func openSystemBrowser(_ call: CAPPluginCall) {
        let raw = call.getString("url") ?? GoogleAuthPlugin.loginURL
        guard let url = URL(string: raw), url.scheme == "https" || url.scheme == "http" else {
            call.reject("Ungültige URL")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url) { ok in
                ok ? call.resolve(["status": "browser_opened", "url": raw]) : call.reject("Browser konnte nicht geöffnet werden")
            }
        }
    }

    @objc func signIn(_ call: CAPPluginCall) {
        openSystemBrowser(call)
    }

    @objc func signInEmbedded(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController, self.loginController == nil else {
                call.reject("Google Login konnte nicht gestartet werden")
                return
            }
            let vc = LoginViewController { [weak self] cookie in
                self?.loginController = nil
                if let cookie = cookie {
                    call.resolve(["status": "success", "cookie": cookie])
                } else {
                    call.reject("Anmeldung abgebrochen")
                }
            }
            self.loginController = vc
            let nav = UINavigationController(rootViewController: vc)
            nav.modalPresentationStyle = .fullScreen
            presenter.present(nav, animated: true)
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        // Login windows use a throwaway data store, so nothing persists natively.
        call.resolve(["status": "signed_out"])
    }
}

final class LoginViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let completion: (String?) -> Void
    private var webView: WKWebView!
    private var urlObservation: NSKeyValueObservation?
    private var finished = false
    private let progress = UIProgressView(progressViewStyle: .bar)
    private var progressObservation: NSKeyValueObservation?

    init(completion: @escaping (String?) -> Void) {
        self.completion = completion
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("unused") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Google Anmeldung"
        view.backgroundColor = .black
        navigationItem.leftBarButtonItem = UIBarButtonItem(barButtonSystemItem: .cancel, target: self, action: #selector(cancel))

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        // Google refuses sign-in from UAs that look like an embedded web view; present as Mobile Safari.
        let os = UIDevice.current.systemVersion.replacingOccurrences(of: ".", with: "_")
        let ver = UIDevice.current.systemVersion.split(separator: ".").prefix(2).joined(separator: ".")
        webView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS \(os) like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/\(ver) Mobile/15E148 Safari/604.1"

        webView.translatesAutoresizingMaskIntoConstraints = false
        progress.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        view.addSubview(progress)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            progress.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])

        urlObservation = webView.observe(\.url, options: [.new]) { [weak self] _, _ in self?.checkLogin() }
        progressObservation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] wv, _ in
            self?.progress.progress = Float(wv.estimatedProgress)
            self?.progress.isHidden = wv.estimatedProgress >= 1
        }

        if let url = URL(string: GoogleAuthPlugin.loginURL) {
            webView.load(URLRequest(url: url))
        }
    }

    private func checkLogin() {
        guard !finished, webView.url?.host == "music.youtube.com" else { return }
        webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { [weak self] cookies in
            guard let self = self, !self.finished else { return }
            let yt = cookies.filter { c in
                let d = c.domain.hasPrefix(".") ? String(c.domain.dropFirst()) : c.domain
                return d == "youtube.com" || d == "music.youtube.com"
            }
            let hasAuth = yt.contains { $0.name == "SAPISID" || $0.name == "__Secure-3PAPISID" }
            guard hasAuth else { return }
            let cookie = yt.map { "\($0.name)=\($0.value)" }.joined(separator: "; ")
            self.finish(cookie)
        }
    }

    private func finish(_ cookie: String?) {
        guard !finished else { return }
        finished = true
        urlObservation = nil
        progressObservation = nil
        dismiss(animated: true) { self.completion(cookie) }
    }

    @objc private func cancel() { finish(nil) }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { checkLogin() }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let scheme = navigationAction.request.url?.scheme?.lowercased() ?? ""
        decisionHandler(["http", "https", "about", "blob", "data"].contains(scheme) ? .allow : .cancel)
    }

    // Pop-ups (target=_blank) open in the same window.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil { webView.load(navigationAction.request) }
        return nil
    }
}
