const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())
let db = null
const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

const intializeDBandServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running')
    })
  } catch (e) {
    console.log(`dbError:${e.message}`)
    process.exit(1)
  }
}
intializeDBandServer()

// post the user credientials
// token

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getquery = `select * from user where username="${username}";`
  const dbuser = await db.get(getquery)
  // console.log(dbuser)
  if (dbuser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    let passwordcheck = await bcrypt.compare(password, dbuser.password)

    if (passwordcheck === true) {
      let payload = {username}
      const jwttoken = jwt.sign(payload, 'munikumar')
      response.send(jwttoken)

      if (jwttoken === undefined) {
        response.status(401)
        response.send('Invalid JWT Token')
      }
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// common code
function logger(request, response, next) {
  let token
  let authheader = request.headers['authorization']
  if (authheader !== undefined) {
    token = authheader.split(' ')[1]
  }

  if (token === undefined) {
    response.status(401)
    response.send('Invalid token')
  } else {
    jwt.verify(token, 'munikumar', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid Acess token')
      } else {
        next()
      }
    })
  }
}

app.get('/states/', logger, async (request, response) => {
  console.log('user')
  const getallquery = `select * from state;`

  const dbuser = await db.all(getallquery)

  const value = dbuser => {
    ;(stateId = dbuser.state_id),
      (stateName = dbuser.state_name),
      (population = dbuser.population)
  }
  response.send(
    dbuser.map(each => {
      value(each)
    }),
  )
})

app.get('states/:stateId/', logger, async (request, response) => {
  const {stateId} = request.params

  const getBooksQuery = `
            SELECT
              *
            FROM
             state where state_id=${stateId};
            `
  const booksArray = await db.get(getBooksQuery)
  response.send(booksArray)
})

app.post('/districts/', logger, async (request, response) => {
  const {stateId, districtName, cases, cured, active, deaths} = request.body
  const createquery = `insert into district(state_id,district_name,cases,cured,active,deaths)
  values(${stateId},"${districtName}",${cases},${cured},${active},${deaths});`

  await db.run(createquery)
  response.send('District Successfully Added')
})

app.get('/districts/:districtId/', logger, async (request, response) => {
  const {districtId} = request.params
  const getquery = `select * from district where district_id=${districtId};`

  const dbuser = await db.get(getquery)
  const value = () => {
    ;(districtId = dbuser.district_id),
      (districtName = dbuser.district_name),
      (stateId = dbuser.state_id),
      (cases = dbuser.cases),
      (cured = dbuser.cured),
      (active = dbuser.active),
      (deaths = dbuser.deaths)
  }
  response.send(value(dbuser))
})

app.delete('/districts/:districtId/', logger, async (request, response) => {
  const {districtId} = request.params

  const getquery = `delete from district where district_id=${districtId};`

  const dbuser = await db.get(getquery)

  response.send('District Removed')
})

app.put('/districts/:districtId/', logger, async (request, response) => {
  const {districtId} = request.params
  const {stateId, districtName, cases, cured, active, deaths} = request.body
  const getquery = `update district set 
  state_id=${stateId},
  district_name="${districtName}",
  cases=${cases},cured=${cured},active=${active},deaths=${deaths};`

  const dbuser = await db.get(getquery)

  response.send('District Details Updated')
})

app.get('/states/:stateId/stats/', logger, async (request, response) => {
  const {stateId} = request.params
  const getstatquery = `select 
  sum(cases),
  sum(cured),
  sum(active),
  sum(deaths) from district where state_id=${stateId};`
  const stats = await db.run(getstatquery)
  response.send({
    totalCases: stats['sum(cases)'],
    totalCured: stats['sum(cured)'],
    totalActive: stats['sum(active)'],
    totalDeaths: stats['sum(deaths)'],
  })
})

module.exports = app
