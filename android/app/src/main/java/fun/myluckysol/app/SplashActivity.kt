package `fun`.myluckysol.app

import android.app.Activity
import android.content.Intent
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.widget.VideoView

class SplashActivity : Activity() {

    private lateinit var videoView: VideoView
    private var transitioned = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.splash_screen)

        videoView = findViewById(R.id.splash_video)

        val videoUri = Uri.parse("android.resource://${packageName}/${R.raw.splash_video}")
        videoView.setVideoURI(videoUri)

        // On completion, go to main
        videoView.setOnCompletionListener {
            transitionToMain()
        }

        // On error (unsupported codec, missing file, etc), skip to main immediately
        videoView.setOnErrorListener { _, _, _ ->
            transitionToMain()
            true
        }

        // Hard fallback after 5 seconds in case video hangs silently
        videoView.postDelayed({
            transitionToMain()
        }, 5000)

        videoView.start()
    }

    private fun transitionToMain() {
        if (transitioned) return
        transitioned = true
        val intent = Intent(this, MainActivity::class.java)
        startActivity(intent)
        finish()
        overridePendingTransition(0, 0)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Block back during splash
    }
}
