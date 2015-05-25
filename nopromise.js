/* http://github.com/avih/nopromise MIT */
(function(){

var async = setTimeout,
    staticNativePromise,
    globalQ;

try {
    async = this.setImmediate || async;
    staticNativePromise = Promise.resolve();
    async = function(f) { staticNativePromise.then(f) };
    async = process.nextTick || async;
} catch (e) {}


function deq() {
    var f, tmp = globalQ.reverse();
    globalQ = 0;
    while (f = tmp.pop())
        f();
}

function internalAsync(f) {
    if (globalQ) {
        globalQ.push(f);
    } else {
        globalQ = [f];
        async(deq);
    }
}

function unpend(p, state, value) {
    if (!p._state) {
        p._state = state;
        p._output = value;

        var f, r = p._resolvers;
        if (r) {
            r.reverse();
            while (f = r.pop())
                internalAsync(f);
        }
    }
}

NoPromise.prototype = {
    resolve: function(value) {
        unpend(this, 1, value);
    },

    reject: function(reason) {
        unpend(this, 2, reason);
    },

    then: function(onFulfilled, onRejected) {
        var _self    = this,
            promise2 = new NoPromise;

        _self._state ? internalAsync(promise2Resolver)
                     : _self._resolvers ? _self._resolvers.push(promise2Resolver)
                                        : _self._resolvers = [promise2Resolver];
        return promise2;

        function promise2Resolver() {
            var isFulfilled = _self._state < 2,
                _output     = _self._output,
                handler     = isFulfilled ? onFulfilled : onRejected,
                FUNCTION    = "function";

            if (typeof handler != FUNCTION) {
                isFulfilled ? promise2.resolve(_output) : promise2.reject(_output);
            } else {
                promise2Resolution(0, 1);
            }

            function promise2Resolution(x, firstTime) {
                var then,
                    done = 0;

                try {
                    if (firstTime)
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

function NoPromise() {
}

NoPromise.deferred = function() { var d = new NoPromise; return d.promise = d };
try {
  module.exports = NoPromise;
} catch (e) {
  this.NoPromise = NoPromise;
}

})()
