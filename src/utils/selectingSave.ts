import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import { MyError } from './common';

export const savesDirectory = path.join(process.env['USERPROFILE']!, 'Documents/Paradox Interactive/Stellaris/save games');

export const selectSaveFileByString = async (string: string): Promise<string> => {
	try {
		await fs.access(string);
		return string;
	}
	catch (_) {}

	// Try to find by 'game_name_something/<input>[.sav]'
	let filePath = path.join(savesDirectory, string);
	if (!filePath.endsWith('.sav')) {
		filePath += '.sav';
	}

	try {
		await fs.access(filePath);
		return filePath;
	}
	catch (e) {
		throw new MyError('input-not-found', 'Input file or save not found.', e);
	}
}

export const selectSaveFilePrompt = async (): Promise<string> => {
	const savedGamesDirectoriesNames = (await fs.readdir(savesDirectory, {withFileTypes: true}))
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name)
	;

	const { gameDirectoryName } = await inquirer.prompt([{
		name: 'gameDirectoryName',
		type: 'list',
		message: 'Select game to work with:',
		choices: savedGamesDirectoriesNames, // TODO: add more information (version, full game name, lastest game date)
	}]);

	const gameDirectoryPath = path.join(savesDirectory, gameDirectoryName);
	const saveFilesNames = (await fs.readdir(gameDirectoryPath, {withFileTypes: true}))
		.filter(dirent => dirent.isFile())
		.map(dirent => dirent.name)
	;
	type Choice = {
		name: string;
		short: string;
		value: string;
		mtime: Date;
	} | typeof inquirer.Separator;
	const saveFileChoices: Choice[] =
		(await Promise.all(
			saveFilesNames.map(async (name) => {
				const mtime = (await fs.lstat(path.join(gameDirectoryPath, name))).mtime;
				return {
					name: `${name} (${mtime.toLocaleString('sv', {
						timeZoneName: 'short', 
						year: 'numeric', 
						month: '2-digit', 
						day: '2-digit', 
						hour: '2-digit', 
						minute: '2-digit', 
						second: '2-digit'
					}).replace(/:\d\d .*/, '')})`,
					short: name,
					value: name, 
					mtime,
				};
			})
		))
		.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
	;
	saveFileChoices.push(inquirer.Separator);

	const { saveFileName } = await inquirer.prompt([{
		name: 'saveFileName',
		type: 'list',
		message: 'Select save file to work with:',
		choices: saveFileChoices, // TODO: add more information (date, game stats)
	}]);

	const saveFilePath = path.join(gameDirectoryPath, saveFileName)
	return saveFilePath;
}

export const selectLatestSaveFile = async (): Promise<string> => {
	const savedGamesDirectoriesNames = (await fs.readdir(savesDirectory, {withFileTypes: true}))
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name)
	;
	let filePath: string | undefined;
	let mostRecentTime = new Date(0);

	for (const gameDirectoryName of savedGamesDirectoriesNames) {
		const gameDirectoryPath = path.join(savesDirectory, gameDirectoryName);
		
		const saveFilesNames = (await fs.readdir(gameDirectoryPath, {withFileTypes: true}))
			.filter(dirent => dirent.isFile())
			.map(dirent => dirent.name)
		;

		for (const saveFileName of saveFilesNames) {
			const saveFilePath = path.join(gameDirectoryPath, saveFileName);
			const mtime = (await fs.lstat(saveFilePath)).mtime;
			if (mostRecentTime < mtime) {
				mostRecentTime = mtime;
				filePath = saveFilePath;
			}
		}
	}

	if (filePath) {
		return filePath;
	}
	else {
		throw new MyError('no-latest', 'No latest save can be found.');
	}
}
