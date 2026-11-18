#!/bin/bash

npm install
npm audit fix

npm run lint
npm run typecheck
npm test

npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "Bump version"
git push

