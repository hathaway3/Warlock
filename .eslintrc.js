// .eslintrc.js (Root project linter config)
module.exports = {
    'extends': [
        'eslint:recommended',
        'plugin:node/recommended', // Use node/eslint recommendations
        'prettier' // Ensure prettier handles formatting conflicts
    ],
    'parserOptions': {
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    'rules': {
        // Enforce grouped declarations convention (as per copilot-instructions.md)
        'prefer-const': ['error', {destructuring: false, cyclic: false}],
        'curly': ['error', 'all'],
        'no-unused-vars': ['warn', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}]
        // Add other specific backend rules here
    },
    'env': {
        node: true,
        es2020: true
    }
};