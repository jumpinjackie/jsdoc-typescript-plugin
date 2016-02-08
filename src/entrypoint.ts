/// <reference path="../typings/tsd.d.ts" />
/// <reference path="externs.d.ts" />
/// <reference path="config.ts" />
/// <reference path="doclet.ts" />
/// <reference path="doclettypes.ts" />
/// <reference path="io.ts" />
/// <reference path="moduleutils.ts" />
/// <refernece path="processcompleteevent.ts" />
/// <reference path="tsdgenerator.ts" />
/// <reference path="tsoutput.ts" />
var fs = require("fs");
var env = require("jsdoc/env");
exports.handlers = {
    processingComplete(e: TsdPlugin.IJsDocProcessingCompleteEvent): void {
        var proc = new TsdPlugin.TsdGenerator(env.conf.typescript || {});
        proc.process(e.doclets, (fileName) => fs.createWriteStream(fileName));
    }
};