/// <reference path="./doclet.ts" />

module TsdPlugin {
    /**
     * The event passed on a JsDoc newDoclet event
     */
    export interface IJsDocNewDocletEvent {
        /**
         * The processed doclet
         */
        doclet: IDoclet;
    }
    
    /**
     * The event passed on a JsDoc processingComplete event
     */
    export interface IJsDocProcessingCompleteEvent {
        /**
         * The processed doclets
         */
        doclets: IDoclet[];
    }
}