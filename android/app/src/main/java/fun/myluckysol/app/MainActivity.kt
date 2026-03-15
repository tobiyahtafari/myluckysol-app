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

    private lateinit var webView: WebView
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
