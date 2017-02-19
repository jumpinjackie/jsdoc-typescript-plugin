/**
 * ol-postprocess.js
 *
 * This script generates TypeScript ES2015 module declarations from a JSON file containing public types
 * dumped by the jsdoc-typescript-plugin and appends them to a openlayers.d.ts file
 */
const os = require("os");
const fs = require("fs");
const path = require("path");
const jsonfile = require("jsonfile");

if (process.argv.length != 4) {
    console.log("Usage: node ol-postprocess.js [path/to/public.json] [path/to/openlayers.d.ts]")
    process.exit(1);
}

const publicJsonPath = path.resolve(process.argv[2]);
const dtsPath = path.resolve(process.argv[3]);

if (!fs.existsSync(dtsPath)) {
    console.error("File not found: " + dtsPath);
    process.exit(1);
}

console.log("public types path: " + publicJsonPath);
console.log("openlayers.d.ts path: " + dtsPath);

jsonfile.readFile(publicJsonPath, function(err, obj) {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    // OL ES2015 modules follow a very simple convention which makes this easy to implement.
    //
    // For a fully dotted class, replace the dots with '/' and lowercase all identifiers between
    // That name is your ES2015 module name and we just re-export said identifier as a default export
    //
    // For example, the ES2015 for ol.Map would look like this:
    //
    // declare module "ol/map" {
    //     export default ol.Map;
    // }
    //

    var esClasses = obj.filter(function(val) {
        return val.kind == "Class";
    }).map(function(val, index) {
        return {
            module: val.fullName.split(".").map(function(t) { return t.toLowerCase() }).join("/"),
            export: val.fullName
        };
    });

    esClasses.forEach(function(cls) {
        var def = "/*" + os.EOL;
        def += " * ES2015 module declaration for " + cls.export + os.EOL;
        def += " */" + os.EOL;
        def += 'declare module "' + cls.module + '" {' + os.EOL;
        def += "    export default " + cls.export + ";" + os.EOL;
        def += "}" + os.EOL;
        fs.appendFileSync(dtsPath, def);
        console.log("Wrote ES2015 module for: " + cls.export);
    });

    var esModules = new Map();
    obj.filter(function(val) {
        return val.kind == "Method"
    }).forEach(function(meth) {
        const tokens = meth.fullName.split(".");
        const parent = tokens.slice(0, tokens.length - 1);
        const dotted = parent.join(".");
        if (dotted != "" && dotted != "ol") { //HACK: Typedefs mis-classified as functions are being emitted by the plugin, so skip them for now
            if (!esModules.has(dotted)) {
                esModules.set(dotted, {
                    module: parent.join("/"),
                    exportMembers: []
                });
            }
            esModules.get(dotted).exportMembers.push({ name: tokens[tokens.length - 1], fullName: meth.fullName });
        }
    });

    esModules.forEach(function(mod) {
        var def = "/*" + os.EOL;
        def += " * ES2015 module declaration for " + mod.module.split("/").join(".") + os.EOL;
        def += " */" + os.EOL;
        def += 'declare module "' + mod.module + '" {' + os.EOL;
        //def += "    export default " + mod.export + ";" + os.EOL;
        def += "    export default {" + os.EOL;
        for (var i = 0; i < mod.exportMembers.length; i++) {
            def += "        " + mod.exportMembers[i].name + ": " + mod.exportMembers[i].fullName;
            if (i < mod.exportMembers.length - 1) {
                def += ",";
            }
            def += os.EOL;
        }
        def += "    };" + os.EOL;
        def += "}" + os.EOL;
        fs.appendFileSync(dtsPath, def);
        console.log("Wrote ES2015 module for: " + mod.module.split("/").join("."));
    });
});