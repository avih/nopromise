/* http://github.com/avih/nopromise MIT */
(function(){

var FUNCTION = "function",
    staticNativePromise,
    async = setTimeout;

try {
    staticNativePromise = Promise.resolve(1);
    async = function(f) { staticNativePromise.then(f) };
} catch (e) {}

try {
    async = setImmediate;
} catch (e) {}

try {
    async = process.nextTick || async;
} catch (e) {}


function NoPromise() {
    var _state,
        _output,
        _resolvers = Array(),
        _self = this;

    _self.resolve = _resolve;
    _self.reject  =  _reject;
    _self.then    =    _then;
    return _self;

    function _resolve(value) {
        if (!_state) {
            _state = 1;
            _output = value;
            _resolvers.forEach(async);
        }
    }
    function _reject(value) {
        if (!_state) {
            _state = 2;
            _output = value;
            _resolvers.forEach(async);
        }
    }

    function _then(onFulfilled, onRejected) {
        var promise2 = new NoPromise;
        _state ? async(promise2Resolver) : _resolvers.push(promise2Resolver);
        return promise2;

        function promise2Resolver() {
            var handler = _state < 2 ? onFulfilled : onRejected;

            if (typeof handler != FUNCTION) {
                (_state < 2 ? promise2.resolve : promise2.reject)(_output);
            } else {
                promise2Resolution(0, handler);
            }
        }

        function promise2Resolution(x, handler) {
            var then,
                done = 0;

            try {
                if (handler)
                    x = handler(_output);

                if (x == promise2) {
                    promise2.reject(TypeError());

                } else if ((typeof x == FUNCTION || x && typeof x == "object")
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

NoPromise.deferred = function() { var d = new NoPromise; return d.promise = d };
try {
  module.exports = NoPromise;
} catch (e) {
  this.NoPromise = NoPromise;
}

})()