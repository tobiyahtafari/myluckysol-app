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
import androidx.lifecycle.lifecycleScope
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import com.solana.mobilewalletadapter.clientlib.MobileWalletAdapter
import com.solana.mobilewalletadapter.clientlib.TransactionResult
import kotlinx.coroutines.launch
import java.math.BigInteger

class MainActivity : AppCompatActivity() {

    internal lateinit var webView: WebView
    private lateinit var splashScreen: LinearLayout
    private lateinit var offlineScreen: LinearLayout
    private lateinit var retryButton: Button
    private val APP_URL = "https://myluckysol.fun"

    private lateinit var activityResultSender: ActivityResultSender
    private val mwaClient = MobileWalletAdapter()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        activityResultSender = ActivityResultSender(this)

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
    // Provides MWA-based wallet connection that works with the Solana Seeker's
    // Seed Vault and any installed MWA-compatible wallet (Phantom, Solflare, etc.)
    inner class WalletBridge {

        /** Returns true when running inside the MyLuckySol Android APK */
        @JavascriptInterface
        fun isNativeApp(): Boolean = true

        /**
         * Authorize the user's wallet via Mobile Wallet Adapter.
         * Calls window.__mwaCb[callbackId](error, publicKey, authToken) on completion.
         */
        @JavascriptInterface
        fun connect(callbackId: String) {
            runOnUiThread {
                lifecycleScope.launch {
                    try {
                        val result = mwaClient.transact(activityResultSender) {
                            authorize(
                                identityUri = Uri.parse("https://myluckysol.fun"),
                                iconUri = Uri.parse("https://myluckysol.fun/favicon.ico"),
                                identityName = "MyLuckySol",
                                cluster = "mainnet-beta",
                                authToken = null
                            )
                        }
                        val publicKey = encodeBase58(result.accounts[0].publicKey)
                        val token = escapeJs(result.authToken)
                        callJs(callbackId, null, publicKey, token)
                    } catch (e: Exception) {
                        callJs(callbackId, e.message ?: "Connection failed", null, null)
                    }
                }
            }
        }

        /**
         * Reauthorize an existing session (after app restart or token expiry).
         * Calls window.__mwaCb[callbackId](error, publicKey, authToken) on completion.
         */
        @JavascriptInterface
        fun reauthorize(storedAuthToken: String, callbackId: String) {
            runOnUiThread {
                lifecycleScope.launch {
                    try {
                        val result = mwaClient.transact(activityResultSender) {
                            reauthorize(
                                identityUri = Uri.parse("https://myluckysol.fun"),
                                iconUri = Uri.parse("https://myluckysol.fun/favicon.ico"),
                                identityName = "MyLuckySol",
                                authToken = storedAuthToken
                            )
                        }
                        val publicKey = encodeBase58(result.accounts[0].publicKey)
                        val token = escapeJs(result.authToken)
                        callJs(callbackId, null, publicKey, token)
                    } catch (e: Exception) {
                        // Re-auth failed — user must do a fresh connect
                        callJs(callbackId, "reauth_failed", null, null)
                    }
                }
            }
        }

        /**
         * Sign a base64-encoded Solana transaction.
         * Returns the signed transaction as base64 via the callback.
         */
        @JavascriptInterface
        fun signTransaction(base64Tx: String, storedAuthToken: String, callbackId: String) {
            runOnUiThread {
                lifecycleScope.launch {
                    try {
                        val txBytes = android.util.Base64.decode(base64Tx, android.util.Base64.DEFAULT)
                        val signedTxs = mwaClient.transact(activityResultSender) {
                            val reauth = reauthorize(
                                identityUri = Uri.parse("https://myluckysol.fun"),
                                iconUri = Uri.parse("https://myluckysol.fun/favicon.ico"),
                                identityName = "MyLuckySol",
                                authToken = storedAuthToken
                            )
                            signTransactions(
                                transactions = arrayOf(txBytes)
                            )
                        }
                        val signedBase64 = android.util.Base64.encodeToString(
                            signedTxs.signedPayloads[0], android.util.Base64.DEFAULT
                        ).trim()
                        callJsSign(callbackId, null, signedBase64)
                    } catch (e: Exception) {
                        callJsSign(callbackId, e.message ?: "Signing failed", null)
                    }
                }
            }
        }

        /**
         * Deauthorize the current wallet session.
         */
        @JavascriptInterface
        fun disconnect(storedAuthToken: String) {
            runOnUiThread {
                lifecycleScope.launch {
                    try {
                        mwaClient.transact(activityResultSender) {
                            deauthorize(authToken = storedAuthToken)
                        }
                    } catch (_: Exception) { }
                }
            }
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

    // ─── Base58 encoding (for Solana public keys) ───────────────────────────
    private fun encodeBase58(input: ByteArray): String {
        val alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        var value = BigInteger(1, input)
        val base = BigInteger.valueOf(58)
        val zero = BigInteger.ZERO
        val result = StringBuilder()
        while (value > zero) {
            val dr = value.divideAndRemainder(base)
            value = dr[0]
            result.insert(0, alphabet[dr[1].toInt()])
        }
        for (b in input) {
            if (b.toInt() == 0) result.insert(0, alphabet[0]) else break
        }
        return result.toString()
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
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
