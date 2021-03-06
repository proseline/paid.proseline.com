var FormData = require('form-data')
var cancel = require('./cancel')
var concat = require('simple-concat')
var confirmCancel = require('./confirm-cancel')
var confirmSubscribe = require('./confirm-subscribe')
var constants = require('./constants')
var crypto = require('@proseline/crypto')
var http = require('http')
var server = require('./server')
var subscribe = require('./subscribe')
var tape = require('tape')

tape('POST /subscribe', function (test) {
  server(function (port, done) {
    var email = 'test@example.com'
    var password = 'a terrible password'
    subscribe({ email, password, port, test }, function () {
      test.end()
      done()
    })
  })
})

tape('POST /subscribe with huge body', function (test) {
  server(function (port, done) {
    var request = http.request({
      method: 'POST',
      path: '/subscribe',
      port
    })
      .once('response', function (response) {
        test.equal(
          response.statusCode, 413,
          'responds 413'
        )
        test.end()
        done()
      })
    var buffer = Buffer.alloc(512)
    for (var i = 0; i < 100; i++) {
      request.write(buffer)
    }
    request.end()
  })
})

tape('POST /subscribe with invalid body', function (test) {
  server(function (port, done) {
    http.request({
      method: 'POST',
      path: '/subscribe',
      port
    })
      .once('response', function (response) {
        test.equal(
          response.statusCode, 400,
          'responds 400'
        )
        test.end()
        done()
      })
      .end(JSON.stringify({}))
  })
})

tape('POST /subscribe with invalid signature', function (test) {
  server(function (port, done) {
    var message = {
      token: constants.VALID_STRIPE_SOURCE,
      date: new Date().toISOString(),
      email: 'test@example.com'
    }
    var order = {
      publicKey: 'a'.repeat(64),
      signature: 'b'.repeat(128),
      message
    }
    http.request({
      method: 'POST',
      path: '/subscribe',
      port
    })
      .once('response', function (response) {
        test.equal(
          response.statusCode, 400,
          'responds 400'
        )
        test.end()
        done()
      })
      .end(JSON.stringify(order))
  })
})

tape('POST /subscribe with expired order', function (test) {
  server(function (port, done) {
    var keyPair = crypto.signingKeyPair()
    var date = new Date()
    date.setDate(date.getDate() - 30)
    var message = {
      token: constants.VALID_STRIPE_SOURCE,
      date: date.toISOString(),
      email: 'test@example.com'
    }
    var order = {
      publicKey: keyPair.publicKey.toString('hex'),
      message
    }
    crypto.sign(order, keyPair.secretKey, 'signature', 'message')
    http.request({
      method: 'POST',
      path: '/subscribe',
      port
    })
      .once('response', function (response) {
        test.equal(
          response.statusCode, 400,
          'responds 400'
        )
        test.end()
        done()
      })
      .end(JSON.stringify(order))
  })
})

tape('GET /subscribe', function (test) {
  server(function (port, done) {
    var email = 'test@example.com'
    var password = 'a terrible password'
    subscribe({ email, password, port }, function (email) {
      confirmSubscribe(email, port, test, function () {
        test.end()
        done()
      })
    })
  })
})

tape('PUT /subscribe', function (test) {
  server(function (port, done) {
    http.request({ path: '/subscribe', method: 'PUT', port })
      .once('response', function (response) {
        test.equal(
          response.statusCode, 405,
          'responds 405'
        )
        test.end()
        done()
      })
      .end()
  })
})

tape('POST /cancel', function (test) {
  server(function (port, done) {
    var email = 'test@example.com'
    var password = 'a terrible password'
    subscribe({ email, password, port }, function (subscribeMessage) {
      confirmSubscribe(subscribeMessage, port, null, function () {
        cancel(email, port, test, function () {
          test.end()
          done()
        })
      })
    })
  })
})

tape('POST /cancel', function (test) {
  server(function (port, done) {
    var email = 'notauser@example.com'
    var form = new FormData()
    form.append('email', email)
    var request = http.request({
      method: 'POST',
      path: '/cancel',
      headers: form.getHeaders(),
      port
    })
      .once('response', function (response) {
        if (test) {
          test.equal(
            response.statusCode, 200,
            'responds 200'
          )
          concat(response, function (error, buffer) {
            var body = buffer.toString()
            test.ifError(error, 'no error')
            var string = 'E-Mail Sent'
            test.assert(
              body.includes(string),
              'body includes ' + JSON.stringify(string)
            )
            test.end()
            done()
          })
        }
      })
      .once('error', function (error) {
        test.ifError(error)
      })
    form.pipe(request)
  })
})

tape('POST /cancel', function (test) {
  server(function (port, done) {
    var email = 'test@example.com'
    var password = 'a terrible password'
    subscribe({ email, password, port }, function (subscribeMessage) {
      confirmSubscribe(subscribeMessage, port, null, function () {
        cancel(email, port, null, function (cancelMessage) {
          confirmCancel(cancelMessage, port, null, function () {
            var form = new FormData()
            form.append('email', email)
            var request = http.request({
              method: 'POST',
              path: '/cancel',
              headers: form.getHeaders(),
              port
            })
              .once('response', function (response) {
                if (test) {
                  test.equal(
                    response.statusCode, 400,
                    'responds 400'
                  )
                  concat(response, function (error, buffer) {
                    var body = buffer.toString()
                    test.ifError(error, 'no error')
                    var string = 'Already Canceled'
                    test.assert(
                      body.includes(string),
                      'body includes ' + JSON.stringify(string)
                    )
                    test.end()
                    done()
                  })
                }
              })
              .once('error', function (error) {
                test.ifError(error)
              })
            form.pipe(request)
          })
        })
      })
    })
  })
})

tape('GET /cancel', function (test) {
  server(function (port, done) {
    var email = 'test@example.com'
    var password = 'a terrible password'
    subscribe({ email, password, port }, function (subscribeMessage) {
      confirmSubscribe(subscribeMessage, port, null, function () {
        cancel(email, port, null, function (cancelMessage) {
          confirmCancel(cancelMessage, port, test, function () {
            test.end()
            done()
          })
        })
      })
    })
  })
})

tape('GET /cancel without capability', function (test) {
  server(function (port, done) {
    http.request({ path: '/cancel', port })
      .once('response', function (response) {
        test.equal(
          response.statusCode, 200,
          'responds 200'
        )
        test.assert(
          response.headers['content-type'].includes('text/html'),
          'text/html'
        )
        concat(response, function (error, buffer) {
          var body = buffer.toString()
          test.ifError(error, 'no error')
          var name = 'Cancel'
          test.assert(
            body.includes(name),
            'body includes ' + JSON.stringify(name)
          )
          test.end()
          done()
        })
      })
      .end()
  })
})

tape('PUT /cancel', function (test) {
  server(function (port, done) {
    http.request({ path: '/cancel', method: 'PUT', port })
      .once('response', function (response) {
        test.equal(
          response.statusCode, 405,
          'responds 405'
        )
        test.end()
        done()
      })
      .end()
  })
})

tape('POST /subscribe after subscribing', function (test) {
  server(function (port, done) {
    var email = 'test@example.com'
    var password = 'a terrible password'
    subscribe({ email, password, port }, function (subscribeMessage) {
      confirmSubscribe(subscribeMessage, port, null, function () {
        var keyPair = crypto.signingKeyPair()
        var message = {
          token: constants.VALID_STRIPE_SOURCE,
          date: new Date().toISOString(),
          email
        }
        var order = {
          publicKey: keyPair.publicKey.toString('hex'),
          message
        }
        crypto.sign(order, keyPair.secretKey, 'signature', 'message')
        http.request({
          method: 'POST',
          path: '/subscribe',
          port
        })
          .once('response', function (response) {
            test.equal(
              response.statusCode, 400,
              'responds 400'
            )
            test.end()
            done()
          })
          .end(JSON.stringify(order))
      })
    })
  })
})

tape('Resubscribe', function (test) {
  server(function (port, done) {
    var email = 'test@example.com'
    var password = 'a terrible password'
    subscribe({ email, password, port }, function (subscribeMessage) {
      confirmSubscribe(subscribeMessage, port, null, function () {
        cancel(email, port, null, function (cancelMessage) {
          confirmCancel(cancelMessage, port, null, function () {
            subscribe({ email, password, port, test }, function (subscribeMessage) {
              test.end()
              done()
            })
          })
        })
      })
    })
  })
})

tape('GET /subscribe without capability', function (test) {
  server(function (port, done) {
    http.request({ path: '/subscribe', port })
      .once('response', function (response) {
        test.equal(
          response.statusCode, 400,
          'responds 400'
        )
        test.end()
        done()
      })
      .end()
  })
})

tape('GET /subscribe with invalid capability', function (test) {
  server(function (port, done) {
    http.request({
      path: '/subscribe?capability=' + 'a'.repeat(64),
      port
    })
      .once('response', function (response) {
        test.equal(
          response.statusCode, 400,
          'responds 400'
        )
        concat(response, function (error, buffer) {
          var body = buffer.toString()
          test.ifError(error, 'no error')
          var name = 'Invalid'
          test.assert(
            body.includes(name),
            'body includes ' + JSON.stringify(name)
          )
          test.end()
          done()
        })
      })
      .end()
  })
})

tape('GET /cancel with invalid capability', function (test) {
  server(function (port, done) {
    http.request({
      path: '/cancel?capability=' + 'a'.repeat(64),
      port
    })
      .once('response', function (response) {
        test.equal(
          response.statusCode, 400,
          'responds 400'
        )
        concat(response, function (error, buffer) {
          var body = buffer.toString()
          test.ifError(error, 'no error')
          var name = 'Invalid'
          test.assert(
            body.includes(name),
            'body includes ' + JSON.stringify(name)
          )
          test.end()
          done()
        })
      })
      .end()
  })
})

tape('GET /subscribe with cancel capability', function (test) {
  server(function (port, done) {
    var email = 'test@example.com'
    var password = 'a terrible password'
    subscribe({ email, password, port }, function (subscribeMessage) {
      confirmSubscribe(subscribeMessage, port, null, function () {
        cancel(email, port, null, function (cancelMessage) {
          var link = cancelMessage.paragraphs.find(function (paragraph) {
            return paragraph.includes(
              'https://' + constants.HOSTNAME + '/cancel'
            )
          })
          var capability = /capability=(.*)$/.exec(link)[1]
          http.request({
            path: '/subscribe?capability=' + capability,
            port
          })
            .once('response', function (response) {
              test.equal(
                response.statusCode, 400,
                'responds 400'
              )
              concat(response, function (error, buffer) {
                var body = buffer.toString()
                test.ifError(error, 'no error')
                var name = 'Invalid'
                test.assert(
                  body.includes(name),
                  'body includes ' + JSON.stringify(name)
                )
                test.end()
                done()
              })
            })
            .end()
        })
      })
    })
  })
})
