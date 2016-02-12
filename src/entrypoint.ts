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
var logger = require("jsdoc/util/logger");
exports.handlers = {
    processingComplete(e: TsdPlugin.IJsDocProcessingCompleteEvent): void {
        var proc = new TsdPlugin.TsdGenerator(env.conf.typescript || {});
        var sf = {
            createStream: (fileName) => fs.createWriteStream(fileName),
            readText: (fileName) => fs.readFileSync(fileName, "utf8")
        };
        proc.process(e.doclets, sf, logger);
        //proc.dumpDoclets(e.doclets, sf);
    }
};