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
  // ---------------------------------------------------------------- fronteiras
  /**
   * A organizacao por area so continua verdadeira se algo recusar o atalho.
   *
   * Duas regras, e as duas ja custaram caro neste repo quando nao existiam:
   *
   *  - `../` que ATRAVESSA pasta. Antes da reorganizacao havia 46 imports em
   *    `../../`, e era isso que tornava mover um arquivo uma tarde de trabalho.
   *    `@/` e estavel: quem importa nao sabe nem se importa onde o alvo mora.
   *    `./` continua livre — vizinho de pasta e vizinho mesmo (o CSS colocado
   *    depende disso).
   *
   *  - uma AREA importar a outra. Cadastro, resultado e simulacao sao tres
   *    produtos que compartilham um login e um header; se comecarem a se
   *    importar, a pasta vira enfeite e a proxima pessoa nao consegue mais ler
   *    uma area sozinha. Precisa de algo em comum? Sobe para `comum/`, que e uma
   *    decisao visivel no diff. Quem pode falar com todos e `app/`, porque a
   *    raiz de composicao existe justamente para juntar.
   */
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/app/**', 'src/mocks/**', 'src/testes/**', 'src/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message:
                'Use `@/...` em vez de `../` — o caminho fica estável se o arquivo mudar de pasta.',
            },
          ],
        },
      ],
    },
  },
  /**
   * `comum/` e FOLHA: ele nao conhece area nenhuma.
   *
   * Sem esta regra, "comum" vira o nome educado para "onde eu ponho o que nao sei
   * onde por", e a primeira dependencia de volta (comum -> cadastro) desfaz a
   * separacao inteira sem ninguem notar. Foi o que aconteceu com o `AppHeader`,
   * que lia `useUnidade` do cadastro: a regra apareceu depois do fato.
   */
  {
    files: ['src/comum/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['../*'], message: 'Use `@/...` em vez de `../`.' },
            {
              group: ['@/cadastro/*', '@/resultado/*', '@/simulacao/*', '@/app/*'],
              message:
                '`comum/` não conhece as áreas — se depende de uma, não é comum. Mova para a área, ou suba o que é vocabulário compartilhado para `comum/`.',
            },
          ],
        },
      ],
    },
  },
  ...['cadastro', 'resultado', 'simulacao'].map((area) => ({
    files: [`src/${area}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Use `@/...` em vez de `../`.',
            },
            {
              group: ['cadastro', 'resultado', 'simulacao']
                .filter((outra) => outra !== area)
                .map((outra) => `@/${outra}/*`),
              message: `\`${area}/\` não importa de outra área. O que for comum sobe para \`@/comum/\`.`,
            },
          ],
        },
      ],
    },
  })),
  prettier,
)
