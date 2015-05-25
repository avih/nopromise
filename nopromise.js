/* http://github.com/avih/nopromise MIT */
(function(){

var async = setTimeout, // Default scheduler, IE <= 9
    staticNativePromise,
    globalQ,
    FUNCTION = "function";

try {
    // Try to find the fastest asynchronous scheduler for this environment.
    async = this.setImmediate || async; // IE 10/11 will end up using this
    staticNativePromise = Promise.resolve();
    async = function(f) { staticNativePromise.then(f) }; // Firefox/Chrome/Edge
    async = process.nextTick || async; // Node.js
} catch (e) {}


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
// ._resolvers: array of functions (closures) for/if .then calls while pending.
NoPromise.prototype = {
    resolve: function(value) {
        unpend(this, 1, value);
    },

    reject: function(reason) {
        unpend(this, 2, reason);
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
        // _self._state here is either 1 (fulfilled) or 2 (rejected).
        function promise2Resolver() {
            var _output     = _self._output,
                isFulfilled = _self._state < 2,
                handler     = isFulfilled ? onFulfilled : onRejected;

            if (typeof handler != FUNCTION) {
                isFulfilled ? promise2.resolve(_output) : promise2.reject(_output);
            } else {
                promise2Resolution(0, 1);
            }

            function promise2Resolution(x, isFirstTime) {
                var then,
                    done = 0;

                try {
                    if (isFirstTime)
                        x = handler(_output);

                    if (x == promise2) {
                        promise2.reject(TypeError());

                    } else if ((x && typeof x == "object" || typeof x == FUNCTION)
                               && typeof (then = x.then) == FUNCTION) {
                        then.call(x, function(y) { done++ || promise2Resolution(y) },
                                     function(r) { done++ || promise2.reject(r)    });

                    } else {
                        promise2.resolve(x);
                    }

                } catch (e) {
                    done++ || promise2.reject(e);
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

})()
