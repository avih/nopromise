/* http://github.com/avih/nopromise MIT */
exports.deferred = function NoPromise() {
    var sysAsync = setTimeout,
        state,
        output,
        resolvers = [],
        new_promise = {
            resolve: changeState.bind(1),
            reject:  changeState.bind(2),
            then:    promise1then
        };
    return new_promise.promise = new_promise;

    function changeState(value) {
        if (!state) {
            state = this;
            output = value;
            resolvers.forEach(sysAsync);
        }
    }

    function promise1then(onFulfilled, onRejected) {
        var promise2 = NoPromise();
        state ? sysAsync(promise2Resolver) : resolvers.push(promise2Resolver);
        return promise2;

        function promise2Resolver() {
            var handler = state < 2 ? onFulfilled : onRejected;

            if (typeof handler != "function") {
                (state < 2 ? promise2.resolve : promise2.reject)(output);
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
                    x = handler(output);

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
