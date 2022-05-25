#!/usr/bin/env node

const ManagementClient = require('auth0').ManagementClient
const AuthenticationClient = require('auth0').AuthenticationClient
const express = require('express')
const router = express.Router()
const got = require('got')

let manager = new ManagementClient({
  domain: process.env.DOMAIN,
  clientId: process.env.CLIENTID,
  clientSecret: process.env.CLIENT_SECRET,
  scope: "create:users read:users read:user_idp_tokens update:users delete:users read:roles create:roles update:roles delete:roles"
})

let authenticator = new AuthenticationClient({
  domain: process.env.DOMAIN,
  clientId: process.env.CLIENTID
})

/**
 * Let LRDA Apps Users update THEIR OWN profile info.
 * 
 * Make sure the user making the request is the user to update.
 */
router.put('/updateProfileInfo', async function (req, res, next) {
  console.log("update profile info")
  let token = req.header("Authorization") ?? ""
  token = token.replace("Bearer ", "")
  if (token) {
    authenticator.getProfile(token)
      .then(async (current_user) => {
        if (isLRDAUser(current_user)) {
          //The user object is in the body, and the id is present or fail.
          let userObj = req.body ?? {}
          const userid = userObj.sub ?? userObj.user_id ?? userObj.id ?? ""
          delete userObj.sub
          delete userObj.user_id
          delete userObj.id
          if (userid) {
            if (current_user.sub === userid) {
              let params = { id: current_user.sub }
              manager.updateUser(params, userObj)
                .then(user => {
                  res.status(200).json(user)
                })
                .catch(err => {
                  console.error("Trouble updating using profile.")
                  console.error(err)
                  res.status(500).send(err)
                })
            }
            else {
              res.status(401).send("You can only update your own profile.  Please check the id of the user in the request body.")
            }
          }
          else {
            res.status(400).send("The user object was not JSON or did not have an id.")
          }
        }
        else {
          res.status(401).send("You are not a LRDA Apps user, this API is not for you.")
        }
      })
      .catch(err => {
        res.status(500).send(err)
      })
  }
  else {
    res.status(403).send("You must be a LRDA Apps user.  Please provide an access token in the Authorization header.")
  }
})

/**
 * Get all the users from the Auth0 Tenant with app.includes("rerum")
 */
router.get('/getAllUsers', async function (req, res, next) {
  let token = req.header("Authorization") ?? ""
  token = token.replace("Bearer ", "")
  try {
    authenticator.getProfile(token)
      .then(async (current_user) => {
        if (isAdmin(current_user)) {
          let filter = {
            "q": `_exists_:app_metadata.app`
          }
          //FIXME I believe this is limited to 50 users at a time.
          //https://auth0.com/docs/manage-users/user-search/retrieve-users-with-get-users-endpoint#limitations
          let usersWithRoles = await manager.getUsers(filter)
            .then(allUsers => allUsers.filter(usr => usr.app_metadata.app.includes("lrda")))
            .then(async (lrdaUsers) => {
              return Promise.all(lrdaUsers.map(async (u) => {
                let roles = await manager.getUserRoles({ "id": u.user_id })
                  .then(roles => {
                    let r = { "roles": [] }
                    if (roles && roles.length) {
                      r.roles = roles
                        //.filter(roleObj => roleObj.name.includes("rerum_user"))
                        .map(roleObj => roleObj.name)
                    }
                    u[process.env.RERUM_ROLES_CLAIM] = r
                  })
                  .catch(err => {
                    //Could not get user roles.
                    console.error(err)
                    return []
                  })
                return u
              }))
            })
            .catch(err => {
              console.error("Error getting users in back end")
              console.error(err)
              res.status(500).send(err)
            })
          res.status(200).json(usersWithRoles)
        }
        else {
          res.status(401).send("You are not an admin")
        }
      })
      .catch(err => {
        res.status(500)
        next(err)
      })
  } catch (err) {
    next(err)
    return
  }
})

/**
 * Tell our RERUM Auth0 to assign the given user id to the LRDA Public role.
 * This limits access token scope.
 * Other roles are removed.
 */
router.get('/assignPublicRole/:_id', async function (req, res, next) {
  let token = req.header("Authorization") ?? ""
  token = token.replace("Bearer ", "")
  authenticator.getProfile(token)
    .then(user => {
      if (isAdmin(user)) {
        let params = { "id": process.env.LRDA_PUBLIC_ROLE_ID }
        let data = { "users": [req.params._id] }
        manager.assignUsersToRole(params, data)
          .then(resp => {
            //unassign from other roles
            params = { "id": req.params._id }
            data = { "roles": [process.env.LRDA_ADMIN_ROLE_ID] }
            manager.removeRolesFromUser(params, data)
              .then(resp2 => {
                res.status(200).send("Public role was successfully assinged to the user")
              })
              .catch(err => {
                res.status(500).send(err)
              })
          })
          .catch(err => {
            res.status(500).send(err)
          })
      }
      else {
        res.status(500).send("You are not an admin")
      }
    })
    .catch(err => {
      res.status(500).send(err)
    })
})

/**
 * Tell our RERUM Auth0 to assign the given user id to the LRDA Contributor role.
 * This limits access token scope.
 * Other roles are removed.
 */
router.get('/assignContributorRole/:_id', async function (req, res, next) {
  let token = req.header("Authorization") ?? ""
  token = token.replace("Bearer ", "")
  authenticator.getProfile(token)
    .then(user => {
      if (isAdmin(user)) {
        let params = { "id": "" }
        let data = { "users": [req.params._id] }
        manager.assignUsersToRole(params, data)
          .then(resp => {
            //unassign from other roles
            params = { "id": req.params._id }
            data = { "roles": [process.env.LRDA_PUBLIC_ROLE_ID, process.env.LRDA_ADMIN_ROLE_ID] }
            manager.removeRolesFromUser(params, data)
              .then(resp2 => {
                res.status(200).send("Contributor role was successfully assinged to the user")
              })
              .catch(err => {
                res.status(500).send(err)
              })
          })
          .catch(err => {
            res.status(500).send(err)
          })
      }
      else {
        res.status(500).send("You are not an admin")
      }
    })
    .catch(err => {
      res.status(500).send(err)
    })
})

/**
* Tell our RERUM Auth0 to assign the given user id to the LRDA Admin role.
* Other roles are removed.
*/
router.post('/assignAdminRole/:_id', async function (req, res, next) {
  res.status(501).send("We don't expose this.")
})

/**
 * The URL hash from the authorize endpoint looks like #access_token=...&scope=...&
 * Pass in the URL with the hash and the variable to grab.
 * The value for that variable is returned.
 */
function getURLHash(variable, url) {
  var query = url.substr(url.indexOf("#") + 1)
  var vars = query.split("&")
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=")
    if (pair[0] == variable) { return pair[1] }
  }
  return false
}

/**
 *  Given a user profile, check if that user is a LRDA Apps admin.
 */
function isAdmin(user) {
  let roles = { roles: [] }
  if (user[process.env.RERUM_ROLES_CLAIM]) {
    roles = user[process.env.RERUM_ROLES_CLAIM].roles ?? { roles: [] }
  }
  return roles.includes(process.env.LRDA_ADMIN_ROLE)
}

/**
 *  Given a user profile, check if that user belongs to a LRDA App.
 *  Any LRDA Apps user with any level of permission will at least have "rerum" in the apps array.
 */
function isLRDAUser(user) {
  return (
    user[process.env.RERUM_APP_CLAIM] &&
    user[process.env.RERUM_APP_CLAIM].includes("lrda")
  )
}

module.exports = router
