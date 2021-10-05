import { exec } from 'child_process';
import { R_OK } from 'constants';
import { access, opendir, readFile } from 'fs/promises';
import { join } from 'path/win32';
import { MyError, ParserError } from './common';
import { ParadoxDataEntry, ParadoxDataHelper } from './paradox';

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

/**
 * Loads game data that uses Paradox data format.
 * @param relativePath Relative path from game directory to the game resource. 
 * If ends with '*', i.e. 'common/personalities/*, loads whole dir, merged.
 * Does not include modded content (yet?).
 * @returns 
 */
export const loadGameData = async (relativePath: string,
	settings: {
		/**
		 * If true, error will be thrown if game data can't be loaded.
		 * @default true
		 */
		critical?: boolean,
	} = {}
) => {
	settings = Object.assign({ critical: true, }, settings);

	const gameDirectory = await getGameDirectory();
	if (!gameDirectory && settings.critical) {
		throw new MyError('no-game-directory', `Game directory not detected, can't load game data.`)
	}

	// TODO: loading modded content if option flag provided?

	const files: string[] = [];
	if (relativePath.endsWith('*')) {
		const dir = await opendir(join(gameDirectory, relativePath, '../'));
		for await (const dirent of dir) {
			if (dirent.isFile() && dirent.name.endsWith('.txt')) {
				files.push(join(dir.path, dirent.name));
			}
		}
	}
	else {
		files.push(relativePath);
	}

	const object: ParadoxDataEntry[] = [];
	for (const file of files) {
		console.debug(`Loading game data for '${relativePath}'... Current file: ${file}`);
		try {
			const string = await readFile(file, 'utf-8');
			const parsed = ParadoxDataHelper.loadFromString(string);
			object.push(...parsed);
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

	return object;
}
