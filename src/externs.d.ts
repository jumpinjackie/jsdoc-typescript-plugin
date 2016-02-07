declare module "jsdoc/env" {
    class Environment {
        public static conf: any;
    }
    export = Environment;
}
declare module "jsdoc/util/logger" {
    class Logger {
        public warn(msg: string);
        public error(msg: string);
        public fatal(msg: string);
    }
    export = Logger;
}