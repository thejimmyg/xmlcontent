# XMLContent Example

There is a small demo (including setting up of a template engine) that you can run with:

```
cd ../
npm install
cd example
npm install
DEBUG="*" PORT=8000 npm start
```

If you visit http://localhost:8000 you should see the blog.


## Dev

```
npm run fix
```

## Docker

Docker can't copy files from a parent directory so the `docker:build` command puts the current dev version of express-render-error in this directory and created a modified `package.json.docker`:

```
npm run docker:build && npm run docker:run
```
