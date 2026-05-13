/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'server/node_modules/**',
      // Вложенная копия репозитория (UTF-16 и пр.); не линтовать.
      'NEIRO/**',
    ],
  },
]