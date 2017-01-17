var test = require('tape')
const {handleMessages} = require('././utils')
const canvasApi = require('../../canvasApi')
const randomstring = require('randomstring')

test.only('should enroll an assistant in an existing course in canvas', t => {
  t.plan(1)
  let canvasCourse

  const courseCode = 'A' + randomstring.generate(5)

  const message = {
    'kthid': 'u2kub9j5',
    'ugClass': 'group',
    'deleted': false,
    'ug1Name': `edu.courses.SF.${courseCode}.20171.1.assistants`,
    'name_en': 'Teacher assistants for SF1625 Spring 17 1',
    'name_sv': 'Lärarassistenter på SF1625 VT17 1',
    'member': ['u1znmoik']}


  const course = {
    'name': 'Emil testar',
    'course_code': courseCode,
    'sis_course_id': `${courseCode}VT171`,
    'start_at': '2016-08-29T09:15:03.346Z'
  }

  // First create a fresch course in canvas
  canvasApi.createCourse({course}, 14) // Courses that starts with an 'A' is handled by this account
  .then(res => {
    canvasCourse = res
    console.log('canvasCourse', canvasCourse)
  })
  .then(() => handleMessages(message))
  .then(([{resp}]) => canvasApi.pollUntilSisComplete(resp.id))
  .then(()=> canvasApi.getEnrollments(canvasCourse.id))
  .then(enrollments => t.equal(enrollments, ['u1znmoik']))
})
