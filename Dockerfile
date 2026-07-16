FROM node:22-alpine

WORKDIR /app

COPY app.js index.html local-server.mjs styles.css ./
RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 8787
ENV HOST=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "local-server.mjs", "8787"]
