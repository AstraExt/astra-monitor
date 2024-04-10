/** @type {import('eslint').Linter.Config}*/
module.exports = {
    env: {
        es2022: true,
        node: true
    },
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
    },
    plugins: ['@typescript-eslint'],
    rules: {
        indent: 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'linebreak-style': ['error', 'unix'],
        semi: ['error', 'always'],
        'keyword-spacing': [
            'error',
            {
                before: true,
                after: true,
                overrides: {
                    if: { after: false },
                    for: { after: false },
                    while: { after: false },
                    catch: { after: false },
                    switch: { after: false },
                    function: { after: false }
                }
            }
        ]
    }
};
