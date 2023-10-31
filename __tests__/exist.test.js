let request = require("supertest")

//Fun fact, if you don't require app, you don't get coverage even though the tests run just fine.
let app = require('../app')

//A super fun note.  If you do request(app), the tests will fail due to race conditions.  
//client.connect() in db-controller.js will not finish before some calls to the routes.  So strange.
//request = request(app)
request = request("http://localhost:3333")

it('/ -- Make sure index exists', function(done) {
  request
    .get("/index.html")
    .expect(200)
    .then(response => {
        done()
    })
    .catch(err => done(err))
})