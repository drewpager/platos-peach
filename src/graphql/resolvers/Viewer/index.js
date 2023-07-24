"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewerResolvers = void 0;
const api_1 = require("../../../lib/api");
const crypto_1 = __importDefault(require("crypto"));
const utils_1 = require("../../../lib/utils");
const stripe = require("stripe")(`${process.env.S_SECRET_KEY}`);
// When in production w/ HTTPS, add secure setting
const cookieOptions = {
    httpOnly: true,
    sameSite: true,
    signed: true,
    secure: process.env.NODE_ENV === "development" ? false : true,
    // domain: "localhost",
};
const logInViaGoogle = async (code, token, db, res) => {
    const { user } = await api_1.Google.logIn(code);
    if (!user) {
        throw new Error(`Failed to log in with Google!`);
    }
    const userNamesList = user.names && user.names.length ? user.names : null;
    const userPhotosList = user.photos && user.photos.length ? user.photos : null;
    const userEmailList = user.emailAddresses && user.emailAddresses.length
        ? user.emailAddresses
        : null;
    const userName = userNamesList ? userNamesList[0].displayName : null;
    const userId = userNamesList &&
        userNamesList[0].metadata &&
        userNamesList[0].metadata.source
        ? userNamesList[0].metadata.source.id
        : null;
    const userAvatar = userPhotosList && userPhotosList[0].url ? userPhotosList[0].url : null;
    const userEmail = userEmailList && userEmailList[0].value ? userEmailList[0].value : null;
    const existingUser = await db.users.findOne({ _id: userId?.toString() });
    const userPaymentId = existingUser ? `${existingUser.paymentId}` : null;
    if (!userName || !userId || !userAvatar || !userEmail) {
        throw new Error("Google Log In Error!");
    }
    const updateRes = await db.users.findOneAndUpdate({ _id: userId }, {
        $set: {
            token,
            name: userName,
            avatar: userAvatar,
            contact: userEmail,
            paymentId: userPaymentId,
            watched: [],
            playlists: [],
        },
    });
    let viewer = updateRes.value;
    if (!viewer) {
        try {
            const updateResponse = await db.users.insertOne({
                _id: userId,
                token,
                name: userName,
                avatar: userAvatar,
                contact: userEmail,
                paymentId: "undefined",
                watched: [],
                playlists: [],
            });
            viewer = await db.users.findOne({ _id: updateResponse.insertedId });
            if (viewer) {
                return viewer;
            }
        }
        catch (e) {
            throw new Error(`Failed with code: ${e}`);
        }
    }
    if (viewer) {
        res.cookie("viewer", userId, {
            ...cookieOptions,
            maxAge: 365 * 24 * 60 * 60 * 1000,
        });
    }
    else {
        throw new Error("Failed to return viewer object!");
    }
    return viewer;
};
const logInViaCookie = async (token, db, req, res) => {
    const updateCook = await db.users.findOneAndUpdate({ _id: req.signedCookies.viewer }, { $set: { token } });
    const viewer = updateCook.value;
    if (!viewer) {
        res.clearCookie("viewer", { ...cookieOptions });
    }
    else {
        return viewer;
    }
};
exports.viewerResolvers = {
    Query: {
        authUrl: () => {
            try {
                return api_1.Google.authUrl;
            }
            catch (err) {
                throw new Error(`Failed to authenticate with Google: ${err}`);
            }
        },
    },
    Mutation: {
        logIn: async (_root, { input }, { db, req, res }) => {
            try {
                const code = input ? input.code : null;
                const token = crypto_1.default.randomBytes(16).toString("hex");
                const viewer = code
                    ? await logInViaGoogle(code, token, db, res)
                    : await logInViaCookie(token, db, req, res);
                if (!viewer) {
                    return { didRequest: true };
                }
                return {
                    _id: viewer._id,
                    token: viewer.token,
                    avatar: viewer.avatar,
                    paymentId: viewer.paymentId,
                    didRequest: true,
                };
            }
            catch (error) {
                throw new Error(`Failed to log in: ${error}`);
            }
        },
        logOut: (_root, _args, { res }) => {
            try {
                res.clearCookie("viewer", { ...cookieOptions });
                return { didRequest: true };
            }
            catch (err) {
                throw new Error(`Failed to log out user: ${err}`);
            }
        },
        // addPayment: async (
        //   viewer: Viewer,
        //   { id }: PaymentArgs,
        //   { db }: { db: Database }
        // ): Promise<Viewer | string> => {
        //   const user = await db.users.findOne({ _id: `${viewer._id}` });
        //   const customer = await stripe.customers.search({
        //     query: `email:\'${user?.contact}\'`,
        //   });
        //   try {
        //     if (!!customer) {
        //       const customerPay = await db.users.findOneAndUpdate(
        //         { _id: `${viewer._id}` },
        //         { $set: { paymentId: `${customer.data[0].id}` } }
        //       );
        //       viewer.paymentId = customer.data[0].id;
        //       return customerPay.value ? `${viewer.paymentId}` : "undefined";
        //     }
        //     const userPay = await db.users.findOneAndUpdate(
        //       { _id: `${viewer._id}` },
        //       { $set: { paymentId: `${id}` } }
        //     );
        //     viewer.paymentId = id;
        //     return userPay.value ? `${id}` : "undefined";
        //   } catch (err) {
        //     throw new Error(`Error adding payment in Mutation: ${err}`);
        //   }
        // },
        // connectStripe: async (
        //   _root: undefined,
        //   { input }: ConnectStripeArgs,
        //   { db, req }: { db: Database; req: Request }
        // ): Promise<Viewer> => {
        //   try {
        //     const { code } = input;
        //     let viewer = await authorize(db, req);
        //     if (!viewer) {
        //       throw new Error(`Viewer cannot be found!`);
        //     }
        //     const wallet = await Stripe.connect(code);
        //     if (!wallet) {
        //       throw new Error("Stripe grant error");
        //     }
        //     const updateRes = await db.users.findOneAndUpdate(
        //       { _id: viewer._id },
        //       { $set: { paymentId: `${wallet}` } }
        //     );
        //     if (!updateRes) {
        //       throw new Error(`Failed to update user with payment information`);
        //     }
        //     viewer = updateRes.value;
        //     return {
        //       _id: viewer?._id,
        //       token: viewer?.token,
        //       avatar: viewer?.avatar,
        //       paymentId: wallet,
        //       didRequest: true,
        //     };
        //   } catch (e) {
        //     throw new Error(`Failed to connect with stripe: ${e}`);
        //   }
        // },
        disconnectStripe: async (_root, _args, { db, req }) => {
            try {
                let viewer = await (0, utils_1.authorize)(db, req);
                if (!viewer) {
                    throw new Error(`Failed to authorize viewer!`);
                }
                const updateRes = await db.users.findOneAndUpdate({ _id: viewer._id }, { $set: { paymentId: "undefined" } });
                if (!updateRes.value) {
                    throw new Error(`Viewer could not be updated`);
                }
                viewer = updateRes.value;
                return {
                    _id: viewer?._id,
                    token: viewer?.token,
                    avatar: viewer?.avatar,
                    paymentId: viewer?.paymentId,
                    didRequest: true,
                };
            }
            catch (e) {
                throw new Error(`Failed to disconnect Stripe: ${e}`);
            }
        },
    },
    Viewer: {
        id: (viewer) => {
            return viewer._id;
        },
        paymentId: (viewer) => {
            return viewer.paymentId ? viewer.paymentId : undefined;
        },
        playlists: async (viewer, { limit, page }, { db }) => {
            try {
                if (!viewer) {
                    return null;
                }
                const data = {
                    total: 0,
                    result: [],
                };
                let cursor = await db.playlists.find({
                    creator: { $in: [viewer && viewer._id ? viewer._id : "1010"] },
                });
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.total = await cursor.count();
                data.result = await cursor.toArray();
                return data;
            }
            catch (e) {
                throw new Error(`Failed to query user playlists: ${e}`);
            }
        },
    },
};
