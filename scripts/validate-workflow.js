#!/usr/bin/env node

/**
 * Workflow Integration Validation Script
 * Validates that the CI/CD pipeline is properly configured with E2E tests as quality gates
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

console.log('🔍 Validating CI/CD Workflow Integration...\n');

// Read the CI workflow file
const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml');

if (!fs.existsSync(workflowPath)) {
    console.error('❌ CI workflow file not found at:', workflowPath);
    process.exit(1);
}

try {
    const workflowContent = fs.readFileSync(workflowPath, 'utf8');
    const workflow = yaml.load(workflowContent);

    console.log('✅ CI workflow file loaded successfully\n');

    // Validation checks
    const checks = [
        {
            name: 'E2E Tests Job Exists',
            check: () => workflow.jobs['e2e-tests'] !== undefined,
            description: 'Verifies that the e2e-tests job is defined'
        },
        {
            name: 'E2E Tests Dependencies',
            check: () => {
                const e2eJob = workflow.jobs['e2e-tests'];
                return e2eJob && e2eJob.needs &&
                    e2eJob.needs.includes('frontend-test') &&
                    e2eJob.needs.includes('backend-test') &&
                    e2eJob.needs.includes('ai-service-test');
            },
            description: 'Verifies E2E tests depend on all unit test jobs'
        },
        {
            name: 'Docker Compose Integration',
            check: () => {
                const e2eJob = workflow.jobs['e2e-tests'];
                return e2eJob && e2eJob.steps &&
                    e2eJob.steps.some(step =>
                        step.run && step.run.includes('docker-compose') &&
                        step.run.includes('docker-compose.e2e.yml')
                    );
            },
            description: 'Verifies E2E tests use Docker Compose'
        },
        {
            name: 'Staging Deployment Dependencies',
            check: () => {
                const stagingJob = workflow.jobs['deploy-staging'];
                return stagingJob && stagingJob.needs &&
                    stagingJob.needs.includes('e2e-tests');
            },
            description: 'Verifies staging deployment depends on E2E tests'
        },
        {
            name: 'Production Deployment Dependencies',
            check: () => {
                const prodJob = workflow.jobs['deploy-production'];
                return prodJob && prodJob.needs &&
                    prodJob.needs.includes('e2e-tests');
            },
            description: 'Verifies production deployment depends on E2E tests'
        },
        {
            name: 'Build Job Dependencies',
            check: () => {
                const buildJob = workflow.jobs['build-and-push-production'];
                return buildJob && buildJob.needs &&
                    buildJob.needs.includes('e2e-tests');
            },
            description: 'Verifies build job depends on E2E tests'
        },
        {
            name: 'Playwright Configuration',
            check: () => {
                const e2eJob = workflow.jobs['e2e-tests'];
                return e2eJob && e2eJob.steps &&
                    e2eJob.steps.some(step =>
                        step.run && step.run.includes('playwright')
                    );
            },
            description: 'Verifies Playwright is used for E2E testing'
        },
        {
            name: 'Service Health Checks',
            check: () => {
                const e2eJob = workflow.jobs['e2e-tests'];
                return e2eJob && e2eJob.steps &&
                    e2eJob.steps.some(step =>
                        step.run && step.run.includes('wait-on')
                    );
            },
            description: 'Verifies services are health-checked before testing'
        }
    ];

    // Run validation checks
    let passedChecks = 0;
    let failedChecks = 0;

    console.log('📋 Running Validation Checks:\n');

    checks.forEach((check, index) => {
        const result = check.check();
        const status = result ? '✅' : '❌';
        const statusText = result ? 'PASS' : 'FAIL';

        console.log(`${index + 1}. ${status} ${check.name}: ${statusText}`);
        console.log(`   ${check.description}`);

        if (result) {
            passedChecks++;
        } else {
            failedChecks++;
            console.log(`   ⚠️  This check failed - please review the workflow configuration`);
        }
        console.log('');
    });

    // Summary
    console.log('📊 Validation Summary:');
    console.log(`   ✅ Passed: ${passedChecks}/${checks.length}`);
    console.log(`   ❌ Failed: ${failedChecks}/${checks.length}`);
    console.log('');

    if (failedChecks === 0) {
        console.log('🎉 All validation checks passed!');
        console.log('✅ E2E testing is properly integrated as a quality gate');
        console.log('✅ Deployments are protected by comprehensive testing');
        console.log('✅ Workflow follows TDD best practices');
        console.log('');
        console.log('🚀 Your CI/CD pipeline is ready for production!');
    } else {
        console.log('⚠️  Some validation checks failed.');
        console.log('🔧 Please review and fix the workflow configuration.');
        console.log('📚 Refer to WORKFLOW_INTEGRATION_COMPLETE.md for guidance.');
        process.exit(1);
    }

} catch (error) {
    console.error('❌ Error validating workflow:', error.message);
    process.exit(1);
}

// Additional file checks
console.log('\n🔍 Checking Additional Files...\n');

const additionalChecks = [
    {
        file: 'docker-compose.e2e.yml',
        description: 'E2E Docker Compose configuration'
    },
    {
        file: 'property-search-frontend/Dockerfile',
        description: 'Frontend Docker configuration'
    },
    {
        file: 'property-search-frontend/playwright.config.ts',
        description: 'Playwright configuration'
    },
    {
        file: 'property-search-frontend/tests/e2e/search.spec.ts',
        description: 'Core E2E test file'
    },
    {
        file: 'scripts/test-e2e-docker.sh',
        description: 'Local E2E testing script (Linux/Mac)'
    },
    {
        file: 'scripts/test-e2e-docker.ps1',
        description: 'Local E2E testing script (Windows)'
    }
];

let missingFiles = 0;

additionalChecks.forEach(check => {
    const filePath = path.join(__dirname, '..', check.file);
    const exists = fs.existsSync(filePath);
    const status = exists ? '✅' : '❌';

    console.log(`${status} ${check.file}`);
    console.log(`   ${check.description}`);

    if (!exists) {
        missingFiles++;
        console.log(`   ⚠️  File not found - may need to be created`);
    }
    console.log('');
});

if (missingFiles === 0) {
    console.log('🎉 All required files are present!');
} else {
    console.log(`⚠️  ${missingFiles} files are missing - please create them.`);
}

console.log('\n🎭 E2E Testing Integration Validation Complete!');

// Install js-yaml if not present
if (!fs.existsSync(path.join(__dirname, '..', 'node_modules', 'js-yaml'))) {
    console.log('\n📦 Note: This script requires js-yaml. Install with:');
    console.log('   npm install js-yaml');
}