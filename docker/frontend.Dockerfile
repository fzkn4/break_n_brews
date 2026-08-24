# Shared by the admin, staffs, and customer portals. The build context selects
# which one — see the `build.context` of each service in docker-compose.yml.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

# The compose service overrides this with its own --port.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
