# FINANCE AI (HTML único + Supabase só como banco)

Aplicativo instalável (PWA). Todo o sistema — layout, login, cadastro e troca de senha, lançamentos, parcelamentos, metas, importação CSV/PDF/OneDrive, planilha `.xlsx` e dicas — está no arquivo **`index.html`**.
O Supabase guarda apenas os dados (Postgres). **Não usa** Supabase Auth, Edge Functions nem Storage.

## 1. Banco (uma vez)
1. Supabase › **SQL Editor** › cole todo o conteúdo de `supabase/migrations/20261123000000_finance_ai_html.sql` › **Run**.
   (ou: `supabase link --project-ref mcvcnllpriazdhwjyigi && supabase db push`)
2. Se você já aplicou a migração da versão anterior (com Supabase Auth), ela fica sem uso; pode apagar as tabelas antigas (`transactions`, `installments`, `family_*`, etc.) quando quiser.

A URL e a chave **publishable** do projeto já estão no começo do script do `index.html` (`SUPABASE_URL`, `SUPABASE_KEY`). São públicas por design.

## 2. Como a segurança funciona
- Tabelas bloqueadas para a API pública (RLS ligado, sem políticas, sem privilégios). Todo acesso passa pelas funções `fa_*` do banco.
- Senhas guardadas com **bcrypt** (pgcrypto); a sessão é um token aleatório (guardado só como hash no banco, validade de 30 dias).
- 5 tentativas erradas bloqueiam o e-mail por 15 minutos.
- **Primeiro acesso:** com o banco vazio, a tela pede para criar o **administrador**. Depois disso não existe cadastro público: só o administrador cria usuários (aba *Usuários*).
- **Senha inicial:** o administrador informa ou gera uma senha temporária por usuário (mostrada uma única vez). No primeiro login o usuário é obrigado a trocá-la. Não há senha padrão fixa no HTML (qualquer pessoa leria).
- **Esqueci a senha:** não há envio de e-mail; o administrador redefine em *Usuários › Redefinir senha*.
- Perfis: administrador, membro (edita) e leitura. Todos os usuários ativos compartilham os mesmos dados (um espaço familiar).
- Limites: a chave publishable fica visível no HTML (normal); quem a tem consegue chamar as funções, mas só com e-mail/senha válidos. Use senhas fortes e HTTPS.

## 3. Instalar como aplicativo (PWA)
Arquivos do app (todos na MESMA pasta, sem subpastas): `index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`.
1. Publique no GitHub Pages (item abaixo). A instalação exige **https**; abrindo o arquivo local não aparece a opção.
2. Android (Chrome): abra o endereço do site e toque em **Instalar app** (botão no menu lateral/login) ou menu ⋮ › Instalar app. iPhone (Safari): Compartilhar › Adicionar à Tela de Início.
3. O service worker guarda só a "casca" do app (tela e ícones) para abrir mais rápido/offline. **Dados financeiros nunca são guardados em cache.** Ao atualizar o site, aumente `CACHE = 'finance-ai-vN'` em `sw.js`.

## 4. Publicar / usar
- **GitHub Pages:** suba o repositório, *Settings › Pages › Source: GitHub Actions* e faça push na `main` (o workflow publica o `index.html`).
- **Local:** dê duplo clique no `index.html` (funciona, exceto login Microsoft) ou rode `npx serve .` / `python3 -m http.server`.
- Bibliotecas (leitor de PDF, planilha, login Microsoft) são carregadas da internet **só quando usadas**.

## 5. IA (opcional)
Aba *Assistente IA*: escolha o provedor — **Google Gemini**, Anthropic (Claude), OpenAI ou **Meta (Muse)** — e informe sua chave. Google Gemini: chave criada no Google AI Studio (`aistudio.google.com`), modelo padrão `gemini-3.5-flash-lite`. Meta: chave criada no painel dev.meta.ai (Model API), endereço `https://api.meta.ai/v1`, modelo padrão `muse-spark-1.1`; se o navegador bloquear a chamada direta (CORS), use outro provedor ou as dicas locais. Ela fica **só neste navegador** (localStorage) e os dados vão direto ao provedor; use uma chave com limite de gasto. Sem chave, as dicas são calculadas localmente.

## 6. OneDrive
Registre um app no Microsoft Entra (tipo *Single-page application*), redirect URI = URL exata do site (a aba Importações mostra), permissões `User.Read` e `Files.Read`. Cole na aba Importações o **ID do aplicativo (cliente)** — um código `00000000-0000-…`, **não o e-mail**. Em conta de empresa o TI pode exigir aprovação; alternativa: importação manual escolhendo os arquivos pelo app OneDrive. Só funciona em https/localhost e com a página aberta (sem sincronização em segundo plano).

## 7. Importação
Botões **Modelo CSV** (planilha de exemplo para preencher) e **Meus lançamentos (.csv)** (backup reimportável). CSV (UTF-8/ANSI; `,` `;` ou tab; cabeçalho pode vir após linhas de preâmbulo) e PDF com texto. Duplicidade por arquivo (SHA-256) e por lançamento. `PARC 03/10`, `Parcela 3 de 10` ou coluna "parcela" criam/atualizam parcelamentos. "Pagamento de fatura" vira transferência.

## Testes
`npm test` (funções de leitura/normalização; `app_pure.js` é o mesmo bloco embutido no `index.html`).

## Atualização do banco (se você já aplicou o SQL antes)
Rode uma vez `atualizacao-sql-tipo.sql` no SQL Editor: habilita corrigir na tela o *Tipo* (receita/despesa/transferência) de cada lançamento.

## Extratos bancários em PDF
O leitor reconhece extratos em colunas (Data | Histórico | Docto | Crédito | Débito | Saldo): a data vale para as linhas seguintes até a próxima data, o histórico pode ocupar 2 linhas, e receita/despesa vem da coluna (Crédito/Débito) confirmada pela variação do saldo. Movimentos entre contas do titular (ex.: `TRANSF.POUP`, Pix para si mesmo — informe seu nome no campo *Seu nome no extrato*) viram *transferência*. Se algo vier errado, corrija o tipo/categoria na aba Lançamentos.
