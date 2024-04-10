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

type XMLObject = {
    [key: string]: string | number | boolean | XMLObject | XMLObject[];
};

export default class XMLParser {
    private pos: number = 0; // Current position in the string
    private stack: Array<{ tagName: string; obj: XMLObject }> = [];
    private currentObj: XMLObject | undefined = {};
    private currentTagName: string = '';
    private xml: string = '';

    constructor() {}

    public parse(xml: string): XMLObject | undefined {
        this.xml = xml;
        this.resetParser();
        this.skipDeclarations();

        let rootObjName = '';
        const rootObj: XMLObject = {};

        while(this.pos < this.xml.length) {
            const nextLessThan = this.xml.indexOf('<', this.pos);
            if(nextLessThan === -1) break; // End of XML document

            if(nextLessThan !== this.pos) {
                const textContent = this.parseTextContent(this.pos);
                if(textContent && this.currentObj) this.currentObj['#text'] = textContent;
            }

            this.pos = nextLessThan;
            this.skipToNextImportantChar();

            if(this.xml[this.pos] === '<') {
                if(this.xml[this.pos + 1] === '/') {
                    // Closing tag
                    this.pos = this.xml.indexOf('>', this.pos) + 1;
                    const finishedObject = this.stack.pop();
                    if(this.stack.length === 0) {
                        if(rootObjName) {
                            rootObj[rootObjName] = finishedObject?.obj ?? {};
                            return rootObj;
                        }
                        return finishedObject?.obj;
                    }
                    this.currentObj = this.stack[this.stack.length - 1].obj;
                } else {
                    // Opening tag
                    if(!this.parseTag()) break; // Could not find tag: malformed XML

                    const attributes = this.parseAttributes();
                    const newObj: XMLObject = { ...attributes };
                    if(!this.currentObj) {
                        rootObjName = this.currentTagName;
                        this.currentObj = newObj;
                    } else {
                        if(!this.currentObj[this.currentTagName])
                            this.currentObj[this.currentTagName] = newObj;
                        else if(Array.isArray(this.currentObj[this.currentTagName]))
                            (this.currentObj[this.currentTagName] as Array<XMLObject>).push(newObj);
                        else
                            this.currentObj[this.currentTagName] = [
                                this.currentObj[this.currentTagName] as XMLObject,
                                newObj
                            ];
                    }
                    this.stack.push({ tagName: this.currentTagName, obj: newObj });
                    this.currentObj = newObj;
                }
            } else {
                this.pos++;
            }
        }

        return undefined; // In case of no proper closing tag or empty XML
    }

    private resetParser(): void {
        this.pos = 0;
        this.stack = [];
        this.currentObj = undefined;
        this.currentTagName = '';
    }

    private skipDeclarations(): void {
        // Skip XML declaration
        if(this.xml.startsWith('<?xml', this.pos)) this.pos = this.xml.indexOf('?>', this.pos) + 2;
        // Skip whitespace
        while(
            this.xml[this.pos] === ' ' ||
            this.xml[this.pos] === '\n' ||
            this.xml[this.pos] === '\t' ||
            this.xml[this.pos] === '\r'
        )
            this.pos++;
        // Skip DOCTYPE declaration
        if(this.xml.startsWith('<!DOCTYPE', this.pos))
            this.pos = this.xml.indexOf('>', this.pos) + 1;
        // Skip any whitespace after declarations
        while(
            this.xml[this.pos] === ' ' ||
            this.xml[this.pos] === '\n' ||
            this.xml[this.pos] === '\t' ||
            this.xml[this.pos] === '\r'
        )
            this.pos++;
    }

    private skipToNextImportantChar(): void {
        const nextTagOpen = this.xml.indexOf('<', this.pos);
        const nextTagClose = this.xml.indexOf('>', this.pos);
        this.pos = nextTagOpen < nextTagClose && nextTagOpen !== -1 ? nextTagOpen : nextTagClose;
    }

    private parseTag(): boolean {
        const firstSpace = this.xml.indexOf(' ', this.pos);
        const firstClosure = this.xml.indexOf('>', this.pos);

        const endOfTagName =
            firstSpace !== -1 && firstSpace < firstClosure ? firstSpace : firstClosure;
        if(endOfTagName === -1) return false;

        this.currentTagName = this.xml.substring(this.pos + 1, endOfTagName).trim();
        this.pos = endOfTagName;
        return true;
    }

    private parseAttributes(): XMLObject {
        const attrs: XMLObject = {};

        while(this.xml[this.pos] === ' ') this.pos++;

        if(this.xml[this.pos] === '>') {
            this.pos++; // Move past '>'
            return attrs; // Return empty attributes
        }

        while(this.pos < this.xml.length && this.xml[this.pos] !== '>') {
            // Find the end of this tag or the next attribute
            let nextSpace = this.xml.indexOf(' ', this.pos);
            const nextEqual = this.xml.indexOf('=', this.pos);
            let endOfTag = this.xml.indexOf('>', this.pos);

            if(nextSpace === -1 || (nextEqual !== -1 && nextEqual < nextSpace))
                nextSpace = nextEqual;

            if(nextSpace === -1 || nextSpace > endOfTag) nextSpace = endOfTag;
            // No more attributes
            if(nextSpace === this.pos || nextSpace === -1) break;

            const attrName = '@' + this.xml.substring(this.pos, nextSpace);
            this.pos = nextSpace + 1; // Move past the space or equal sign

            // Skip spaces to find the start of attribute value or next attribute name
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
                    if(spaceOrEndTag === -1 || spaceOrEndTag > endOfTag) spaceOrEndTag = endOfTag;
                    const attrValue = this.xml.substring(this.pos, spaceOrEndTag);
                    attrs[attrName] = isNaN(Number(attrValue)) ? attrValue : Number(attrValue); // Convert to number if possible
                    this.pos = spaceOrEndTag;
                }
            } else {
                // No value, boolean attribute
                attrs[attrName] = true;
            }

            while(this.xml[this.pos] === ' ' && this.pos < endOfTag) this.pos++;
            if(this.xml[this.pos] === '>') {
                this.pos++; // Move past '>'
                break;
            }
        }

        return attrs;
    }

    private parseTextContent(startPos: number): string {
        const endPos = this.xml.indexOf('<', startPos);
        const textContent = this.xml.substring(startPos, endPos).trim();
        this.pos = endPos; // Update global position to the start of the next tag
        return textContent;
    }
}
