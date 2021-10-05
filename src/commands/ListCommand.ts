import fs from 'fs/promises';
import path from 'path';
import { Console } from 'console';
import { Command } from 'commander';
import { savesDirectory } from '@/utils/selectingSave';

export const registerListCommand = (parent: Command) => {
	const that = parent
		.command('list')
		.description('lists saves with details')
		// TODO:
		// .option('-l, --latest', 'list only latest file saves for each game')
		// .option('-p, --path', 'include file paths in output')
		.action(async (options) => {
			console.log('List of saves: ');
			// @ts-ignore // See https://github.com/DefinitelyTyped/DefinitelyTyped/discussions/55985
			const indentedConsole = new Console({
				stdout: process.stdout,
				groupIndentation: 4,
			});

			const savedGamesDirectoriesNames = (await fs.readdir(savesDirectory, {withFileTypes: true}))
				.filter(dirent => dirent.isDirectory())
				.map(dirent => dirent.name)
			;

			for (const gameDirectoryName of savedGamesDirectoriesNames) {
				const gameDirectoryPath = path.join(savesDirectory, gameDirectoryName);

				indentedConsole.group('+ ' + gameDirectoryName); // TODO: fancier name here
				
				const saveFilesNames = (await fs.readdir(gameDirectoryPath, {withFileTypes: true}))
					.filter(dirent => dirent.isFile())
					.map(dirent => dirent.name)
				;

				const maxNameLength = saveFilesNames.reduce((a, b) => a.length > b.length ? a : b).length;

				(await Promise.all(
					saveFilesNames.map(async (name) => {
						const mtime = (await fs.lstat(path.join(gameDirectoryPath, name))).mtime;
						return {
							name: `- ${name.padEnd(maxNameLength)} (${mtime.toLocaleString('sv', {
								timeZoneName: 'short', 
								year: 'numeric', 
								month: '2-digit', 
								day: '2-digit', 
								hour: '2-digit', 
								minute: '2-digit', 
								second: '2-digit'
							}).replace(/:\d\d .*/, '')})`,
							mtime,
						};
					})
				))
				.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
				.forEach(entry => {
					indentedConsole.log(entry.name);
				})

				indentedConsole.groupEnd();
			}
		})
	;
	return that;
}

export default registerListCommand;
