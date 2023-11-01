let request = require("supertest")

//Fun fact, if you don't require app, you don't get coverage even though the tests run just fine.
let app = require('../app')

request = request("http://localhost:3333")

// Essentially useless.  It's a placeholder so 'tests' are a part of the CD workflow.
it('/ -- Make sure index exists', function(done) {
  request
    .get("/index.html")
    .expect(200)
    .then(response => {
        done()
    })
    .catch(err => done(err))
})