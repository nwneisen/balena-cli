/**
 * @license
 * Copyright 2018-2019 Balena Ltd.
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

import type * as dockerode from 'dockerode';
import { flags } from '@oclif/command';
import { parseAsInteger } from './validation';

export * from './docker-js';

interface BalenaEngineVersion extends dockerode.DockerVersion {
	Engine?: string;
}

export interface DockerConnectionCliFlags {
	docker?: string;
	dockerHost?: string;
	dockerPort?: number;
	ca?: string;
	cert?: string;
	key?: string;
}

export interface DockerCliFlags extends DockerConnectionCliFlags {
	tag?: string;
	buildArg?: string; // maps to 'arg'
	arg?: string; // Not part of command profile
	'cache-from'?: string; // maps to 'image-list'
	'image-list'?: string; // Not part of command profile
	nocache: boolean;
	squash: boolean;
}

export const dockerConnectionCliFlags: flags.Input<DockerConnectionCliFlags> = {
	docker: flags.string({
		description: 'Path to a local docker socket (e.g. /var/run/docker.sock)',
		char: 'P',
	}),
	dockerHost: flags.string({
		description:
			'Docker daemon hostname or IP address (dev machine or balena device) ',
		char: 'h',
	}),
	dockerPort: flags.integer({
		description:
			'Docker daemon TCP port number (hint: 2375 for balena devices)',
		char: 'p',
		parse: (p) => parseAsInteger(p, 'dockerPort'),
	}),
	ca: flags.string({
		description: 'Docker host TLS certificate authority file',
	}),
	cert: flags.string({
		description: 'Docker host TLS certificate file',
	}),
	key: flags.string({
		description: 'Docker host TLS key file',
	}),
};

export const dockerCliFlags: flags.Input<DockerCliFlags> = {
	tag: flags.string({
		description: 'The alias to the generated image',
		char: 't',
	}),
	buildArg: flags.string({
		description:
			'Set a build-time variable (eg. "-B \'ARG=value\'"). Can be specified multiple times.',
		char: 'B',
		// Maps to flag `arg`
	}),
	'cache-from': flags.string({
		description: `\
Comma-separated list (no spaces) of image names for build cache resolution. \
Implements the same feature as the "docker build --cache-from" option.`,
		// Maps to flag `image-list`
	}),
	nocache: flags.boolean({
		description: "Don't use docker layer caching when building",
	}),
	squash: flags.boolean({
		description: 'Squash newly built layers into a single new layer',
	}),
};

export async function isBalenaEngine(docker: dockerode): Promise<boolean> {
	// dockerVersion.Engine should equal 'balena-engine' for the current/latest
	// version of balenaEngine, but it was at one point (mis)spelt 'balaena':
	// https://github.com/balena-os/balena-engine/pull/32/files
	const dockerVersion = (await docker.version()) as BalenaEngineVersion;
	return !!(
		dockerVersion.Engine && dockerVersion.Engine.match(/balena|balaena/)
	);
}
