const config = require('./server/init/configuration')
const queue = require('node-queue-adapter')(config.secure.azure.queueConnectionString)
const {addDescription} = require('message-type')
const handleMessage = require('./handleMessage')

require('colors')

var MESSAGECOUNTER = 0

function readMessage () {
  MESSAGECOUNTER += 1
  //process.stdout.write('\nChecking Azure queue... ' + MESSAGECOUNTER)

  let message
  return queue
    .readMessageFromQueue('ug-canvas')
    .then(msg => {
      message = msg
      if (!msg) {
        // Best way to abort a promise chain is by a custom error according to:
        // http://stackoverflow.com/questions/11302271/how-to-properly-abort-a-node-js-promise-chain-using-q
        throw new Error('abort_chain')
      }

      return msg
    })
    .then(msg => JSON.parse(msg.body))
    .then(msg =>{
        console.log(JSON.stringify(msg,null,4).blue);
        return msg
    })
    .then(addDescription)
    .then(handleMessage)
    .then(() => queue.deleteMessageFromQueue(message))
    .catch(e => {
      if (e.message !== 'abort_chain') {
        console.log("\nIn Error handling function testing to remove the message from queue.....")
        console.error(`Exception: `, e)
      }
    }).finally(readMessage)
}
readMessage()
