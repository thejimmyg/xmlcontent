const express = require('express')
const fs = require('fs')
const path = require('path')
const moment = require('moment')
const {promisify} = require('util')

const readFileAsync = promisify(fs.readFile)


// Parse


const libxml = require('libxmljs')
// const fs = require('fs')

const parse = async function (path, regions) {
  const result = {}
  for (let r = 0; r < regions.length; r++) {
    const regionName = regions[r]
    if (regionName === 'type' || regionName === 'title' || regionName === 'heading') {
      throw new Error(`'${regionName}' is reserved and cannot be used as a region name`)
    }
    result[regionName] = []
  }
  const page = await readFileAsync(path, {encoding: 'utf8'})
  const xmlDoc = libxml.parseXmlString(page)
  const root = xmlDoc.root()
  const children = root.childNodes()
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const regionName = child.name()
    switch (regionName) {
      case 'title':
        result.title = child.text()
        break
      case 'heading':
        result.heading = child.text()
        break
      default:
        if (regions.indexOf(regionName) !== -1) {
          const blocks = child.childNodes()
          for (let j = 0; j < blocks.length; j++) {
            const block = blocks[j]
            if (block.name() !== 'text') {
              result[regionName].push([block.name(), block])
            }
          }
        }
    }
  }
  result.type = root.name()
  result.root = root
  return result
}




const commonmark = require('commonmark')

const reader = new commonmark.Parser()
const writer = new commonmark.HtmlRenderer({safe: true})

const markdownRender = function (markdown) {
  const parsed = reader.parse(markdown)
  // Modify the tree to increase heading levels
  var walker = parsed.walker()
  var event, node
  while ((event = walker.next())) {
    node = event.node
    if (event.entering && node.type === 'heading') {
      node.level += 1
    }
  }
  return writer.render(parsed)
}


// const libxml = require('libxmljs')
const spawn = require('child_process').spawn

const run = function (args, stdin) {
  return new Promise((resolve, reject) => {
    const process = spawn(args[0], args.slice(1))
    process.stdin.end(stdin)
    let out = ''
    process.stdout.on('data', (data) => {
      out += data
    })
    // process.stderr.on('data', (data) => {
    //   process.stderr.write(data)
    // })
    process.on('close', (code) => {
      // if (code === 0) {
      resolve([code, out])
      // } else {
      //   reject(code)
      // }
    })
  })
}
const embed = require('embed-video')

const outputContent = async function(content) {
  let contentRegion = ''
  for (let i = 0; i < content.length; i++) {
    const [type, block] = content[i]
    switch (type) {
      case 'markdown':
        contentRegion += markdownRender(block.text())
        break
      case 'paragraph':
        let  inner = ''
        const innerNodes = block.childNodes()
        for (let k = 0; k < innerNodes.length; k++) {
          const pDoc = innerNodes[k]
          const imageNodes = pDoc.find('//image')
          if (imageNodes) {
            for (let l=0; l<imageNodes.length; l++) {
              const orig = imageNodes[l]
              orig.name('img')
              orig.attr({class: 'image'})
            }
          }
          const videoNodes = pDoc.find('//video')
          if (videoNodes) {
            for (let l=0; l<videoNodes.length; l++) {
              const origVideo = videoNodes[l]
              const src = origVideo.attr('src').value()
              const html = embed(src, {attr: {width: 640, height: 360}})
              .replace(/allowfullscreen/g, 'allowfullscreen="true"')
              const embedVideo = libxml.parseXmlString('<?xml version="1.0" encoding="UTF-8"?>' + html)
              const a = embedVideo.root().node('a')
              a.text(src)
              a.attr({'href': src})
              embedVideo.root().attr({class: 'video'})
              origVideo.name('div')
              origVideo.attr('src').remove()
              origVideo.attr({class: 'video'})
              origVideo.addChild(embedVideo.root())//.toString())
            }
          }
          inner += pDoc.toString() + '\n'
        }
        contentRegion += inner
        break
      case 'image':
        contentRegion += '<p><img src="' + block.text() + '"></p>'
        break
      case 'restructuredtext':
        console.log('Running rst.py ...')
        const [code, out] = await run(['/usr/bin/env', 'python', path.join(__dirname, 'rst.py')], block.text())
        console.log('done')
        contentRegion += out
        break
      default:
        throw new Error(`Unknown block type ${type} in region 'content'`)
    }
  }
  return contentRegion
}


// App

// const moment = require('moment')

const tweets = async function(root) {
  const tweets = []
  const tweetNodes = root.find('//tweet[not(@private) or @private != true][position() <= 20]')
  for (let t=0; t<tweetNodes.length; t++) {
    const tweetNode = tweetNodes[t]
    const tweet = {public: true}
    if (tweetNode.attr('public') && tweetNode.attr('public').value() === 'false') {
      tweet.public = false
    }
    tweet.posted = moment(tweetNode.find('posted')[0].text()).format("ddd Do MMM YYYY, h:mma")
    const tweetContent = []
    const blocks = tweetNode.find('content')[0].childNodes()
    for (let j = 0; j < blocks.length; j++) {
      const block = blocks[j]
      if (block.name() !== 'text') {
        tweetContent.push([block.name(), block])
      }
    }
    tweet.content = await outputContent(tweetContent)
    tweets.push(tweet)
  }
  return tweets
}

const tags = function(root) {
  const tags = []
  const tagsNodes = root.find('//tags')
  if (tagsNodes.length) {
    const tagNodes = tagsNodes[0].find('tag')
    for (let i=0; i<tagNodes.length; i++) {
      tags.push(tagNodes[i].text())
    }
  }
  return tags
}

function domainApp(app, contentDir) {

  app.get('*', async (req, res, next) => {
    let contentFile
    if (req._parsedUrl.pathname === '/') {
      contentFile = path.join(contentDir, 'index.page')
    } else {
      const contentPath = req._parsedUrl.pathname.substring(1, req._parsedUrl.pathname.length)
      contentFile = path.join(contentDir, contentPath + '.page')
    }
    let stat
    try {
      stat = fs.statSync(contentFile)
    } catch (e) {
      return next()
    }
    if (!stat.isFile()) {
      return next()
    }
    const result = await parse(contentFile, ['content'])
    const {type, title, heading, content, root} = result
    const view = {
      title: title || heading,
      heading,
      content: await outputContent(content),
    }
    if (type === 'home') {
      view.tweets = await tweets(root.find('tweets')[0])
    }
    if (type === 'blogpost') {
      const tagsList = tags(root)
      if (tagsList.length) {
        view.tags = tagsList.join(', ')
      }
    }
    if (type === 'blogpost' || type === 'project') {
      const posted = root.find('posted')
      if (posted.length) {
        view.posted = moment(posted[0].text()).format("ddd Do MMM YYYY, h:mma")
      }
    }
    res.render(type, view)
  })


  app.get('*', async (req, res, next) => {
    if (!req._parsedUrl.pathname.endsWith('.html')) {
      return next()
    }
    res.setHeader('Location', req.url.replace(req._parsedUrl.pathname, req._parsedUrl.pathname.slice(0, -5)))
    res.status(302).send('Redirecting ...')
  })

  app.get('*', async (req, res, next) => {
    if (!req._parsedUrl.pathname.endsWith('/index')) {
      return next()
    }
    res.setHeader('Location', req.url.replace(req._parsedUrl.pathname, req._parsedUrl.pathname.slice(0, -6)))
    res.status(302).send('Redirecting ...')
  })

}


module.exports = {domainApp}
