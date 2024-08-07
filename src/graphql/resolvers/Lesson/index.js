"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lessonResolvers = void 0;
const mongodb_1 = require("mongodb");
const graphql_1 = require("graphql");
const dateRegex = 
// /\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2]\d|3[0-1])|-[1-9]\d{0,11}|[1-9]\d{0,4}/
/\=(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2]\d|3[0-1])|-[1-9]\d{0,11}|[1-9]\d{0,4}|([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))|(Present)/;
const validate = (value) => {
    if (typeof value !== "string") {
        throw new Error(`Value is not a string ${value}`);
    }
    if (!dateRegex.test(value)) {
        throw new Error(`Value is not formatted as a date ${value}`);
    }
    return value;
};
const parseLiteral = (ast) => {
    if (ast.kind !== graphql_1.Kind.STRING) {
        throw new Error(`Query error: can only parse strings but got ${ast.kind}`);
    }
    return validate(ast.value);
};
const GraphQLDateConfig = {
    name: "DateScalar",
    description: "A valid date object",
    serialize: validate,
    parseValue: validate,
    parseLiteral,
};
const GraphQLDate = new graphql_1.GraphQLScalarType(GraphQLDateConfig);
const verifyCreateLessonInput = ({ title, category, meta, video, startDate, endDate, }) => {
    if (title.length > 160) {
        throw new Error("Title must not exceed 160 characters in length!");
    }
    if (category.length < 1) {
        throw new Error("Please add at least one category.");
    }
    if (!dateRegex.test(startDate)) {
        throw new Error("Please format date as Year-Month-Day (YYYY-MM-DD)");
    }
    if (!dateRegex.test(endDate)) {
        throw new Error("Please format date as Year-Month-Day (YYYY-MM-DD)");
    }
    if (meta.length < 1) {
        throw new Error("Please add a brief description to provide students with context about this lesson.");
    }
    if (video.length < 1) {
        throw new Error("Please add a video!");
    }
};
exports.lessonResolvers = {
    Query: {
        lesson: async (_root, { id }, { db }) => {
            const lesson = await db.lessons.findOne({ _id: new mongodb_1.ObjectId(id) });
            if (!lesson) {
                throw new Error("Lesson cannot be found!");
            }
            return lesson;
        },
        allLessons: async (_root, { page, limit }, { db }) => {
            const data = {
                total: 0,
                result: [],
                totalCount: 0,
            };
            let cursor = await db.lessons.find({});
            const count = cursor;
            cursor = cursor.skip(page > 1 ? (page - 1) * limit : 0);
            cursor = cursor.limit(limit);
            data.total = await cursor.count();
            data.result = await cursor.toArray();
            data.totalCount = await count.count();
            return data;
        },
        relatedPlans: async (_root, { id }, { db }) => {
            const related = await db.playlists
                .find({ public: true, plan: { $elemMatch: { _id: id } } })
                .limit(3);
            const cursor = await related.toArray();
            if (cursor.length === 0 || !cursor) {
                const anyPlaylists = await db.playlists
                    .find({ public: true })
                    .sort({ _id: -1 })
                    .limit(3);
                if (!anyPlaylists) {
                    throw new Error("Failed to query related plans");
                }
                return anyPlaylists.toArray();
                // throw new Error("Failed to query related plans");
            }
            return cursor;
        },
        lessonTitle: async (_root, { title }, { db }) => {
            const regex = new RegExp(title, "i");
            const lessonTitle = await db.lessons.findOne({ title: regex });
            if (!lessonTitle) {
                throw new Error("Failed to find lesson!");
            }
            return lessonTitle;
        },
    },
    Lesson: {
        id: (lesson) => {
            return lesson._id;
        },
        duration: (lesson) => {
            return lesson.duration;
        },
        // script: (lesson: Lesson) => {
        //   return lesson.script;
        // },
    },
    Playlist: {
        id: (playlist) => {
            return playlist._id;
        },
        // creator: async (
        //   playlist: Playlist,
        //   _args: Record<string, unknown>,
        //   { db, req }: { db: Database; req: Request }
        // ): Promise<string> => {
        //   try {
        //     const creator = await db.users.findOne({ _id: playlist.creator });
        //     if (!creator) {
        //       throw new Error("Creator can't be found!");
        //     }
        //     const viewer = await authorize(db, req);
        //     if (viewer && viewer._id === playlist.creator) {
        //       playlist.authorized = true;
        //     }
        //     return creator._id;
        //   } catch (err) {
        //     throw new Error(
        //       `You are either not the creator or not logged in: ${err}!`
        //     );
        //   }
        // },
    },
    Mutation: {
        createLesson: async (_root, { input }, { db }) => {
            const id = new mongodb_1.ObjectId();
            // const viewerId = viewer && viewer.id ? viewer.id : "116143759549242008910";
            try {
                verifyCreateLessonInput(input);
                const insertResult = await db.lessons.insertOne({
                    _id: id,
                    ...input,
                });
                const insertedResult = insertResult
                    ? await db.lessons.findOne({ _id: insertResult.insertedId })
                    : false;
                if (!insertedResult) {
                    throw new Error("Lesson is undefined");
                }
                await db.users.updateOne({ _id: `${input.creator}` }, { $push: { lessons: insertedResult } });
                return insertedResult;
            }
            catch (e) {
                throw new Error(`Failed to insert lesson: ${e}`);
            }
        },
        deleteLesson: async (viewer, { id }, { db }) => {
            try {
                const deletedLesson = await db.lessons.deleteOne({
                    _id: new mongodb_1.ObjectId(id),
                });
                if (!deletedLesson) {
                    throw new Error("Failed to delete lesson");
                }
                return deletedLesson.acknowledged;
            }
            catch (error) {
                throw new Error(`Failed to start deleting lesson: ${error}`);
            }
        },
        bookmarkLesson: async (_root, { id, viewer }, { db }) => {
            try {
                const data = await db.lessons.findOne({
                    _id: new mongodb_1.ObjectId(id),
                });
                const exists = await db.users.findOne({ _id: viewer });
                if (data &&
                    exists?.bookmarks
                        ?.map((lesson) => lesson["_id"].toString() === `${data._id}`)
                        .includes(true)) {
                    const unBookmark = await db.users.updateOne({ _id: viewer }, { $pull: { bookmarks: data } });
                    if (!unBookmark) {
                        throw new Error("Failed to unbookmark lesson!");
                    }
                    return unBookmark ? "unbookmarked" : "null";
                }
                else {
                    const bookmark = await db.users.updateOne({ _id: viewer }, { $push: { bookmarks: data } });
                    if (!bookmark) {
                        throw new Error("Failed to bookmark lesson!");
                    }
                    return bookmark ? "bookmarked" : "null";
                }
            }
            catch (error) {
                throw new Error(`Failed to bookmark lesson entirely: ${error}`);
            }
        },
    },
    DateScalar: GraphQLDate,
};
