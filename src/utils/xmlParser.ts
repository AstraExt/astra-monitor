/*!
 * Copyright (C) 2023 Lju
 *
 * This file is part of Astra Monitor extension for GNOME Shell.
 * [https://github.com/AstraExt/astra-monitor]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import GLib from 'gi://GLib';

type XMLObject = {
    [key: string]: string | number | boolean | XMLObject | XMLObject[];
};

export default class XMLParser {
    private pos: number = 0; // Current position in the string
    private objStack: XMLObject[] = [];
    private currentObj: XMLObject | undefined = {};
    private currentTagName: string = '';
    private xml: string = '';

    // The parsing state lives on the instance, so an async (time-sliced) parse must
    // complete before the next one can safely start: concurrent calls are serialized
    private parseQueue: Promise<unknown> = Promise.resolve();

    constructor() {}

    public parse(
        xml: string,
        skips: string[] = [],
        maxLockMs: number = 1
    ): Promise<XMLObject | undefined> {
        const run = this.parseQueue.then(() => this.doParse(xml, skips, maxLockMs));
        this.parseQueue = run.then(
            () => undefined,
            () => undefined
        );
        return run;
    }

    private async doParse(
        xml: string,
        skips: string[],
        maxLockMs: number
    ): Promise<XMLObject | undefined> {
        this.xml = xml;
        this.resetParser();
        this.skipDeclarations();

        // Time-slicing: periodically yield back to GNOME Shell's main loop so we don't
        // block rendering/animations for too long. The clock is only checked once every
        // 32 iterations because GLib.get_monotonic_time has a non-negligible cost itself.
        const maxLockUs = Math.max(0, maxLockMs) * 1000;
        let sliceStart = GLib.get_monotonic_time();
        let iterations = 0;

        const yieldIfNeeded = (): Promise<void> | null => {
            if(maxLockUs <= 0) return null;
            if((++iterations & 31) !== 0) return null;
            if(GLib.get_monotonic_time() - sliceStart < maxLockUs) return null;
            return new Promise<void>(resolve => {
                GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                    sliceStart = GLib.get_monotonic_time();
                    resolve();
                    return GLib.SOURCE_REMOVE;
                });
            });
        };

        try {
            let rootObjName = '';
            const rootObj: XMLObject = {};

            while(this.pos < this.xml.length) {
                const nextLessThan = this.xml.indexOf('<', this.pos);
                if(nextLessThan === -1) break; // End of XML document

                // Parse any text content before the next '<'
                if(nextLessThan !== this.pos) {
                    const textContent = this.parseTextContent(this.pos);
                    if(textContent && this.currentObj) {
                        this.currentObj['#text'] = textContent;
                    }
                }

                this.pos = nextLessThan;
                this.skipToNextImportantChar();

                if(this.xml[this.pos] === '<') {
                    if(this.xml[this.pos + 1] === '/') {
                        // handle comments
                        if(this.xml.startsWith('<!--', this.pos)) {
                            const endComment = this.xml.indexOf('-->', this.pos);
                            this.pos = endComment !== -1 ? endComment + 3 : this.xml.length;
                            continue;
                        }
                        
                        // Closing tag
                        this.pos = this.xml.indexOf('>', this.pos) + 1;
                        const finishedObject = this.objStack.pop();
                        if(this.objStack.length === 0) {
                            // We closed the root tag
                            if(rootObjName) {
                                rootObj[rootObjName] = finishedObject ?? {};
                                return rootObj;
                            }
                            return finishedObject;
                        }
                        // Update currentObj to the now-top of the stack
                        this.currentObj = this.objStack[this.objStack.length - 1];
                    } else {
                        // Opening tag
                        if(!this.parseTag()) break; // Could not find tag: malformed XML

                        // Check if this tag should be skipped entirely
                        if(skips.includes(this.currentTagName)) {
                            // Skip attributes and the entire content until the matching closing tag
                            // eslint-disable-next-line no-await-in-loop
                            await this.skipAttributesAndBlock(this.currentTagName, yieldIfNeeded);
                            continue; // Move to the next iteration
                        }

                        // Otherwise, parse the attributes
                        const newObj: XMLObject = {};
                        this.parseAttributesInto(newObj);

                        // If there's no current object, this is the root object
                        if(!this.currentObj) {
                            rootObjName = this.currentTagName;
                            this.currentObj = newObj;
                        } else {
                            // Insert newObj under the current tag
                            if(!this.currentObj[this.currentTagName]) {
                                this.currentObj[this.currentTagName] = newObj;
                            } else if(Array.isArray(this.currentObj[this.currentTagName])) {
                                (this.currentObj[this.currentTagName] as Array<XMLObject>).push(
                                    newObj
                                );
                            } else {
                                this.currentObj[this.currentTagName] = [
                                    this.currentObj[this.currentTagName] as XMLObject,
                                    newObj,
                                ];
                            }
                        }

                        // Push the new object onto the stack
                        this.objStack.push(newObj);
                        this.currentObj = newObj;
                    }
                } else {
                    // Not a '<' for some reason—skip it
                    this.pos++;
                }

                // Yield at the end of each main loop iteration if we've exceeded the time slice.
                const yieldPromise = yieldIfNeeded();
                if(yieldPromise) {
                    // eslint-disable-next-line no-await-in-loop
                    await yieldPromise;
                }
            }

            return undefined; // No proper closing tag or empty XML
        } finally {
            // Don't retain the (possibly large) XML string and tree between parses
            this.xml = '';
            this.resetParser();
        }
    }

    // -------------------------------------------------------------------------
    //  Helper Methods
    // -------------------------------------------------------------------------

    private resetParser(): void {
        this.pos = 0;
        this.objStack.length = 0;
        this.currentObj = undefined;
        this.currentTagName = '';
    }

    private skipDeclarations(): void {
        // Skip XML declaration
        if(this.xml.startsWith('<?xml', this.pos)) {
            const endDecl = this.xml.indexOf('?>', this.pos);
            this.pos = endDecl !== -1 ? endDecl + 2 : this.xml.length;
        }

        // Skip whitespace
        while(
            this.xml[this.pos] === ' ' ||
            this.xml[this.pos] === '\n' ||
            this.xml[this.pos] === '\t' ||
            this.xml[this.pos] === '\r'
        ) {
            this.pos++;
        }

        // Skip DOCTYPE declaration
        if(this.xml.startsWith('<!DOCTYPE', this.pos)) {
            const endDoctype = this.xml.indexOf('>', this.pos);
            this.pos = endDoctype !== -1 ? endDoctype + 1 : this.xml.length;
        }

        // Skip any whitespace after declarations
        while(
            this.xml[this.pos] === ' ' ||
            this.xml[this.pos] === '\n' ||
            this.xml[this.pos] === '\t' ||
            this.xml[this.pos] === '\r'
        ) {
            this.pos++;
        }
    }

    private skipToNextImportantChar(): void {
        const nextTagOpen = this.xml.indexOf('<', this.pos);
        const nextTagClose = this.xml.indexOf('>', this.pos);
        if(nextTagOpen === -1 && nextTagClose === -1) return;
        if(nextTagOpen !== -1 && nextTagClose !== -1) {
            this.pos = Math.min(nextTagOpen, nextTagClose);
        } else if(nextTagOpen === -1) {
            this.pos = nextTagClose;
        } else {
            this.pos = nextTagOpen;
        }
    }

    private parseTag(): boolean {
        const firstSpace = this.xml.indexOf(' ', this.pos);
        const firstClosure = this.xml.indexOf('>', this.pos);

        if(firstClosure === -1) return false;

        const endOfTagName =
            firstSpace !== -1 && firstSpace < firstClosure ? firstSpace : firstClosure;
        if(endOfTagName === -1) return false;

        // Extract the tag name
        this.currentTagName = this.xml.substring(this.pos + 1, endOfTagName).trim();
        this.pos = endOfTagName;
        return true;
    }

    private parseAttributesInto(attrs: XMLObject): void {
        // Skip any spaces between tag name and the first attribute or closing '>'
        while(this.xml[this.pos] === ' ') this.pos++;

        // If we reached '>' right away, no attributes
        if(this.xml[this.pos] === '>') {
            this.pos++; // Move past '>'
            return;
        }

        while(this.pos < this.xml.length && this.xml[this.pos] !== '>') {
            // Find the end of this tag or the next attribute
            let nextSpace = this.xml.indexOf(' ', this.pos);
            const nextEqual = this.xml.indexOf('=', this.pos);
            let endOfTag = this.xml.indexOf('>', this.pos);

            if(nextSpace === -1 || (nextEqual !== -1 && nextEqual < nextSpace)) {
                nextSpace = nextEqual;
            }
            if(nextSpace === -1 || nextSpace > endOfTag) {
                nextSpace = endOfTag;
            }

            // If nextSpace equals this.pos, something's off; break to avoid infinite loop
            if(nextSpace === this.pos || nextSpace === -1) {
                break;
            }

            const attrName = '@' + this.xml.substring(this.pos, nextSpace);
            this.pos = nextSpace + 1; // Move past the space or '='

            // Skip spaces to find the start of the attribute value or next attribute
            while(this.xml[this.pos] === ' ' && this.pos < endOfTag) this.pos++;

            // Check if attribute has a value
            if(
                this.xml[this.pos] === '=' ||
                this.xml[this.pos] === '"' ||
                this.xml[this.pos] === "'"
            ) {
                if(this.xml[this.pos] === '=') {
                    this.pos++; // Move past '='
                    while(this.xml[this.pos] === ' ') this.pos++; // Skip spaces after '='
                }

                const quoteChar = this.xml[this.pos];
                if(quoteChar === '"' || quoteChar === "'") {
                    this.pos++; // Move past opening quote
                    const endQuote = this.xml.indexOf(quoteChar, this.pos);
                    const attrValue = this.xml.substring(this.pos, endQuote);
                    attrs[attrName] = attrValue; // Assign string value
                    this.pos = endQuote + 1; // Move past closing quote
                } else {
                    // Handle as number or boolean
                    let spaceOrEndTag = this.xml.indexOf(' ', this.pos);
                    endOfTag = this.xml.indexOf('>', this.pos);
                    if(spaceOrEndTag === -1 || spaceOrEndTag > endOfTag) {
                        spaceOrEndTag = endOfTag;
                    }
                    const attrValue = this.xml.substring(this.pos, spaceOrEndTag);
                    attrs[attrName] = isNaN(Number(attrValue)) ? attrValue : Number(attrValue);
                    this.pos = spaceOrEndTag;
                }
            } else {
                // Boolean attribute
                attrs[attrName] = true;
            }

            while(this.xml[this.pos] === ' ' && this.pos < endOfTag) this.pos++;
            if(this.xml[this.pos] === '>') {
                this.pos++; // Move past '>'
                break;
            }
        }
    }

    private parseTextContent(startPos: number): string {
        const endPos = this.xml.indexOf('<', startPos);
        if(endPos === -1) {
            // No more tags found; return remaining text
            const text = this.xml.substring(startPos).trim();
            this.pos = this.xml.length;
            return text;
        }
        const textContent = this.xml.substring(startPos, endPos).trim();
        this.pos = endPos; // Update global position to the start of the next tag
        return textContent;
    }

    // -------------------------------------------------------------------------
    //  Skip Logic
    // -------------------------------------------------------------------------

    /**
     * Skip the entirety of a given tag (including nested occurrences).
     * This moves `this.pos` forward to just past the matching closing tag.
     * Example: if tagName = 'supported_clocks', it will skip everything
     * from <supported_clocks> to </supported_clocks>, including nested
     * <supported_clocks> if they occur.
     */
    private async skipAttributesAndBlock(
        tagName: string,
        yieldIfNeeded: () => Promise<void> | null
    ): Promise<void> {
        const closePrefix = `</${tagName}`;
        const openPrefix = `<${tagName}`;

        // First, move pos to the end of this opening tag ('>')
        const endOfTag = this.xml.indexOf('>', this.pos);
        if(endOfTag === -1) {
            // Malformed tag, just jump to the end
            this.pos = this.xml.length;
            return;
        }

        // Check if this is self-closing: <tagName ... />
        // If so, there's nothing else to skip.
        const maybeSlash = this.xml.lastIndexOf('/', endOfTag);
        if(maybeSlash !== -1) {
            // Ensure the slash is actually right before the '>' (ignoring whitespace)
            const tagContent = this.xml.substring(maybeSlash, endOfTag).trim();
            if(tagContent === '/') {
                // It's a self-closing tag, so just move pos past it and return
                this.pos = endOfTag + 1;
                return;
            }
        }

        // Otherwise, skip past the '>'
        this.pos = endOfTag + 1;

        // Now skip everything until we find the matching `</tagName>` (considering nesting)
        let level = 1;
        while(this.pos < this.xml.length && level > 0) {
            const yieldPromise = yieldIfNeeded();
            if(yieldPromise) {
                // eslint-disable-next-line no-await-in-loop
                await yieldPromise;
            }
            const nextOpen = this.xml.indexOf('<', this.pos);
            if(nextOpen === -1) {
                // No more tags, end of document
                this.pos = this.xml.length;
                break;
            }
            this.pos = nextOpen;

            // Check if it's a closing tag for this element
            if(this.xml.startsWith(closePrefix, this.pos)) {
                level--;
            }
            // Check if it's a nested opening tag of the same name
            else if(this.xml.startsWith(openPrefix, this.pos)) {
                level++;
            }

            // Move past '>'
            const nextClose = this.xml.indexOf('>', this.pos + 1);
            if(nextClose === -1) {
                // Malformed XML, just jump to the end
                this.pos = this.xml.length;
                break;
            }
            this.pos = nextClose + 1;
        }
    }
}
