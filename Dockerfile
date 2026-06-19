FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html
RUN rm -rf ./*

COPY index.html style.css app.js data.js utils.js reports.js api-sync.js api-config.example.js manifest.json sw.js ./

COPY docker-entrypoint.d/10-api-config.sh /docker-entrypoint.d/10-api-config.sh
RUN chmod +x /docker-entrypoint.d/10-api-config.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
