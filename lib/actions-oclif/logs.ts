/**
 * @license
 * Copyright 2016-2020 Balena Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { flags } from '@oclif/command';
import Command from '../command';
import * as cf from '../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../utils/lazy';
import { LogMessage } from 'balena-sdk';
import { IArg } from '@oclif/parser/lib/args';

interface FlagsDef {
	tail?: boolean;
	service?: string[];
	system?: boolean;
	help: void;
}

interface ArgsDef {
	device: string;
}

export default class LogsCmd extends Command {
	public static description = stripIndent`
		Show device logs.

		Show logs for a specific device.

		By default, the command prints all log messages and exits.

		To continuously stream output, and see new logs in real time, use the \`--tail\` option.

		If an IP or .local address is passed to this command, logs are displayed from
		a local mode device with that address. Note that --tail is implied
		when this command is provided a local mode device.

		Logs from a single service can be displayed with the --service flag. Just system logs
		can be shown with the --system flag. Note that these flags can be used together.

		Note: --service and --system flags must come after the device parameter, as per examples.
`;
	public static examples = [
		'$ balena logs 23c73a1',
		'$ balena logs 23c73a1 --tail',
		'',
		'$ balena logs 192.168.0.31',
		'$ balena logs 192.168.0.31 --service my-service',
		'$ balena logs 192.168.0.31 --service my-service-1 --service my-service-2',
		'',
		'$ balena logs 23c73a1.local --system',
		'$ balena logs 23c73a1.local --system --service my-service',
	];

	public static args: Array<IArg<any>> = [
		{
			name: 'device',
			description: 'device UUID, IP, or .local address',
			required: true,
		},
	];

	public static usage = 'logs <device>';

	public static flags: flags.Input<FlagsDef> = {
		tail: flags.boolean({
			description: 'continuously stream output',
			char: 't',
		}),
		service: flags.string({
			description: stripIndent`
				Reject logs not originating from this service.
				This can be used in combination with --system or other --service flags.`,
			char: 's',
			multiple: true,
		}),
		system: flags.boolean({
			description:
				'Only show system logs. This can be used in combination with --service.',
			char: 'S',
		}),
		help: cf.help,
	};

	public static primary = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			LogsCmd,
		);

		const balena = getBalenaSdk();
		const { serviceIdToName } = await import('../utils/cloud');
		const { displayDeviceLogs, displayLogObject } = await import(
			'../utils/device/logs'
		);
		const { validateIPAddress, validateDotLocalUrl } = await import(
			'../utils/validation'
		);
		const Logger = await import('../utils/logger');

		const logger = Logger.getLogger();

		const displayCloudLog = async (line: LogMessage) => {
			if (!line.isSystem) {
				let serviceName = await serviceIdToName(balena, line.serviceId);
				if (serviceName == null) {
					serviceName = 'Unknown service';
				}
				displayLogObject(
					{ serviceName, ...line },
					logger,
					options.system || false,
					options.service,
				);
			} else {
				displayLogObject(
					line,
					logger,
					options.system || false,
					options.service,
				);
			}
		};

		if (
			validateIPAddress(params.device) ||
			validateDotLocalUrl(params.device)
		) {
			// Logs from local device
			const { DeviceAPI } = await import('../utils/device/api');
			const deviceApi = new DeviceAPI(logger, params.device);
			logger.logDebug('Checking we can access device');
			try {
				await deviceApi.ping();
			} catch (e) {
				const { ExpectedError } = await import('../errors');
				throw new ExpectedError(
					`Cannot access device at address ${params.device}.  Device may not be in local mode.`,
				);
			}

			logger.logDebug('Streaming logs');
			const logStream = await deviceApi.getLogStream();
			await displayDeviceLogs(
				logStream,
				logger,
				options.system || false,
				options.service,
			);
		} else {
			// Logs from cloud
			await Command.checkLoggedIn();
			if (options.tail) {
				const logStream = await balena.logs.subscribe(params.device, {
					count: 100,
				});
				// Never resolve (quit with CTRL-C), but reject on a broken connection
				await new Promise((_resolve, reject) => {
					logStream.on('line', displayCloudLog);
					logStream.on('error', reject);
				});
			} else {
				const logMessages = await balena.logs.history(params.device);
				for (const logMessage of logMessages) {
					await displayCloudLog(logMessage);
				}
			}
		}
	}
}
