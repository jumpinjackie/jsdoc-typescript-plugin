module TsdPlugin {
    /**
     * Module helper utility
     */
    export class ModuleUtils {
        /**
         * Gets whether this module name is an AMD one
         */
        public static isAMD(name: string): boolean {
            return name.indexOf("/") >= 0;
        }
        
        /**
         * Writes the TS module tree out to the specified output stream
         */
        public static outputTsd(module: ITSModule, stream: IndentedOutputStream, conf: ITypeScriptPluginConfiguration, logger: ILogger, publicTypes: Dictionary<IOutputtable>): void {
            for (let type of module.types) {
                //console.log(`Outputting type: ${type.getFullName()}`);
                type.output(stream, conf, logger, publicTypes);
            }
            for (let moduleName in module.children) {
                let child = module.children[moduleName];
                //Root modules have to be declared
                let decl = ((child.isRoot === true) ? "declare " : "");
                //Write module decl
                
                //Strip module: prefix if found
                let modName: string = moduleName;
                if (modName.indexOf("module:") == 0) {
                    modName = modName.substring(7);
                }
                if (ModuleUtils.isAMD(modName)) {
                    stream.writeln(`${decl}module "${modName}" {`)
                } else {
                    stream.writeln(`${decl}module ${modName} {`);
                }
                stream.indent();
                ModuleUtils.outputTsd(child, stream, conf, logger, publicTypes);
                stream.unindent();
                stream.writeln("}");
            }
        }
    }
}