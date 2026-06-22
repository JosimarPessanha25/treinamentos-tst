# Templates de E-mail HTML Personalizados – TST

Estes são os templates de e-mail em HTML prontos para uso no Supabase Auth. Eles foram desenhados especificamente com as cores e estilo visual do **TST** (verde institucional `#197b55`, fundo limpo `#f6f7f4` e tipografia profissional).

Como configurar no Supabase:
1. Acesse o **Supabase Dashboard** -> Seu projeto (`svavwwfjnyhzmkviwnwx`).
2. Vá em **Project Settings** -> **Auth** -> **Email Templates** (ou **Authentication** -> **Email Templates**).
3. Selecione o template correspondente (Confirm signup, Reset password, etc.).
4. Substitua o conteúdo do campo **Message** (HTML) pelo código abaixo.

---

## 1. Confirmar Cadastro (Confirm Signup)

**Assunto sugerido:** `Confirme seu cadastro - Sistema de Treinamentos TST`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de Cadastro - TST</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f7f4; color: #17211d; margin: 0; padding: 0; -webkit-text-size-adjust: none; }
    .wrapper { width: 100%; background-color: #f6f7f4; padding: 40px 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #dbe2dc; box-shadow: 0 4px 6px rgba(0,0,0,0.02); overflow: hidden; }
    .header { background-color: #173d2e; padding: 30px; text-align: center; }
    .header-title { color: #ffffff; font-size: 20px; font-weight: bold; margin-top: 10px; letter-spacing: 0.5px; }
    .content { padding: 40px 30px; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: bold; color: #17211d; margin-bottom: 20px; }
    .text { font-size: 15px; color: #555555; margin-bottom: 30px; }
    .btn-wrap { text-align: center; margin: 35px 0; }
    .btn { background-color: #197b55; color: #ffffff !important; text-decoration: none; padding: 14px 28px; font-size: 15px; font-weight: bold; border-radius: 6px; display: inline-block; box-shadow: 0 4px 6px rgba(25, 123, 85, 0.2); }
    .btn:hover { background-color: #156546; }
    .footer { background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #eeeeee; font-size: 12px; color: #888888; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="header-title">Treinamentos TST</div>
        <div style="color: #6ee7b7; font-size: 12px; margin-top: 4px;">Cursos & Certificados</div>
      </div>
      <div class="content">
        <div class="greeting">Olá!</div>
        <div class="text">
          Seja bem-vindo ao <strong>Sistema de Treinamentos TST</strong>.<br><br>
          Para confirmar seu cadastro e ativar sua conta, clique no botão abaixo:
        </div>
        <div class="btn-wrap">
          <a href="{{ .ConfirmationURL }}" class="btn">Confirmar Cadastro</a>
        </div>
        <div class="text" style="font-size: 13px; color: #888; text-align: center; margin-top: 20px;">
          Se o botão acima não funcionar, copie e cole o seguinte link no seu navegador:<br>
          <a href="{{ .ConfirmationURL }}" style="color: #197b55; word-break: break-all;">{{ .ConfirmationURL }}</a>
        </div>
      </div>
      <div class="footer">
        Este é um e-mail automático enviado pelo Sistema de Segurança do Trabalho TST.<br>
        &copy; 2026 TST. Todos os direitos reservados.
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 2. Redefinir Senha (Reset Password)

**Assunto sugerido:** `Recuperação de Senha - Sistema de Treinamentos TST`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinição de Senha - TST</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f7f4; color: #17211d; margin: 0; padding: 0; -webkit-text-size-adjust: none; }
    .wrapper { width: 100%; background-color: #f6f7f4; padding: 40px 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #dbe2dc; box-shadow: 0 4px 6px rgba(0,0,0,0.02); overflow: hidden; }
    .header { background-color: #173d2e; padding: 30px; text-align: center; }
    .header-title { color: #ffffff; font-size: 20px; font-weight: bold; margin-top: 10px; letter-spacing: 0.5px; }
    .content { padding: 40px 30px; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: bold; color: #17211d; margin-bottom: 20px; }
    .text { font-size: 15px; color: #555555; margin-bottom: 30px; }
    .btn-wrap { text-align: center; margin: 35px 0; }
    .btn { background-color: #197b55; color: #ffffff !important; text-decoration: none; padding: 14px 28px; font-size: 15px; font-weight: bold; border-radius: 6px; display: inline-block; box-shadow: 0 4px 6px rgba(25, 123, 85, 0.2); }
    .btn:hover { background-color: #156546; }
    .footer { background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #eeeeee; font-size: 12px; color: #888888; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="header-title">Treinamentos TST</div>
        <div style="color: #6ee7b7; font-size: 12px; margin-top: 4px;">Cursos & Certificados</div>
      </div>
      <div class="content">
        <div class="greeting">Olá!</div>
        <div class="text">
          Recebemos uma solicitação de redefinição de senha para sua conta no <strong>Sistema de Treinamentos TST</strong>.<br><br>
          Se você solicitou esta redefinição, clique no botão abaixo para criar uma nova senha de acesso:
        </div>
        <div class="btn-wrap">
          <a href="{{ .ConfirmationURL }}" class="btn">Redefinir Minha Senha</a>
        </div>
        <div class="text" style="font-size: 13px; color: #888;">
          Se você não solicitou a alteração de sua senha, por favor ignore este e-mail. Seus dados de login continuam seguros.
        </div>
      </div>
      <div class="footer">
        Este é um e-mail automático enviado pelo Sistema de Segurança do Trabalho TST.<br>
        &copy; 2026 TST. Todos os direitos reservados.
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 3. Alteração de E-mail (Email Change)

**Assunto sugerido:** `Confirme sua alteração de e-mail - Sistema de Treinamentos TST`

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de Alteração de E-mail - TST</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f7f4; color: #17211d; margin: 0; padding: 0; -webkit-text-size-adjust: none; }
    .wrapper { width: 100%; background-color: #f6f7f4; padding: 40px 0; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #dbe2dc; box-shadow: 0 4px 6px rgba(0,0,0,0.02); overflow: hidden; }
    .header { background-color: #173d2e; padding: 30px; text-align: center; }
    .header-title { color: #ffffff; font-size: 20px; font-weight: bold; margin-top: 10px; letter-spacing: 0.5px; }
    .content { padding: 40px 30px; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: bold; color: #17211d; margin-bottom: 20px; }
    .text { font-size: 15px; color: #555555; margin-bottom: 30px; }
    .btn-wrap { text-align: center; margin: 35px 0; }
    .btn { background-color: #197b55; color: #ffffff !important; text-decoration: none; padding: 14px 28px; font-size: 15px; font-weight: bold; border-radius: 6px; display: inline-block; box-shadow: 0 4px 6px rgba(25, 123, 85, 0.2); }
    .btn:hover { background-color: #156546; }
    .footer { background-color: #f9fafb; padding: 25px 30px; text-align: center; border-top: 1px solid #eeeeee; font-size: 12px; color: #888888; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="header-title">Treinamentos TST</div>
        <div style="color: #6ee7b7; font-size: 12px; margin-top: 4px;">Cursos & Certificados</div>
      </div>
      <div class="content">
        <div class="greeting">Olá!</div>
        <div class="text">
          Você solicitou a alteração do seu e-mail cadastrado no <strong>Sistema de Treinamentos TST</strong>.<br><br>
          Para confirmar o novo e-mail, por favor clique no botão abaixo:
        </div>
        <div class="btn-wrap">
          <a href="{{ .ConfirmationURL }}" class="btn">Confirmar Novo E-mail</a>
        </div>
        <div class="text" style="font-size: 13px; color: #888;">
          Se você não solicitou essa alteração, nenhuma ação é necessária e seu e-mail anterior continuará ativo.
        </div>
      </div>
      <div class="footer">
        Este é um e-mail automático enviado pelo Sistema de Segurança do Trabalho TST.<br>
        &copy; 2026 TST. Todos os direitos reservados.
      </div>
    </div>
  </div>
</body>
</html>
```
