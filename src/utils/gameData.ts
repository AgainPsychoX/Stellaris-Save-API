import { exec } from 'child_process';
import { R_OK } from 'constants';
import { access, opendir, readFile } from 'fs/promises';
import { join, resolve } from 'path/win32';
import { MyError, ParserError } from './common';
import { getLogger } from './logging';
import { ParadoxDataEntry, ParadoxDataHelper, ParadoxDataObject, ParadoxDataPrimitive } from './paradox';

const console = getLogger('game-data');

/**
 * @private Shouldn't be accessed directly; Use `setGameDirectory` or `getGameDirectory`.
 */
let gameDirectory: string | undefined;

export const setGameDirectory = async (path: string) => {
	gameDirectory = path;
	return testGameDirectory(path);
}

export const getGameDirectory = async () => {
	if (!gameDirectory) {
		// TODO: save detected game directory for faster detection later?
		gameDirectory = await tryDetectGameDirectory();
		if (gameDirectory) {
			console.debug(`Using game directory: ${gameDirectory}`);
		}
		else {
			console.warn(`Game directory not found, some functionality might be unavailable. Use '--game-directory' option to provide custom path.`);
		}
		return gameDirectory;
	}
	return gameDirectory;
}

const testGameDirectory = async (path: string) => {
	try {
		await access(join(path, 'stellaris.exe'), R_OK);
		await access(join(path, 'common/'), R_OK);
	}
	catch (_) {
		return false;
	}
	return true;
}

const tryDetectGameDirectory = async () => {
	// TODO: detect game directory using Steam
	// TODO: detect game directory using GOG
	
	// Detect game directory on drives within subfolder
	if (process.platform == 'win32') {
		// TODO: add one directory depth? many people have structure like 'D:\MyGames\ASDF'
		console.debug('Looking for game directory on directly on drives...');
		const queue = await new Promise<string[]>((resolve, reject) => {
			exec('wmic logicaldisk get name', (error, stdout) => {
				if (error) {
					reject(error);
				}
				else {
					resolve(
						stdout.split('\r\r\n')
							.filter(value => /[A-Za-z]:/.test(value))
							.map(value => `${value.trim()}\\`)
					);
				}
			});
		});
		let i = 0;
		while (i < queue.length) {
			const dir = await opendir(queue[i]!);
			for await (const dirent of dir) {
				if (dirent.name.toLowerCase().includes('stellaris')) {
					if (dirent.isDirectory()) {
						const entryPath = join(dir.path, dirent.name);
						if (await testGameDirectory(entryPath)) {
							return entryPath;
						}
						else {
							if (200 < queue.length) {
								// Stop queueing more, as we could hit symlink hell.
								continue;
							}
							queue.push(entryPath);
						}
					}
				}
			}
			i += 1;
		}
	}

	return '';
}

const resolveSelectorToFiles = async (directory: string, selector: string) => {
	const files: string[] = [];
	if (selector.endsWith('*') || selector.endsWith('*.txt')) {
		const dir = await opendir(join(directory, selector, '../'));
		for await (const dirent of dir) {
			if (dirent.isFile() && dirent.name.endsWith('.txt')) {
				files.push(join(dir.path, dirent.name));
			}
		}
	}
	else {
		if (selector.endsWith('.txt')) {
			files.push(selector);
		}
		else {
			files.push(selector + '.txt');
		}
	}

	return files;
}

// For now absolute path lower cased.
type CacheKey = string;
const getCacheKey = (path: string) => resolve(path).toLowerCase();

/**
 * Cache for game data. 
 * @key `string` - key of game data.
 * @value `ParadoxDataEntry[]` - parsed values of game file.
 */
const gameDataCache = new Map<CacheKey, ParadoxDataEntry[]>();

/**
 * Loads game data that uses Paradox data format (`.txt` files).
 * 
 * @param selector Relative path from game directory to the game resource.
 * If ends with '*', i.e. 'common/personalities/*, loads whole dir, merged.
 * Does not include modded content (yet?).
 * 
 * Note: If using caching, modifying returned data might affect cache content,
 * and further return values from further calls using the cache. 
 * Typically, it isn't an issue, as game data should not be modified.
 */
export const loadGameData = async (selector: string,
	settings: {
		/**
		 * If true, error will be thrown if game data can't be loaded.
		 * @default true
		 */
		critical?: boolean,
		/**
		 * If true, enables caching loaded files, so file is read only once.
		 * @default true
		 */
		cache?: boolean,
		/**
		 * If false, variables will not be evaluated to values.
		 * Example: `@corvette_hp` will be evaluated to `300`.
		 */
		evaluateVars?: boolean,
		/**
		 * If true, enables caching variables sources if evaluating vars.
		 * @default true
		 */
		cacheVars?: boolean,
	} = {}
) => {
	settings = Object.assign({
		critical: true, 
		cache: true, 
		cacheVars: true,
		evaluateVars: true,
	}, settings);

	// TODO: allow selector to be absolute path?

	const gameDirectory = await getGameDirectory();
	if (!gameDirectory && settings.critical) {
		throw new MyError('no-game-directory', `Game directory not detected, can't load game data.`)
	}

	const files = await resolveSelectorToFiles(gameDirectory, selector);

	const object: ParadoxDataEntry[] = [];
	for (const file of files) {
		let data: ParadoxDataEntry[] | undefined = undefined;

		const key = getCacheKey(file);

		// Try use cached value
		if (settings.cache) {
			// TODO: cache across program executions? idk is it even worth coding
			data = gameDataCache.get(key);
		}

		console.debug(`Loading game data for '${selector}'... Current file: ${file} ${data ? '[from cache]' : ''}`);

		// Load value raw
		if (!data) {
			try {
				const string = await readFile(file, 'utf-8');
				const parsed = ParadoxDataHelper.loadFromString(string);
				object.push(...parsed);

				if (settings.cache) {
					gameDataCache.set(key, parsed);
				}
			}
			catch (error) {
				if (error instanceof ParserError) {
					error.path = file;
				}
				if (settings.critical) {
					console.warn(`Error while parsing game data at '${file}'. `);
					throw error;
				}
				else {
					console.warn(`Error while parsing game data at '${file}'. File content will be omitted, which might result in incomplete data and missing functionality.`);
					console.debug(error);
				}
			}
		}

		if (data) {
			object.push(...data);
		}
	}

	if (settings.evaluateVars) {
		await evaluateVariables(object, {
			cache: settings.cache,
			onMissing: settings.critical ? 'error' : 'warning',
		});
	}

	return object;
}

const fillValuesMap = (map: Map<string, ParadoxDataPrimitive>, entries: ParadoxDataEntry[]) => {
	for (const entry of entries) {
		const key = entry[0];
		if (typeof key == 'string') {
			if (key.startsWith('@')) {
				map.set(key, entry[1] as ParadoxDataPrimitive);
			}
		}
	}
}

/**
 * Cache for common variables values.
 * See `commonVariablesSources` for game data files selectors list.
 * @key `string` - name of variable (with 'at' character, to avoid substrings).
 * @value `ParadoxDataPrimitive` - value for the variable.
 */
const commonVariablesCache = new Map<string, ParadoxDataPrimitive>();

const commonVariablesSources = [
	'common/scripted_variables/*',
];

const loadCommonVariablesValues = async (settings: {
	cache?: boolean,
	clear?: boolean,
} = {}) => {
	settings = Object.assign({
		cache: true,
		clear: false,
	}, settings);

	if (settings.clear) {
		commonVariablesCache.clear();
	}

	if (commonVariablesCache.size == 0) {
		// Rebuild the cache
		for (const source of commonVariablesSources) {
			const entries = await loadGameData(source, {
				critical: true,
				cache: false,
				evaluateVars: false,
			});
			fillValuesMap(commonVariablesCache, entries);
		}
	}

	return commonVariablesCache;
}

type EvaluateVariablesSettings = {
	/**
	 * Behaviour if variable can't be evaluated.
	 * 
	 * Options:
	 * * `error` - throws error.
	 * * `warning` - ignore problem, report warning.
	 * * `silent` - ignore problem, don't report problem (except debug log).
	 * @default 'error'
	 */
	onMissing: 'error' | 'warning' | 'silent',
	/**
	 * Value to use, if variable can't be evaluated, but execution continues.
	 * If undefined, the entry will be removed.
	 * If null, the value will not be changed (will stay as "variable").
	 * @default null
	 */
	overwriteOnIgnore: ParadoxDataPrimitive | undefined | null,
	/**
	 * If true, enables caching files, so file is read only once.
	 * @default true
	 */
	cache: boolean,
	/**
	 * If true, includes variables values from common sources.
	 * See `commonVariablesSources` for game data files selectors list.
	 * @default true
	 */
	useCommons: boolean,
	/**
	 * Variables values to use, overrides the common values if used, 
	 * gets overridden by context/local values and `override`.
	 * @default {} // empty map
	 */
	values: Map<string, ParadoxDataPrimitive>,
	/**
	 * Includes passed object as variables source for evaluating variables 
	 * for the object. The variables will not be included in caching.
	 * @default true
	 */
	useContext: boolean,
	/**
	 * Custom values provided that will override variables values from sources.
	 * @default {} // empty map
	 */
	override: Map<string, ParadoxDataPrimitive>,
}

/**
 * Evaluates variables in data object (nested in the tree entires values).
 * 
 * Priority for variable values (highest = most important):
 * 1. `override` values map.
 * 2. context/local defined values (if `useContext` is true).
 * 3. `values` values map.
 * 4. common sources variable values (if `useCommons` is true).
 *
 * @param object Object to work with, will be modified.
 * @param settings Settings.
 */
export const evaluateVariables = async (object: ParadoxDataObject, settings: Partial<EvaluateVariablesSettings> = {}) => {
	const _settings = Object.assign({
		onMissing: 'error',
		overwriteOnIgnore: null,
		cache: true, 
		useCommons: true,
		values: new Map(),
		useContext: true,
		override: new Map(),
	}, settings) as EvaluateVariablesSettings;

	const gameDirectory = await getGameDirectory();
	if (!gameDirectory && _settings.useCommons) {
		throw new MyError('no-game-directory', `Game directory not detected, can't load game data.`)
	}

	const localValues = new Map<string, ParadoxDataPrimitive>();
	if (_settings.useContext) {
		fillValuesMap(localValues, object);
	}

	await loadCommonVariablesValues({
		cache: _settings.cache,
		clear: !_settings.cache,
	});

	const getVarValue = (name: string) => {
		let value = _settings.override.get(name);
		if (value == undefined && _settings.useContext) {
			value = localValues.get(name);
		}
		if (value == undefined) {
			value = _settings.values.get(name);
		}
		if (value == undefined && _settings.useCommons) {
			value = commonVariablesCache.get(name);
		}
		if (value == undefined) {
			const string = ``; // TODO: var name, file name, location in tree.
			switch (_settings.onMissing) {
				case 'error':
					throw new MyError('game-data/missing-variable-value', string);
				case 'warning':
					console.warn(string);
					break;
			}
			if (_settings.overwriteOnIgnore != null) {
				value = _settings.overwriteOnIgnore;
			}
		}
		return value;
	}

	const crawl = (parent: ParadoxDataObject) => {
		for (const entry of parent) {
			const value = entry[1];
			if (Array.isArray(value)) {
				crawl(value);
			}
			else {
				if (typeof value == 'string') {
					if (value.startsWith('@')) {
						entry[1] = getVarValue(value);
					}
				}
			}
		}
	}

	crawl(object);
}
