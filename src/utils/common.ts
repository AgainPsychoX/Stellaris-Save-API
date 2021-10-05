
export class MyError extends Error {
	code: string;
	inner?: any;

	constructor(code: string, message?: string, inner?: any) {
		super(message || code);
		this.code = code;
		this.inner = inner;
	}
}

export const getLineAndColumn = (string: string, offset: number) => {
	let line = 1;
	let column = 1;
	for (let j = 0; j < offset; j++) {
		column += 1;
		if (string.charCodeAt(j) === 10) {
			line += 1;
			column = 1;
		}
	}
	return [line, column] as const;
}

export const getLinesRange = (
	string: string, 
	options: {
		prefixLineNumbers?: boolean
		firstLine?: number, 
		lastLine?: number, 
		centerLine?: number,
		radius?: number,
		highlight?: { line: number, column?: number },
		process?: (lineString: string, lineNumber: number) => string;
	} = {}) => {
	options = Object.assign({ prefixLineNumbers: false, radius: 2 }, options);
	if (options.firstLine === undefined) {
		if (options.centerLine === undefined) {
			if (options.highlight) {
				options.centerLine = options.highlight.line;
			}
			else {
				throw new Error('no lines selected');
			}
		}
		if (options.radius === undefined) {
			options.radius = 2;
		}
		options.firstLine = options.centerLine - options.radius;
		if (options.lastLine === undefined) {
			options.lastLine = options.centerLine + options.radius;
		}
	}
	if (options.firstLine <= 0) {
		options.firstLine = 1;
	}
	let current = 0;
	let currentLine = 1;
	let selected: string[] = [];
	while (true) {
		const next = string.indexOf('\n', current);
		if (next === -1) {
			selected.push(string.substring(current));
			break;
		}
		if (options.firstLine <= currentLine) {
			selected.push(string.substring(current, next));
			if (currentLine == options.lastLine) {
				break;
			}
		}
		currentLine += 1;
		current = next + 1;
	}
	if (options.process) {
		selected = selected.map((text, index) => options.process!(text, options.firstLine! + index));
	}
	let prefixWidth = 0;
	if (options.prefixLineNumbers) {
		const width = ('' + (options.firstLine + selected.length)).length;
		prefixWidth = width + 2;
		selected = selected.map((text, index) => `${('' + (options.firstLine! + index)).padStart(width)}: ${text}`);
	}
	if (options.highlight) {
		const index = Math.max(options.highlight.line - options.firstLine, 0);
		const insert = options.highlight.column
			? '^'.padStart(prefixWidth + options.highlight.column) 
			: `${' '.repeat(prefixWidth)}${'^'.repeat(38)}`
		;
		selected.splice(index + 1, 0, insert);
	}
	return selected;
}

export interface ParserErrorPoint {
	offset: number;
	comment?: string;
}

export class ParserError extends MyError {
	path: string | undefined
	content: string;
	points: ParserErrorPoint[];

	constructor(code: string, message: string, path: string | undefined, content: string, points?: ParserErrorPoint[], inner?: any) {
		super(code, message, inner);
		this.path = path;
		this.content = content;
		this.points = points || [];

		// Make 'content' string not enumerable to hide it from debug printing,
		// as it would be annoying (too long to read, only beginning visible).
		Object.defineProperty(this, 'content', { enumerable: false });
	}

	override toString() {
		return [this.message, ...this.points.map(p => {
			const [line, column] = getLineAndColumn(this.content, p.offset);
			return (
				(this.path 
					? `${this.path}:${line}:${column} ${p.comment || ''}` 
					: (p.comment 
						? `${p.comment}\n` 
						: '\n'
					)
				) +
				getLinesRange(this.content, {
					prefixLineNumbers: true, 
					highlight: { line, column },
					process: (line => line.replace(/ /g, '·').replace(/\t/g, '▹')),
				}).join('\n')
			);
		})].join('\n');
	}
}

