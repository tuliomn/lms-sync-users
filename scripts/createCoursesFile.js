
const rp = require('request-promise')
const Promise = require('bluebird') // use bluebird to get a little more promise functions then the standard Promise AP
const parseString = Promise.promisify(require('xml2js').parseString)
const {groupBy} = require('lodash')
const config = require('../server/init/configuration')
const canvasUtilities = require('kth-canvas-utilities')
canvasUtilities.init(config.full.canvas.apiUrl, config.secure.canvas.apiKey)
const {getCourseAndCourseRoundFromKopps, createCanvasCourseObject} = canvasUtilities
const csvFile = require('../csvFile')
const fs = Promise.promisifyAll(require('fs'))

const termin = process.env.TERMIN
const period = process.env.PERIOD

console.log('creating csv file using settings', termin, period)

const fileName = `csv/courses-${termin}-${period}.csv`

function get (url) {
  // console.log(url)
  return rp({
    url,
    method: 'GET',
    json: true,
    headers: {
      'content-type': 'application/json'
    }
  })
}

/** *
* return example:
* {"round":{"courseCode":"MJ2244","startTerm":"20171","roundId":"1","xmlns":""},"periods":[{"term":"20171","number":"3"}]}
*/
function addPeriods (courseRounds) {
  function addInfoForCourseRound ([round]) {
    return get(`http://www.kth.se/api/kopps/v1/course/${round.courseCode}/round/${termin}/${round.roundId}`)
    .then(parseString)
    .then(roundInfo => {
      const periods = roundInfo.courseRound.periods && roundInfo.courseRound.periods[0].period.map(period => period.$)

      return {round, periods}
    })
  }

  return Promise.map(courseRounds, addInfoForCourseRound)
}

function filterCoursesByCount (courseRounds, filterFn) {
  const courseRoundsGrouped = groupBy(courseRounds, courseRound => courseRound.courseCode)

  return Object.getOwnPropertyNames(courseRoundsGrouped)
  .map(name => courseRoundsGrouped[name])
  .filter(filterFn)
}

function extractRelevantData (courseRounds) {
  return courseRounds.courseRoundList.courseRound.map(round => round.$)
}

function buildCanvasCourseObjects (courseRounds) {
  return Promise.map(courseRounds, ({round}) => {
    // Add a ':' between year and term
    const position = 4
    const startTerm = [round.startTerm.slice(0, position), ':', round.startTerm.slice(position)].join('')
    return getCourseAndCourseRoundFromKopps({courseCode: round.courseCode, startTerm, round: round.roundId})
  })
  .then(coursesAndCourseRounds => Promise.map(coursesAndCourseRounds, createCanvasCourseObject))
}

function writeCsvFile (canvasCourseObjects) {
  const columns = [
    'course_id',
    'short_name',
    'long_name',
    'start_date',
    'account_id',
    'status']

  function writeLine ({course, subAccount, courseRound, shortName}) {
    const lineArr = [
      course.course.sis_course_id,
      course.course.course_code,
      `${course.course.course_code} ${shortName || ''} ${course.course.name}`,
      course.course.start_at,
      subAccount.sis_account_id,
      'active']

    return csvFile.writeLine(lineArr, fileName)
    .then(() => {
      return {course, subAccount, courseRound, shortName}
    })
  }

  return fs.mkdirAsync('csv')
  .catch(e => console.log('couldnt create csv folder. This is probably fine, just continue'))
  .then(() => csvFile.writeLine(columns, fileName))
  .then(() => Promise.map(canvasCourseObjects, writeLine))
}

function deleteFile () {
  return fs.unlinkAsync(fileName)
      .catch(e => console.log("couldn't delete file. It probably doesn't exist. This is fine, let's continue"))
}

// Start executing
deleteFile()
.then(() => get(`http://www.kth.se/api/kopps/v1/courseRounds/${termin}`))
.then(parseString)
.then(extractRelevantData)
.then(courseRounds => filterCoursesByCount(courseRounds, courses => courses.length === 1))
.then(addPeriods)
.then(coursesWithPeriods => coursesWithPeriods.filter(({periods}) => periods && periods.find(({number}) => number === period)))
.then(buildCanvasCourseObjects)
.then(writeCsvFile)
.catch(e => console.error(e))