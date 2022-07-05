import path from 'path';
import process from 'process';
import { Command } from 'commander';
import { packTemporaryFilesIntoSave, unpackSaveIntoTemporaryFiles } from '@/utils/packing';
import { addSaveFileInputHandlingToCommand } from './common';
import { canAccess, MyError } from '@/utils/common';

export const registerPackCommand = (parent: Command) => {
	const that = parent
		.command('pack')
		.description('packs gamestate and meta files into valid save file')
		.option('-i, --input <directory>', `path to directory containing meta and gamestate files to pack (default: current dir)`)
		.option('-o, --output <savePath>', `output save file path (default: ./out.sav)`)
		.option('-y, --overwrite', `overwrites file content`, false)
		.action(async (options: { input?: string, output?: string, overwrite: boolean }) => {
			if (!options.input) {
				options.input = process.cwd();
				// process.exit(22);
				// throw new MyError('input-not-specified', `Input directory must be specified.`);
			}
			if (!options.output) {
				options.output = path.join(process.cwd(), 'out.sav');
			}
			
			if (await canAccess(options.output)) {
				if (!options.overwrite) {
					// TODO: interactive question prompt?
					setImmediate(() => console.error(`Remove it or use '--overwrite' option.`));
					throw new MyError('pack/no-overwrite', `File '${options.output}' already exist.`);
				}
			}
			await packTemporaryFilesIntoSave(options.output, options.input, true, options.overwrite);
		})
	;
	return that;
}

export const registerUnpackCommand = (parent: Command) => {
	const that = parent
		.command('unpack')
		.description('unpacks save file into gamestate and meta files')
		.option('-o, --output <directory>', `path to directory where output meta and gamestate (default: current dir)`)
		.action(async (options: { input: string, output?: string }) => {
			if (!options.output) {
				options.output = process.cwd();
			}
			await unpackSaveIntoTemporaryFiles(options.input, options.output, true);
		})
	;
	addSaveFileInputHandlingToCommand(that, { useArgument: 0 });
	return that;
}
