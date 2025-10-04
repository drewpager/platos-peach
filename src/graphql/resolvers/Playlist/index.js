"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playlistResolvers = void 0;
const mongodb_1 = require("mongodb");
exports.playlistResolvers = {
    Query: {
        playlist: async (_root, { id }, { db }) => {
            const playlist = await db.playlists.findOne({ _id: new mongodb_1.ObjectId(id) });
            if (!playlist) {
                throw new Error("Failed to find playlist!");
            }
            return playlist;
        },
        plan: async (_root, { title }, { db }) => {
            const regex = new RegExp(title, "i");
            const playlist = await db.playlists.findOne({ name: regex });
            if (!playlist) {
                throw new Error("Failed to find playlist!");
            }
            return playlist;
        },
        allplaylists: async (_root, { limit, page }, { db }) => {
            const data = {
                total: 0,
                result: [],
                totalCount: 0,
            };
            let cursor = await db.playlists.find({});
            cursor = cursor.skip(page > 1 ? (page - 1) * limit : 0);
            cursor = cursor.limit(limit);
            data.result = await cursor.toArray();
            data.total = data.result.length;
            data.totalCount = await db.playlists.countDocuments({});
            return data;
        },
    },
    Playlist: {
        id: (playlist) => {
            return playlist._id;
        },
        name: (playlist) => {
            return playlist.name;
        },
        level: (playlist) => {
            return playlist.level;
        },
        category: (playlist) => {
            return playlist.category;
        },
    },
    LessonPlanUnion: {
        __resolveType(obj, context, info) {
            if (obj.startDate) {
                return "Lesson";
            }
            if (obj.questions) {
                return "Quiz";
            }
            if (obj.content) {
                return "Article";
            }
            return null;
        },
    },
    Mutation: {
        lessonPlan: async (_root, { input, viewerId }, { db }) => {
            const id = new mongodb_1.ObjectId();
            try {
                const insertResult = await db.playlists.insertOne({
                    _id: id,
                    ...input,
                });
                const insertedResult = insertResult
                    ? await db.playlists.findOne({ _id: insertResult.insertedId })
                    : false;
                if (!insertedResult) {
                    throw new Error("Failed to insert new lesson plan!");
                }
                await db.users.updateOne({ _id: viewerId }, { $push: { playlists: insertedResult } });
                return insertedResult;
            }
            catch (e) {
                throw new Error(`Failed to insert lesson plan ${e}`);
            }
        },
        updatePlan: async (_root, { input, id }, { db }) => {
            const ide = new mongodb_1.ObjectId(id);
            try {
                const playlist = await db.playlists.findOneAndUpdate({ _id: ide }, {
                    $set: {
                        name: input.name,
                        plan: input.plan,
                        public: input.public,
                        premium: input.premium,
                        level: input.level,
                        category: input.category,
                    },
                });
                if (!playlist) {
                    throw new Error(`Playlist Database update failed`);
                }
                const upsertedResult = playlist
                    ? await db.playlists.findOne({ _id: ide })
                    : false;
                if (!upsertedResult) {
                    throw new Error(`Sorry, but I Failed to update this playlist!`);
                }
                return {
                    _id: upsertedResult._id,
                    name: upsertedResult.name,
                    plan: upsertedResult.plan,
                    creator: upsertedResult.creator,
                    public: upsertedResult.public,
                    authorized: true,
                    premium: upsertedResult.premium,
                    level: upsertedResult.level,
                    category: upsertedResult.category,
                };
            }
            catch (e) {
                throw new Error(`Failed to update playlist ${e}`);
            }
        },
        deletePlaylist: async (_root, { id }, { db }) => {
            try {
                const deletePlaylist = await db.playlists.deleteOne({
                    _id: new mongodb_1.ObjectId(id),
                });
                if (!deletePlaylist) {
                    throw new Error("Playlist deletion didn't work!");
                }
                return deletePlaylist.acknowledged;
            }
            catch (error) {
                throw new Error(`Failed to delete playlist: ${error}`);
            }
        },
        copyPlaylist: async (_root, { id, viewerId }, { db }) => {
            const newId = new mongodb_1.ObjectId();
            const playlist = await db.playlists.findOne({ _id: new mongodb_1.ObjectId(id) });
            const user = await db.users.findOne({ _id: viewerId });
            try {
                if (playlist) {
                    const insertResult = await db.playlists.insertOne({
                        _id: new mongodb_1.ObjectId(newId),
                        public: false,
                        premium: false,
                        creator: viewerId,
                        name: user
                            ? `${playlist.name} ${user?.name} copy`
                            : `${playlist.name} copy`,
                        plan: [...playlist.plan],
                        level: playlist.level,
                        category: playlist.category,
                    });
                    const insertedResult = insertResult
                        ? await db.playlists.findOne({ _id: insertResult.insertedId })
                        : false;
                    if (!insertedResult) {
                        throw new Error("Failed to insert new lesson plan!");
                    }
                    return insertedResult;
                }
            }
            catch (e) {
                throw new Error(`Failed to copy playlist: ${e}`);
            }
        },
        updatePlanPublic: async (_root, { id, publicStatus }, { db }) => {
            try {
                const pub = publicStatus ? false : true;
                const playlist = await db.playlists.findOneAndUpdate({ _id: new mongodb_1.ObjectId(id) }, { $set: { public: pub } });
                if (!playlist) {
                    throw new Error("Playlist update didn't work!");
                }
                return playlist.ok ? true : false;
            }
            catch (error) {
                throw new Error(`Failed to update playlist: ${error}`);
            }
        },
    },
};
