/* http://github.com/avih/nopromise MIT */
(function(){

var globalQ,
    async,
    staticNativePromise,
    FULFILLED = 1,
    REJECTED  = 2,
    FUNCTION  = "function";

// Try to find the fastest asynchronous scheduler for this environment:
// setImmediate -> native Promise scheduler -> setTimeout
async = this.setImmediate; // nodejs, IE 10+
try {
    staticNativePromise = Promise.resolve();
    async = async || function(f) { staticNativePromise.then(f) }; // Firefox/Chrome
} catch (e) {}
async = async || setTimeout; // IE < 10, others


// The invariant between internalAsync and dequeue is that if globalQ is thuthy,
// then a dequeue is already scheduled and will execute globalQ asynchronously,
// otherwise, globalQ needs to be created and dequeue needs to be scheduled.
// The elements (functions) of the globalQ array need to be invoked in order.
function dequeue() {
    var f, tmp = globalQ.reverse();
    globalQ = 0;
    while (f = tmp.pop())
        f();
}

// This is used throughout the implementation as the asynchronous scheduler.
// While satisfying the contract to invoke f asynchronously, it combines
// individual f's into a single group which is later iterated synchronously.
function internalAsync(f) {
    if (globalQ) {
        globalQ.push(f);
    } else {
        globalQ = [f];
        async(dequeue);
    }
}

// Fulfil/reject a promise if it's pending, else no-op.
function unpend(p, state, value) {
    if (!p._state) {
        p._state = state;
        p._output = value;

        var f, arr = p._resolvers;
        if (arr) {
            // The case where `then` is called many times for the same promise
            // is rare, so for simplicity, we're not optimizing for it, or else
            // if globalQ is empty, we can just do: globalQ = p._resolvers;
            arr.reverse();
            while (f = arr.pop())
                internalAsync(f);
        }
    }
}

// Other than the prototype methods, the object may also have:
// ._state    : 1 if fulfilled, 2 if rejected (doesn't exist otherwise).
// ._output   : value if fulfilled, reason if rejected (doesn't exist otherwise).
// ._resolvers: array of functions (closures) for each .then call while pending (if there were any).
NoPromise.prototype = {
    resolve: function(value) {
        unpend(this, FULFILLED, value);
    },

    reject: function(reason) {
        unpend(this, REJECTED, reason);
    },

    // Each call to `then` returns a new NoPromise object and creates a closure
    // which is used to resolve it after then's this is fulfilled/rejected.
    then: function(onFulfilled, onRejected) {
        var _self    = this,
            promise2 = new NoPromise;

        _self._state ? internalAsync(promise2Resolver)
                     : _self._resolvers ? _self._resolvers.push(promise2Resolver)
                                        : _self._resolvers = [promise2Resolver];
        return promise2;

        // Invoked asynchronously to `then` and after _self is fulfilled/rejected.
        // _self._state here is FULFILLED/REJECTED
        function promise2Resolver() {
            var handler = _self._state == FULFILLED ? onFulfilled : onRejected;

            if (typeof handler != FUNCTION) {
                unpend(promise2, _self._state, _self._output);
            } else {
                promise2Resolution(0, 1);
            }

            function promise2Resolution(x, isFirstTime) {
                var then,
                    done = 0;

                try {
                    if (isFirstTime)
                        x = handler(_self._output);

                    if (x == promise2) {
                        unpend(promise2, REJECTED, TypeError());

                    // Check for generic thenable... which includes NoPromise.
                    } else if ((x && typeof x == "object" || typeof x == FUNCTION)
                               && typeof (then = x.then) == FUNCTION) {
                        then.call(x, function(y) { done++ || promise2Resolution(y) },
                                     function(r) { done++ || unpend(promise2, REJECTED, r)});

                    } else {
                        unpend(promise2, FULFILLED, x);
                    }

                } catch (e) {
                    done++ || unpend(promise2, REJECTED, e);
                }
            }
        }
    }
}

// Nothing to do other than having the correct prototype.
// then/resolve/reject all need a `this` object.
function NoPromise() {
}

NoPromise.deferred = function() {
    var d = new NoPromise;
    return d.promise = d;
};

try {
  module.exports = NoPromise;
} catch (e) {
  this.NoPromise = NoPromise;
}

"nopromise_extend"; /* placeholder for extensions */

})()
