"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userResolvers = void 0;
const utils_1 = require("../../../lib/utils");
const stripe = require("stripe")(`${process.env.S_SECRET_KEY}`);
exports.userResolvers = {
    Query: {
        user: async (_root, { id }, { db, req }) => {
            try {
                const user = await db.users.findOne({ _id: id });
                if (!user) {
                    throw new Error("User can't be found");
                }
                const viewer = await (0, utils_1.authorize)(db, req);
                if (viewer && viewer._id === user._id) {
                    user.authorized = true;
                }
                return user;
            }
            catch (error) {
                throw new Error(`Failed to query user: ${error}`);
            }
        },
        allUsers: async (_root, { page, limit }, { db }) => {
            const data = {
                total: 0,
                result: [],
                totalCount: 0,
            };
            let cursor = await db.users.find({});
            const count = cursor;
            cursor = cursor.skip(page > 1 ? (page - 1) * limit : 0);
            cursor = cursor.limit(limit);
            data.total = await cursor.count();
            data.result = await cursor.toArray();
            data.totalCount = await count.count();
            return data;
        },
    },
    User: {
        id: (user) => {
            return user._id;
        },
        paymentId: (user) => {
            return user.paymentId;
        },
        playlists: async (user, { limit, page }, { db }) => {
            try {
                // if (!user.authorized) {
                //   return null;
                // }
                const data = {
                    total: 0,
                    result: [],
                    totalCount: 0,
                };
                let cursor = await db.playlists.find({ creator: { $in: [user._id] } });
                const countTotal = await db.playlists.find({
                    creator: { $in: [user._id] },
                });
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.total = await cursor.count();
                data.result = await cursor.toArray();
                data.totalCount = await countTotal.count();
                return data;
            }
            catch (e) {
                throw new Error(`Failed to query user playlists: ${e}`);
            }
        },
        lessons: async (user, { limit, page }, { db }) => {
            try {
                const data = {
                    total: 0,
                    result: [],
                    totalCount: 0,
                };
                let cursor = await db.lessons.find({
                    creator: { $in: [user._id] },
                });
                const totalCount = await db.lessons.find({
                    creator: { $in: [user._id] },
                });
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.total = await cursor.count();
                data.result = await cursor.toArray();
                data.totalCount = await totalCount.count();
                // if (data.total === 0) {
                //   return null;
                // }
                return data;
            }
            catch (e) {
                throw new Error(`Failed to query user lessons: ${e}`);
            }
        },
        quizzes: async (user, { limit, page }, { db }) => {
            try {
                const data = {
                    total: 0,
                    result: [],
                    totalCount: 0,
                };
                let cursor = await db.quizzes.find({
                    creator: { $in: [user._id] },
                });
                const totalCount = await db.quizzes.find({
                    creator: { $in: [user._id] },
                });
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.total = await cursor.count();
                data.result = await cursor.toArray();
                data.totalCount = await totalCount.count();
                return data;
            }
            catch (e) {
                throw new Error(`Failed to query quizzes ${e}`);
            }
        },
        articles: async (user, { limit, page }, { db }) => {
            try {
                const data = {
                    total: 0,
                    result: [],
                    totalCount: 0,
                };
                let cursor = await db.articles.find({
                    creator: { $in: [user._id] },
                });
                const totalCount = await db.articles.find({
                    creator: { $in: [user._id] },
                });
                cursor = cursor.skip(page > 0 ? (page - 1) * limit : 0);
                cursor = cursor.limit(limit);
                data.total = await cursor.count();
                data.result = await cursor.toArray();
                data.totalCount = await totalCount.count();
                return data;
            }
            catch (e) {
                throw new Error(`Failed to query articles ${e}`);
            }
        },
        bookmarks: async (user, {}, { db }) => {
            try {
                const cursor = await db.users.distinct("bookmarks", {
                    _id: `${user._id}`,
                });
                return cursor;
            }
            catch (e) {
                throw new Error(`Failed to bookmark anything ${e}`);
            }
        },
        package: (user) => {
            return user.package;
        },
    },
    Mutation: {
        addPayment: async (_root, { id }, { db }) => {
            // const viewerId = "118302753872778003967";
            const viewerId = id;
            try {
                const userObj = await db.users.findOne({
                    _id: viewerId,
                });
                if (!userObj) {
                    throw new Error("User can't be found");
                }
                const contactEmail = userObj.contact;
                const customer = await stripe.customers.search({
                    query: `email:\'${contactEmail}\'`,
                });
                if (!customer) {
                    throw new Error("Customer can't be found");
                }
                if (customer.data.length === 0) {
                    const customerId = undefined;
                    const amount = 0;
                    const cadence = "N/A";
                    const status = "Inactive";
                    const since = 0;
                    const trial_end = 0;
                    const customerPay = await db.users.findOneAndUpdate({ _id: `${viewerId}` }, {
                        $set: {
                            paymentId: customerId,
                            package: {
                                amount: amount,
                                cadence: cadence,
                                status: status,
                                since: since,
                                trialEnd: trial_end,
                            },
                        },
                    });
                    return customerPay ? viewerId : "Payment details unavailable";
                }
                const subscriptions = await stripe.customers.retrieve(`${customer.data[0].id}`, {
                    expand: ["subscriptions"],
                });
                const amount = subscriptions.subscriptions.data[0].plan.amount;
                const cadence = subscriptions.subscriptions.data[0].plan.interval;
                const status = subscriptions.subscriptions.data[0].status;
                const since = subscriptions.subscriptions.data[0].created;
                const trial_end = subscriptions.subscriptions.data[0].trial_end;
                const customerId = customer?.data[0].id;
                const customerPay = await db.users.findOneAndUpdate({ _id: `${viewerId}` }, {
                    $set: {
                        paymentId: customerId,
                        package: {
                            amount: amount,
                            cadence: cadence,
                            status: status,
                            since: since,
                            trialEnd: trial_end,
                        },
                    },
                });
                return customerPay.value ? customerId : "undefined";
            }
            catch (err) {
                throw new Error(`Error adding payment in Mutation: ${err}`);
            }
        },
        deleteAllBookmarks: async (user, { id }, { db }) => {
            try {
                if (user?.bookmarks?.length === 0) {
                    throw new Error("No bookmarks to delete");
                }
                const deleteBookmarks = await db.users.findOneAndUpdate({ _id: `${id}` }, { $set: { bookmarks: [] } });
                return deleteBookmarks.ok
                    ? "Bookmarks deleted"
                    : "Failed to delete bookmarks";
            }
            catch (error) {
                throw new Error(`Failed to delete all bookmarks: ${error}`);
            }
        },
    },
};
