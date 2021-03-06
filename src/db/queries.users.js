const User = require("./models").User;
const Wiki = require("./models").Wiki;
const Collaborator = require("./models").Collaborator;
const bcrypt = require("bcryptjs");
const Authorizer = require("../policies/application");
const Sequelize = require('sequelize');
const Op = Sequelize.Op

module.exports = {
  createUser(newUser, callback) {
    const salt = bcrypt.genSaltSync();  
    const hashedPassword = bcrypt.hashSync(newUser.password, salt);

    return User.create({
      name: newUser.name,
      email: newUser.email,
      password: hashedPassword
    })
    .then((user) => {
      callback(null, user);
    })
    .catch((err) => {
      if(err.errors[0] === undefined) {
        console.log(err);
        callback("Something went wrong!");
      } else {
        errorReformatted = [{  // make this fit our view messaging for Validation Errors
          param: err.errors[0].path,
          msg: err.errors[0].message
        }]
        callback(errorReformatted);
      }
    });
  },
  getUser(req, callback) {
    let result = {};
    User.findById(req.params.id)
    .then((user) => {
      if(!user) {
        callback(404);
      } else {
        result["user"] = user;

        if(req.user && ((req.user.role === 2) || (req.user.id === user.id))) { 
          // signed in, and either an admin or my own profile
          Wiki.findAll({ 
            where: {
              userId: user.id
            }
          })
          .then((wikis) => {
            result["wikis"] = wikis;

            Collaborator.scope({ // collaborator objects, scope includes Wiki
              method: ["collaboratorOn", user.id]
            }).all()
            .then((collaborators) => {
              result["collaborators"] = collaborators;

              // console.log(result.collaborators[0].Wiki);
              callback(null, result);
            })
            .catch((err) => {
              console.log(err);
              callback(err);
            }); 
          })
          .catch((err) => {
            console.log(err);
            callback(err);
          });             
        } else { // not signed in, or someone else's public stuff only
          Wiki.scope({ method: ["userWikisPublic", user.id]}).all()
          .then((wikis) => {
            result["wikis"] = wikis;
            result["collaborators"] = []; // either do this here or put the logic in the view
            callback(null, result);
          })
          .catch((err) => {
            console.log(err);
            callback(err);
          }); 
        }
      }
    });
  },
  getAllUsers(callback) {
    return User.findAll({order: [Sequelize.literal('id ASC')]})
    .then((users) => {
      callback(null, users);
    })
    .catch((err) => {
      console.log(err)
      callback(err);
    });
  },
  /*
  deleteUser(req, callback) {
    return User.findById(req.params.id)

    .then((user) => {
      const authorized = new Authorizer(req.user, user).destroy();
      
      if(authorized) {
        user.destroy()
        .then((deletedRecordsCount) => {
          callback(null, deletedRecordsCount);
        });
      } else {
        req.flash("notice", "You are not authorized to do that.");
        callback(401, null);
      }
    })
    .catch((err) => {
      callback(err);
    });
  },
  */
  upgradeUser(req, callback) {
    return User.findById(req.params.id)
    .then((user) => {
      if(!user) {
        return callback(404);
      }
      // console.log(req.body);
      const stripeToken = req.body.stripeToken;
      const stripeEmail = req.body.stripeEmail;
      // const authorized = new Authorizer(req.user, user).update();
      
      // if(authorized) {
      var stripe = require("stripe")("sk_test_dXC7bshnFR7vw5BYfJ5DUCOU");

      const charge = stripe.charges.create({
        amount: 1500,
        currency: 'usd',
        source: stripeToken,
        receipt_email: stripeEmail,
        description: 'Upedia Premium Upgrade'
      }, function(err, charge) {
        user.update({
          role: 1
        })
        .then(() => {
          callback(null, user);
        })
        .catch((err) => {
          callback(err);
        });
      });
    })
    .catch((err) => {
      callback(err);
    });
  },
  downgradeUser(req, callback) {
    return User.findById(req.params.id)
    .then((user) => {
      if(!user) {
        return callback(404);
      }
      // const authorized = new Authorizer(req.user, user).update();
      
      // if(authorized) {

      user.update({
        role: 0
      })
      .then((user) => {
        // console.log(user);
        Wiki.update(
          { private: false },
          { where: { userId: user.id}}
        )
        .then(() => {
          // Let's collect all Collaborator objects where the associated
          // Wiki is owned by this here user that just downgraded
          Collaborator.findAll({
            where: {
              '$Wiki.userId$': user.id
            },
            include: [{
              model: Wiki
            }]
          })
          .then((collaborators) => {
            // Let's build our destroy function that returns a promise
            const destroyCollaborators = (collaborator) => {
              Collaborator.destroy({
                where: {
                  wikiId: collaborator.wikiId
                }
              })
            }
            // Let's build the async forEach function
            async function asyncForEach(array, callback) {
              for (let index = 0; index < array.length; index++) {
                await callback(array[index], index, array)
              }
            }
            // Let's do this.
            const start = async () => {
              await asyncForEach(collaborators, async (collaborator) => {
                await destroyCollaborators(collaborator)
              })
              console.log('Done')
            }
            start();
            // https://codeburst.io/javascript-async-await-with-foreach-b6ba62bbf404

            // We have now deleted all Collaborator objects associated with this user's
            // now downgraded-to-public Wikis.
            callback(null, user);
          })
          .catch((err) => {
            console.log(err);
            callback(err);
          });
        })
        .catch((err) => {
          console.log(err);

          callback(err);
        });
      })
      .catch((err) => {
        console.log(err);

        callback(err);
      });
    })
    .catch((err) => {
      console.log(err);

      callback(err);
    });
  }
}