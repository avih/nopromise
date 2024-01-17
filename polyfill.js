var muGlobal = Function("return this")();
if (!muGlobal.Promise) muGlobal.Promise = require("./nopromise");
