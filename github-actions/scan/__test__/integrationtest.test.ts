// SPDX-License-Identifier: MIT

import { create } from '@actions/artifact';
import { debug, error, getInput, info, isDebug, warning } from '@actions/core';
import * as shell from 'shelljs';
import { getWorkspaceDir } from '../src/fs-helper';
import * as input from '../src/input';
import { getFieldFromJsonReport } from '../src/json-helper';
import * as launcher from '../src/launcher';
import { LaunchContext } from '../src/launcher';
import { IntegrationTestContext } from './integrationtest/testframework';
import * as fs from 'fs';

jest.mock('@actions/core');
jest.mock('@actions/artifact');

/*
* This is an integration test suite for github-action "scan".
* As precondition you have to call "01-start.sh" and "03-init_sechub_data.sh"- or call 'sdc -pigh' to do this automatically.
* (Another option is to call `sdc -bgh' to do a full build for github action which does automatically execute the scripts and all integration tests)
*
* After start and prepare scripts have finished you can execute the integration tests via "npm run integration-test"
*
* At the end the servers can be stopped with  "05-stop.sh" (please look into script for an example and more details)
* (This is an explanation to start the tests locally - the github action workflow "github-action-scan.yml" does it in exact same way for CI/CD)
*
*/
const sechub_debug = shell.env['SECHUB_DEBUG'];
const debug_enabled = sechub_debug == 'true';

const integrationTestContext = new IntegrationTestContext();

integrationTestContext.workspaceDir = getWorkspaceDir();

integrationTestContext.serverPort = 8443; // TODO make this configurable - in our start script it is already configurable
integrationTestContext.serverUserId = 'int-test_superadmin'; // TODO make this configurable - in our start script it is already configurable
integrationTestContext.serverApiToken = 'int-test_superadmin-pwd'; // TODO make this configurable - in our start script it is already configurable

integrationTestContext.finish();

const mockedInputMap = new Map();

beforeEach(() => {
    
    shell.echo('----------------------------------------------------------------------------------------------------------------------------------');
    shell.echo('START Integration test: '+ expect.getState().currentTestName);
    shell.echo('----------------------------------------------------------------------------------------------------------------------------------');

    jest.resetAllMocks();

    (getInput as jest.Mock).mockImplementation((name) => {
        return mockedInputMap.get(name);
    });
    if (debug_enabled) {
        (debug as jest.Mock).mockImplementation((message) => {
            console.debug('gh-debug: %s', message);
        });
        (isDebug as jest.Mock).mockImplementation(() => {
            return true;
        });
    }

    (info as jest.Mock).mockImplementation((message) => {
        console.log('gh-info: %s', message);
    });
    (warning as jest.Mock).mockImplementation((message) => {
        console.log('gh-warning: %s', message);
    });
    (error as jest.Mock).mockImplementation((message) => {
        console.log('gh-error: %s', message);
    });

    (create as jest.Mock).mockName('artifactClient');
    (create as jest.Mock).mockImplementation(() => {
        return {
            'uploadArtifact': jest.fn(),
        };
    });
});



function initInputMap() {
    mockedInputMap.clear();
    mockedInputMap.set(input.PARAM_SECHUB_SERVER_URL, `https://localhost:${integrationTestContext.serverPort}`);
    mockedInputMap.set(input.PARAM_SECHUB_USER, `${integrationTestContext.serverUserId}`);
    mockedInputMap.set(input.PARAM_API_TOKEN, `${integrationTestContext.serverApiToken}`);

    mockedInputMap.set(input.PARAM_CLIENT_VERSION, '1.4.0');

    mockedInputMap.set(input.PARAM_REPORT_FORMATS, 'json');
    mockedInputMap.set(input.PARAM_TRUST_ALL, 'true'); // self signed certificate in test...
}

describe('integrationtest codescan generated config', () => {
    test('codescan green', async () => {

        /* prepare */
        initInputMap();
        mockedInputMap.set(input.PARAM_INCLUDED_FOLDERS, '__test__/integrationtest/test-sources');
        mockedInputMap.set(input.PARAM_PROJECT_NAME, 'test-project-1');

        /* execute */
        const result = await launcher.launch();

        /* test */
        assertLastClientExitCode(result, 0);
        assertTrafficLight(result, 'GREEN');
        assertJsonReportContains(result, 'result-green');

    });
    test('codescan yellow', async () => {

        /* prepare */
        initInputMap();
        mockedInputMap.set(input.PARAM_INCLUDED_FOLDERS, '__test__/integrationtest/test-sources');
        mockedInputMap.set(input.PARAM_PROJECT_NAME, 'test-project-2');

        /* execute */
        const result = await launcher.launch();

        /* test */
        assertLastClientExitCode(result, 0);
        assertTrafficLight(result, 'YELLOW');
        assertJsonReportContains(result, 'result-yellow');

    });

    test('codescan red', async () => {

        /* prepare */
        initInputMap();
        mockedInputMap.set(input.PARAM_INCLUDED_FOLDERS, '__test__/integrationtest/test-sources');
        mockedInputMap.set(input.PARAM_PROJECT_NAME, 'test-project-3');

        /* execute */
        const result = await launcher.launch();

        /* test */
        assertLastClientExitCode(result, 1); // exit code 1, because RED
        assertTrafficLight(result, 'RED');
        assertJsonReportContains(result, 'result-red');
    });

});

describe('integrationtest secretscan generated config', () => {
    test('secretscan yellow, json only', async () => {

        /* prepare */
        initInputMap();
        mockedInputMap.set(input.PARAM_INCLUDED_FOLDERS, '__test__/integrationtest/test-sources');
        mockedInputMap.set(input.PARAM_PROJECT_NAME, 'test-project-5');
        mockedInputMap.set(input.PARAM_SCAN_TYPES, 'secretscan');

        /* execute */
        const result = await launcher.launch();

        /* test */
        assertTrafficLight(result, 'YELLOW');
        assertLastClientExitCode(result, 0);
        assertJsonReportContains(result, 'generic-api-key has detected secret for file UnSAFE_Bank/Backend/docker-compose.yml');
        
    });
    test('secretscan yellow, html', async () => {

        /* prepare */
        initInputMap();
        mockedInputMap.set(input.PARAM_INCLUDED_FOLDERS, '__test__/integrationtest/test-sources');
        mockedInputMap.set(input.PARAM_PROJECT_NAME, 'test-project-5');
        mockedInputMap.set(input.PARAM_SCAN_TYPES, 'secretscan');
        mockedInputMap.set(input.PARAM_REPORT_FORMATS, 'html');

        /* execute */
        const result = await launcher.launch();

        /* test */
        assertTrafficLight(result, 'YELLOW');
        assertLastClientExitCode(result, 0);
        assertJsonReportContains(result, 'generic-api-key has detected secret for file UnSAFE_Bank/Backend/docker-compose.yml');
       
        loadHTMLReportAndAssertItContains(result, 'generic-api-key has detected secret for file UnSAFE_Bank/Backend/docker-compose.yml');
        
    });

});

describe('integrationtest licensescan generated config', () => {
    test('licensescan green, spdx-json', async () => {

        /* prepare */
        initInputMap();
        mockedInputMap.set(input.PARAM_INCLUDED_FOLDERS, '__test__/integrationtest/test-sources');
        mockedInputMap.set(input.PARAM_PROJECT_NAME, 'test-project-6');
        mockedInputMap.set(input.PARAM_SCAN_TYPES, 'licensescan');
        mockedInputMap.set(input.PARAM_REPORT_FORMATS, 'spdx-json');

        /* execute */
        const result = await launcher.launch();
        
        /* test */
        assertTrafficLight(result, 'GREEN');
        assertLastClientExitCode(result, 0);
        assertJsonReportContains(result, 'findings'); // findings in json available - but green, because only licensescan
        
        loadSpdxJsonReportAndAssertItContains(result, 'LGPL');
    });

});

describe('integrationtest non-generated config', () => {
    test('config-path defined, but file not found', async () =>  {

        /* prepare */
        initInputMap();
        mockedInputMap.set(input.PARAM_PROJECT_NAME, 'test-project-3');
        mockedInputMap.set(input.PARAM_CONFIG_PATH, 'unknown/not-existing-config.json');

        /* execute + test */
        await launcher.launch().catch(error => console.log(`Error handled : ${error}`));

    });

    test('config-path defined, file available, web scan with red trafficlight', async () =>  {

        /* prepare */
        initInputMap();
        mockedInputMap.set(input.PARAM_PROJECT_NAME, 'test-project-4'); // we must set the project name here, even when we have a config! GitHub action needs this always.

        const pwd = shell.pwd();
        const configDir = `${pwd}/__test__/integrationtest/test-config`;

        mockedInputMap.set(input.PARAM_CONFIG_PATH, `${configDir}/sechub-config-webscan-project-4.json`);

        /* execute */
        const result = await launcher.launch();

        /* test */
        assertLastClientExitCode(result, 1);
        assertTrafficLight(result, 'RED');
        assertJsonReportContains(result, 'XSS attackable parameter output: </p><script>alert(1)');

    });


});

function assertLastClientExitCode(context: LaunchContext, exitCode: number) {
    expect(context.lastClientExitCode).toEqual(exitCode);
}

function assertTrafficLight(context: LaunchContext, trafficLight: string) {
    const found = getFieldFromJsonReport('trafficLight', context.secHubReportJsonObject);
    expect(found).toEqual(trafficLight);

}

function assertJsonReportContains(context: LaunchContext, textPart: string) {
    const text = JSON.stringify(context.secHubReportJsonObject);
    expect(text).toContain(textPart);
}

function loadHTMLReportAndAssertItContains(context: LaunchContext, textPart: string) {
    
    const fileName = context.secHubReportJsonFileName.replace('.json','.html');
    const htmlPath = `./${fileName}`;
    if (context.debug){
        const pwd = shell.pwd();
        shell.echo('current dir: '+pwd);
        shell.echo('htmlPath: '+htmlPath);
    }
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain(textPart);
}

function loadSpdxJsonReportAndAssertItContains(context: LaunchContext, textPart: string) {
    
    const fileName = context.secHubReportJsonFileName.replace('.json','.spdx.json');
    const spdxJsonPath = `./${fileName}`;
    if (context.debug){
        const pwd = shell.pwd();
        shell.echo('current dir: '+pwd);
        shell.echo('spdxJsonPath: '+spdxJsonPath);
    }
    const spdxJson = fs.readFileSync(spdxJsonPath, 'utf8');

    expect(spdxJson).toContain(textPart);
}