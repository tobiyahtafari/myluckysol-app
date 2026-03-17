package `fun`.myluckysol.app

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    internal lateinit var webView: WebView
    private lateinit var splashScreen: LinearLayout
    private lateinit var offlineScreen: LinearLayout
    private lateinit var retryButton: Button
    private val APP_URL = "https://myluckysol.fun"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        splashScreen = findViewById(R.id.splashScreen)
        offlineScreen = findViewById(R.id.offlineScreen)
        retryButton = findViewById(R.id.retryButton)

        retryButton.setOnClickListener {
            if (isOnline()) {
                offlineScreen.visibility = View.GONE
                splashScreen.visibility = View.VISIBLE
                webView.visibility = View.INVISIBLE
                webView.loadUrl(APP_URL)
            }
        }

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowContentAccess = true
            allowFileAccess = false
            setSupportMultipleWindows(true)
            mediaPlaybackRequiresUserGesture = false
            userAgentString = "$userAgentString MyLuckySolApp/1.0 SolanaSeeker"
        }

        // Inject the native wallet bridge — available as window.SolanaWalletBridge in JavaScript
        webView.addJavascriptInterface(WalletBridge(), "SolanaWalletBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return when {
                    url.startsWith("https://myluckysol.fun") -> {
                        view.loadUrl(url)
                        false
                    }
                    // MWA v1 protocol — must be intercepted so WebView doesn't
                    // try to load it as a webpage; fired as an Intent so the
                    // system wallet (Phantom, Seed Vault, Solflare…) handles it.
                    // After launching the wallet we manually dispatch window.blur
                    // so the MWA JS SDK's detectionPromise resolves correctly.
                    url.startsWith("solana-wallet:") -> {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            startActivity(intent)
                            // Dispatch blur so MWA's getDetectionPromise() resolves
                            webView.post {
                                webView.evaluateJavascript(
                                    "window.dispatchEvent(new Event('blur'))",
                                    null
                                )
                            }
                        } catch (e: Exception) {
                            // No MWA-compatible wallet installed
                        }
                        true
                    }
                    url.startsWith("solana:") || url.startsWith("solanawallet:") ||
                    url.startsWith("phantom:") || url.startsWith("solflare:") ||
                    url.startsWith("okx:") || url.startsWith("backpack:") -> {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (e: Exception) {
                            // wallet not installed
                        }
                        true
                    }
                    url.startsWith("http://") || url.startsWith("https://") -> {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        true
                    }
                    else -> false
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                splashScreen.animate()
                    .alpha(0f)
                    .setDuration(300)
                    .withEndAction {
                        splashScreen.visibility = View.GONE
                        splashScreen.alpha = 1f
                    }
                    .start()
                webView.animate()
                    .alpha(1f)
                    .setDuration(300)
                    .withStartAction { webView.visibility = View.VISIBLE }
                    .start()
            }

            override fun onReceivedError(
                view: WebView,
                errorCode: Int,
                description: String,
                failingUrl: String
            ) {
                if (!isOnline()) {
                    splashScreen.visibility = View.GONE
                    webView.visibility = View.GONE
                    offlineScreen.visibility = View.VISIBLE
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                request.grant(request.resources)
            }

            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                return true
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: android.webkit.ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                return false
            }
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
            splashScreen.visibility = View.GONE
            webView.visibility = View.VISIBLE
        } else if (!isOnline()) {
            splashScreen.visibility = View.GONE
            offlineScreen.visibility = View.VISIBLE
        } else {
            webView.loadUrl(APP_URL)
        }
    }

    // ─── Native Wallet Bridge ────────────────────────────────────────────────
    // Exposed to JavaScript as window.SolanaWalletBridge
    // This is a stub for now — the actual MWA integration will be added when
    // we can integrate the full Solana Mobile SDK. For now, this allows the
    // JavaScript side to detect it's running in the APK and show the native UI.
    inner class WalletBridge {

        /** Returns true when running inside the MyLuckySol Android APK */
        @JavascriptInterface
        fun isNativeApp(): Boolean = true

        /**
         * Stub implementation — in production, this would use the Solana Mobile SDK
         * to connect to the system wallet (Seed Vault, Phantom, Solflare, etc.)
         * For now, it signals to the JavaScript side that a native wallet is available.
         */
        @JavascriptInterface
        fun connect(callbackId: String) {
            // TODO: Integrate full MWA SDK here
            // For now, just return a stub response
            callJs(callbackId, "Not yet implemented — please install a wallet from the Solana dApp Store", null, null)
        }

        @JavascriptInterface
        fun reauthorize(storedAuthToken: String, callbackId: String) {
            callJs(callbackId, "Reauthorization not yet implemented", null, null)
        }

        @JavascriptInterface
        fun signTransaction(base64Tx: String, storedAuthToken: String, callbackId: String) {
            callJsSign(callbackId, "Transaction signing not yet implemented", null)
        }

        @JavascriptInterface
        fun disconnect(storedAuthToken: String) {
            // Stub
        }

        private fun callJs(callbackId: String, error: String?, publicKey: String?, authToken: String?) {
            val errArg = if (error != null) "'${escapeJs(error)}'" else "null"
            val pkArg = if (publicKey != null) "'${escapeJs(publicKey)}'" else "null"
            val tkArg = if (authToken != null) "'${escapeJs(authToken)}'" else "null"
            webView.post {
                webView.evaluateJavascript(
                    "window.__mwaCb && window.__mwaCb['$callbackId'] && window.__mwaCb['$callbackId']($errArg,$pkArg,$tkArg)",
                    null
                )
            }
        }

        private fun callJsSign(callbackId: String, error: String?, signedBase64: String?) {
            val errArg = if (error != null) "'${escapeJs(error)}'" else "null"
            val txArg = if (signedBase64 != null) "'${escapeJs(signedBase64)}'" else "null"
            webView.post {
                webView.evaluateJavascript(
                    "window.__mwaCb && window.__mwaCb['$callbackId'] && window.__mwaCb['$callbackId']($errArg,$txArg)",
                    null
                )
            }
        }

        private fun escapeJs(s: String): String =
            s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
    }

    // ─── Lifecycle helpers ───────────────────────────────────────────────────
    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
    }

    override fun onPause() {
        super.onPause()
        // Do NOT call webView.onPause() or webView.pauseTimers() here.
        // The MWA WebSocket session must remain active while the wallet
        // app is in the foreground handling the signing request.
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
