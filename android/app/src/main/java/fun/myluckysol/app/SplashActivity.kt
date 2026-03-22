package `fun`.myluckysol.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.VideoView
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {

    private lateinit var videoView: VideoView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.splash_screen)

        videoView = findViewById(R.id.splash_video)

        // Play splash video from raw resources
        val videoUri = Uri.parse("android.resource://${packageName}/${R.raw.splash_video}")
        videoView.setVideoURI(videoUri)

        // When video completes, transition to MainActivity
        videoView.setOnCompletionListener {
            transitionToMain()
        }

        // Fallback: after 4 seconds, go to MainActivity anyway
        // (in case video doesn't play or completes prematurely)
        videoView.postDelayed({
            if (videoView.isPlaying || !hasWindowFocus()) {
                // Still playing or window lost focus, wait more
                return@postDelayed
            }
            transitionToMain()
        }, 4000)

        // Start playing
        videoView.start()
    }

    private fun transitionToMain() {
        val intent = Intent(this, MainActivity::class.java)
        // Preserve any deep link intent extras
        if (intent.extras != null) {
            intent.putExtras(this.intent.extras!!)
        }
        startActivity(intent)
        finish()
        overridePendingTransition(0, 0) // No transition animation
    }

    override fun onBackPressed() {
        // Prevent back button during splash
        super.onBackPressed()
    }
}
