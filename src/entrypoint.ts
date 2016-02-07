/// <reference path="externs.d.ts" />
/// <reference path="./tsdgenerator.ts" />
import fs = require("fs");
import env = require("jsdoc/env");

var handler = {
    processingComplete(e: TsdPlugin.IJsDocProcessingCompleteEvent): void {
        var proc = new TsdPlugin.TsdGenerator(env.conf.typescript || {});
        proc.process(e.doclets, (fileName) => fs.createWriteStream(fileName));
    }
};
export default handler;