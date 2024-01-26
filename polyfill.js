var g = Function("return this")();
if (!g.Promise) g.Promise = require("./nopromise");
