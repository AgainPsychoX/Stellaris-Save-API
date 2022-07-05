import { ParserError } from "./common";

export type ParadoxDataPrimitive = string | number;

export type ParadoxDataPiece = ParadoxDataPrimitive | ParadoxDataObject;

export type ParadoxDataEntry = {
	/**
	 * Entry key. If null, entry is considered as value only.
	 */
	0: string | number | null;

	/**
	 * Entry value. If undefined, entry will be omitted (not saved).
	 */
	1: ParadoxDataPiece | undefined;

	/**
	 * Operator, if any other than '='.
	 * 
	 * Operators looks like: `=`, `==`, `!=`, `>=`, `<=`.
	 * If it's operator other than most common `=`, it will be set as third
	 * index at entry array, i.e. `a >= b` -> `['a', 'b', '>=']`.
	 */
	2?: string | undefined;
}

export type ParadoxDataObject = ParadoxDataEntry[];

export const stripSidesByCharacter = (string: string) => string.substring(1, string.length - 1);

/// Serializes and deserializes Paradox save data to and from Javascript accessible form:
/// * statement form entry - array with up to 2 elements: key and value, or sole value.
/// * key can be one of: number, string or null if not existing (solo value entry).
/// * value can be one of: number, string or array of children entries.
export class ParadoxDataHelper {
	static loadFromString(string: string, reportProgress?: (_: number) => void) {
		let i = 0;

		const skipWhitespace = () => {
			while (string.charCodeAt(i) <= 32) {
				i += 1;
			}
		};
		const skipWhitespaceAndComments = () => {
			while (true) {
				skipWhitespace();
				if (string.charCodeAt(i) === 35) {
					// Skip everything after hash #
					let c = string.charCodeAt(i);
					while (c && c != 10) {
						i += 1;
						c = string.charCodeAt(i);
					}
					// Skip new line
					i += 1;
				}
				else {
					// No more comments
					break;
				}
			}
		};

		/**
		 * Skipping word or number. Stop at whitespace, operator or object close.
		 */
		const skipSmallPrimitive = () => {
			let charCode;
			while (true) {
				charCode = string.charCodeAt(i);
				if (charCode > 32 && !([33, 60, 61, 62, 125].includes(charCode))) {
					i += 1;
					continue;
				}
				break;
			}
		}

		const getPiece = (): ParadoxDataPiece | undefined => {
			const charCode = string.charCodeAt(i);
			// Name (a-z/A-Z) or variable (@)
			if ((97 <= charCode && charCode <= 122) || (64 <= charCode && charCode <= 90)) {
				const start = i;
				i += 1;
				skipSmallPrimitive();
				return string.substring(start, i);
			}
			// Number (0-9 or '-')
			else if ((48 <= charCode && charCode <= 57) || charCode === 45) {
				const start = i;
				i += 1;
				skipSmallPrimitive();
				return parseFloat(string.substring(start, i));
			}
			// String "..."
			else if (charCode === 34) {
				const start = i;
				let end = i;
				do {
					end = string.indexOf('"', end + 1);
				}
				while (string.charAt(end - 1) == '\\');
				
				if (end === -1) {
					throw new ParserError(
						'parser/string-not-closed', `string not closed`,
						undefined, string, [{offset: start, comment: 'String start'}]
					);
				}
				const tmp = string.substring(i, end + 1);
				i = end + 1;
				return tmp;
			}
			// Object {...}
			else if (charCode === 123) {
				const start = i;
				i += 1;
				const entries = [];
				while (true) {
					const entry = getNextEntry();
					if (!entry) {
						break;
					}
					entries.push(entry);
				}
				if (string.charAt(i) === '}') {
					i += 1;
					return entries;
				}
				else {
					throw new ParserError(
						'parser/object-not-closed', `object not closed`, 
						undefined, string, 
						[
							{offset: start, comment: 'Object start'}, 
							{offset: i, comment: 'Expected end'},
						]
					);
				}
			}
			// End of object '}'
			else if (charCode === 125) {
				return undefined;
			}
			// End of file
			else if (isNaN(charCode)) {
				return undefined;
			}
			// Bugged empty string key
			else if (charCode === 61) {
				return '';
			}
			else {
				throw new ParserError(
					'parser/unexpected-symbol', `unexpected symbol: charCode=${charCode}`, 
					undefined, string, [{offset: i}]
				);
			}
		};

		const getNextEntry = (): ParadoxDataEntry | undefined => {
			if (reportProgress) {
				reportProgress(i);
			}

			// Look for next key
			skipWhitespaceAndComments();
			const key = getPiece();
			if (key === undefined) {
				return undefined;
			}

			// Look for operator
			skipWhitespaceAndComments();
			let operator = string.charAt(i);
			let anyOperator = false;
			switch (operator) {
				case '!':
				case '<':
				case '=':
				case '>':
					i += 1;
					if (string.charAt(i + 1) == '=') {
						// 2 character operator, `!=`, `<=`, `==`, `>=`
						operator += '=';
						i += 1;
					}
					anyOperator = true;
					break;
			}

			// If any operator, look for associated value
			if (anyOperator) {
				if (Array.isArray(key)) {
					throw new ParserError(
						'parser/array-as-key', `array as key is invalid`, 
						undefined, string, [{offset: i}]
					);
				}
				skipWhitespaceAndComments();
				const value = getPiece();
				if (operator == '=') {
					return [key, value];
				}
				else {
					return [key, value, operator];
				}
			}
			// If no operator, return as value with no key (array member)
			else {
				return [null, key];
			}
		};
	
		const data = [];
		while (true) {
			const entry = getNextEntry();
			if (!entry) {
				break;
			}
			data.push(entry);
		}
		return data;
	}

	static saveToString(entries: ParadoxDataEntry[]) {
		// TODO: add `reportProgress` for characters written (approx)
		const objectToString = (o: ParadoxDataEntry[], depth: number) => {
			let str = `{\n`;
			o.forEach(e => {
				str += entryToString(e, depth + 1);
			});
			str += `${'\t'.repeat(depth)}}\n`;
			return str;
		}
		const entryToString = (e: ParadoxDataEntry, depth: number) => {
			if (typeof e[1] == 'undefined') {
				// Omit undefined
				return '';
			}
			if (e[0] === null) {
				// Solo value entry
				switch (typeof e[1]) {
					case 'string':
					case 'number': return `${'\t'.repeat(depth)}${e[1]}\n`;
					case 'object': return `${'\t'.repeat(depth)}${objectToString(e[1] as ParadoxDataEntry[], depth)}`;
					default: throw new Error(`invalid value type: ${typeof e[0]}`);
				}
			}
			else {
				// Normal 'key=value' entry
				let str;
				switch (typeof e[0]) {
					case 'string':
					case 'number': str = `${'\t'.repeat(depth)}${e[0]}`; break;
					default: throw new Error(`invalid key type: ${typeof e[0]}`);
				}
				str += e[2] || '=';
				switch (typeof e[1]) {
					case 'string':
					case 'number': str += `${e[1]}\n`; break;
					case 'object': str += objectToString(e[1] as ParadoxDataEntry[], depth); break;
					default: throw new Error(`invalid value type: ${typeof e[1]}`);
				}
				return str;
			}
		}
	
		let str = '';
		entries.forEach(e => {
			str += entryToString(e, 0);
		});
		return str;
	}
}

type EntriesFilter = (key: string | number | null, value: ParadoxDataPiece | undefined) => boolean;

/**
 * Object handle helper class, easing access to sub-elements.
 * 
 * Object is set of entries, e.g. `foo = { bar = 123 xyz = "Lorem Ipsum" }`.
 */
export class ParadoxDataObjectHandle {
	_object: ParadoxDataObject;

	constructor(object: ParadoxDataObject | ParadoxDataObjectHandle | ParadoxDataEntryHandle) {
		if (object instanceof ParadoxDataEntryHandle) {
			if (!Array.isArray(object._entry)) {
				throw new ReferenceError(`trying to get object handle for entry value of primitive type`);
			}
			this._object = object._entry[1] as ParadoxDataObject;
		}
		else if (object instanceof ParadoxDataObjectHandle) {
			this._object = object._object;
		}
		else {
			this._object = object;
		}
	}

	/**
	 * Get entry handle for key in object. 
	 * If entry does not exist, if will be created as undefined (not saved unless changed).
	 */ 
	$ (key: string | number) {
		const entry = this._object.find(e => e[0] === key);
		if (entry) {
			return new ParadoxDataEntryHandle(entry);
		}
		else {
			const newEntry = [key, undefined] as ParadoxDataEntry;
			this._object.push(newEntry);
			return new ParadoxDataEntryHandle(newEntry);
		}
	}

	/**
	 * Assuming entry contains the object, get entries handles of that object.
	 * Can provide key to filtering (by value) or function (conditional).
	 * If no entries matching key exist, empty array is returned.
	 * @throws `ReferenceError` in case the entry contains no entries (primitives type).
	 */ 
	 $$ (key?: string | number | null | undefined | EntriesFilter) {
		if (key === undefined) {
			return this._object
				.map(e => new ParadoxDataEntryHandle(e))
			;
		}
		if (typeof key === 'function') {
			return this._object
				.filter(e => key(e[0], e[1]))
				.map(e => new ParadoxDataEntryHandle(e))
			;
		}
		return this._object
			.filter(e => e[0] === key)
			.map(e => new ParadoxDataEntryHandle(e))
		;
	}

	/**
	 * Assuming entry contains the object, removes subentry of that object.
	 */
	removeSubentry(entry: ParadoxDataEntry | ParadoxDataEntryHandle) {
		const other = entry instanceof ParadoxDataEntryHandle ? entry._entry : entry;
		const index = this._object.indexOf(other);
		if (index !== -1) {
			this._object.splice(index, 1);
		}
	}

	/**
	 * Assuming entry contains the object, removes all subentries 
	 * of that object with selected key.
	 */
	removeSubentriesByKey(key: string) {
		let i = 0;
		while (i < this._object.length) {
			if (this._object[i]![0] === key) {
				this._object.splice(i, 1);
			}
			else {
				i += 1;
			}
		}
	}

	/**
	 * Value, as underlying array.
	 */
	get value (): ParadoxDataObject {
		return this._object;
	}

	/**
	 * Shortcut for value.
	 */
	get _ (): ParadoxDataObject {
		return this._object;
	}
}

/**
 * Entry handle helper class, easing access to sub-elements.
 * 
 * Entry is pair of key and value, e.g. `foo = { bar = 123 xyz = "Lorem Ipsum" }`.
 */
export class ParadoxDataEntryHandle {
	_entry: ParadoxDataEntry;

	constructor(entry: ParadoxDataEntry | ParadoxDataEntryHandle) {
		this._entry = entry instanceof ParadoxDataEntryHandle ? entry._entry : entry;
	}

	/**
	 * Get entry handle for key in object, assuming entry contains the object.
	 * If entry for key does not exist, if will be created upon value assignation.
	 * @throws `ReferenceError` in case the entry contains no entries (primitives type).
	 */ 
	$ (key: string | number) {
		const entries = this.valueAsObject();
		const entry = entries.find(e => e[0] === key);
		if (entry) {
			return new ParadoxDataEntryHandle(entry);
		}
		else {
			const newEntry = [key, undefined] as ParadoxDataEntry;
			entries.push(newEntry);
			return new ParadoxDataEntryHandle(newEntry);
		}
	}

	/**
	 * Assuming entry contains the object, get entries handles of that object.
	 * Can provide key to filtering (by value) or function (conditional).
	 * If no entries matching key exist, empty array is returned.
	 * @throws `ReferenceError` in case the entry contains no entries (primitives type).
	 */ 
	$$ (key?: string | number | null | undefined | EntriesFilter) {
		const entries = this.valueAsObject();
		if (key === undefined) {
			return entries
				.map(e => new ParadoxDataEntryHandle(e))
			;
		}
		if (typeof key === 'function') {
			return entries
				.filter(e => key(e[0], e[1]))
				.map(e => new ParadoxDataEntryHandle(e))
			;
		}
		return entries
			.filter(e => e[0] === key)
			.map(e => new ParadoxDataEntryHandle(e))
		;
	}

	/**
	 * Assuming entry contains the object, removes subentry of that object.
	 */
	removeSubentry(entry: ParadoxDataEntry | ParadoxDataEntryHandle) {
		const entires = this.valueAsObject();
		const other = entry instanceof ParadoxDataEntryHandle ? entry._entry : entry;
		const index = entires.indexOf(other);
		if (index !== -1) {
			entires.splice(index, 1);
		}
	}

	/**
	 * Assuming entry contains the object, removes all subentries 
	 * of that object with selected key.
	 */
	removeSubentriesByKey(key: string) {
		const entires = this.valueAsObject();
		let i = 0;
		while (i < entires.length) {
			if (entires[i]![0] === key) {
				entires.splice(i, 1);
			}
			else {
				i += 1;
			}
		}
	}

	/**
	 * Key of the entry.
	 */
	get key (): string | number | null {
		return this._entry[0];
	}
	set key (value: string | number | null) {
		this._entry[0] = value;
	}

	/**
	 * Value in the entry.
	 */
	get value (): ParadoxDataPiece | undefined {
		return this._entry[1];
	}
	set value (value: ParadoxDataPiece | undefined) {
		this._entry[1] = value;
	}

	// TODO: add $ and $$ proper names, make $ and $$ just shorthands
	// TODO: refactor project to use `valueAsObject` and similar
	// TODO: `valueAsString`
	// TODO: `valueAsWord`
	// TODO: `valueAsNumber`
	// TODO: remove `_`?
	// TODO: make `_entry` protected?

	/**
	 * Gets value in the entry, asserting it's object. 
	 * If it's undefined, sets value as empty object.
	 * @throws `ReferenceError` in case the entry is not object.
	 */
	valueAsObject(): ParadoxDataObject {
		if (!Array.isArray(this._entry[1])) {
			if (this._entry[1] === undefined) {
				this._entry[1] = [];
			}
			else {
				throw new ReferenceError(`expected object value`);
			}
		}
		return this._entry[1];
	}

	/**
	 * Shortcut for value.
	 */
	get _ (): ParadoxDataPiece | undefined {
		return this._entry[1];
	}
	set _ (value: ParadoxDataPiece | undefined) {
		this._entry[1] = value;
	}
}

/**
 * Prepares object handle for data piece, assuming its object.
 * Throws error if passed piece isn't valid object.
 */
export const $ = (object: ParadoxDataPiece | undefined) => {
	if (!Array.isArray(object)) {
		throw new TypeError(`expected data object`);
	}
	return new ParadoxDataObjectHandle(object);
}
