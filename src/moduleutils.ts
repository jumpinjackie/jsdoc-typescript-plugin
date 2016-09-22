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
        
        public static cleanModuleName(moduleName: string): string {
            let modName: string = moduleName;
            if (modName.indexOf("module:") == 0) {
                modName = modName.substring(7);
            }
            if (modName.indexOf("~") >= 0) {
                modName = modName.substring(modName.indexOf("~") + 1);
            }
            return modName;
        }
        
        /**
         * Writes the TS module tree out to the specified output stream
         */
        public static outputTsd(
            module:      ITSModule,
            stream:      IndentedOutputStream,
            conf:        ITypeScriptPluginConfiguration,
            logger:      ILogger,
            publicTypes: Map<string, IOutputtable>
        ): void {
            for (let type of module.types) {
                //console.log(`Outputting type: ${type.getFullName()}`);
                type.output(stream, conf, logger, publicTypes);
            }
            module.children.forEach((child, moduleName) => {
                //Root modules have to be declared
                let decl = ((child.isRoot === true && conf.doNotDeclareTopLevelElements === false) ? "declare " : "");
                //Write module decl
                
                //Strip module: prefix if found
                let modName: string = ModuleUtils.cleanModuleName(moduleName);
                if (ModuleUtils.isAMD(modName)) {
                    stream.writeln(`${decl}module "${modName}" {`)
                } else {
                    stream.writeln(`${decl}module ${modName} {`);
                }
                stream.indent();
                ModuleUtils.outputTsd(child, stream, conf, logger, publicTypes);
                stream.unindent();
                stream.writeln("}");
            });
        }
    }
}