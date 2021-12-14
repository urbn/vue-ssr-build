module.exports = {
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['html', 'text'],
    coverageThreshold: {
        'src/': {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
        },
    },
    verbose: true,
};
