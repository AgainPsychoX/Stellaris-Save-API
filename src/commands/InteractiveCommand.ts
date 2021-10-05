import repl from 'repl';
import path from 'path';
import { Command } from 'commander';
import * as StellarisSaveLib from '@/index';
import { addSaveFileInputHandlingToCommand, loadSaveFileFancy, saveSaveFileFancy } from './common';

export const registerInteractiveCommand = (parent: Command) => {
	const that = parent
		.command('interactive')
		.alias('repl')
		.description('opens save and enters interactive mode (JS REPL with save object)')
		.action(async (options) => {
			const inputFilePath = options.input as string;
			const save = await loadSaveFileFancy(inputFilePath);

			await new Promise<void>((resolve, reject) => {
				const replServer = repl.start({
					useGlobal: true,
					preview: false,
				}).on('exit', () => {
					resolve();
				});
				replServer.defineCommand('saveREPL', replServer.commands.save!);
				replServer.defineCommand('loadREPL', replServer.commands.load!);
				replServer.defineCommand('save', {
					help: 'Save game file to specified file or name', 
					action: function (file) {
						if (!file) {
							file = inputFilePath + '.out.sav';
						}
						else if (!(file.includes('/') || file.includes('\\'))) {
							// If does not look like path, save the file next to input file.
							file = path.join(inputFilePath, '../', file);
							if (!file.endsWith('.sav')) {
								file += '.sav';
							}
						}
						this.output.write(`Saving game file...\n`);
						saveSaveFileFancy(file, save).then(() => {
							this.output.write(`Game file saved at ${file}\n`);
						}).catch(error => {
							this.output.write(`Failed to save: ${error}\n`);
						}).finally(() => {
							this.displayPrompt();
						});
					}
				});
				replServer.defineCommand('load', {
					help: 'Load game from specified file or name, or start save selection prompt.', 
					action: function (file) {
						this.output.write(`Not implemented - restart the script selecting other file.\n`);
						this.displayPrompt();
						// TODO: implement load/swap on demand
					}
				});
	
				replServer.context.save = save;
				replServer.context.inputFilePath = inputFilePath;
				for (const [key, value] of Object.entries(StellarisSaveLib)) {
					replServer.context[key] = value;
				}
			});
		})
	;
	addSaveFileInputHandlingToCommand(that, { interactive: true });
	return that;
}

export default registerInteractiveCommand;
