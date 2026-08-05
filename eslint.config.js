import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/**
 * Lint do projeto (flat config, ESLint 9).
 *
 * Duas regras carregam peso aqui e valem a leitura antes de silenciar qualquer
 * aviso delas:
 *  - `react-hooks/exhaustive-deps`: quase todo bug de estado que apareceu neste
 *    app veio de efeito com dependência faltando ou sobrando (seed que rodava
 *    duas vezes, rascunho que não regravava). Onde a dependência é omitida de
 *    propósito, o desvio fica com comentário explicando.
 *  - `react-refresh/only-export-components`: os arquivos de contexto exportam
 *    provider + hook juntos, o que é intencional; o desvio está marcado neles.
 *
 * `eslint-config-prettier` entra por último para desligar as regras de estilo —
 * formatação é assunto do Prettier, não do lint.
 */
export default tseslint.config(
  // `public/mockServiceWorker.js` e gerado pelo MSW — nao e codigo nosso.
  { ignores: ['dist', 'deploy', '.tsbuild', 'coverage', 'public'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Variável ignorada de propósito (o idioma `const { x: _fora, ...resto }`)
      // não é erro: é como se descarta uma chave sem mutar o objeto.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  prettier,
)
