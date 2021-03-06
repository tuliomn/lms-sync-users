var test = require('tape')
const {handleMessages} = require('././utils')
const canvasApi = require('../../canvasApi')
const randomstring = require('randomstring')
const assert = require('assert')
const {promisify} = require('util')
async function processMessage (message, course) {
  // First create a fresch course in canvas
  try {
    const accountId = 14 // Courses that starts with an 'A' is handled by account 14
    const canvasCourse = await canvasApi.createCourse({course}, accountId)
    await canvasApi.createDefaultSection(canvasCourse)
    const [{resp}] = await handleMessages(message)
    await canvasApi.pollUntilSisComplete(resp.id)
    const enrolledUsers = await canvasApi.getEnrollments(canvasCourse.id)
    console.log('enrolledUsers:', JSON.stringify(enrolledUsers))
    const [enrolledUser] = enrolledUsers
    return enrolledUser
  } catch (e) {
    console.error('An error occured', e)
  }
}

test('should enroll an assistant in an existing course in canvas', t => {
  t.plan(1)

  const courseCode = 'A' + randomstring.generate(5) // Assistants course code should be 6 chars
  const userKthId = 'u1znmoik'
  const message = {
    ugClass: 'group',
    ug1Name: `edu.courses.SF.${courseCode}.20171.1.assistants`,
    member: [userKthId]}

  const course = {
    name: 'Emil testar',
    'course_code': courseCode,
    'sis_course_id': `${courseCode}VT171`
  }

  processMessage(message, course)
    .then((enrolledUser) => {
      t.equal(enrolledUser.sis_user_id, userKthId)
    })
})

test('should enroll an employee in correct section in Miljöutbildningen and Canvas at KTH', async t => {
  const canvasCourseId = 5011 // Miljöutbildningen
  const canvasCourseId2 = 85 // Canvas at KTH

  // First create a new user
  const kthid = randomstring.generate(8)
  const username = `${kthid}_abc`
  const createUserMessage = {
    kthid,
    'ugClass': 'user',
    'deleted': false,
    'affiliation': ['student'],
    username,
    'family_name': 'Stenberg',
    'given_name': 'Emil Stenberg',
    'primary_email': 'esandin@gmail.com'}

  await handleMessages(createUserMessage)

  // Then enroll the new user
  const staffMessage = {
    ugClass: 'group',
    ug1Name: 'app.katalog3.A',
    member: [kthid]}

  const [{resp}] = await handleMessages(staffMessage)
  await canvasApi.pollUntilSisComplete(resp.id)

  const enrolledUsersMU = await canvasApi.get(`courses/${canvasCourseId}/enrollments?sis_section_id[]=app.katalog3.A.section1`)
  assert(enrolledUsersMU.find(user => user.user.sis_user_id === kthid), 'Oh no, the user is not enrolled in this section!')

  const enrolledUsersCanvasAtKth = await canvasApi.get(`courses/${canvasCourseId2}/enrollments?sis_section_id[]=app.katalog3.A.section2`)
  assert(enrolledUsersCanvasAtKth.find(user => user.user.sis_user_id === kthid), 'Oh no, the user is not enrolled in this section!')

  t.end()
})

test('should enroll a re-registered student in an existing course in canvas', t => {
  t.plan(2)
  const userKthId = 'u1znmoik'
  const courseCode0 = 'A' + randomstring.generate(1)
  const courseCode1 = randomstring.generate(4)

  const message = {
    ugClass: 'group',
    ug1Name: `ladok2.kurser.${courseCode0}.${courseCode1}.omregistrerade_20171`,
    member: [userKthId]}

  const course = {
    name: 'Emil testar',
    'course_code': courseCode0 + courseCode1,
    'sis_course_id': `${courseCode0 + courseCode1}VT173`
  }

  processMessage(message, course)
    .then(enrolledUser => {
      t.ok(enrolledUser)
      t.equal(enrolledUser.sis_user_id, userKthId)
    })
})

test('should enroll a student in an existing course in canvas', t => {
  t.plan(2)

  const courseCode0 = 'A' + randomstring.generate(1)
  const courseCode1 = randomstring.generate(4)
  const userKthId = 'u1znmoik'

  const message = {
    kthid: 'u2yp4zyn',
    ugClass: 'group',
    ug1Name: `ladok2.kurser.${courseCode0}.${courseCode1}.registrerade_20171.1`,
    member: [userKthId]}

  const course = {
    name: 'Emil testar',
    'course_code': courseCode0 + courseCode1,
    'sis_course_id': `${courseCode0 + courseCode1}VT171`
  }

  processMessage(message, course)
    .then((enrolledUser) => {
      t.ok(enrolledUser)
      t.equal(enrolledUser.sis_user_id, userKthId)
    })
})

test('should 𝙣𝙤𝙩 enroll an antagen', async t => {
  const courseCode0 = 'A' + randomstring.generate(1)
  const courseCode1 = randomstring.generate(4)
  const userKthId = 'u1znmoik'

  const message = {
    kthid: 'u2yp4zyn',
    ugClass: 'group',
    ug1Name: `ladok2.kurser.${courseCode0}.${courseCode1}.antagna_20181.1`,
    member: [userKthId]}

  const course = {
    name: 'Emil testar',
    'course_code': courseCode0 + courseCode1,
    'sis_course_id': `${courseCode0 + courseCode1}VT171`
  }

  const accountId = 14 // Courses that starts with an 'A' is handled by account 14
  const canvasCourse = await canvasApi.createCourse({course}, accountId)
  await handleMessages(message)

  // Can't poll since no csv file should have been sent to canvas
  // Add a short sleep (I know, this is really ugly) to make sure that any incorrectly sent csv files are caught
  const delay = promisify(setTimeout)
  await delay(5000)
  const enrolledUsers = await canvasApi.getEnrollments(canvasCourse.id)
  assert.deepEqual(enrolledUsers, [])
  t.end()
})
