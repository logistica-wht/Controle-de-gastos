# FINANCE AI (HTML único + Supabase só como banco)

Todo o sistema — layout, login, cadastro e troca de senha, lançamentos, parcelamentos, metas, importação CSV/PDF/OneDrive, planilha `.xlsx` e dicas — está no arquivo **`index.html`**.
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

## 3. Usar
- **GitHub Pages:** suba o repositório, *Settings › Pages › Source: GitHub Actions* e faça push na `main` (o workflow publica o `index.html`).
- **Local:** dê duplo clique no `index.html` (funciona, exceto login Microsoft) ou rode `npx serve .` / `python3 -m http.server`.
- Bibliotecas (leitor de PDF, planilha, login Microsoft) são carregadas da internet **só quando usadas**.

## 4. IA (opcional)
Aba *Assistente IA*: informe sua chave Anthropic ou OpenAI. Ela fica **só neste navegador** (localStorage) e os dados vão direto ao provedor; use uma chave com limite de gasto. Sem chave, as dicas são calculadas localmente.

## 5. OneDrive
Registre um app no Microsoft Entra (tipo *Single-page application*), redirect URI = URL do site, permissões `User.Read` e `Files.Read`; cole o *client ID* na aba Importações. Só funciona em https/localhost e com a página aberta (sem sincronização em segundo plano).

## 6. Importação
CSV (UTF-8/ANSI; `,` `;` ou tab; cabeçalho pode vir após linhas de preâmbulo) e PDF com texto. Duplicidade por arquivo (SHA-256) e por lançamento. `PARC 03/10`, `Parcela 3 de 10` ou coluna "parcela" criam/atualizam parcelamentos. "Pagamento de fatura" vira transferência.

## Testes
`npm test` (funções de leitura/normalização; `app_pure.js` é o mesmo bloco embutido no `index.html`).
