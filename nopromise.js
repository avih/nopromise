/* http://github.com/avih/nopromise MIT */
(function(G){

// Note: NoPromise[.prototype].resolve() are the only places where "resolve"
// actually means "fulfill". Everywhere else, and specifically at the comments,
// "resolved" means "not pending" - which can be either fulfilled or rejected.
// The variable names also reflect this "resolved" == "not-pending" notion.

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
// While satisfying the contract to invoke f asynchronously, it batches
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
    },

    catch: function(onRejected) {
        return this.then(undefined, onRejected);
    },

    // P.finaly(fn) returns a promise X, and calls fn after P resolves to T.
    // if fn throws E: X is rejected with E.
    // Else if fn returns a promise F: X is resolved once F is resolved:
    //   If F is rejected with FJ: X is rejected with FJ.
    // Else: X mirrors T [ignoring fn's retval or F's fulfillment value]
    finally: function(onFinally) {
        function fin_noargs() { return onFinally() }
        var fn;
        return this
            .then(function(v) { fn = function() { return v } },
                  function(r) { fn = function() { throw r } })
            .then(fin_noargs, fin_noargs)
            .then(function finallyOK() { return fn() });
    },
}


// CTOR:
//   return new NoPromise(function(fulfill, reject) { setTimeout(function() { fulfill(42); }, 100); });
function NoPromise(executor) {
    var self = this;
    if (executor) {  // not used inside 'then' nor by the legacy interface
        executor(function(v) { unpend(self, FULFILLED, v); }, // bind is slower
                 function(r) { unpend(self, REJECTED,  r); });
    }
}


// Static methods
// --------------

// Returns an already fulfilled/rejected promise with specified value/reason
NoPromise.resolve = function(v) {
    return new NoPromise(function(ful, rej) { ful(v); });
};

NoPromise.reject  = function(r) {
    return new NoPromise(function(ful, rej) { rej(r); });
};

// Duplicates the logic used in NoPromise to detect a generic thenable
function is_promise(x) {
    return ((x && typeof x == "object") || typeof x == FUNCTION)
           && typeof x.then == FUNCTION;
}


// For .all and .race: we support iterators as array or array-like, and slack
// when it comes to throwing on invalid iterators (we only try [].slice.call).

// Static NoPromise.all(iter) returns a promise X.
// If iter is empty: X fulfills synchronously to an empty array.
// Else for the first promise in iter which rejects with J: X rejects a-sync with J.
// Else (all fulfill): X fulfills a-sync to an array of iter's fulfilled-values
// (non-promise values are considered already fulfilled with that value).
NoPromise.all = function(iter) {
    Array.isArray(iter) || (iter = [].slice.call(iter));
    var len = iter.length;
    if (!len)
        return NoPromise.resolve([]);  // empty fulfills synchronously

    return new NoPromise(function(allful, allrej) {
        var rv = [], pending = 0;
        function fulOne(i, val) { rv[i] = val; --pending || allful(rv); }

        iter.forEach(function(v, i) {
            if (is_promise(v)) {
                pending++;
                v.then(fulOne.bind(null, i), allrej);
            } else {
                rv[i] = v;
            }
        });

        // Non empty but without promises - fulfills a-sync
        if (!pending)
            NoPromise.resolve(rv).then(allful);
    });
}

// Static NoPromise.race(iter) returns a promise X:
// If iter is empty: X never resolves.
// Else: X resolves always a-sync to mirror the first promise in iter which resolves.
// (non-promise values are considered already fulfilled with that value).
NoPromise.race = function(iter) {
    return new NoPromise(function(allful, allrej) {
        Array.isArray(iter) || (iter = [].slice.call(iter));
        iter.some(function(v, i) {
            if (is_promise(v)) {
                v.then(allful, allrej);
            } else {
                NoPromise.resolve(v).then(allful);
                return true;  // continuing would end up no-op
            }
        });
    });
}


// Legacy interface - not used by any NoPromise code, provided as legacy:
//   var d = NoPromise.defer(); setTimeout(function() { d.resolve(42); }, 100); return d.promise;
// d.promise is indistinguishable from a promise created as "new NoPromise(executor)"
NoPromise.defer = NoPromise.deferred = function() {
    var d = new NoPromise;
    return d.promise = d;
};

NoPromise.prototype.resolve = function(value) {
    unpend(this, FULFILLED, value);
}

NoPromise.prototype.reject = function(reason) {
    unpend(this, REJECTED, reason);
}
// End of legacy interface


// export/set-global
try {
    module.exports = NoPromise;
} catch (e) {
    G.NoPromise = NoPromise;
}

})( // used to setup a global NoPromise - not when using require("nopromise")
    typeof global != "undefined" ? global :
    typeof window != "undefined" ? window : this)
