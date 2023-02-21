FROM node:18
WORKDIR /usr/src/app

COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm install

COPY src/. src/.
COPY includes/. includes/.

EXPOSE 25405
CMD [ "npm", "start" ]