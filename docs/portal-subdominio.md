# Portal em subdomínio (`portal.cromiacomunicacao.com`)

Esta base é `Vite + React Router`. Não existe `middleware.ts` de Next.js aqui.

O equivalente implementado no frontend foi:

- `portal.cromiacomunicacao.com/:slug` renderiza `PortalPage`
- `portal.cromiacomunicacao.com/aprovacao/:slug` renderiza `PublicApprovalPage`
- rotas administrativas ficam bloqueadas no subdomínio `portal.`

## O que precisa no servidor

O subdomínio `portal.cromiacomunicacao.com` precisa servir o mesmo build estático do app e reescrever qualquer rota SPA para `index.html`.

## Apache / cPanel

Use o `DocumentRoot` do subdomínio apontando para o build publicado e aplique:

```apacheconf
Options -MultiViews
RewriteEngine On

RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

RewriteRule ^ index.html [L]
```

## Nginx

```nginx
server {
  server_name portal.cromiacomunicacao.com;
  root /caminho/do/build;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## Como validar

1. `https://portal.cromiacomunicacao.com/SEU_TOKEN`
   - deve abrir o portal do cliente
2. `https://portal.cromiacomunicacao.com/aprovacao/SEU_TOKEN`
   - deve abrir a aprovação pública
3. `https://portal.cromiacomunicacao.com/dashboard`
   - não deve abrir a área administrativa
