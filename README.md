# Sistema de Treinamentos TST

Plataforma de treinamentos TST com portal do aluno, painel administrativo, controle de vídeo, avaliação objetiva, resultado, certificado e base inicial para Supabase.

## Como abrir

Abra o arquivo `index.html` no navegador. Não há instalação obrigatória nesta versão.

## O que está pronto

- Portal do aluno com dashboard, dados do colaborador e lista de treinamentos.
- Tela de treinamento com vídeo simulado, progresso salvo no navegador e bloqueio de avanço.
- Avaliação liberada somente após 100% do vídeo.
- Cálculo de nota, aprovação/reprovação e geração de certificado em HTML.
- Portal administrativo com indicadores, alunos, treinamentos, perguntas, certificados, relatórios, notificações, usuários e configurações.
- Exportação CSV dos relatórios administrativos.
- Schema inicial em `supabase-schema.sql` com tabelas, índices, RLS e buckets de storage.

## Próximos passos naturais

1. Criar o projeto Supabase e executar `supabase-schema.sql`.
2. Migrar os dados simulados do `app.js` para tabelas reais.
3. Implementar login com Supabase Auth.
4. Substituir o vídeo simulado por player real com controle de progresso.
5. Gerar certificados em PDF no backend com QR Code validável.
6. Enviar notificações por e-mail usando SMTP ou Resend.
