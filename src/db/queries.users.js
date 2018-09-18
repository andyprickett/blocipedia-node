const User = require("./models").User;
const Wiki = require("./models").Wiki;
const bcrypt = require("bcryptjs");

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
  getUser(id, callback) {
    let result = {};
    User.findById(id)
    .then((user) => {
      if(!user) {
        callback(404);
      } else {
        result["user"] = user;

        Wiki.scope({ method: ["userWikis", id]}).all()
        .then((wikis) => {
          result["wikis"] = wikis;

          callback(null, result);
        })
        .catch((err) => {
          callback(err);
        });
      }
    });
  },
  getAllUsers(callback) {
    return User.all()
    .then((users) => {
      callback(null, users);
    })
    .catch((err) => {
      callback(err);
    });
  },
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
        description: 'Blocipedia Premium Upgrade'
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
      .then(() => {
        callback(null, user);
      })
      .catch((err) => {
        callback(err);
      });
    })
    .catch((err) => {
      callback(err);
    });
  }
}