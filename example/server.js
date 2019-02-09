/* Start Bolierplate --> */
const express = require('express')
const { prepareDebug, prepareOption, optionFromEnv, installSignalHandlers, setupErrorHandlers } = require('express-render-error')
const debug = require('debug')('blog:server')
const { prepareMustache, setupMustache, mustacheFromEnv } = require('express-mustache-overlays')
const { preparePublicFiles, setupPublicFiles, publicFilesFromEnv } = require('express-public-files-overlays')
const { prepareTheme, bootstrapOptionsFromEnv } = require('bootstrap-flexbox-overlay')
const { prepareAuth, prepareSignIn, signInOptionsFromEnv, withUser, authOptionsFromEnv } = require('express-mustache-jwt-signin')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

// Install signal handlers
installSignalHandlers()

// Create the app and set up configuration
const app = express()
prepareDebug(app, debug)
prepareOption(app, optionFromEnv(app))
prepareMustache(app, mustacheFromEnv(app))
preparePublicFiles(app, publicFilesFromEnv(app))
prepareTheme(app, bootstrapOptionsFromEnv(app))

const envAuthOptions = authOptionsFromEnv(app)
if ((typeof envAuthOptions.secret === 'undefined') || (envAuthOptions.cookieSecure !== true)) {
  const msg = 'WARNING: Settings only for development. Need to set secret and cookieSecure for production.'
  debug(msg)
  console.error(msg)
}
const defaultAuthOptions = {
  signInUrl: '/signin',
  // Change this!
  secret: 'reallysecret', // Needs to be long and kept secret for production
  cookieSecure: false // Should be set to true to only allow browsers to accept cookies over HTTPS
}
// We don't want to keep secret in app.locals.auth so it gets returned to be used explicitly in withUser. (Avoids accidental rendering in a template for example)
const { secret } = prepareAuth(app, Object.assign({}, defaultAuthOptions, envAuthOptions))
// Sign in and out aren't handled here, but we need this data to render templates correctly.
prepareSignIn(app, Object.assign({ signOutUrl: '/signOut', dashboardUrl: '/hello' }, signInOptionsFromEnv(app)))

// Add any library overlays required

// Setup middleware
app.use(cookieParser())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))


app.use(withUser(app, secret))
// Uncomment to override the user for debugging:
// const { setUser } = require('express-mustache-jwt-signin')
// app.use(setUser({username: 'user', admin: true}))
/* <-- End Bolierplate */

const { markdownRender, markdownServe, triggerSearchHook } = require('express-markdown-pages')
const path = require('path')

const rootDir = path.normalize(process.env.ROOT_DIR || './content')

//  const codeBlockSwaps = {}
//  codeBlockSwaps['youtube'] = (input) => {
//    return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${input.replace(/^\s+|\s+$/g, '')}" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
//  }
//  
//  markdownServe(app, '*', rootDir, async (input) => {
//    return markdownRender(input, { codeBlockSwaps })
//  })
//  
//  const searchAuthorization = process.env.SEARCH_AUTHORIZATION
//  const searchIndexUrl = process.env.SEARCH_INDEX_URL
//  if (searchIndexUrl && !searchAuthorization) {
//    throw new Error('SEARCH_INDEX_URL environment variable specified without SEARCH_AUTHORIZATION')
//  }
//  if (!searchIndexUrl && searchAuthorization) {
//    throw new Error('SEARCH_AUTHORIZATION environment variable specified without SEARCH_INDEX_URL')
//  }
//  if (searchIndexUrl) {
//    // Look for changes to mark down files that might need indexing
//    triggerSearchHook(app, rootDir, searchIndexUrl, searchAuthorization, { debug, codeBlockSwaps })
//  }
// 
// app.get('/', (req, res) => {
//   res.redirect('/hello')
// })
// 
// app.use(express.static(rootDir, {}))

const { domainApp } = require('xmlcontent')

app.locals.publicFiles.overlay("/media", [path.normalize("./public/media")])
app.locals.mustache.overlay(["./views"])

// app.use(express.static(staticDir, {index: ['index.html']}))

domainApp(app, rootDir)

// Setup public files *before* the error handler
setupPublicFiles(app)


/* Start Bolierplate -->  */
// Handle errors right at the end
setupErrorHandlers(app, { debug })

// Install the overlays and the template engine
const mustacheEngine = setupMustache(app)
app.engine('mustache', mustacheEngine)
app.set('views', app.locals.mustache.dirs)
app.set('view engine', 'mustache')

// Serve the app
app.listen(app.locals.option.port, () => console.log(`Example app listening on port ${app.locals.option.port}`))
/* <-- End Bolierplate */
