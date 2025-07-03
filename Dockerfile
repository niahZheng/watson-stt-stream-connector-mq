# pull official base image
FROM node:20-alpine

# set working directory
WORKDIR /app

# add `/app/node_modules/.bin` to $PATH
ENV PATH /app/node_modules/.bin:$PATH

# install app dependencies
COPY package.json ./
COPY package-lock.json ./

RUN apk add --update python3 make g++ && rm -rf /var/cache/apk/*
RUN npm install

# switch user
USER node

# add app
COPY . ./

# Expose the port
EXPOSE 443

# start app
CMD ["npm", "start"] 