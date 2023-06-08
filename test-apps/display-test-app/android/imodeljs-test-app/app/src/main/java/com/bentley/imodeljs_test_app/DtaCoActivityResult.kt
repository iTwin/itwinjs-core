package com.bentley.imodeljs_test_app

import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultCaller
import androidx.activity.result.contract.ActivityResultContract
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * A wrapper around [ActivityResultCaller] that uses Kotlin Coroutines.
 *
 * @param resultCaller The [ActivityResultCaller] to register for activity results.
 * @param owner The lifecycle owner to associate with for onDestroy cleanup.
 * @param contract The contract passed to [ActivityResultCaller.registerForActivityResult].
 */
open class DtaCoActivityResult<I, O>(resultCaller: ActivityResultCaller, contract: ActivityResultContract<I, O>, owner: LifecycleOwner) {
    private var cancellableContinuation: CancellableContinuation<O>? = null
    private val resultLauncher = resultCaller.registerForActivityResult(contract) { result ->
        cancellableContinuation?.resume(result)
        cancellableContinuation = null
    }

    /**
     * Constructor that uses a [ComponentActivity].
     *
     * @param activity The [ComponentActivity] to register for results and cleanup.
     * @param contract The contract passed to [ActivityResultCaller.registerForActivityResult].
     */
    @Suppress("unused")
    constructor(activity: ComponentActivity, contract: ActivityResultContract<I, O>): this(activity, contract, activity)

    init {
        owner.lifecycle.addObserver(object: DefaultLifecycleObserver {
            override fun onDestroy(owner: LifecycleOwner) {
                resultLauncher.unregister()
                cancellableContinuation?.cancel()
                cancellableContinuation = null
            }
        })
    }

    /**
     * Starts the registered launcher and returns the output value via a coroutine.
     *
     * @param input The input data for the launcher.
     */
    suspend operator fun invoke(input: I) = suspendCancellableCoroutine { continuation ->
        cancellableContinuation = continuation
        resultLauncher.launch(input)
        continuation.invokeOnCancellation {
            cancellableContinuation = null
        }
    }
}
