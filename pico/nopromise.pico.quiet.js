/* http://github.com/avih/nopromise MIT */
exports.deferred = function NoPromise() {
    var async = setTimeout,
        _state,
        _output,
        _resolvers = [],
        new_promise = {
            resolve: _changeState.bind(1),
            reject:  _changeState.bind(2),
            then:    _then
        };
    return new_promise.promise = new_promise;

    function _changeState(value) {
        if (!_state) {
            _state = this;
            _output = value;
            _resolvers.forEach(async);
        }
    }

    function _then(onFulfilled, onRejected) {
        var promise2 = NoPromise();
        _state ? async(promise2Resolver) : _resolvers.push(promise2Resolver);
        return promise2;

        function promise2Resolver() {
            var handler = _state < 2 ? onFulfilled : onRejected;

            if (typeof handler != "function") {
                (_state < 2 ? promise2.resolve : promise2.reject)(_output);
            } else {
                promise2Resolution(0, handler);
            }
        }

        function promise2Resolution(x, handler) {
            var then,
                done = 0;

            function once(fn) {
                return function(v) { done++ || fn(v) }
            }

            try {
                if (handler)
                    x = handler(_output);

                if (x == promise2) {
                    promise2.reject(TypeError());

                } else if ((typeof x == "function" || x && typeof x == "object")
                           && typeof (then = x.then) == "function") {
                    then.call(x, once(promise2Resolution), once(promise2.reject));

                } else {
                    promise2.resolve(x);
                }

            } catch (e) {
                once(promise2.reject)(e);
            }
        }
    }
}
