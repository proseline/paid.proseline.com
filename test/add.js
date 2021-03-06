var concat = require('simple-concat')
var constants = require('./constants')
var crypto = require('@proseline/crypto')
var http = require('http')
var mailgun = require('../mailgun/test').events

module.exports = function (email, port, test, callback) {
  var keyPair = crypto.signingKeyPair()
  var message = {
    name: 'test device',
    date: new Date().toISOString(),
    email
  }
  var add = {
    publicKey: keyPair.publicKey.toString('hex'),
    message
  }
  crypto.sign(add, keyPair.secretKey, 'signature', 'message')
  mailgun.once('sent', function (message) {
    if (test) {
      test.equal(message.to, email, 'to address')
      test.assert(message.subject.includes('Add'), 'subject has "Add"')
      test.assert(
        message.paragraphs.some(function (paragraph) {
          return paragraph.includes(
            'https://' + constants.HOSTNAME + '/add'
          )
        }),
        'sent capability link'
      )
    }
    callback(message)
  })
  http.request({ path: '/add', method: 'POST', port })
    .once('response', function (response) {
      if (test) {
        test.equal(
          response.statusCode, 200,
          'responds 200'
        )
        concat(response, function (error, buffer) {
          var body = buffer.toString()
          test.ifError(error, 'no error')
          test.equal(
            body, JSON.stringify({ message: 'e-mail sent' }),
            'e-mail sent message'
          )
        })
      }
    })
    .end(JSON.stringify(add))
}
